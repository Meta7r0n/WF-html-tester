// Builds the served, CDN-free copy of the game that every harness in this
// directory drives.
//
// index.html loads Three.js, GLTFLoader and PeerJS from CDNs. A headless run
// (and any offline check) cannot reach them, so pointing a harness straight at
// the file gets a blank page and a pile of confusing "THREE is not defined"
// errors. This rewrites those three tags to local copies, fetching them once
// if they are not already vendored.
//
// It also flips on preserveDrawingBuffer. Without it, reading pixels back off
// the canvas outside the rAF callback returns transparent black, which reads
// as "the renderer is broken" rather than "you asked at the wrong moment".
//
//   node tools/make-preview.js <outdir>
//
// Then serve <outdir> and point a harness at it:
//   cd <outdir> && python3 -m http.server 8934
//   node tools/gamepad-test.js
//
// The libraries are copied from tools/vendor/, never downloaded. A build step
// that reaches the network is a build step that fails in exactly the
// environments this exists to support -- CI, an offline machine, and this
// project's own sandbox, which cannot reach cdnjs at all. They are committed
// (about 770 KB, all three MIT) so this works with no network whatsoever.
const fs = require('fs');
const path = require('path');

// Pinned to the exact versions index.html asks for -- a preview built against
// a different Three.js is not the thing being tested. If a version here is
// bumped, replace the matching file in tools/vendor/ in the same commit.
const VENDOR = [
  { file: 'three.min.js',   url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' },
  { file: 'GLTFLoader.js',  url: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js' },
  { file: 'peerjs.min.js',  url: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js' }
];

(async () => {
  const outDir = path.resolve(process.argv[2] || 'preview-build');
  const src = path.join(__dirname, '..', 'index.html');
  if (!fs.existsSync(src)) throw new Error('cannot find index.html next to tools/');

  const vendorSrc = path.join(__dirname, 'vendor');
  const vendorDir = path.join(outDir, 'vendor');
  fs.mkdirSync(vendorDir, { recursive: true });

  for (const v of VENDOR) {
    const from = path.join(vendorSrc, v.file);
    if (!fs.existsSync(from)) {
      throw new Error('missing tools/vendor/' + v.file +
        '\n  Fetch it from ' + v.url + ' and drop it there.');
    }
    fs.copyFileSync(from, path.join(vendorDir, v.file));
    console.log('vendor/' + v.file + '  ' + fs.statSync(from).size + ' bytes');
  }

  let html = fs.readFileSync(src, 'utf8');
  let rewrites = 0;
  VENDOR.forEach(v => {
    if (html.indexOf(v.url) === -1) {
      // Loud, not silent: a CDN tag that changed upstream would otherwise
      // leave a preview that still points at the network and fails later,
      // far from the cause.
      console.warn('WARN  no tag found for ' + v.url + ' -- index.html may have changed');
      return;
    }
    html = html.split(v.url).join('vendor/' + v.file);
    rewrites++;
  });

  const RENDERER = "antialias: true, powerPreference: 'high-performance'";
  if (html.indexOf(RENDERER) === -1) {
    console.warn('WARN  renderer options not found -- preserveDrawingBuffer not applied');
  } else {
    html = html.replace(RENDERER, RENDERER + ', preserveDrawingBuffer: true');
  }

  const out = path.join(outDir, 'preview.html');
  fs.writeFileSync(out, html);

  // Assets are loaded at runtime by relative path, so the preview needs them
  // beside it or the GLB-backed bosses never appear.
  const assets = path.join(__dirname, '..', 'assets');
  if (fs.existsSync(assets)) {
    fs.cpSync(assets, path.join(outDir, 'assets'), { recursive: true });
    console.log('copied assets/');
  }

  console.log('wrote ' + out + '  (' + rewrites + '/' + VENDOR.length + ' CDN tags rewritten)');
  console.log('serve it with:  cd ' + outDir + ' && python3 -m http.server 8934');
})().catch(err => { console.error(String(err && err.message || err)); process.exit(1); });
