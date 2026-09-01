// The editor as a MODE: can a person find it, and can they get back out?
//
// Separate from editor-test.js (does the engine layer work) and
// editor-mouse-test.js (does the mouse reach it) because this covers the
// thing neither did: for two commits the editor was reachable only by an
// undocumented F2, and leaving it dropped you nowhere in particular.
//
// Everything here goes through the real buttons and the real click handlers,
// and asserts hit-testability rather than trusting that a click landed --
// the pause veil once swallowed every editor click while every programmatic
// check still passed.
//
//   node tools/editor-mode-test.js <port|url>
const { chromium } = (() => {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (e) { /* next */ }
  }
  console.error('playwright not found. Install it with:  npm i -D playwright');
  process.exit(1);
})();

const ARG = process.argv[2];
const URL = !ARG ? 'http://localhost:8934/preview.html'
  : /^\d+$/.test(ARG) ? 'http://localhost:' + ARG + '/preview.html'
  : ARG;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log((pass ? ' PASS ' : '*FAIL*') + '  ' + name + (detail !== undefined ? '   ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 744 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('loading');
    return !el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
  }, { timeout: 120000 });
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');       // past the splash
  await page.waitForTimeout(800);

  const frames = n => page.evaluate(count => new Promise(res => {
    let left = count;
    const tick = () => { if (--left <= 0) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), n);

  /* Click a control the way a person does, after proving the browser would
     actually deliver the click to it -- an element covered by a veil reports
     a perfectly good bounding box. */
  async function clickControl(id) {
    const probe = await page.evaluate(sel => {
      const el = document.getElementById(sel);
      if (!el) return { ok: false, why: 'no element' };
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { ok: false, why: 'zero size' };
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      if (!(top === el || el.contains(top))) {
        return { ok: false, why: 'covered by ' + (top ? (top.id || top.className || top.tagName) : 'nothing'), cx, cy };
      }
      return { ok: true, cx, cy };
    }, id);
    if (!probe.ok) return probe;
    await page.mouse.click(probe.cx, probe.cy);
    await frames(2);
    return probe;
  }

  /* ---------------- the entry point that did not exist ---------------- */
  const menuBtn = await page.evaluate(() => {
    const b = document.getElementById('startEditorBtn');
    if (!b) return { found: false };
    const r = b.getBoundingClientRect();
    return { found: true, label: b.textContent.trim(), visible: r.width > 0 && r.height > 0 };
  });
  check('main menu offers a Map Editor button', menuBtn.found && menuBtn.visible, menuBtn.label);

  const openProbe = await clickControl('startEditorBtn');
  check('the menu button is genuinely clickable', openProbe.ok, openProbe.why || ('at ' + openProbe.cx + ',' + openProbe.cy));

  let st = await page.evaluate(() => ({
    active: EDITOR.active, from: EDITOR.openedFrom,
    editorVisible: !document.getElementById('editor').classList.contains('hidden'),
    startHidden: document.getElementById('start').classList.contains('hidden'),
    entered: GAME.entered
  }));
  check('clicking it opens the editor', st.active && st.editorVisible, JSON.stringify(st));
  check('the start menu gets out of the way', st.startHidden);
  check('it knows it came from the menu', st.from === 'menu', st.from);
  check('no match was started just to open it', st.entered === false);

  // The editor panels have to be reachable, not merely present.
  const panel = await page.evaluate(() => {
    const b = document.querySelector('#edBrowser [data-place]');
    if (!b) return { ok: false, why: 'no browser items' };
    const r = b.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    return { ok: top === b || b.contains(top), what: b.textContent.trim() };
  });
  check('editor panels are clickable, not veiled', panel.ok, panel.what || panel.why);

  /* --------------------------- grid snapping -------------------------- */
  const snap = await page.evaluate(async () => {
    const out = {};
    out.defaultSize = EDITOR.snapSize;
    EDITOR._setPlaceType('prop_crate');
    EDITOR._setTool('place');
    return out;
  });
  check('snap is on by default', snap.defaultSize === 0.5, snap.defaultSize + ' m');

  // Place by clicking the viewport, then read back where it landed.
  await page.mouse.move(620, 430);
  await frames(2);
  await page.mouse.click(620, 430);
  await frames(3);
  const placed = await page.evaluate(() => {
    const i = SANDBOX.instances[SANDBOX.instances.length - 1];
    if (!i) return null;
    const p = i.data.transform.position;
    return { x: p.x, z: p.z, type: i.type };
  });
  const onGrid = placed && Math.abs(placed.x / 0.5 - Math.round(placed.x / 0.5)) < 1e-6 &&
                 Math.abs(placed.z / 0.5 - Math.round(placed.z / 0.5)) < 1e-6;
  check('a placed object lands on the snap grid', onGrid,
    placed ? placed.x + ',' + placed.z : 'nothing placed');

  const offGrid = await page.evaluate(async () => {
    const box = document.getElementById('edSnapOn');
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    return EDITOR.snapSize;
  });
  check('unticking Snap turns it off', offGrid === 0, String(offGrid));
  await page.evaluate(() => {
    const box = document.getElementById('edSnapOn');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const sel = document.getElementById('edSnapSize');
    sel.value = '2';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const bigger = await page.evaluate(() => EDITOR.snapSize);
  check('the grid size selector takes effect', bigger === 2, bigger + ' m');

  /* ------------------------- frame the selection ---------------------- */
  const framed = await page.evaluate(async () => {
    EDITOR._setTool('select');
    const inst = SANDBOX.instances[SANDBOX.instances.length - 1];
    EDITOR._select(inst);
    // Fly somewhere useless first, so framing has to actually move.
    EDITOR.camera.position.set(120, 60, 120);
    const before = EDITOR.camera.position.clone();
    EDITOR.focusSelection();
    const after = EDITOR.camera.position.clone();
    const p = inst.object3D.position;
    return {
      moved: before.distanceTo(after) > 1,
      near: after.distanceTo(p) < 30,
      dist: +after.distanceTo(p).toFixed(2)
    };
  });
  check('F frames the selection', framed.moved && framed.near, framed.dist + 'm away');

  /* ---------------------- and back out to the menu -------------------- */
  const exitProbe = await page.evaluate(() => {
    const b = document.querySelector('#edTools [data-tool="close"]');
    if (!b) return { ok: false, why: 'no Exit button' };
    const r = b.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    return { ok: top === b || b.contains(top), cx, cy, label: b.textContent.trim() };
  });
  check('the editor has an Exit button', exitProbe.ok, exitProbe.label || exitProbe.why);
  if (exitProbe.ok) { await page.mouse.click(exitProbe.cx, exitProbe.cy); await frames(3); }

  st = await page.evaluate(() => ({
    active: EDITOR.active,
    editorHidden: document.getElementById('editor').classList.contains('hidden'),
    startVisible: !document.getElementById('start').classList.contains('hidden'),
    bodyClass: document.body.classList.contains('editor-open')
  }));
  check('Exit leaves the editor', !st.active && st.editorHidden);
  check('Exit from the menu returns to the menu', st.startVisible, JSON.stringify(st));
  check('the HUD-hiding body class is cleared', !st.bodyClass);

  /* ------------- reopening, and playtest starting a real run ---------- */
  await clickControl('startEditorBtn');
  const play = await page.evaluate(async () => {
    // Give the playtest somewhere to put the player, the way an author would.
    EDITOR._setPlaceType('spawn_player');
    EDITOR._setTool('place');
    EDITOR._place('spawn_player', new THREE.Vector3(4, 0, 6));
    const btn = document.querySelector('#edTools [data-tool="play"]');
    btn.click();
    return { clicked: !!btn };
  });
  check('Play is reachable from a menu-opened editor', play.clicked);
  await page.waitForTimeout(2500);
  await frames(4);

  const after = await page.evaluate(() => ({
    editorActive: EDITOR.active,
    entered: GAME.entered,
    // The HUD is a set of elements each toggled with .on, not one #hud node.
    hudUp: document.getElementById('vitals').classList.contains('on'),
    editorHidden: document.getElementById('editor').classList.contains('hidden'),
    px: +PLAYER.position.x.toFixed(1), pz: +PLAYER.position.z.toFixed(1)
  }));
  check('playtest leaves the editor', !after.editorActive && after.editorHidden);
  check('playtest actually starts a run', after.entered === true, JSON.stringify(after));
  check('the player is dropped at the authored spawn',
    Math.abs(after.px - 4) < 1.5 && Math.abs(after.pz - 6) < 1.5, after.px + ',' + after.pz);

  // F2 back into the editor, which should now report a game origin.
  await page.keyboard.press('F2');
  await frames(3);
  const back = await page.evaluate(() => ({ active: EDITOR.active, from: EDITOR.openedFrom }));
  check('F2 returns to the editor from a playtest', back.active);
  check('it now knows a run is live', back.from === 'game', back.from);

  // And Exit mid-run lands on pause, not on the main menu.
  await page.evaluate(() => { EDITOR.close(); });
  await frames(3);
  const mid = await page.evaluate(() => ({
    active: EDITOR.active,
    pauseVisible: !document.getElementById('pause').classList.contains('hidden'),
    startVisible: !document.getElementById('start').classList.contains('hidden')
  }));
  check('Exit mid-run goes to pause, not the main menu',
    !mid.active && mid.pauseVisible && !mid.startVisible, JSON.stringify(mid));

  const pauseBtn = await page.evaluate(() => {
    const b = document.getElementById('pauseEditorBtn');
    if (!b) return { found: false };
    const r = b.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    return { found: true, clickable: top === b || b.contains(top), cx, cy };
  });
  check('pause offers a Map Editor button too', pauseBtn.found && pauseBtn.clickable);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
