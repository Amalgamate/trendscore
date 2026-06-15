// read_mck_full.cjs — dump full parsed data from each MCK Excel file
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const MCK_DIR = path.join(__dirname, 'data', 'MCK');

function parseFile(file) {
  const wb = xlsx.readFile(path.join(MCK_DIR, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(c => c && /name/i.test(String(c)))) {
      headerIdx = i;
      break;
    }
  }
  const header = rows[headerIdx] || rows[0];
  const dataRows = rows.slice(headerIdx + 1).filter(r =>
    r && r[0] && String(r[0]).trim().length > 1 && !/^(mean|rank|sub|position|total|average)/i.test(String(r[0]).trim())
  );
  return { header, dataRows };
}

const targets = [
  'GRD 3 A TERM 2 OPENER_021045.xlsx',
  'GRADE 4B.xlsx',
  'M.C.K HIGHWAY A-WPS Office.xlsx',
  'PG A...TERM 2 OPENER EXAM_021143.xlsx',
];

for (const file of targets) {
  const { header, dataRows } = parseFile(file);
  console.log(`\n=== ${file} ===`);
  console.log(`HEADER: ${JSON.stringify(header)}`);
  console.log(`ROWS (${dataRows.length}):`);
  for (const r of dataRows) {
    console.log(JSON.stringify(r));
  }
}
