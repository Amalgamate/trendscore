// scan_mck_files.cjs — scan all Excel files in data/MCK and print structure
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const MCK_DIR = path.join(__dirname, 'data', 'MCK');

const files = fs.readdirSync(MCK_DIR).filter(f => f.endsWith('.xlsx'));
console.log(`Found ${files.length} xlsx files:\n`);

for (const file of files) {
  const wb = xlsx.readFile(path.join(MCK_DIR, file));
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (the one with NAME or student names)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(c => c && String(c).toUpperCase().includes('NAME'))) {
      headerIdx = i;
      break;
    }
  }

  const header = headerIdx >= 0 ? rows[headerIdx] : rows[0];
  const dataRows = rows.slice(headerIdx >= 0 ? headerIdx + 1 : 1).filter(r => r && r[0] && String(r[0]).trim().length > 1 && isNaN(r[0]));

  console.log(`=== ${file} ===`);
  console.log(`  Sheet: ${sheetName}`);
  console.log(`  Header (row ${headerIdx}): ${JSON.stringify(header)}`);
  console.log(`  Data rows: ${dataRows.length}`);
  if (dataRows.length > 0) {
    console.log(`  First row: ${JSON.stringify(dataRows[0])}`);
    console.log(`  Last row:  ${JSON.stringify(dataRows[dataRows.length - 1])}`);
  }
  console.log('');
}
