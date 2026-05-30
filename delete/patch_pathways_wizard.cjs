/**
 * patch_pathways_wizard.cjs
 * Run: node patch_pathways_wizard.cjs
 *
 * Patches LearnerProfile.jsx to:
 *   1. Add PathwaysWizard import
 *   2. Replace the entire PATHWAYS TAB block with <PathwaysWizard learner={currentLearner} />
 */

const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  'src/components/CBCGrading/pages/profiles/LearnerProfile.jsx'
);

let src = fs.readFileSync(TARGET, 'utf8');

// ── 1. Add import (after the ProfilePhotoModal import line) ──────────────────
const importLine = `import ProfilePhotoModal from '../../shared/ProfilePhotoModal';`;
const importReplacement = `import ProfilePhotoModal from '../../shared/ProfilePhotoModal';
import PathwaysWizard from './PathwaysWizard';`;

if (!src.includes("import PathwaysWizard")) {
  src = src.replace(importLine, importReplacement);
  console.log('✓ Added PathwaysWizard import');
} else {
  console.log('– PathwaysWizard import already present, skipping');
}

// ── 2. Replace the PATHWAYS TAB block ────────────────────────────────────────
// The block starts with:  {/* PATHWAYS TAB */}
// and ends just before:   {/* MEDICAL TAB */}
// We replace the entire inner div with the wizard component.

const START_MARKER = '{/* PATHWAYS TAB */}';
const END_MARKER   = '{/* MEDICAL TAB */}';

const startIdx = src.indexOf(START_MARKER);
const endIdx   = src.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1) {
  console.error('✗ Could not find PATHWAYS TAB or MEDICAL TAB marker in LearnerProfile.jsx');
  console.error('  Ensure the comments {/* PATHWAYS TAB */} and {/* MEDICAL TAB */} exist.');
  process.exit(1);
}

const newBlock = `{/* PATHWAYS TAB */}
                        {activeTab === 'pathways' && isSecondaryLearner && (
                            <div className="animate-fade-in">
                                <PathwaysWizard learner={currentLearner} />
                            </div>
                        )}

                        `;

src = src.slice(0, startIdx) + newBlock + src.slice(endIdx);

console.log('✓ Replaced PATHWAYS TAB block with PathwaysWizard');

// ── 3. Write back ────────────────────────────────────────────────────────────
fs.writeFileSync(TARGET, src, 'utf8');
console.log('✓ LearnerProfile.jsx patched successfully');
