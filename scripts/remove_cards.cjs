const fs = require('fs');
let code = fs.readFileSync('src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx', 'utf8');
const lines = code.split('\n');

const startIdx = lines.findIndex(line => line.includes('<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">'));

if (startIdx !== -1) {
    let endIdx = -1;
    for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].includes('</div>') && lines[i-1].includes('</svg>') && lines[i-3].includes('</svg>')) {
            endIdx = i;
            break;
        }
    }
    
    if (endIdx !== -1) {
        // delete startIdx to endIdx (inclusive)
        lines.splice(startIdx, endIdx - startIdx + 1);
        fs.writeFileSync('src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx', lines.join('\n'));
        console.log('Removed cards');
    } else {
        console.log('Could not find end index');
    }
} else {
    console.log('Could not find start index');
}
