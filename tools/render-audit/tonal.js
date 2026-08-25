// Objective frame analysis. Decodes PNGs through headless Chromium's canvas
// (no image-library dependency) and reports the statistics that separate a
// flat prototype frame from a graded, film-looking one.
//
//   node tonal.js shots/baseline shots/rendercore ...
//
// Metrics, and why each one matters for this art target:
//   p01/p99      - true black / true white points. A 1930s film look needs
//                  p01 near 0 and p99 near 255. Our baseline has no blacks.
//   range        - p99 - p01. Under ~180 means the image is washed out.
//   shadow%      - pixels under 64. Reference frames run 20-40%. Baseline ~0%.
//   mid% / high% - distribution across the tonal scale.
//   rms          - contrast (std-dev of luma). Higher = more modelled form.
//   edge         - mean Sobel magnitude, a proxy for linework/detail density.
//   sat          - mean HSV saturation, to confirm we stay colorful (we are
//                  explicitly NOT going black-and-white like the reference).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

// MIME follows the extension so the same analysis works on reference stills
// (jpg/webp) as on our own captures (png) -- comparing our frames against the
// reference's actual numbers is the whole point, and it is not much of a
// comparison if only one side can be decoded.
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };

async function analyze(page, file) {
  const b64 = fs.readFileSync(file).toString('base64');
  const mime = MIME[path.extname(file).toLowerCase()] || 'image/png';
  return await page.evaluate(async ({ b64, mime }) => {
    const img = new Image();
    img.src = 'data:' + mime + ';base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const n = c.width * c.height;

    const luma = new Float32Array(n);
    const hist = new Uint32Array(256);
    let satSum = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luma[i] = y;
      hist[Math.min(255, Math.max(0, Math.round(y)))]++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      satSum += mx === 0 ? 0 : (mx - mn) / mx;
    }
    const pct = (target) => {
      let acc = 0; const want = n * target;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= want) return v; }
      return 255;
    };
    let mean = 0; for (let i = 0; i < n; i++) mean += luma[i]; mean /= n;
    let varr = 0; for (let i = 0; i < n; i++) { const dv = luma[i] - mean; varr += dv * dv; }
    const rms = Math.sqrt(varr / n);

    let shadow = 0, mid = 0, high = 0;
    for (let v = 0; v < 256; v++) {
      if (v < 64) shadow += hist[v]; else if (v < 192) mid += hist[v]; else high += hist[v];
    }

    // Sobel magnitude over the luma plane -> linework / detail density proxy.
    let edgeSum = 0, edgeN = 0;
    const W = c.width, H = c.height;
    for (let yy = 1; yy < H - 1; yy += 2) {
      for (let xx = 1; xx < W - 1; xx += 2) {
        const L = (px, py) => luma[py * W + px];
        const gx = -L(xx-1,yy-1) - 2*L(xx-1,yy) - L(xx-1,yy+1)
                 +  L(xx+1,yy-1) + 2*L(xx+1,yy) + L(xx+1,yy+1);
        const gy = -L(xx-1,yy-1) - 2*L(xx,yy-1) - L(xx+1,yy-1)
                 +  L(xx-1,yy+1) + 2*L(xx,yy+1) + L(xx+1,yy+1);
        edgeSum += Math.sqrt(gx * gx + gy * gy); edgeN++;
      }
    }
    return {
      p01: pct(0.01), p50: pct(0.50), p99: pct(0.99),
      mean: +mean.toFixed(1), rms: +rms.toFixed(1),
      shadowPct: +(100 * shadow / n).toFixed(1),
      midPct: +(100 * mid / n).toFixed(1),
      highPct: +(100 * high / n).toFixed(1),
      edge: +(edgeSum / edgeN).toFixed(1),
      sat: +(100 * satSum / n).toFixed(1)
    };
  }, { b64, mime });
}

async function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) { console.error('usage: node tonal.js <dir> [dir...]'); process.exit(1); }
  const root = '/tmp/claude-0/-home-user-WF-html-tester/d83ff3e4-3d42-580e-b8c5-ceb2b22aaf92/scratchpad/';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto('about:blank');

  const out = {};
  for (const dRaw of dirs) {
    const d = path.isAbsolute(dRaw) ? dRaw : root + dRaw;
    if (!fs.existsSync(d)) { out[dRaw] = { error: 'missing' }; continue; }
    const files = fs.readdirSync(d).filter(f => MIME[path.extname(f).toLowerCase()]).sort();
    const rows = {};
    const agg = { p01: 0, p50: 0, p99: 0, mean: 0, rms: 0, shadowPct: 0, highPct: 0, edge: 0, sat: 0 };
    for (const f of files) {
      const r = await analyze(page, path.join(d, f));
      rows[f.replace(path.extname(f), '')] = r;
      for (const k of Object.keys(agg)) agg[k] += r[k];
    }
    const c = files.length || 1;
    for (const k of Object.keys(agg)) agg[k] = +(agg[k] / c).toFixed(1);
    agg.range = +(agg.p99 - agg.p01).toFixed(1);
    out[dRaw] = { mean: agg, frames: rows };
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
