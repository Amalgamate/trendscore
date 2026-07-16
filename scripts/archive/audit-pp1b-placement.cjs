const fs = require('fs');

const names = `HAMZA SALDIN
AMRAM MUTUGI
JOSLYN KADZO
ABDISULMUD ISSACK
MAXWEL NDIRATHI
ASHWAG AHMED
JAYDEN MAINA
RUMANA HASSAN
RAIMA HALKANO
YASIN MOHAMED
QAMAR ABDIKADIR
RAQUEL KINYA
SUHANA FESTUS
NORAH NASIAE
WISDOM MUNENE
HASSAN HUSSEIN
MELISA CHEROP
ASHALUL BASHIR
ZAHEERA ABDIRAMAN
SALMA ALI
RAYAN BILLOW
ZAHIR SOMO
YASHFER MOHAMED
BRAIDEN MBWORI
ELIANA MWENDE
HUMPHREY MWANGI
AMIR GALMA
HALIMA HALKANO
MOHAMED MOHAMUD
HABIBA ABDIRASHID
FAVOUR MUKAMI
VICTOR MUTUMA
KAIRA MOHAMUD
MASUD HASSAN`.split('\n');
const parse = line => { const parts = line.split(','); return { grade: parts[0], id: parts[1], name: parts.slice(2, -1).join(','), results: Number(parts.at(-1)) }; };
const learners = fs.readFileSync('C:/tmp/mck-active-learners.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(parse);
const norm = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const lev = (a,b) => { const row=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){let d=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const p=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,d+(a[i-1]===b[j-1]?0:1));d=p;}} return row[b.length]; };
const audit = names.map(source => {
  const sourceNorm = norm(source);
  const exact = learners.filter(l => norm(l.name) === sourceNorm);
  const candidates = exact.length ? exact : learners.map(l => ({...l, distance:lev(sourceNorm,norm(l.name))}))
    .filter(l => l.distance <= 3).sort((a,b) => a.distance-b.distance).slice(0,3);
  return { source, exact: exact.length === 1, candidates: candidates.map(c => ({id:c.id,name:c.name,grade:c.grade,results:c.results,distance:c.distance ?? 0})) };
});
console.log(JSON.stringify({ total:names.length, exact:audit.filter(x=>x.exact).length, proposed:audit.filter(x=>x.candidates.length===1).length, unresolved:audit.filter(x=>x.candidates.length!==1), audit },null,2));
