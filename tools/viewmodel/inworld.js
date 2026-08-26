// Two in-world frames with the viewmodel in them.
//
// The viewmodel harnesses in this directory render the weapon over a flat
// clear colour, which is the right way to judge a silhouette or a motion and
// the wrong way to judge whether the thing reads against an actual scene.
// barn-ext and windmill are the two honest midtone vantages -- the others are
// either blown out or crushed, and a viewmodel that looks fine over a
// white-out proves nothing.
//
//   tools/viewmodel/serve-and-run.sh node tools/viewmodel/inworld.js [outDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('../render-audit/harness');
const fs = require('fs');

const POINTS = [
  { name: 'barn-ext', pos: [22, 0, 6], yaw: 1.15, pitch: 0.02 },
  { name: 'windmill', pos: [-2, 0, -14], yaw: -0.45, pitch: 0.10 }
];

async function main() {
  const dir = (process.env.VMOUT || '/tmp/vmshots') + '/' + (process.argv[2] || 'inworld');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  const errors = await H.boot(page, process.env.VMURL || 'http://127.0.0.1:9102/preview.html');
  const notes = [];

  for (const pt of POINTS) {
    const r = await H.goTo(page, pt, 6);
    if (r.warn) notes.push(pt.name + ': ' + r.warn);
    for (const w of ['pipePopper', 'glizzyGat']) {
      await page.evaluate(id => {
        try { WEAPON.grantWeapon(id, 999, { repeatPickup: true }); } catch (e) {}
        WEAPON.setCurrent(id, true, true);
        WEAPON.refillAll();
      }, w);
      await page.evaluate(n => window.__waitFrames(n), 10);
      await page.screenshot({ path: dir + '/' + pt.name + '-' + w + '.png' });
    }
  }
  console.log(JSON.stringify({ dir, notes, errors: [...new Set(errors)] }, null, 1));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
