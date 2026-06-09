const fs = require('fs');
const files = [
  'src/components/CBCGrading/pages/dashboard/ParentDashboard.jsx',
  'src/components/CBCGrading/pages/dashboard/HeadTeacherDashboard.jsx',
  'src/components/CBCGrading/pages/dashboard/CurriculumHeadDashboard.jsx',
  'src/components/CBCGrading/pages/dashboard/AccountantDashboard.jsx',
];
const cycle = ['navy', 'teal', 'red', 'green'];
const oldTones = ['indigo','purple','emerald','amber','orange','rose','blue','violet','slate','cyan'];
const pattern = new RegExp("tone: '(" + oldTones.join('|') + ")'", 'g');

files.forEach(fp => {
  let src = fs.readFileSync(fp, 'utf8');
  let i = 0;
  const replaced = src.replace(pattern, () => {
    const t = cycle[i % 4];
    i++;
    return "tone: '" + t + "'";
  });
  fs.writeFileSync(fp, replaced);
  console.log(fp.split('/').pop(), '— replaced', i, 'tone(s)');
});
