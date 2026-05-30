const ExcelJS=require('exceljs');
const fs=require('fs');
const path='C:/Amalgamate/Projects/TrensCORE/Merti';
const files=fs.readdirSync(path).filter(f=>f.toLowerCase().endsWith('.xlsx')).sort();
(async()=>{
  for(const f of files){
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.readFile(path+'/'+f);
    const ws=wb.worksheets[0];
    console.log('\n=== '+f+' ===');
    for(let i=1;i<=30;i++){
      const v=(ws.getRow(i).values||[]).slice(1).map(x=>String(x??'').trim());
      if(v.join('')!=='') console.log(i+': '+JSON.stringify(v));
    }
  }
})().catch(e=>{console.error(e); process.exit(1);});
