import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const publicDirectory = path.join(root, 'public');
const sourcePath = path.join(publicDirectory, 'favicon.png');

const regularCanvasSize = 512;
const regularMarkSize = 336;
const safeMarkSize = 300;

const mark = await sharp(sourcePath)
  .resize(regularMarkSize, regularMarkSize, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toBuffer();

const roundedCard = Buffer.from(`
  <svg width="${regularCanvasSize}" height="${regularCanvasSize}" viewBox="0 0 ${regularCanvasSize} ${regularCanvasSize}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#0f172a" flood-opacity="0.14"/>
      </filter>
    </defs>
    <rect x="32" y="26" width="448" height="448" rx="72" fill="#ffffff" filter="url(#shadow)"/>
  </svg>
`);

const regularIcon = await sharp({
  create: {
    width: regularCanvasSize,
    height: regularCanvasSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: roundedCard, top: 0, left: 0 },
    {
      input: mark,
      left: Math.round((regularCanvasSize - regularMarkSize) / 2),
      top: Math.round((regularCanvasSize - regularMarkSize) / 2),
    },
  ])
  .png()
  .toBuffer();

for (const size of [44, 71, 150, 192, 310, 512]) {
  await sharp(regularIcon)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDirectory, `logo${size}.png`));
}

// Maskable/adaptive icons need an opaque full canvas. Android supplies the
// final circle, squircle, rounded rectangle, and press animation.
const safeMark = await sharp(sourcePath)
  .resize(safeMarkSize, safeMarkSize, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: regularCanvasSize,
    height: regularCanvasSize,
    channels: 4,
    background: '#ffffff',
  },
})
  .composite([
    {
      input: safeMark,
      left: Math.round((regularCanvasSize - safeMarkSize) / 2),
      top: Math.round((regularCanvasSize - safeMarkSize) / 2),
    },
  ])
  .png()
  .toFile(path.join(publicDirectory, 'logo-maskable.png'));

console.log('Generated rounded desktop icons and a platform-safe maskable icon.');
