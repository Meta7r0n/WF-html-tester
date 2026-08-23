// Are our eight "vantage points" actually reachable, and do they point where
// we think? Nothing measured from them means anything until this passes.
//
// Every one of them was authored as {pos:[x, y, z], yaw, pitch} with a
// hand-guessed y and a yaw that the game silently ignored. This teleports to
// each in turn, lets the player settle, and prints where they really ended up.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./harness');

const POINTS = [
  { name: 'yard',       pos: [6, 2.0, 18],    yaw: 0.28,  pitch: -0.05 },
  { name: 'barn-ext',   pos: [22, 2.0, 6],    yaw: 1.15,  pitch: 0.02 },
  { name: 'windmill',   pos: [-2, 2.0, -14],  yaw: -0.45, pitch: 0.10 },
  { name: 'greenhouse', pos: [-43.5, 1.9, 4], yaw: 0.02,  pitch: 0.0 },
  { name: 'silo-west',  pos: [-86, 2.2, 14],  yaw: -2.05, pitch: 0.06 },
  { name: 'silo-north', pos: [10, 2.2, -58],  yaw: 0.75,  pitch: 0.08 },
  { name: 'maze',       pos: [36, 1.9, 14],   yaw: 0.15,  pitch: 0.0 },
  { name: 'northbarn',  pos: [48, 2.0, -46],  yaw: 0.05,  pitch: 0.04 }
];

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  const errors = await H.boot(page);

  let bad = 0;
  for (const pt of POINTS) {
    const { where, warn } = await H.goTo(page, pt, 5);
    const m = await H.measure(page, 3);
    const flag = warn ? 'WARN' : ' ok ';
    if (warn) bad++;
    console.log(`${flag} ${pt.name.padEnd(11)} asked (${pt.pos[0]}, ${pt.pos[2]}) yaw ${pt.yaw}` +
                `  ->  got (${where.x}, ${where.z}) y=${where.y} yaw=${where.yaw} grounded=${where.grounded}` +
                `   p50=${m.p50} p99=${m.p99} sh=${m.sh}` + (warn ? `   [${warn}]` : ''));
  }
  console.log(`\n${bad} of ${POINTS.length} vantage points do not land where asked.`);
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
