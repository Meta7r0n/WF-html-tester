// Reusable capture harness: boots the game, teleports to a set of framed
// vantage points, and screenshots each one. Used for every before/after pass.
//
// The boot and teleport live in harness.js now. They used to live here, and
// they were wrong: `PLAYER.yaw = y` was a silent no-op (yaw is a getter with
// no setter), and each point's `y` was a hand-guessed constant rather than
// resolved against the floor, so the player was screenshotted mid-fall while
// pointing in an unknown direction. Every before/after comparison taken with
// the old version of this file is void. See harness.js for the full account.
//
//   node capture.js <outDir> [url]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./harness');

// y is resolved from WORLD.groundAt at capture time, so it is no longer part
// of the point definition -- only where to stand and where to look.
const SHOTS = [
  { name: 'yard',       pos: [6, 0, 18],    yaw: 0.28,  pitch: -0.05 },
  { name: 'barn-ext',   pos: [22, 0, 6],    yaw: 1.15,  pitch: 0.02 },
  { name: 'windmill',   pos: [-2, 0, -14],  yaw: -0.45, pitch: 0.10 },
  { name: 'greenhouse', pos: [-43.5, 0, 4], yaw: 0.02,  pitch: 0.0 },
  { name: 'silo-west',  pos: [-86, 0, 14],  yaw: -2.05, pitch: 0.06 },
  { name: 'silo-north', pos: [10, 0, -58],  yaw: 0.75,  pitch: 0.08 },
  { name: 'maze',       pos: [36, 0, 14],   yaw: 0.15,  pitch: 0.0 },
  { name: 'northbarn',  pos: [48, 0, -46],  yaw: 0.05,  pitch: 0.04 }
];

async function main() {
  const outDir = process.argv[2] || 'baseline';
  const url = process.argv[3] || 'http://localhost:8934/preview.html';
  const fs = require('fs');
  const dir = __dirname + '/shots/' + outDir;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  const errors = await H.boot(page, url);

  const warns = [];
  for (const s of SHOTS) {
    const { where, warn } = await H.goTo(page, s, 5);
    if (warn) warns.push(`${s.name}: ${warn}`);
    await page.screenshot({ path: dir + '/' + s.name + '.png', timeout: 120000 });
    console.log(`${warn ? 'WARN' : ' ok '} ${s.name.padEnd(11)} (${where.x}, ${where.y}, ${where.z}) yaw=${where.yaw}` +
                (warn ? `  [${warn}]` : ''));
  }
  // Surfaced, not swallowed: a frame taken from somewhere other than where it
  // was asked for is not a picture of what its filename claims.
  console.log(JSON.stringify({ dir, shots: SHOTS.map(s => s.name), warns, errors }, null, 2));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
