const fs = require('fs');
let code = fs.readFileSync('src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx', 'utf8');

const sIdx = code.indexOf('{/* School Health & Executive Summary Sections */}');
const eIdx = code.indexOf('{/* Attention Required */}');
const sec = code.substring(sIdx, eIdx);

const leftColStr = '{/* LEFT COLUMN — SCHOOL HEALTH */}';
const rightColStr = '{/* RIGHT COLUMN — EXECUTIVE SUMMARY */}';

const leftCol = sec.substring(sec.indexOf(leftColStr), sec.indexOf(rightColStr));
const rightCol = sec.substring(sec.indexOf(rightColStr));

let newRightCol = rightCol.replace(
  '<div className="grid grid-cols-2 gap-4 flex-1">\\n            {/* Billing Insights Card — spans both columns */}\\n            <BillingInsightsCard onNavigate={onNavigate} />',
  '<div className="flex flex-col gap-4 flex-1">\\n            {/* Billing Insights Card */}\\n            <BillingInsightsCard onNavigate={onNavigate} />\\n            <div className="grid grid-cols-3 gap-4">'
);
// fallback if the regex fails due to spacing
newRightCol = newRightCol.replace(
  '<div className="grid grid-cols-2 gap-4 flex-1">',
  '<div className="flex flex-col gap-4 flex-1">'
);
newRightCol = newRightCol.replace(
  '{/* Learners Card */}',
  '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">\\n              {/* Learners Card */}'
);

newRightCol = newRightCol.replace(
  '</div>\\n        </div>',
  '</div>\\n          </div>\\n        </div>'
);

const newSec = code.substring(sIdx, sIdx + '{/* School Health & Executive Summary Sections */}'.length) + 
  '\\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">\\n        ' + 
  newRightCol.trimEnd() + '\\n\\n        ' + leftCol.trimEnd() + '\\n      </div>\\n\\n      ';

code = code.replace(sec, newSec);
fs.writeFileSync('src/components/CBCGrading/pages/dashboard/AdminDashboard.jsx', code);
console.log('done');
