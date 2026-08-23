// Shared boot + teleport for every capture/measurement script.
//
// This exists because the same teleport bug was copy-pasted into capture.js,
// sweep.js, sweep2.js and stab.js, and silently corrupted every frame any of
// them ever produced. Two separate faults, both invisible:
//
//   1. `PLAYER.yaw = y` did nothing. PLAYER exposes yaw and pitch as getters
//      with no setters, so in sloppy mode the assignment is discarded without
//      error. Every "vantage point" was pointing wherever the player happened
//      to be facing -- not where the harness asked. (Fixed in the game itself
//      by adding PLAYER.setLook(); this module uses it.)
//
//   2. The y coordinate was hardcoded per point (2.0, 2.2, 1.9...) rather than
//      resolved against the floor. Where that guess was above the ground the
//      player fell for several frames after the teleport, and where it was
//      below, they were inside geometry. stab.js caught northbarn falling
//      2.96 -> 0 over four frames while being measured: p50 read 97 on the
//      first frame and 23 once it landed. That single fact explains the whole
//      "same parameters measure differently" mystery, and it means the
//      northbarn "near-black void" that drove a lot of grade work was partly
//      an artifact of measuring a player who had fallen through the floor.
//
// So: resolve y off WORLD.groundAt like the dev console's tp does, aim with
// setLook, then WAIT FOR THE POSITION TO ACTUALLY HOLD and report it if it
// does not. A vantage point that cannot be reached should say so loudly
// rather than quietly returning a picture of somewhere else.

async function boot(page, url) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url || 'http://localhost:8934/preview.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('loading');
    return !el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
  }, { timeout: 90000 });
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('enterBtn').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('scarfHeroBtn').click());
  await page.waitForTimeout(400);
  await page.mouse.click(50, 50); await page.waitForTimeout(400);
  await page.mouse.click(60, 60); await page.waitForTimeout(2000);
  await page.mouse.click(640, 400); await page.waitForTimeout(400);

  await page.evaluate(() => {
    // Wait for N *rendered* frames. Under swiftshader a frame can take a full
    // second, so millisecond waits say nothing about how far the pipeline has
    // caught up after a teleport.
    window.__waitFrames = function (n) {
      return new Promise(resolve => {
        let left = n;
        const tick = () => { if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
    };

    window.__goto = function (x, z, yaw, pitch) {
      const y = WORLD.groundAt(x, z, PLAYER.position.y + 0.8, PLAYER.layerId);
      PLAYER.position.set(x, y, z);
      PLAYER.velocity.set(0, 0, 0);
      if (PLAYER.setLook) PLAYER.setLook(yaw, pitch);
      else return { ok: false, why: 'PLAYER.setLook missing -- game predates the look fix' };
      return { ok: true };
    };

    window.__where = function () {
      const p = PLAYER.position;
      return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
               yaw: +PLAYER.yaw.toFixed(3), pitch: +PLAYER.pitch.toFixed(3),
               grounded: PLAYER.grounded };
    };

    // Copies the live WebGL canvas into a 2D canvas inside an animation frame
    // (so it works without preserveDrawingBuffer) and reduces it to the same
    // statistics tonal.js computes offline.
    window.__measure = function () {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const src = document.querySelector('#app canvas');
          const w = 320, h = 180;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const x = c.getContext('2d');
          x.drawImage(src, 0, 0, w, h);
          const d = x.getImageData(0, 0, w, h).data;
          const n = w * h;
          const hist = new Uint32Array(256);
          let satSum = 0;
          for (let i = 0; i < n; i++) {
            const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
            hist[Math.min(255, Math.max(0, Math.round(0.2126*r + 0.7152*g + 0.0722*b)))]++;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            satSum += mx === 0 ? 0 : (mx - mn) / mx;
          }
          const pct = t => { let a = 0, want = n * t; for (let v = 0; v < 256; v++) { a += hist[v]; if (a >= want) return v; } return 255; };
          let shadow = 0, high = 0;
          for (let v = 0; v < 64; v++) shadow += hist[v];
          for (let v = 192; v < 256; v++) high += hist[v];
          resolve({ p50: pct(0.50), p99: pct(0.99),
                    sh: +(100*shadow/n).toFixed(1), hi: +(100*high/n).toFixed(1),
                    sat: +(100*satSum/n).toFixed(1) });
        });
      });
    };

    window.__applyParams = function (p) {
      const R = CONFIG.render;
      for (const k of Object.keys(p)) {
        if (k.startsWith('l.')) R.lights[k.slice(2)] = p[k]; else R.grade[k] = p[k];
      }
      // NOT `window.RENDERCORE`. The game declares `const RENDERCORE = ...` at
      // top level, and a top-level const does not become a property of window
      // -- it lives in the global lexical environment, reachable by bare name
      // only. So `window.RENDERCORE` was undefined, this guard was always
      // false, and syncLights() never ran: every light parameter written here
      // landed in CONFIG and was never pushed to the live rig.
      //
      // That is why cutting every light by 36% moved the measured median by
      // one point. It was not a clamp and not a weak effect -- nothing was
      // applied. Grade parameters were unaffected because RENDERCORE re-reads
      // CONFIG.render.grade every frame, which is exactly why grade
      // experiments appeared to work while every light axis looked inert.
      if (typeof RENDERCORE !== 'undefined' && RENDERCORE.syncLights) RENDERCORE.syncLights();
      else throw new Error('RENDERCORE.syncLights unreachable -- light params would silently no-op');
    };
  });

  // Drain the mouse delta our own boot clicks left pending. INPUT accumulates
  // movementX/Y and the frame loop consumes it once per frame -- so under
  // pointer lock the big jump from clicking (60,60) then (640,400) is still
  // sitting in the buffer when boot returns, and lands on the first frame
  // after it. That silently clobbered the FIRST vantage point of every run
  // (yaw came out -0.938 instead of the requested 0.28) while every later
  // point was fine, which is a nicely misleading failure: a set of eight
  // frames where exactly one is aimed wrong looks like a level problem, not a
  // harness one.
  await page.evaluate(() => window.__waitFrames(3));
  return errors;
}

// Teleport and hold. Returns { settled, where, warn } -- `warn` is set when the
// player did not end up where we asked, which is a fact about the level (a
// vantage point inside a wall, on a slope, over a hole), not something to
// paper over.
async function goTo(page, pt, settleFrames) {
  const settle = settleFrames || 4;
  const r = await page.evaluate(({ pos, yaw, pitch }) =>
    window.__goto(pos[0], pos[2], yaw, pitch), pt);
  if (r && r.ok === false) throw new Error('goto failed: ' + r.why);
  await page.evaluate(n => window.__waitFrames(n), settle);
  let where = await page.evaluate(() => window.__where());

  // One re-aim if a stray input delta moved us off the requested facing. The
  // boot drain above should make this unnecessary; it is kept because a look
  // that silently ends up somewhere else is the exact failure this module
  // exists to stop, and one cheap retry is worth more than a warning nobody
  // reads.
  if (Math.abs(where.yaw - pt.yaw) > 0.02) {
    await page.evaluate(({ yaw, pitch }) => PLAYER.setLook(yaw, pitch), pt);
    await page.evaluate(() => window.__waitFrames(2));
    where = await page.evaluate(() => window.__where());
  }

  const dx = Math.abs(where.x - pt.pos[0]), dz = Math.abs(where.z - pt.pos[2]);
  let warn = null;
  if (dx > 1.0 || dz > 1.0) warn = `moved ${dx.toFixed(1)},${dz.toFixed(1)} from the requested spot`;
  else if (Math.abs(where.yaw - pt.yaw) > 0.02) warn = `yaw is ${where.yaw} not ${pt.yaw}`;
  else if (!where.grounded) warn = 'not grounded (still falling?)';
  return { where, warn };
}

// Median of several consecutive frames, after settling. One frame is not a
// measurement when the renderer is this slow.
async function measure(page, samples) {
  const s = [];
  const n = samples || 3;
  for (let i = 0; i < n; i++) {
    s.push(await page.evaluate(() => window.__measure()));
    if (i < n - 1) await page.evaluate(() => window.__waitFrames(1));
  }
  const med = k => s.map(x => x[k]).sort((a, b) => a - b)[Math.floor(n / 2)];
  return { p50: med('p50'), p99: med('p99'), sh: med('sh'), hi: med('hi'), sat: med('sat') };
}

module.exports = { boot, goTo, measure };
