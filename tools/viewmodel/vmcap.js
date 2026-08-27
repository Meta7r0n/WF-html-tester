/* Deterministic viewmodel motion capture.
 *
 * The box is shared with several other agents' headless Chromiums, so
 * real-time rAF capture runs at well under 1fps and cannot be used to
 * judge animation timing. Instead this harness:
 *   1. wraps THREE.WebGLRenderer at load to grab the renderer and the
 *      (scene,camera) / (viewScene,viewCamera) pairs the game renders,
 *   2. freezes the game's rAF loop,
 *   3. steps PLAYER/WEAPON/FX by hand at a fixed dt,
 *   4. redraws ONLY the viewmodel scene (cheap) and snapshots it.
 * Frames are therefore exactly spaced in simulated time regardless of how
 * loaded the machine is, and are laid out as one contact sheet per burst.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

const BASE = (process.env.VMOUT || '/tmp/vmshots') + '/';
const URL = 'http://127.0.0.1:9102/preview.html';

const INIT_HOOK = `(() => {
  let _T;
  window.__cap = { seq: [], renderer: null };
  function patch(T) {
    if (!T || !T.WebGLRenderer || T.__capPatched) return !!(T && T.__capPatched);
    T.__capPatched = true;
    const Orig = T.WebGLRenderer;
    function Wrapped(opts) {
      const r = new Orig(opts);
      if (!window.__cap.renderer) window.__cap.renderer = r;
      const orig = r.render.bind(r);
      r.render = function (s, c) {
        const q = window.__cap.seq;
        q.push([s, c]);
        if (q.length > 10) q.shift();
        return orig(s, c);
      };
      return r;
    }
    Wrapped.prototype = Orig.prototype;
    T.WebGLRenderer = Wrapped;
    return true;
  }
  Object.defineProperty(window, 'THREE', {
    configurable: true,
    get() { return _T; },
    set(v) {
      _T = v;
      let tries = 0;
      (function poll() { if (patch(_T) || ++tries > 200) return; setTimeout(poll, 0); })();
    }
  });
})();`;

const RECORDER = `
window.__vm = {
  time: 0, frames: [], labels: [],
  crop: JSON.parse(window.__cropSpec || '{"x":430,"y":250,"w":850,"h":470}'), scale: parseFloat(window.__cropScale || '0.45'),
  init() {
    const cap = window.__cap;
    let view = null, world = null;
    cap.seq.forEach(p => {
      const c = p[1];
      if (!c || !c.isPerspectiveCamera) return;
      if (Math.abs(c.far - 12) < 0.01) view = p; else world = p;
    });
    this.renderer = cap.renderer;
    this.viewScene = view && view[0]; this.viewCamera = view && view[1];
    this.scene = world && world[0]; this.camera = world && world[1];
    this.time = 100;
    return !!(this.renderer && this.viewScene && this.viewCamera && this.camera);
  },
  freeze() {
    if (this._raf) return true;
    this._raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function () { return 0; };
    return true;
  },
  step(dt, n) {
    for (let i = 0; i < n; i++) {
      this.time += dt;
      try { PLAYER.update(dt, true, { x: 0, y: 0 }); } catch (e) { this.err = String(e); }
      try { WEAPON.update(dt, this.time, this.camera, true); } catch (e) { this.err = String(e); }
      try { FX.update(dt, this.time); } catch (e) { this.err = String(e); }
    }
  },
  draw() {
    const r = this.renderer;
    r.setRenderTarget(null);          // RENDERCORE may have left its RT bound
    r.setClearColor(0x9fa8ae, 1);
    r.clear(true, true, true);
    r.render(this.viewScene, this.viewCamera);
  },
  grab(label) {
    const cv = this.renderer.domElement;
    const sx = cv.width / (cv.clientWidth || cv.width);
    const sy = cv.height / (cv.clientHeight || cv.height);
    const w = Math.round(this.crop.w * this.scale), h = Math.round(this.crop.h * this.scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(cv, this.crop.x * sx, this.crop.y * sy,
      this.crop.w * sx, this.crop.h * sy, 0, 0, w, h);
    this.frames.push(c); this.labels.push(label || '');
  },
  reset() { this.frames = []; this.labels = []; this.err = null; },
  /* Every sheet says what the sim was actually doing on that frame. The
     old sheets could not distinguish a sprint pose from a player who was
     still falling and therefore never sprinting at all. */
  tag() {
    try {
      return (PLAYER.grounded ? 'g' : '-') + (PLAYER.sprinting ? 'S' : '-') +
        (PLAYER.aiming ? 'A' : '-') + ' v' + PLAYER.speedRatio.toFixed(2);
    } catch (e) { return '?'; }
  },
  /* Land the player somewhere real and face them. PLAYER.yaw/pitch are
     getters -- assigning to them is a silent no-op -- and a guessed y left
     the player falling through the first second of every capture. */
  place(x, z, yaw, pitch) {
    const y = WORLD.groundAt(x, z, PLAYER.position.y + 0.8, PLAYER.layerId);
    PLAYER.position.set(x, y, z);
    PLAYER.velocity.set(0, 0, 0);
    PLAYER.setLook(yaw, pitch);
    for (let i = 0; i < 30 && !PLAYER.grounded; i++) this.step(1 / 60, 1);
    return PLAYER.grounded;
  },
  /* Step the sim in fixed slices, snapshotting every 'every' slices. */
  run(opts) {
    const dt = opts.dt || 1 / 60;
    const every = opts.every || 1;
    const n = opts.frames || 20;
    this.reset();
    for (let i = 0; i < n; i++) {
      if (i > 0) this.step(dt, every);
      if (opts.at) { try { opts.at(i); } catch (e) { this.err = String(e); } }
      this.draw();
      this.grab((i * every * dt * 1000).toFixed(0) + 'ms ' + this.tag());
    }
    return this.err || null;
  },
  sheet(cols) {
    const f = this.frames; if (!f.length) return null;
    const w = f[0].width, h = f[0].height, rows = Math.ceil(f.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * w; c.height = rows * h;
    const g = c.getContext('2d');
    g.fillStyle = '#141414'; g.fillRect(0, 0, c.width, c.height);
    f.forEach((fr, i) => {
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      g.drawImage(fr, x, y);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      const label = i + ' · ' + this.labels[i];
      g.font = 'bold 12px monospace';
      const tw = g.measureText(label).width + 10;
      g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillRect(x + 2, y + 2, tw, 17);
      g.fillStyle = '#ffe27a'; g.fillText(label, x + 7, y + 15);
    });
    return c.toDataURL('image/jpeg', 0.88);
  }
};
`;

async function boot(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.indexOf('favicon') >= 0) return;
    errors.push('CONSOLE: ' + t.slice(0, 240));
  });
  await page.addInitScript(INIT_HOOK);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('loading');
    return !el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
  }, { timeout: 120000 });
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('enterBtn').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('scarfHeroBtn').click());
  await page.waitForTimeout(400);
  await page.mouse.click(50, 50);
  await page.waitForTimeout(300);
  await page.mouse.click(60, 60);
  // Wait for the game loop to have actually rendered a few frames so the
  // scene/camera pairs are recorded, however slow the machine is.
  await page.waitForFunction(() => window.__cap && window.__cap.seq.some(p => p[1] && p[1].isPerspectiveCamera && Math.abs(p[1].far - 12) < 0.01),
    { timeout: 180000 });
  await page.evaluate(([c, s]) => { window.__cropSpec = c; window.__cropScale = s; },
    [process.env.VMCROP || '{"x":430,"y":250,"w":850,"h":470}', process.env.VMSCALE || '0.45']);
  await page.evaluate(RECORDER);
  const ok = await page.evaluate(() => window.__vm.init() && window.__vm.freeze());
  if (!ok) throw new Error('capture init failed');
  return errors;
}

async function main() {
  const tag = process.argv[2] || 'run';
  const only = (process.argv[3] || 'all').split(',');
  const want = n => only.indexOf('all') >= 0 || only.indexOf(n) >= 0;
  const dir = BASE + tag;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = await boot(page);
  const notes = [];

  await page.evaluate(() => {
    window.__place = () => window.__vm.place(6, 18, 0.28, -0.02);
    window.__place();
    ['tinSixer', 'fieldhand', 'carrotCannon', 'scrapRailgun', 'sprayTorch',
     'seedSpitter', 'portalGun', 'glizzyGat', 'theClaw'].forEach(id => {
      try { WEAPON.grantWeapon(id, 999, { repeatPickup: true }); } catch (e) {}
    });
    WEAPON.refillAll();
  });

  // --- primitives -------------------------------------------------------
  const equip = id => page.evaluate(w => {
    WEAPON.setCurrent(w, true, true);
    WEAPON.refillAll();
    INPUT.clearActions();
    window.__place();
    window.__vm.step(1 / 60, 40);      // let it settle into its held pose
  }, id);

  async function sheet(name, cols) {
    const url = await page.evaluate(c => window.__vm.sheet(c), cols || 6);
    if (!url) { notes.push('no frames: ' + name); return; }
    fs.writeFileSync(dir + '/' + name + '.jpg', Buffer.from(url.split(',')[1], 'base64'));
  }

  // Fire a single shot at frame `fireAt`, capturing `frames` snapshots
  // `every` sim-steps apart. Non-automatic guns are temporarily flipped to
  // automatic so the trigger can be driven without pointer lock; the fire
  // path, timings and recoil are identical either way.
  async function fireBurst(name, id, o) {
    await equip(id);
    const err = await page.evaluate(([w, opt]) => {
      const d = CONFIG.weapons[w];
      const wasAuto = d.automatic;
      d.automatic = true;
      const r = window.__vm.run({
        dt: 1 / 60, every: opt.every, frames: opt.frames,
        at: i => {
          if (opt.hold) { INPUT.actions.fire = i >= opt.fireAt; return; }
          INPUT.actions.fire = (i === opt.fireAt);
        }
      });
      INPUT.actions.fire = false;
      d.automatic = wasAuto;
      return r;
    }, [id, o]);
    if (err) notes.push(name + ' ERR ' + err);
    await sheet(name, o.cols || 5);
  }

  // --- bursts -----------------------------------------------------------
  if (want('fire')) {
    await fireBurst('fire-pipePopper', 'pipePopper', { frames: 24, every: 2, fireAt: 2 });
    await fireBurst('fine-pipePopper', 'pipePopper', { frames: 20, every: 1, fireAt: 3 });
    await fireBurst('fine-glizzyGat', 'glizzyGat', { frames: 20, every: 1, fireAt: 3 });
    await fireBurst('fire-glizzyGat', 'glizzyGat', { frames: 24, every: 4, fireAt: 2 });
    await fireBurst('fire-tinSixer', 'tinSixer', { frames: 20, every: 2, fireAt: 2 });
    await fireBurst('fire-fieldhand', 'fieldhand', { frames: 20, every: 1, fireAt: 2 });
    await fireBurst('fire-carrotCannon', 'carrotCannon', { frames: 20, every: 3, fireAt: 2 });
    await fireBurst('fire-scrapRailgun', 'scrapRailgun', { frames: 24, every: 3, fireAt: 2 });
    await fireBurst('fire-portalGun', 'portalGun', { frames: 20, every: 3, fireAt: 2 });
  }
  if (want('auto')) {
    await fireBurst('auto-fieldhand', 'fieldhand', { frames: 24, every: 2, fireAt: 2, hold: true });
    await fireBurst('auto-seedSpitter', 'seedSpitter', { frames: 24, every: 2, fireAt: 2, hold: true });
  }

  if (want('reload')) {
    for (const [id, frames, every] of [
      ['pipePopper', 24, 4], ['glizzyGat', 24, 6], ['fieldhand', 24, 5],
      ['tinSixer', 24, 4], ['seedSpitter', 24, 6]
    ]) {
      await equip(id);
      // Drain the mag through the real fire path so the reload is legal.
      await page.evaluate(w => {
        const d = CONFIG.weapons[w];
        const wasAuto = d.automatic; d.automatic = true;
        let guard = 0;
        while (WEAPON.ammo > 0 && guard++ < 400) {
          INPUT.actions.fire = true;
          window.__vm.step(1 / 60, 2);
          INPUT.actions.fire = false;
          window.__vm.step(1 / 60, Math.ceil(d.fireInterval * 60) + 1);
        }
        d.automatic = wasAuto;
        INPUT.actions.fire = false;
        window.__vm.step(1 / 60, 12);
      }, id);
      // R stays latched in INPUT.pressed until the first stepped update
      // consumes it, so pressing it here starts the reload on frame 1.
      await page.keyboard.press('r');
      const err = await page.evaluate(([f, e]) => window.__vm.run({
        dt: 1 / 60, every: e, frames: f
      }), [frames, every]);
      if (err) notes.push('reload-' + id + ' ERR ' + err);
      await sheet('reload-' + id, 5);
    }
  }

  if (want('switch')) {
    for (const [from, to] of [['pipePopper', 'glizzyGat'], ['glizzyGat', 'fieldhand'],
                              ['fieldhand', 'unarmed'], ['unarmed', 'pipePopper']]) {
      await equip(from);
      const err = await page.evaluate(([a, b]) => window.__vm.run({
        dt: 1 / 60, every: 2, frames: 22,
        at: i => { if (i === 2) WEAPON.setCurrent(b, true, true); }
      }), [from, to]);
      if (err) notes.push('switch ERR ' + err);
      await sheet('switch-' + from + '-to-' + to, 5);
    }
  }

  if (want('ads')) {
    for (const id of ['fieldhand', 'tinSixer', 'glizzyGat']) {
      await equip(id);
      const err = await page.evaluate(() => window.__vm.run({
        dt: 1 / 60, every: 2, frames: 24,
        at: i => { INPUT.actions.ads = (i >= 2 && i < 15); }
      }));
      if (err) notes.push('ads ERR ' + err);
      await sheet('ads-' + id, 5);
      await page.evaluate(() => { INPUT.actions.ads = false; });
    }
  }

  if (want('idle')) {
    for (const id of ['pipePopper', 'glizzyGat']) {
      await equip(id);
      await page.evaluate(() => window.__vm.run({ dt: 1 / 60, every: 10, frames: 18 }));
      await sheet('idle-' + id, 5);
    }
  }

  if (want('move')) {
    await equip('pipePopper');
    let err = await page.evaluate(() => window.__vm.run({
      dt: 1 / 60, every: 3, frames: 24,
      at: i => { INPUT.actions.forward = i >= 1; INPUT.actions.sprint = i >= 1; }
    }));
    if (err) notes.push('sprint ERR ' + err);
    await sheet('sprint-pipePopper', 5);
    err = await page.evaluate(() => window.__vm.run({
      dt: 1 / 60, every: 2, frames: 20,
      at: i => { if (i === 1) { INPUT.actions.forward = false; INPUT.actions.sprint = false; } }
    }));
    if (err) notes.push('settle ERR ' + err);
    await sheet('settle-pipePopper', 5);
    await page.evaluate(() => INPUT.clearActions());
  }

  if (want('look')) {
    await equip('pipePopper');
    const err = await page.evaluate(() => window.__vm.run({
      dt: 1 / 60, every: 2, frames: 22,
      at: i => { if (i >= 2 && i < 10) WEAPON.addLook(90, 0); }
    }));
    if (err) notes.push('look ERR ' + err);
    await sheet('look-pipePopper', 5);
  }

  console.log(JSON.stringify({ dir, notes, errors: [...new Set(errors)] }, null, 2));
  await browser.close();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
