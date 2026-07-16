const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { PrismaClient, TestStatus, ModerationStatus, AssessmentStatus, CurriculumType, SummativeTestType } = require('@prisma/client');

const prisma = new PrismaClient();
const sourceDir = process.env.MCK_SOURCE_DIR || '/tmp/mck-scores';
const YEAR = 2026;
const TERM = 'TERM_2';
const TYPE = 'MID_TERM';
const files = [
  ['1B_014939.xlsx', 'Sheet1', 'GRADE_1'], ['G4A  Midterm term2 2026.xlsx', '4A', 'GRADE_4'],
  ['GRADE 2B RESULTS.xlsx', 'Sheet1', 'GRADE_2'], ['GRADE 3AMID TERM EXAM_024959.xlsx', 'Sheet1', 'GRADE_3'],
  ['GRADE 6 TERM 2MID RESULTS.xlsx', 'Sheet1', 'GRADE_6'], ['MID-TERM EXAM.xlsx', 'Sheet1', 'PLAYGROUP'],
  ['P.G (B)MIDTERM 2ND TERM EXAM RESULTS.xlsx', 'Sheet1', 'PLAYGROUP'],
  ['PP1 B  MIDTERM EXAMS (1) (1) (2).xlsx', 'Sheet1', 'PP1'], ['PP2 (B) MIDTERM EXAM.xlsx', 'Sheet2', 'PP2'],
];
const primary = { MATH:'Mathematical Activities', MATHS:'Mathematical Activities', ENG:'English', ENGLISH:'English', KISW:'Kiswahili', KISWA:'Kiswahili', ENV:'Environmental Activities', ENVIR:'Environmental Activities', SCIE:'Science and Technology', SCI:'Science and Technology', 'S/S':'Social Studies', AGR:'Agriculture', 'C/A':'Creative Activities', 'C/ART':'Creative Activities', 'C/ARTS':'Creative Activities', CRE:'Religious Education', 'C .R. E':'Religious Education', 'C. R. E':'Religious Education' };
const preprimary = { MATH:'Mathematical Activities', MATHS:'Mathematical Activities', LANG:'Language Activities', LANGU:'Language Activities', LANGUAGE:'Language Activities', READ:'Language Activities', READING:'Language Activities', ENV:'Environmental Activities', ENVIRO:'Environmental Activities', ENVIR:'Environmental Activities', 'I. L.A':'Environmental Activities', INTERGRATED:'Environmental Activities', CREAT:'Creative Activities', 'C/ART':'Creative Activities', 'C/ARTS':'Creative Activities', REL:'Religious Activities', CRE:'Religious Activities', 'C. R. E':'Religious Activities', KISWA:'Kiswahili', KUSOMA:'Kiswahili' };
const norm = (v) => String(v?.text ?? v?.result ?? v ?? '').replace(/[\s\u00a0]+/g, ' ').trim().toUpperCase();
const text = (v) => String(v?.text ?? v?.result ?? v ?? '');
const metadata = new Set(['NAME','NAMES','S/N','SN','NO','NO.','TOTAL','TOTALS','TOTAL SCORES','AVERAGE','MEAN','MEAN SCORE','MEAN SCORES','SUB RANK','SUB-RANK','POSITION','POS','POST']);
const reviewedMatches = new Map([
  ['GRADE_1|SARAH JEISO','SARA JESSO'], ['GRADE_1|HALIMA ABDIRIZACK','HALIMA ABDIRIZAK'], ['GRADE_1|AIPHA WAITHERU','ALPHA WAITHERU'], ['GRADE_1|RAY DICKSON','ROY DIKSON'], ['GRADE_1|GHALTU GALGALO','CHALTU GALALO'], ['GRADE_1|IBRAHIM MOHAMMED','IBRAHIM MOHAMED'], ['GRADE_1|SAMUEL KIRIMI','SAMWEL KIRIMI'], ['GRADE_1|WILDAH MAKENA','WILDA MAKENA'], ['GRADE_1|FEISAL JAMAL','FAISAL JAMAL'], ['GRADE_1|PRINCESS WANJIKU','PRINCES WANJIKU'], ['GRADE_1|ALIANA KANANA','ALINA KANANA'], ['GRADE_1|ONESMUS BOSOO','ONESMUS BOOSO'],
  ['GRADE_1|ASMAHAN MOHAMMED','ASMAHAN MOHAMED'], ['GRADE_1|SAFWAN','SAFWAN ABDIRAHAMAN'],
  ['GRADE_2|EMMANUEL KIPLAGAT',"EMMANUEL KIPLANG'AT"], ['GRADE_2|HUSSEIN ABUDULAHI','HUSSEIN ABDULLAHI'], ['GRADE_2|FREDRICK MSEE','FREDRICK MUSEE'], ['GRADE_2|EMISION QURESH','EMISON QURESH'], ['GRADE_2|HADJA RASHID','HADIJA RASHID'], ['GRADE_2|BAHALA ABDISALAN','BAHAJA ABDISALAM'], ['GRADE_2|ARHAM AHMED','ARHAAM AHMED'], ['GRADE_2|CASEY NJAMBI','CASSEY NJAMBI'], ['GRADE_2|SHABAN YUSSOF','SHABAN YUSUF'], ['GRADE_2|SHUKRAN HUSSEIN','SHUKRANI HUSSEIN'],
  ['GRADE_4|ZILHAN MOHAMMED','ZILHAN MOHAMED'], ['GRADE_4|MOHAMUD IDRIS','MOHAMED IDRIS'], ['GRADE_4|HAWO ILYASA','HAWO ELIYAS'], ['GRADE_4|NAJMA MOHAMMED','NAJMA MOHAMED'], ['GRADE_4|AMAYA CHEPCHUMBA','AMIA CHEPCHUMBA'], ['GRADE_4|MISBAH KOKO','MISBAN KOKO'], ['GRADE_4|MOHAMMED ABDIRIZACK','MOHAMMED ABDIRIZAK'], ['GRADE_4|DARMI MOHAMMED','DARMI MOHAMED'], ['GRADE_4|ZEINAB SALAN','ZEINAB SALAD'],
  ['GRADE_6|NICOLE EKWAM','NICOLE EKUAM'], ['GRADE_6|SANGAB MOHAMMED','SANGAB MOHAMED'],
  ['PLAYGROUP|EMMANUEL MWENDA','EMMANUEL MWENDWA'],
  ['PP1|JOSLYN KADZO','JOSYLIYN KADZO'], ['PP1|MAXWEL NDIRATHI','MAXWELL NDARATHI'], ['PP1|ASHWAG AHMED','ASHWAAQ AHMED'], ['PP1|NORAH NASIAE','NORAH NAISIAE'], ['PP1|BRAIDEN MBWORI','BRAYDEN MBWORI'], ['PP1|HUMPHREY MWANGI','HAMPREY MWANGI'],
  ['PP2|IDALIA GADIO','IDALIA GODIE'], ['PP2|ABDULLAHI AHMED','ABDULAHI AHMED'], ['PP2|NAJRA ABDINASIR','NAJIRA ABDINASIR'], ['PP2|UMLKHEIR ALI','UMULKHEIR ALI'], ['PP2|MAMO BARILE','MAMO BALILE'], ['PP2|YAKUB ABDULLAHI','YAQUB ABDULLAHI'], ['PP2|VILLAN MWENDA','VILAN MWENDA'],
]);

async function parse(filename, sheet, grade) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(sourceDir, filename));
  const ws = wb.getWorksheet(sheet); if (!ws) throw new Error(`${filename}: missing ${sheet}`);
  const rows=[]; ws.eachRow({includeEmpty:true}, (r,n)=>rows.push({n,v:r.values.slice(1)}));
  let header=rows.find(r=>{const j=r.v.map(norm).join(' ');return (j.includes('NAME')||j.includes('NAMES'))&&(j.includes('MATH')||j.includes('ENG')||j.includes('LANG')||j.includes('KISW'));});
  if(!header && filename.startsWith('PP1 B')) header=rows.find(r=>{const j=r.v.map(norm).join(' ');return j.includes('MATH')&&j.includes('LANG')&&j.includes('READ');});
  if(!header) throw new Error(`${filename}: header not found`);
  let nameIndex=header.v.findIndex(v=>['NAME','NAMES'].includes(norm(v))); if(nameIndex<0) nameIndex=1;
  const headers=header.v.map(norm);
  return rows.filter(r=>r.n>header.n).map(r=>({name:text(r.v[nameIndex]).trim(),scores:headers.map((h,i)=>({h,i,score:Number(r.v[i])})).filter(x=>!metadata.has(x.h)&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100)})).filter(x=>x.name&& !['TOTAL','TOTALS','TOTAL SCORES','AVERAGE','MEAN','MEAN SCORE','MEAN SCORES','SUB RANK','SUB-RANK','POSITION'].includes(norm(x.name))).map(x=>({ ...x, grade }));
}
function subjectFor(grade, header) {
  const h=norm(header); const base=['PLAYGROUP','PP1','PP2'].includes(grade) ? preprimary[h] : primary[h];
  let subject=base || h; if(!['PLAYGROUP','PP1','PP2'].includes(grade)){if(subject==='Mathematical Activities')subject='Mathematics';if(subject==='Creative Activities')subject='Creative Arts';}
  const component=['READ','READING'].includes(h)?'Reading':['KUSOMA'].includes(h)?'Kusoma':['LANG','LANGU','LANGUAGE'].includes(h)?'Language':null;
  return {subject,component};
}
async function main(){
  const schools=await prisma.school.findMany({select:{name:true}}); if(!schools.some(s=>/MCK/i.test(s.name))) throw new Error(`Wrong database: ${schools.map(s=>s.name).join(', ')}`);
  const admin=await prisma.user.findFirst({where:{role:{in:['ADMIN','SUPER_ADMIN']},archived:false},select:{id:true}}); if(!admin) throw new Error('No active administrator');
  const learners=await prisma.learner.findMany({where:{archived:false},select:{id:true,firstName:true,middleName:true,lastName:true,grade:true,stream:true}});
  const index=new Map(); for(const l of learners){for(const key of new Set([norm([l.firstName,l.middleName,l.lastName].filter(Boolean).join(' ')),norm(`${l.firstName} ${l.lastName}`)])){if(!key) continue; const composite=`${l.grade}|${key}`;const list=index.get(composite)||[];list.push(l);index.set(composite,list);}}
  const areas=await prisma.learningArea.findMany({select:{id:true,name:true,gradeLevel:true}});
  const tests=await prisma.summativeTest.findMany({where:{term:TERM,academicYear:YEAR,testType:TYPE,archived:false}});
  const report={imported:0,updated:0,createdTests:0,skippedLearners:[],skippedScores:[]};
  for(const [filename,sheet,grade] of files){for(const row of await parse(filename,sheet,grade)){const mappedName=reviewedMatches.get(`${grade}|${norm(row.name)}`); const matches=index.get(`${grade}|${mappedName ? norm(mappedName) : norm(row.name)}`)||[]; if(matches.length!==1){report.skippedLearners.push({filename,name:row.name,grade,matches:matches.length});continue;} const learner=matches[0];
    for(const item of row.scores){let {subject,component}=subjectFor(grade,item.h); if(!subject && grade==='GRADE_6' && item.i===2) subject='Mathematics'; if(!subject){report.skippedScores.push({filename,name:row.name,header:item.h,reason:'unmapped subject'});continue;}
      let title=component?`Term 2 Midterm - ${component}`:`Targeter wings 005 - ${subject} - MID_TERM - TERM_2 2026`;
      let test=tests.find(t=>t.grade===grade&&t.learningArea===subject&&t.title===title);
      if(!test && component){test=tests.find(t=>t.grade===grade&&t.learningArea===subject&&t.title===`Term 2 Midterm - ${component}`);}
      if(!test){const area=areas.find(a=>a.gradeLevel===grade&&norm(a.name)===norm(subject))||areas.find(a=>norm(a.name)===norm(subject));test=await prisma.summativeTest.create({data:{title,learningArea:subject,term:TERM,academicYear:YEAR,grade,testDate:new Date(),totalMarks:100,passMarks:40,createdBy:admin.id,published:true,active:true,status:AssessmentStatus.PUBLISHED,curriculum:CurriculumType.CBC_AND_EXAM,testType:SummativeTestType.MID_TERM,learningAreaId:area?.id}});tests.push(test);report.createdTests++;}
      const existing=await prisma.summativeResult.findUnique({where:{testId_learnerId:{testId:test.id,learnerId:learner.id}},select:{id:true}});
      await prisma.summativeResult.upsert({where:{testId_learnerId:{testId:test.id,learnerId:learner.id}},update:{marksObtained:item.score,percentage:item.score,recordedBy:admin.id},create:{testId:test.id,learnerId:learner.id,marksObtained:item.score,percentage:item.score,grade:item.score>=80?'A':item.score>=60?'B':item.score>=50?'C':item.score>=40?'D':'E',status:item.score>=40?TestStatus.PASS:TestStatus.FAIL,recordedBy:admin.id,moderationStatus:ModerationStatus.APPROVED}}); report[existing?'updated':'imported']++;}
  }}
  console.log(JSON.stringify({
    imported: report.imported,
    updated: report.updated,
    createdTests: report.createdTests,
    reviewedMappings: reviewedMatches.size,
    skippedLearners: report.skippedLearners.length,
    skippedScores: report.skippedScores.length,
    skippedLearnerExamples: report.skippedLearners.slice(0, 20),
    skippedScoreExamples: report.skippedScores.slice(0, 20),
  },null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
