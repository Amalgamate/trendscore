const fs = require('fs');

const skipped = JSON.parse(fs.readFileSync('C:/tmp/mck-skipped-learners.json', 'utf8')).skippedLearnerExamples;
const active = fs.readFileSync('C:/tmp/mck-active-learners.csv', 'utf8').trim().split(/\r?\n/).slice(1)
  .map(line => {
    const parts = line.split(',');
    const [grade, id] = parts;
    const resultCount = Number(parts.pop());
    return { grade, id, name: parts.slice(2).join(','), resultCount };
  });

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const distance = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
};

const possible = skipped.map(source => {
  const sourceName = normalize(source.name);
  const sourceTokens = sourceName.split(' ');
  const candidates = active.filter(candidate => candidate.grade === source.grade).map(candidate => {
    const candidateName = normalize(candidate.name);
    const overlap = sourceTokens.filter(token => token.length > 2 && candidateName.split(' ').includes(token)).length;
    return { candidate: candidate.name, resultCount: candidate.resultCount, overlap, distance: distance(sourceName, candidateName) };
  }).filter(candidate => candidate.distance <= 3 || (candidate.overlap >= 2 && candidate.distance <= 8))
    .sort((a, b) => b.overlap - a.overlap || a.distance - b.distance).slice(0, 3);
  return candidates.length ? { source: source.name, grade: source.grade, candidates } : null;
}).filter(Boolean);

const primary = possible.filter(item => item.candidates.length === 1 && item.candidates[0].distance <= 2);
const zeroResultPrimary = primary.filter(item => item.candidates[0].resultCount === 0);
console.log(JSON.stringify({
  possibleCount: possible.length,
  highConfidenceCount: primary.length,
  highConfidenceWithNoResults: zeroResultPrimary.length,
  highConfidenceWithExistingResults: primary.length - zeroResultPrimary.length,
  zeroResultPrimary,
  possible,
}, null, 2));
