#!/usr/bin/env node
/**
 * Lead-to-cash plan status checker.
 *
 * Usage (from repo root):
 *   node scripts/plan-status.mjs [dir]        default dir: docs/lead-to-cash
 *   node scripts/plan-status.mjs --json
 *
 * Reads every .md file in the folder and reports progress per phase.
 * Fails (exit code 1) when a rule in README section 1 is broken:
 *   R1  a ticked task has no "evidence:" text on its line
 *   R2  a ticked task still has unticked nested sub-steps
 *   R3  a ticked GATE-n while a task in phase n is unticked
 *   also: a task id appears twice
 *
 * Tasks are top-level checkbox lines whose text starts with **L2C-n-nn**,
 * **GATE-n**, or **Sn** (UAT scenarios). Phase membership comes from the
 * most recent heading of the form "## Phase N ...".
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dir = args.find((a) => !a.startsWith('--')) || path.join('docs', 'lead-to-cash');

if (!fs.existsSync(dir)) {
  console.error(`Folder not found: ${dir}`);
  process.exit(2);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const phases = new Map(); // phase number -> { tasks: [], gate: null }
const problems = [];
const seen = new Set();

const getPhase = (n) => {
  if (!phases.has(n)) phases.set(n, { tasks: [], gate: null });
  return phases.get(n);
};

for (const file of files) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/);
  let phase = null;
  let parent = null;

  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;

    const heading = line.match(/^##\s+Phase\s+(\d+)\b/);
    if (heading) {
      phase = Number(heading[1]);
      getPhase(phase);
      parent = null;
      return;
    }

    const box = line.match(/^(\s*)- \[( |x|X)\]\s+(.*)$/);
    if (!box) return;

    const indent = box[1].length;
    const done = box[2].toLowerCase() === 'x';
    const text = box[3];

    if (indent === 0) {
      const id = text.match(/^\*\*((?:L2C|GATE)-[\w-]+|S\d+)\*\*|^\*\*(S\d+)\s/);
      if (!id || phase === null) {
        parent = null;
        return;
      }
      const taskId = id[1] || id[2];
      if (seen.has(taskId)) problems.push(`${where} duplicate task id ${taskId}`);
      seen.add(taskId);

      const rec = { id: taskId, done, where, sub: [] };
      const p = getPhase(phase);
      if (taskId.startsWith('GATE-')) p.gate = rec;
      else p.tasks.push(rec);
      parent = rec;

      if (done && !/evidence:\s*\S/.test(text)) {
        problems.push(`${where} ${taskId} is ticked but has no "evidence:" text`);
      }
    } else if (parent) {
      parent.sub.push({ done, where });
    }
  });
}

const rows = [];
let totalDone = 0;
let totalAll = 0;

for (const [n, p] of [...phases.entries()].sort((a, b) => a[0] - b[0])) {
  const all = [...p.tasks, ...(p.gate ? [p.gate] : [])];

  for (const t of all) {
    const open = t.sub.filter((s) => !s.done).length;
    if (t.done && open > 0) {
      problems.push(`${t.where} ${t.id} is ticked but ${open} nested sub-step(s) are not`);
    }
  }

  const openTasks = p.tasks.filter((t) => !t.done);
  if (p.gate && p.gate.done && openTasks.length > 0) {
    problems.push(
      `${p.gate.where} GATE-${n} is ticked but ${openTasks.length} task(s) in phase ${n} are open (first: ${openTasks[0].id})`
    );
  }

  const done = all.filter((t) => t.done).length;
  const subTotal = all.reduce((s, t) => s + t.sub.length, 0);
  const subDone = all.reduce((s, t) => s + t.sub.filter((x) => x.done).length, 0);
  totalDone += done;
  totalAll += all.length;

  rows.push({
    phase: n,
    tasksDone: done,
    tasksTotal: all.length,
    subDone,
    subTotal,
    gate: p.gate ? (p.gate.done ? 'PASSED' : 'open') : 'missing',
    pct: all.length ? Math.round((done / all.length) * 100) : 0,
  });
}

if (asJson) {
  console.log(JSON.stringify({ rows, totalDone, totalAll, problems }, null, 2));
} else {
  console.log('Lead-to-cash plan status\n');
  console.log('Phase  Done/Total  Sub-steps   %    Gate');
  for (const r of rows) {
    console.log(
      `${String(r.phase).padStart(5)}  ${`${r.tasksDone}/${r.tasksTotal}`.padEnd(10)}  ${`${r.subDone}/${r.subTotal}`.padEnd(10)} ${String(r.pct).padStart(3)}%  ${r.gate}`
    );
  }
  const overall = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;
  console.log(`\nOverall: ${totalDone}/${totalAll} (${overall}%)`);

  const next = [...phases.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, p]) => ({ n, t: p.tasks.find((x) => !x.done) }))
    .find((x) => x.t);
  if (next) console.log(`Next open task: ${next.t.id} (${next.t.where})`);

  if (problems.length) {
    console.log(`\n${problems.length} rule violation(s):`);
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log('\nNo rule violations.');
  }
}

process.exit(problems.length ? 1 : 0);
