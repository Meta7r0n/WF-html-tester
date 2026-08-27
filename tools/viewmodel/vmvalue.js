/* Value + silhouette report for a captured frame's viewmodel.
 *
 * Two questions the eye is bad at answering and this answers exactly:
 *   1. what value range does the viewmodel actually occupy, and is its floor
 *      lower than the rest of the frame's (which makes it read pasted on),
 *   2. does the silhouette alone still say what weapon you are holding --
 *      the region is thresholded to pure black and written out beside the
 *      frame so it can be looked at.
 *
 *   node tools/viewmodel/vmvalue.js <png...>            (no server needed)
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

// The lower-right quadrant is where every held weapon lives; the rest of the
// frame is the control the viewmodel has to live in the same value world as.
const VM = { x: 500, y: 290, w: 780, h: 430 };

const CODE = (b64, vm) => `(async () => {
  const img = new Image();
  await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,${b64}'; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const L = i => 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
  const vm = ${JSON.stringify(vm)};
  const inVM = (x, y) => x >= vm.x && x < vm.x+vm.w && y >= vm.y && y < vm.y+vm.h;
  const all = [], out = [], vmv = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const v = L((y*c.width + x) * 4);
    all.push(v); (inVM(x, y) ? vmv : out).push(v);
  }
  const st = a => { a.sort((p,q)=>p-q); const q=f=>a[Math.min(a.length-1,Math.floor(f*a.length))]|0;
    return { min: a[0]|0, p01: q(0.01), p10: q(0.10), p50: q(0.50), p90: q(0.90), p99: q(0.99),
             lo: +(a.filter(v=>v<20).length/a.length*100).toFixed(1),
             hi: +(a.filter(v=>v>240).length/a.length*100).toFixed(1) }; };
  // Silhouette: everything in the VM box darker than the local background's
  // midpoint, stamped solid. Crude on purpose -- it is the same test as
  // squinting at the frame.
  const s = document.createElement('canvas');
  s.width = vm.w; s.height = vm.h;
  const sg = s.getContext('2d');
  sg.fillStyle = '#fff'; sg.fillRect(0, 0, vm.w, vm.h);
  sg.fillStyle = '#000';
  for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
    if (L(((y+vm.y)*c.width + x+vm.x) * 4) < 96) sg.fillRect(x, y, 1, 1);
  }
  return { frame: st(all), viewmodel: st(vmv), rest: st(out), sil: s.toDataURL('image/png') };
})()`;

async function main() {
  const files = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  const page = await browser.newPage();
  for (const f of files) {
    const b64 = fs.readFileSync(f).toString('base64');
    const r = await page.evaluate(CODE(b64, VM));
    const row = (n, s) => `  ${n.padEnd(10)} min ${String(s.min).padStart(3)}  p01 ${String(s.p01).padStart(3)}` +
      `  p10 ${String(s.p10).padStart(3)}  p50 ${String(s.p50).padStart(3)}  p90 ${String(s.p90).padStart(3)}` +
      `  p99 ${String(s.p99).padStart(3)}  <20 ${String(s.lo).padStart(5)}%  >240 ${String(s.hi).padStart(5)}%`;
    console.log(path.basename(f));
    console.log(row('frame', r.frame));
    console.log(row('viewmodel', r.viewmodel));
    console.log(row('rest', r.rest));
    const sil = f.replace(/\.png$/, '') + '-sil.png';
    fs.writeFileSync(sil, Buffer.from(r.sil.split(',')[1], 'base64'));
  }
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
