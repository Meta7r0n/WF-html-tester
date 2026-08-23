// Probe a handful of named candidate light rigs across all eight vantage
// points, in one boot. Cheaper and far more informative than a blind search
// now that the teleport actually works.
//
// The problem this is aimed at, measured at the current head:
//
//   silo-west 192  yard 182  greenhouse 175  maze 146
//   barn-ext  110  windmill 105  silo-north  91  northbarn 21
//
// Seven of eight sit in a 91-192 band and three of those are over the 160
// ceiling; the eighth is the north barn interior, which is a lighting-content
// problem (nothing lights that room) and cannot be fixed by a global curve
// without blowing out the other seven. So this only tries to bring the
// daylight set down into band.
//
// Why a plain scale is the candidate: `col *= uExposure` happens before the
// black/white points and the gamma, so exposure and "scale every light" are
// the same operation. Given that, the honest place to make the change is the
// rig -- which currently spends 1.105 on an up-facing surface while its own
// comment claims a budget of ~0.95 -- rather than leaving the rig wrong and
// dialling exposure down to hide it.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./harness');

const POINTS = [
  { name: 'yard',       pos: [6, 0, 18],    yaw: 0.28,  pitch: -0.05 },
  { name: 'barn-ext',   pos: [22, 0, 6],    yaw: 1.15,  pitch: 0.02 },
  { name: 'windmill',   pos: [-2, 0, -14],  yaw: -0.45, pitch: 0.10 },
  { name: 'greenhouse', pos: [-43.5, 0, 4], yaw: 0.02,  pitch: 0.0 },
  { name: 'silo-west',  pos: [-86, 0, 14],  yaw: -2.05, pitch: 0.06 },
  { name: 'silo-north', pos: [10, 0, -58],  yaw: 0.75,  pitch: 0.08 },
  { name: 'maze',       pos: [36, 0, 14],   yaw: 0.15,  pitch: 0.0 },
  { name: 'northbarn',  pos: [48, 0, -46],  yaw: 0.05,  pitch: 0.04 }
];

const BASE = { key: 0.50, bnc: 0.20, fill: 0.36, rim: 0.15, amb: 0.11 };

// Scale the whole rig by k. ambLift > 1 additionally props the omnidirectional
// floor back up, so the shaded end does not fall as far as the lit end -- the
// knob that trades some modelling for a narrower frame-to-frame spread.
const rig = (k, ambLift) => ({
  'l.keyIntensity':       +(BASE.key  * k).toFixed(4),
  'l.keyBounceIntensity': +(BASE.bnc  * k).toFixed(4),
  'l.fillIntensity':      +(BASE.fill * k).toFixed(4),
  'l.rimIntensity':       +(BASE.rim  * k).toFixed(4),
  'l.ambIntensity':       +(BASE.amb  * k * (ambLift || 1)).toFixed(4)
});

// Third pass, and the first one aimed at a measured target rather than a
// guessed one. tonal.js on the five Mouse P.I. reference stills gives:
//
//   frame              p01  p50  p99   rms  shadow%  edge
//   saloon interior     23   74  255  51.5    38.3   89.4
//   camp firefight      15   86  230  68.0    36.2   44.3
//   circus boss          8   51  236  64.1    60.3   57.1
//   laboratory           0   42  249  62.5    62.1  107.9
//   skeleton alley       0   49  240  65.0    61.1  118.1
//   MEAN               9.2 60.4  242  62.2    51.6   83.4
//
// The reference is a DARK image with small brilliant accents: median 60, over
// half of every frame below 64, and still a p99 of 242. Our daylight frames sit
// at 145-192 with 11-38% shadow. The old 70-160 band was my guess and would
// have failed three of those five reference frames for being too dark.
//
// Scaling the light rig is the wrong lever for this: it drags the highlights
// down with the mids, and it cannot touch the sky at all (unlit MeshBasic), so
// past a point the frame just floors out. GAMMA pivots around white -- it moves
// the midtone while leaving black at black and white at white, which is exactly
// the axis that separates us from the reference. And the grade is currently at
// gamma 0.62, which since x^0.62 > x for x<1 is actively LIFTING every midtone.
//
// So: sweep gamma up, with a modest light trim, and watch that p99 holds.
const g = (gamma, k, contrast) => {
  const o = { gamma };
  if (contrast !== undefined) o.contrast = contrast;
  if (k !== undefined) Object.assign(o, rig(k));
  return o;
};

const CANDIDATES = [
  ['baseline (g0.62)',        null],
  ['g0.85',                   g(0.85)],
  ['g1.05',                   g(1.05)],
  ['g1.05 + rig0.80',         g(1.05, 0.80)],
  ['g1.25 + rig0.80 + con',   g(1.25, 0.80, 0.22)]
];

const BAND_LO = 75, BAND_HI = 130;   // from the reference; see the note above

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  const errors = await H.boot(page);

  for (const [name, params] of CANDIDATES) {
    if (params) await page.evaluate(p => window.__applyParams(p), params);
    const row = [];
    for (const pt of POINTS) {
      const { warn } = await H.goTo(page, pt, 4);
      const m = await H.measure(page, 3);
      row.push({ n: pt.name, ...m, warn });
    }
    // northbarn is reported but excluded from the band verdict: it is an
    // unlit room, and letting it drive a global exposure decision is how the
    // other seven frames got judged against the wrong target in the first place.
    const day = row.filter(r => r.n !== 'northbarn');
    const p50s = day.map(r => r.p50);
    const out = day.filter(r => r.p50 < BAND_LO || r.p50 > BAND_HI).map(r => r.n);
    console.log(`\n### ${name}`);
    console.log('   ' + row.map(r => `${r.n}=${r.p50}`).join('  '));
    console.log(`   daylight spread ${(Math.max(...p50s) / Math.min(...p50s)).toFixed(2)}x` +
                `   minP01 ${Math.min(...day.map(r => r.p01 === undefined ? -1 : r.p01))}` +
                `   out of ${BAND_LO}-${BAND_HI}: ${out.length ? out.join(', ') : 'none'}` +
                `   maxShadow% ${Math.max(...day.map(r => r.sh))}` +
                `   minP99 ${Math.min(...day.map(r => r.p99))}`);
    const warns = row.filter(r => r.warn);
    if (warns.length) console.log('   WARN ' + warns.map(r => `${r.n}: ${r.warn}`).join(' | '));
  }
  console.log('\nerrors:', JSON.stringify(errors));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
