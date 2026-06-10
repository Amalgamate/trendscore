/**
 * generate-icons.mjs
 * Generates all required app icons from public/branding/logo.png using sharp.
 *
 * Run with:  node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/
 *     favicon.ico          (multi-size ICO: 16, 24, 32, 48, 64)
 *     favicon-16x16.png
 *     favicon-32x32.png
 *     favicon-48x48.png
 *     favicon.png          (64x64  — legacy, referenced in index.html)
 *     logo192.png          (192x192 — PWA manifest)
 *     logo512.png          (512x512 — PWA manifest)
 *     apple-touch-icon.png (180x180 — iOS home screen)
 *     logo-maskable.png    (512x512 with padding — maskable PWA icon)
 *
 *   android/
 *     mipmap-mdpi/ic_launcher.png         (48x48)
 *     mipmap-hdpi/ic_launcher.png         (72x72)
 *     mipmap-xhdpi/ic_launcher.png        (96x96)
 *     mipmap-xxhdpi/ic_launcher.png       (144x144)
 *     mipmap-xxxhdpi/ic_launcher.png      (192x192)
 *     mipmap-mdpi/ic_launcher_round.png   (48x48)
 *     mipmap-hdpi/ic_launcher_round.png   (72x72)
 *     mipmap-xhdpi/ic_launcher_round.png  (96x96)
 *     mipmap-xxhdpi/ic_launcher_round.png (144x144)
 *     mipmap-xxxhdpi/ic_launcher_round.png(192x192)
 *
 *   ios/App/App/Assets.xcassets/AppIcon.appiconset/
 *     AppIcon-20@2x.png   (40x40)
 *     AppIcon-20@3x.png   (60x60)
 *     AppIcon-29@2x.png   (58x58)
 *     AppIcon-29@3x.png   (87x87)
 *     AppIcon-40@2x.png   (80x80)
 *     AppIcon-40@3x.png   (120x120)
 *     AppIcon-60@2x.png   (120x120)
 *     AppIcon-60@3x.png   (180x180)
 *     AppIcon-76.png      (76x76)
 *     AppIcon-76@2x.png   (152x152)
 *     AppIcon-83.5@2x.png (167x167)
 *     AppIcon-1024.png    (1024x1024 — App Store)
 *     Contents.json
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const SOURCE    = path.join(ROOT, 'public', 'branding', 'logo.png');
const PUBLIC    = path.join(ROOT, 'public');

// ── helpers ───────────────────────────────────────────────────────────────────
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

async function resize(size, dest, { circle = false, padding = 0 } = {}) {
  ensure(path.dirname(dest));

  const inner = size - padding * 2;

  let pipeline = sharp(SOURCE).resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } });

  if (circle) {
    // SVG mask for circular crop
    const mask = Buffer.from(
      `<svg><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="white"/></svg>`
    );
    pipeline = pipeline.composite([{ input: mask, blend: 'dest-in' }]);
  }

  if (padding > 0) {
    // Add white/transparent padding to reach full size
    pipeline = pipeline.extend({
      top: padding, bottom: padding, left: padding, right: padding,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    });
  }

  await pipeline.png().toFile(dest);
  console.log(`  ✓ ${path.relative(ROOT, dest)}  (${size}x${size})`);
}

// ── Web / PWA icons ───────────────────────────────────────────────────────────
async function generateWebIcons() {
  console.log('\n📱 Web / PWA icons');

  const webIcons = [
    { size: 16,  name: 'favicon-16x16.png' },
    { size: 32,  name: 'favicon-32x32.png' },
    { size: 48,  name: 'favicon-48x48.png' },
    { size: 64,  name: 'favicon.png' },        // legacy — referenced in index.html
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'logo192.png' },
    { size: 512, name: 'logo512.png' },
  ];

  for (const { size, name } of webIcons) {
    await resize(size, path.join(PUBLIC, name));
  }

  // Maskable icon: logo at 80% with 10% safe-zone padding on each side
  await resize(512, path.join(PUBLIC, 'logo-maskable.png'), { padding: 51 }); // ~10% of 512
  console.log(`  ✓ public/logo-maskable.png  (512x512 maskable)`);
}

// ── Android icons ─────────────────────────────────────────────────────────────
async function generateAndroidIcons() {
  console.log('\n🤖 Android icons');

  const densities = [
    { name: 'mipmap-mdpi',    size: 48  },
    { name: 'mipmap-hdpi',    size: 72  },
    { name: 'mipmap-xhdpi',   size: 96  },
    { name: 'mipmap-xxhdpi',  size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  const androidBase = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

  for (const { name, size } of densities) {
    const dir = path.join(androidBase, name);
    await resize(size, path.join(dir, 'ic_launcher.png'));
    await resize(size, path.join(dir, 'ic_launcher_round.png'), { circle: true });
    await resize(size, path.join(dir, 'ic_launcher_foreground.png'), { padding: Math.round(size * 0.125) });
  }
}

// ── iOS icons ─────────────────────────────────────────────────────────────────
async function generateiOSIcons() {
  console.log('\n🍎 iOS icons');

  const iosIconSet = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  ensure(iosIconSet);

  const icons = [
    { name: 'AppIcon-20@2x.png',   size: 40  },
    { name: 'AppIcon-20@3x.png',   size: 60  },
    { name: 'AppIcon-29@2x.png',   size: 58  },
    { name: 'AppIcon-29@3x.png',   size: 87  },
    { name: 'AppIcon-40@2x.png',   size: 80  },
    { name: 'AppIcon-40@3x.png',   size: 120 },
    { name: 'AppIcon-60@2x.png',   size: 120 },
    { name: 'AppIcon-60@3x.png',   size: 180 },
    { name: 'AppIcon-76.png',      size: 76  },
    { name: 'AppIcon-76@2x.png',   size: 152 },
    { name: 'AppIcon-83.5@2x.png', size: 167 },
    { name: 'AppIcon-1024.png',    size: 1024 },
  ];

  for (const { name, size } of icons) {
    await resize(size, path.join(iosIconSet, name));
  }

  // Write Contents.json for Xcode
  const contents = {
    images: [
      { idiom: 'iphone', scale: '2x', size: '20x20',   filename: 'AppIcon-20@2x.png'   },
      { idiom: 'iphone', scale: '3x', size: '20x20',   filename: 'AppIcon-20@3x.png'   },
      { idiom: 'iphone', scale: '2x', size: '29x29',   filename: 'AppIcon-29@2x.png'   },
      { idiom: 'iphone', scale: '3x', size: '29x29',   filename: 'AppIcon-29@3x.png'   },
      { idiom: 'iphone', scale: '2x', size: '40x40',   filename: 'AppIcon-40@2x.png'   },
      { idiom: 'iphone', scale: '3x', size: '40x40',   filename: 'AppIcon-40@3x.png'   },
      { idiom: 'iphone', scale: '2x', size: '60x60',   filename: 'AppIcon-60@2x.png'   },
      { idiom: 'iphone', scale: '3x', size: '60x60',   filename: 'AppIcon-60@3x.png'   },
      { idiom: 'ipad',   scale: '1x', size: '76x76',   filename: 'AppIcon-76.png'      },
      { idiom: 'ipad',   scale: '2x', size: '76x76',   filename: 'AppIcon-76@2x.png'   },
      { idiom: 'ipad',   scale: '2x', size: '83.5x83.5', filename: 'AppIcon-83.5@2x.png' },
      { idiom: 'ios-marketing', scale: '1x', size: '1024x1024', filename: 'AppIcon-1024.png' },
    ],
    info: { author: 'xcode', version: 1 },
  };

  fs.writeFileSync(
    path.join(iosIconSet, 'Contents.json'),
    JSON.stringify(contents, null, 2)
  );
  console.log('  ✓ ios/.../AppIcon.appiconset/Contents.json');
}

// ── Update manifest.json ──────────────────────────────────────────────────────
function updateManifest() {
  console.log('\n📄 Updating manifest.json');

  const manifest = {
    short_name: 'TrendScore',
    name: 'TrendScore V1.0 - School Management & CBC Grading',
    description: 'Complete CBC School Management & Grading System for Kenyan schools',
    icons: [
      { src: 'favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { src: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: 'favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { src: 'logo192.png',       sizes: '192x192', type: 'image/png' },
      { src: 'logo512.png',       sizes: '512x512', type: 'image/png' },
      { src: 'logo-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#520050',
    background_color: '#ffffff',
    categories: ['education', 'productivity'],
  };

  fs.writeFileSync(
    path.join(PUBLIC, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('  ✓ public/manifest.json updated');
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎨 TrendScore — Icon Generator');
  console.log(`   Source: ${SOURCE}`);

  if (!fs.existsSync(SOURCE)) {
    console.error(`\n❌ Source not found: ${SOURCE}`);
    console.error('   Make sure public/branding/logo.png exists.');
    process.exit(1);
  }

  try {
    await generateWebIcons();
    await generateAndroidIcons();
    await generateiOSIcons();
    updateManifest();

    console.log('\n✅ All icons generated successfully!');
    console.log('\nNext steps:');
    console.log('  1. Commit: git add public/ android/ ios/ && git commit -m "chore: regenerate app icons"');
    console.log('  2. Run: npx cap sync   (to sync icons into native projects)');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
