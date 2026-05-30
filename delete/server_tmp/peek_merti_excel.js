const ExcelJS=require('exceljs');
const fs=require('fs');
const path='C:/Amalgamate/Projects/TrensCORE/Merti';
const files=fs.readdirSync(path).filter(f=>f.toLowerCase().endsWith('.xlsx'));
(async()=>{
  for(const f of files){
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.readFile(path+'/'+f);
    const ws=wb.worksheets[0];
    const h=(ws.getRow(1).values||[]).slice(1);
    const r=(ws.getRow(2).values||[]).slice(1);
    console.log('\n=== '+f+' ===');
    console.log('Headers:', JSON.stringify(h));
    console.log('Row2:', JSON.stringify(r));
  }
})().catch(e=>{console.error(e); process.exit(1);});
