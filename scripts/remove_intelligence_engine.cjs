const fs = require('fs');

const files = [
  {
    path: 'src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx',
    startComment: '{/* Intelligence Engine Section */}',
    endComment: '</div>\n    </div>\n  );\n};\n\nexport default AdminDashboard;',
    replacement: '  );\n};\n\nexport default AdminDashboard;',
    imports: ['import RiskAlerts from', 'import FeeCollectionForecast from', 'import AcademicInsights from', '// Intelligence Engine Widgets']
  },
  {
    path: 'src/components/CBCGrading/pages/dashboard/HeadTeacherDashboard.jsx',
    startComment: '{/* Intelligence Engine Section */}',
    endComment: '</div>\n    </div>\n  );\n};\n\nexport default HeadTeacherDashboard;',
    replacement: '  );\n};\n\nexport default HeadTeacherDashboard;',
    imports: ['import RiskAlerts from', 'import AttendanceAnomalies from', 'import AcademicInsights from', '// Intelligence Engine Widgets',
              '{/* AI Academic Insights Placeholder */}']
  },
  {
    path: 'src/components/CBCGrading/pages/dashboard/TeacherDashboard.jsx',
    startComment: '{/* Intelligence Engine Section */}',
    endComment: '</div>\n    </div>\n  );\n};\n\nexport default TeacherDashboard;',
    replacement: '  );\n};\n\nexport default TeacherDashboard;',
    imports: ['import AttendanceAnomalies from', 'import AcademicInsights from', '// Intelligence Engine Widgets']
  }
];

for (const file of files) {
  let code = fs.readFileSync(file.path, 'utf8');
  
  // Remove the intelligence engine section from where it starts to end of component
  const startIdx = code.indexOf(file.startComment);
  if (startIdx !== -1) {
    const endIdx = code.indexOf(file.endComment);
    if (endIdx !== -1) {
      code = code.substring(0, startIdx).trimEnd() + '\n    ' + file.replacement;
    }
  }
  
  // Remove widget imports and comment
  for (const imp of file.imports) {
    code = code.replace(new RegExp(`.*${imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\r?\n`, 'g'), '');
  }
  
  // Also remove the AI Academic Insights Placeholder card in HeadTeacher
  if (file.path.includes('HeadTeacher')) {
    const aiPlaceholderStart = code.indexOf('{/* AI Academic Insights Placeholder */}');
    if (aiPlaceholderStart !== -1) {
      // Find closing </AppCard> after this
      const closingTag = '</AppCard>';
      let depth = 0;
      let i = aiPlaceholderStart;
      while (i < code.length) {
        if (code.slice(i, i + 8) === '<AppCard') depth++;
        if (code.slice(i, i + 9) === '</AppCard') {
          if (depth > 0) depth--;
          else {
            i += 9;
            break;
          }
        }
        i++;
      }
      code = code.substring(0, aiPlaceholderStart) + code.substring(i);
    }
  }
  
  fs.writeFileSync(file.path, code);
  console.log(`Done: ${file.path}`);
}
