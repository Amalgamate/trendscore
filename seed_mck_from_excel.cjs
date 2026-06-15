#!/usr/bin/env node
// seed_mck_from_excel.cjs
// Reads directly from MCK data folder Excel files and seeds remaining grades
// Grades: Grade 3A, Grade 4B, Playgroup A (re-seed), M.C.K HIGHWAY (PP1)

const xlsx = require('xlsx');
const path = require('path');
const fs   = require('fs');

const MCK_DIR = path.join(__dirname, 'data', 'MCK');
const BASE    = 'https://mck.trendscore.co.ke/api';
const EMAIL   = 'admin@trendscore.app';
const PASS    = 'Admin@123!';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let cookies = '', bearer = '';

async function api(method, p, body, retries = 3) {
  const h = { 'Content-Type': 'application/json' };
  if (cookies) h['Cookie'] = cookies;
  if (bearer)  h['Authorization'] = 'Bearer ' + bearer;
  const res = await fetch(BASE + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) { const e = sc.map(c => c.split(';')[0]).join('; '); cookies = cookies ? cookies + '; ' + e : e; }
  const json = await res.json().catch(() => ({}));
  if (res.status === 429 && retries > 0) { console.log('429 – waiting 12s...'); await sleep(12000); return api(method, p, body, retries - 1); }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// ── Name helpers ──────────────────────────────────────────────────────────────
const norm = s => s.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
function sim(a, b) {
  const wa = norm(a).split(' '), wb = norm(b).split(' ');
  let h = 0;
  for (const w of wa) {
    if (wb.some(x => x === w
      || (w.length >= 5 && x.startsWith(w.slice(0, 5)))
      || (x.length >= 5 && w.startsWith(x.slice(0, 5))))) h++;
  }
  return h / Math.max(wa.length, wb.length);
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
function parseExcel(file) {
  const wb = xlsx.readFile(path.join(MCK_DIR, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i].some(c => c && /name/i.test(String(c)))) { headerIdx = i; break; }
  }
  const header = rows[headerIdx] || rows[0];
  const data = rows.slice(headerIdx + 1).filter(r =>
    r && r[0] && String(r[0]).trim().length > 1 &&
    !/^(mean|rank|sub|position|total|average|subject)/i.test(String(r[0]).trim())
  );
  return { header, data };
}

// ── Core seed function ────────────────────────────────────────────────────────
async function seedGrade({ label, gradeCode, file, colMap, laMap }) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(` ${label}`);
  console.log(`${'═'.repeat(62)}`);

  // Parse Excel
  const { header, data: students } = parseExcel(file);
  console.log(`Excel: ${students.length} rows | Header: ${JSON.stringify(header)}`);

  // Fetch tests
  const tRes = await api('GET', `/assessments/tests?grade=${gradeCode}&term=TERM_2&testType=OPENER&academicYear=2026`);
  const tests = tRes.data || tRes.tests || tRes || [];
  for (const t of tests) t._name = (laMap.get(t.learningAreaId) || '').toLowerCase();
  console.log(`Tests (${tests.length}): ${tests.map(t => t._name).join(', ')}`);

  if (!tests.length) { console.warn('  ⚠ No tests found — skipping'); return; }

  // Fetch learners
  const lRes = await api('GET', `/learners?grade=${gradeCode}&limit=300`);
  const learners = lRes.data || lRes.learners || lRes || [];
  console.log(`DB learners: ${learners.length}`);

  // Match names one-to-one
  const usedIds = new Set();
  const matched = [], unmatched = [];
  for (const row of students) {
    const name = String(row[0]).trim();
    let best = null, bs = 0;
    for (const l of learners) {
      if (usedIds.has(l.id)) continue;
      const full = `${l.firstName} ${l.lastName}`.trim();
      const s = sim(name, full);
      if (s > bs) { bs = s; best = { ...l, _full: full }; }
    }
    if (best && bs >= 0.5) {
      usedIds.add(best.id);
      matched.push({ row, learner: best });
      const flag = bs < 1 ? ' ⚠' : '';
      console.log(`  ✓ "${name}" → "${best._full}" (${(bs*100).toFixed(0)}%)${flag}`);
    } else {
      unmatched.push(name);
      console.warn(`  ✗ "${name}" — NO MATCH (best: ${best?._full || 'none'} @ ${((bs||0)*100).toFixed(0)}%)`);
    }
  }
  if (unmatched.length) console.warn(`\n  Unmatched (${unmatched.length}): ${unmatched.join(', ')}`);

  // Submit per subject
  console.log('\n  Submitting marks...');
  for (const { col, label: subjLabel, kw } of colMap) {
    const test = tests.find(t => kw.some(k => t._name.includes(k)));
    if (!test) { console.warn(`  ${subjLabel}: NO TEST (kw: ${kw.join(', ')}) — available: ${tests.map(t => t._name).join(' | ')}`); continue; }
    const results = matched
      .filter(m => m.row[col] != null && !isNaN(m.row[col]))
      .map(m => ({ learnerId: m.learner.id, marksObtained: Number(m.row[col]) }));
    process.stdout.write(`  ${subjLabel.padEnd(10)} (${test._name.slice(0,25)}) → `);
    try {
      const res = await api('POST', '/assessments/summative/results/bulk', { testId: test.id, results });
      const saved   = res.data?.saved ?? res.saved ?? results.length;
      const skipped = Array.isArray(res.data?.skipped ?? res.skipped) ? (res.data?.skipped ?? res.skipped) : [];
      console.log(`saved:${saved} skipped:${skipped.length}`);
    } catch(e) { console.error(`ERROR: ${e.message.slice(0, 100)}`); }
    await sleep(2500);
  }
  console.log(`  Matched ${matched.length}/${students.length}`);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
const lr = await api('POST', '/auth/login', { email: EMAIL, password: PASS });
bearer = lr.token || lr.data?.token || '';
console.log('Logged in ✓');

const laRes = await api('GET', '/learning-areas');
const laMap = new Map((laRes.data || laRes.learningAreas || laRes).map(la => [la.id, la.name || '']));
console.log(`Learning areas: ${laMap.size}`);


// ─── 1. GRADE 3A ─────────────────────────────────────────────────────────────
await seedGrade({
  label: 'GRADE 3A — Opener Term 2 2026',
  gradeCode: 'GRADE_3',
  file: 'GRD 3 A TERM 2 OPENER_021045.xlsx',
  laMap,
  colMap: [
    { col: 1, label: 'MATH',  kw: ['math'] },
    { col: 2, label: 'ENG',   kw: ['english'] },
    { col: 3, label: 'KISW',  kw: ['kiswahili', 'kisw'] },
    { col: 4, label: 'ENV',   kw: ['environ'] },
    { col: 5, label: 'C/A',   kw: ['creative', 'art'] },
    { col: 6, label: 'CRE',   kw: ['religious', 'christian'] },
  ],
});
await sleep(4000);

// ─── 2. GRADE 4B ─────────────────────────────────────────────────────────────
// Grade 4B students are in GRADE_4 in the DB (same pool as 4A)
// The 4A students were already matched; 4B students should be unmatched by 4A
// Run with fresh match (no usedIds carry-over between seedGrade calls)
await seedGrade({
  label: 'GRADE 4B — Opener Term 2 2026',
  gradeCode: 'GRADE_4',
  file: 'GRADE 4B.xlsx',
  laMap,
  colMap: [
    { col: 1, label: 'MATH',  kw: ['math'] },
    { col: 2, label: 'ENG',   kw: ['english'] },
    { col: 3, label: 'KISW',  kw: ['kiswahili', 'kisw'] },
    { col: 4, label: 'SCI',   kw: ['science'] },
    { col: 5, label: 'AGRI',  kw: ['agri'] },
    { col: 6, label: 'SST',   kw: ['social'] },
    { col: 7, label: 'CRE',   kw: ['religious', 'christian'] },
    { col: 8, label: 'C/A',   kw: ['creative', 'art'] },
  ],
});
await sleep(4000);

// ─── 3. PLAYGROUP A ───────────────────────────────────────────────────────────
await seedGrade({
  label: 'PLAYGROUP A — Opener Term 2 2026',
  gradeCode: 'PLAYGROUP',
  file: 'PG A...TERM 2 OPENER EXAM_021143.xlsx',
  laMap,
  colMap: [
    { col: 1, label: 'MATH',  kw: ['math'] },
    { col: 2, label: 'LANG',  kw: ['language'] },
    { col: 3, label: 'C/A',   kw: ['creative', 'art'] },
    { col: 4, label: 'ENV',   kw: ['environ'] },
    { col: 5, label: 'LIT',   kw: ['pastoral', 'ppi', 'literacy', 'religious'] },
  ],
});
await sleep(4000);

// ─── 4. M.C.K HIGHWAY (PP1) ──────────────────────────────────────────────────
await seedGrade({
  label: 'M.C.K HIGHWAY (PP1) — Opener Term 2 2026',
  gradeCode: 'PP1',
  file: 'M.C.K HIGHWAY A-WPS Office.xlsx',
  laMap,
  colMap: [
    { col: 1, label: 'MATHS', kw: ['math'] },
    { col: 2, label: 'LANG',  kw: ['language'] },
    { col: 3, label: 'READ',  kw: ['pastoral', 'ppi'] },
    { col: 4, label: 'ENV',   kw: ['environ', 'religious'] },
    { col: 5, label: 'C/A',   kw: ['creative', 'art'] },
  ],
});

console.log('\n\n✔  ALL DONE!');
})().catch(console.error);
