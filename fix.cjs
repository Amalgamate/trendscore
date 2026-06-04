const fs = require('fs');
const path = require('path');

const registryPath = 'c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/WidgetRegistry.ts';
const content = fs.readFileSync(registryPath, 'utf8');
const regex = /import\('\.\/widgets\/([^']+)'\)/g;
let match;

while ((match = regex.exec(content)) !== null) {
  const widgetPath = path.join('c:/Amalgamate/Projects/TreadSCORE/src/components/CBCGrading/dashboard/widgets', match[1] + '.tsx');
  if (!fs.existsSync(widgetPath)) {
    const dir = path.dirname(widgetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const name = path.basename(match[1]);
    const template = `import React from 'react';\n\nconst ${name} = () => <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">Coming Soon: ${name}</div>;\nexport default ${name};\n`;
    
    fs.writeFileSync(widgetPath, template);
    console.log('Created placeholder for ' + widgetPath);
  }
}
