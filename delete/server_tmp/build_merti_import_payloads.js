const ExcelJS = require('exceljs');
const fs = require('fs');
const path = 'C:/Amalgamate/Projects/TrensCORE/Merti';
const files = fs.readdirSync(path).filter(f => f.toLowerCase().endsWith('.xlsx')).sort();
function cleanText(v){ return String(v ?? '').replace(/\s+/g,' ').trim(); }
function parseGradeFromCells(cells){
  for(const c of cells){
    const m = cleanText(c).match(/GRADE\s*(\d+)/i);
    if(m) return { num:Number(m[1]), code:`GRADE_${Number(m[1])}` };
  }
  return null;
}
function parseTeacher(line){
  const raw = cleanText(line).replace(/^CLASS\s*TEACHER\s*[:;]?/i,'').trim();
  const name = raw.replace(/^(MR|MRS|MS|MD|TR)\.?\s+/i,'').trim();
  const p=name.split(' ').filter(Boolean); return { fullName:name, firstName:p.shift()||'Teacher', lastName:p.join(' ')||'Staff' };
}
function normPhone(phone){ const d=cleanText(phone).replace(/\D/g,''); if(!d) return ''; if(d.startsWith('254')) return `+${d.slice(0,12)}`; if(d.startsWith('0')) return `+254${d.slice(1,10)}`; if(d.length===9) return `+254${d}`; return `+${d}`; }
function normEmail(email){ let e=cleanText(email).toLowerCase().replace(/^email\s*[:;]?/i,'').replace(/\s+/g,'').replace(/"/g,'').replace(/\\/g,'').replace(/\.come$/i,'.com'); if(!e.includes('@')&&/gmail\.com$/i.test(e)) e=e.replace('gmail.com','@gmail.com'); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)?e:''; }
function parseStudentName(raw){ const t=cleanText(raw).replace(/\s+/g,' '); if(!t) return null; if(/^(class teacher|phone|phno|email|grade|names)/i.test(t)) return null; const p=t.split(' ').filter(Boolean); if(!p.length) return null; const first=p.shift(); const last=p.join(' ')||'STUDENT'; return {firstName:first.toUpperCase(), lastName:last.toUpperCase()}; }
(async()=>{
  const learners=[], tutors=[]; let learnerSeq=1, tutorSeq=1;
  for(const f of files){
    const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(`${path}/${f}`); const ws=wb.worksheets[0];
    const row1=(ws.getRow(1).values||[]).slice(1); const grade=parseGradeFromCells(row1); if(!grade) continue;
    const row2=(ws.getRow(2).values||[]).slice(1).map(cleanText).filter(Boolean); const line2=row2.join(' ');
    const row3=(ws.getRow(3).values||[]).slice(1).map(cleanText).filter(Boolean); const line3=row3.join(' ');
    const row4=(ws.getRow(4).values||[]).slice(1).map(cleanText).filter(Boolean); const line4=row4.join(' ');
    const t=parseTeacher(line2); const phone=normPhone(line3||line4); const email=normEmail(/email/i.test(line3)?line3:line4) || `teacher.${String(tutorSeq).padStart(3,'0')}@merti.local`;
    tutors.push({id:`merti-tutor-${String(tutorSeq).padStart(3,'0')}`,staffId:`T${String(tutorSeq).padStart(3,'0')}`,firstName:t.firstName,lastName:t.lastName,phone,email,subject:`CLASS TEACHER ${grade.code}`}); tutorSeq++;
    for(let r=5;r<=ws.rowCount;r++){
      const vals=(ws.getRow(r).values||[]).slice(1).map(cleanText).filter(Boolean); if(!vals.length) continue;
      const s=parseStudentName(vals.join(' ')); if(!s) continue;
      learners.push({id:`merti-learner-${String(learnerSeq).padStart(4,'0')}`,admissionNumber:`M${String(grade.num).padStart(2,'0')}${String(learnerSeq).padStart(4,'0')}`,firstName:s.firstName,lastName:s.lastName,grade:grade.code,stream:'A',gender:'FEMALE',dateOfBirth:'2012-01-01 00:00:00',admissionDate:'2026-01-01 00:00:00'});
      learnerSeq++;
    }
  }
  fs.writeFileSync('C:/tmp/merti_learners_import.json', JSON.stringify(learners,null,2));
  fs.writeFileSync('C:/tmp/merti_tutors_import.json', JSON.stringify(tutors,null,2));
  console.log(JSON.stringify({learnerCount:learners.length,tutorCount:tutors.length,grades:[...new Set(learners.map(l=>l.grade))],sampleTutor:tutors[0]},null,2));
})();
