const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres:postgres@localhost:5432/zawadi_sms?schema=public"
      }
    }
  });

  const FILE_PATH = 'c:/Amalgamate/Projects/Zawadi SMS/data/Fee_Collection_Score_-_Term_1__2026__04-08-2026_.xlsx';
  console.log('🚀 Starting surgical data correction from Excel source on LOCAL DB...');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE_PATH);
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow((row, n) => {
    if (n <= 2) return; // skip headers
    const vals = row.values.slice(1);
    const admNo = String(vals[2] || '').trim().replace('.0', '');
    if (admNo) {
      rows.push({
        admNo,
        name: vals[1],
        totalBilled: Number(vals[6]) || 0,
        balance: Number(vals[7]) || 0,
        paid: Number(vals[8]) || 0
      });
    }
  });

  console.log(`Parsed ${rows.length} students from Excel. Updating local database...`);

  let updated = 0;
  for (const row of rows) {
    const invoice = await prisma.feeInvoice.findFirst({
      where: {
        invoiceNumber: `INV-2026-MIGR-${row.admNo}`
      }
    });

    if (invoice) {
      const expectedBal = row.totalBilled - row.paid;
      await prisma.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount: row.totalBilled,
          paidAmount:  row.paid,
          balance:     expectedBal
        }
      });
      updated++;
    }
  }

  console.log(`✅ Success! Performed surgical correction on ${updated} local invoices.`);
  await prisma.$disconnect();
}

run().catch(console.error);
