// Is the light knob connected at all?
//
// Before trusting another light experiment, prove the control surface works by
// asking for something whose answer is not in doubt: turn the lights almost
// all the way off. If the frame does not go dark, the parameters are not
// reaching the renderer and every light number measured so far is meaningless.
//
// This check exists because a 36% cut across every light previously moved the
// measured median by one point -- which read like a clamp, and was actually
// `window.RENDERCORE` being undefined (top-level `const` does not attach to
// window), so syncLights() never ran.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./harness');

const POINTS = [
  { name: 'yard',      pos: [6, 0, 18],   yaw: 0.28,  pitch: -0.05 },
  { name: 'barn-ext',  pos: [22, 0, 6],   yaw: 1.15,  pitch: 0.02 },
  { name: 'silo-west', pos: [-86, 0, 14], yaw: -2.05, pitch: 0.06 }
];

const BASE = { key: 0.50, bnc: 0.20, fill: 0.36, rim: 0.15, amb: 0.11 };
const rig = k => ({
  'l.keyIntensity':       +(BASE.key  * k).toFixed(4),
  'l.keyBounceIntensity': +(BASE.bnc  * k).toFixed(4),
  'l.fillIntensity':      +(BASE.fill * k).toFixed(4),
  'l.rimIntensity':       +(BASE.rim  * k).toFixed(4),
  'l.ambIntensity':       +(BASE.amb  * k).toFixed(4)
});

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  const errors = await H.boot(page);

  for (const [name, params] of [['lights x1.00', rig(1.0)], ['lights x0.05', rig(0.05)], ['lights x1.00 again', rig(1.0)]]) {
    await page.evaluate(p => window.__applyParams(p), params);
    // Confirm the change actually landed in the live rig, not just in CONFIG.
    const live = await page.evaluate(() => {
      const l = RENDERCORE.lights;
      return { key: +l.key.intensity.toFixed(3), fill: +l.fill.intensity.toFixed(3), amb: +l.amb.intensity.toFixed(3) };
    });
    const row = [];
    for (const pt of POINTS) {
      await H.goTo(page, pt, 4);
      row.push(pt.name + '=' + (await H.measure(page, 3)).p50);
    }
    console.log(`${name.padEnd(19)} live rig key=${live.key} fill=${live.fill} amb=${live.amb}   ${row.join('  ')}`);
  }
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
