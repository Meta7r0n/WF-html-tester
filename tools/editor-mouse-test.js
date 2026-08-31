// Editor interaction: the mouse path specifically.
//
// tools/editor-test.js drives the editor's command layer -- the functions its
// buttons call. That proves the model works and proves nothing at all about
// whether a click reaches it. This drives real mouse events at real screen
// coordinates through the raycaster, which is where an editor actually breaks:
// a pick that hits the outline shell instead of the mesh, a ghost that eats
// its own raycast, a drag that reads the wrong plane.
//
//   node tools/editor-mouse-test.js [url] [shotDir]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const H = require('./render-audit/harness');

// Screenshots default to a 30s timeout. Under software rasterisation a single
// frame can take a second, so the default fires long before the compositor
// has anything to hand back -- that is the renderer being slow, not the page
// being broken.
function shot(page, file) {
  return page.screenshot({ path: file, timeout: 180000 });
}

// Click a DOM control, asserting hit-testability ourselves rather than
// leaning on Playwright's actionability wait. That wait samples the bounding
// box on animation frames, and at ~1fps under swiftshader it starves and
// times out on a button that is perfectly clickable. Checking
// elementFromPoint at the button's own centre is a STRONGER guarantee than
// the timeout gives us -- it proves a real click at that pixel would land on
// this element and not on something overlapping it.
async function clickControl(page, selector) {
  const probe = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, why: 'no such element' };
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ok: false, why: 'zero size' };
    el.scrollIntoView({ block: 'center' });
    const r2 = el.getBoundingClientRect();
    const x = Math.round(r2.left + r2.width / 2), y = Math.round(r2.top + r2.height / 2);
    const top = document.elementFromPoint(x, y);
    const hit = top === el || el.contains(top);
    return { ok: hit, x, y, why: hit ? '' : 'covered by ' +
      (top ? (top.id ? '#' + top.id : top.tagName) : 'nothing') };
  }, selector);
  if (!probe.ok) return probe;
  await page.mouse.click(probe.x, probe.y);
  return probe;
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log((pass ? ' PASS ' : '*FAIL*') + ' ' + name + (detail ? '   ' + detail : ''));
}

(async () => {
  const url = process.argv[2];
  const shotDir = process.argv[3] || 'editor-shots';
  fs.mkdirSync(shotDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = await H.boot(page, url);
  const read = fn => page.evaluate(fn);
  const frames = n => page.evaluate(k => window.__waitFrames(k), n);

  // Park the editor camera looking down at a known patch of open ground, so
  // screen-space coordinates map to predictable world positions.
  await page.evaluate(() => {
    EDITOR.enter();
    EDITOR.camera.position.set(6, 14, 30);
  });
  await frames(3);
  // Aim down at the yard. Done through the camera the editor actually uses.
  await page.evaluate(() => {
    const c = EDITOR.camera;
    c.rotation.order = 'YXZ';
    c.rotation.set(-0.85, 0, 0);
  });
  await frames(2);

  const centre = { x: 640, y: 380 };

  // ---- ghost follows the cursor ---------------------------------------
  await page.evaluate(() => EDITOR._setPlaceType('prop_barrel'));
  await frames(2);
  await page.mouse.move(centre.x, centre.y);
  await frames(2);
  const ghostAt = await read(() => {
    // The ghost is the only scene child that is neither the sandbox group nor
    // a gizmo and carries cloned transparent materials.
    let found = null;
    GAME.scene.children.forEach(c => {
      if (c.type === 'Group' && c !== SANDBOX.ensureGroup() && c.children.length) {
        let transparent = false;
        c.traverse(n => { if (n.material && n.material.opacity === 0.45) transparent = true; });
        if (transparent) found = { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) };
      }
    });
    return found;
  });
  check('placement ghost exists and tracks the cursor',
    !!ghostAt && Number.isFinite(ghostAt.x), JSON.stringify(ghostAt));

  await shot(page, path.join(shotDir, '1-ghost.png'));

  // ---- click to place --------------------------------------------------
  await page.mouse.click(centre.x, centre.y);
  await frames(2);
  const afterClick = await read(() => ({
    count: SANDBOX.count,
    sel: EDITOR.selection && EDITOR.selection.type,
    pos: EDITOR.selection && {
      x: +EDITOR.selection.data.transform.position.x.toFixed(2),
      z: +EDITOR.selection.data.transform.position.z.toFixed(2)
    }
  }));
  check('a click in the viewport places an object',
    afterClick.count === 1 && afterClick.sel === 'prop_barrel',
    JSON.stringify(afterClick.pos));
  check('placement lands somewhere real, not at the origin',
    afterClick.pos && (Math.abs(afterClick.pos.x) > 0.01 || Math.abs(afterClick.pos.z) > 0.01),
    JSON.stringify(afterClick.pos));

  const placedPos = afterClick.pos;

  // ---- deselect, then click the object to pick it ----------------------
  await page.evaluate(() => { EDITOR._setPlaceType(null); EDITOR._select(null); });
  await frames(2);
  const deselected = await read(() => !EDITOR.selection);
  check('selection can be cleared', deselected);

  // Project the placed object back to screen space and click exactly there,
  // rather than guessing a pixel -- the same self-checking trick the signage
  // captures used.
  const screenPt = await read(() => {
    const i = SANDBOX.instances[0];
    const p = i.data.transform.position;
    const v = new THREE.Vector3(p.x, p.y + 0.5, p.z).project(EDITOR.camera);
    const c = document.querySelector('#app canvas').getBoundingClientRect();
    return {
      x: Math.round(c.left + (v.x * 0.5 + 0.5) * c.width),
      y: Math.round(c.top + (-v.y * 0.5 + 0.5) * c.height),
      onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1
    };
  });
  check('placed object projects on screen', screenPt.onScreen,
    screenPt.x + ',' + screenPt.y);

  await page.mouse.click(screenPt.x, screenPt.y);
  await frames(2);
  const picked = await read(() => ({
    id: EDITOR.selection && EDITOR.selection.id,
    type: EDITOR.selection && EDITOR.selection.type,
    boxVisible: !!document.querySelector('#edInspector .ed-sel')
  }));
  check('clicking an object selects it (raycast pick)',
    picked.type === 'prop_barrel', String(picked.id));
  check('selection is reflected in the inspector', picked.boxVisible);

  await shot(page, path.join(shotDir, '2-selected.png'));

  // ---- drag to move ----------------------------------------------------
  await page.evaluate(() => EDITOR._setTool('move'));
  await page.mouse.move(screenPt.x, screenPt.y);
  await page.mouse.down();
  await page.mouse.move(screenPt.x + 130, screenPt.y + 40, { steps: 6 });
  await page.mouse.up();
  await frames(2);
  const dragged = await read(() => {
    const i = SANDBOX.instances[0];
    return {
      x: +i.data.transform.position.x.toFixed(2),
      z: +i.data.transform.position.z.toFixed(2),
      meshX: +i.object3D.position.x.toFixed(2),
      solidMinX: i.handle.solids.length ? +i.handle.solids[0].minX.toFixed(2) : null
    };
  });
  const movedBy = Math.hypot(dragged.x - placedPos.x, dragged.z - placedPos.z);
  check('dragging moves the object', movedBy > 1,
    JSON.stringify(placedPos) + ' -> ' + dragged.x + ',' + dragged.z);
  check('mesh follows the drag', Math.abs(dragged.meshX - dragged.x) < 0.01);
  check('collider follows the drag',
    dragged.solidMinX !== null && Math.abs(dragged.solidMinX - dragged.x) < 1.2,
    'solid.minX=' + dragged.solidMinX + ' obj.x=' + dragged.x);

  // One drag must be one undo step, not one per mousemove.
  const undoDepth = await read(() => {
    const before = SANDBOX.instances[0].data.transform.position.x;
    EDITOR.undo();
    return { before: +before.toFixed(2), after: +SANDBOX.instances[0].data.transform.position.x.toFixed(2) };
  });
  check('a whole drag is one undo step',
    Math.abs(undoDepth.after - placedPos.x) < 0.01,
    undoDepth.before + ' -> ' + undoDepth.after + ' (placed at ' + placedPos.x + ')');
  await page.evaluate(() => EDITOR.redo());

  // ---- wheel to rotate --------------------------------------------------
  await page.evaluate(() => EDITOR._setTool('rotate'));
  const beforeRot = await read(() => SANDBOX.instances[0].data.transform.rotation);
  await page.mouse.move(screenPt.x, screenPt.y);
  await page.mouse.wheel(0, 120);
  await frames(2);
  const afterRot = await read(() => SANDBOX.instances[0].data.transform.rotation);
  check('wheel rotates the selection with the rotate tool',
    Math.abs(afterRot - beforeRot) > 0.01,
    beforeRot.toFixed(3) + ' -> ' + afterRot.toFixed(3));

  // ---- right-drag looks, and must not select ---------------------------
  const camBefore = await read(() => ({ y: EDITOR.camera.rotation.y }));
  const selBefore = await read(() => EDITOR.selection && EDITOR.selection.id);
  await page.mouse.move(600, 300);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(720, 300, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await frames(2);
  const camAfter = await read(() => ({ y: EDITOR.camera.rotation.y }));
  const selAfter = await read(() => EDITOR.selection && EDITOR.selection.id);
  check('right-drag turns the editor camera',
    Math.abs(camAfter.y - camBefore.y) > 0.05,
    camBefore.y.toFixed(3) + ' -> ' + camAfter.y.toFixed(3));
  check('right-drag does not change selection', selAfter === selBefore);

  // ---- browser button places via the DOM --------------------------------
  await page.evaluate(() => EDITOR._select(null));
  const crateClick = await clickControl(page, '#edBrowser [data-place="prop_crate"]');
  check('browser button is genuinely clickable', crateClick.ok,
    crateClick.ok ? 'at ' + crateClick.x + ',' + crateClick.y : crateClick.why);
  await frames(2);
  const armed = await read(() => EDITOR._tool);
  check('clicking a browser item arms the place tool', armed === 'place', armed);
  await page.mouse.click(centre.x + 90, centre.y + 30);
  await frames(2);
  const two = await read(() => ({ count: SANDBOX.count, types: SANDBOX.instances.map(i => i.type) }));
  check('a browser-armed click places that object',
    two.count === 2 && two.types.indexOf('prop_crate') !== -1, two.types.join(', '));

  // ---- Escape cancels placement -----------------------------------------
  await clickControl(page, '#edBrowser [data-place="prop_tree"]');
  await frames(1);
  await page.keyboard.press('Escape');
  await frames(1);
  const cancelled = await read(() => EDITOR._tool);
  check('Escape cancels an armed placement', cancelled === 'select', cancelled);

  // ---- Delete key --------------------------------------------------------
  await page.evaluate(() => EDITOR._select(SANDBOX.instances[SANDBOX.count - 1]));
  await page.keyboard.press('Delete');
  await frames(1);
  const afterDel = await read(() => SANDBOX.count);
  check('Delete key removes the selection', afterDel === 1, afterDel + ' left');

  await shot(page, path.join(shotDir, '3-final.png'));

  // ---- the editor must not leak into gameplay ---------------------------
  await page.evaluate(() => EDITOR.play());
  await frames(4);
  const inPlay = await read(() => ({
    editorHidden: document.getElementById('editor').classList.contains('hidden'),
    gridVisible: (() => {
      let g = null;
      GAME.scene.children.forEach(c => { if (c.type === 'GridHelper') g = c; });
      return g ? g.visible : null;
    })(),
    ghostGone: (() => {
      let t = false;
      GAME.scene.traverse(n => { if (n.material && n.material.opacity === 0.45) t = true; });
      return !t;
    })()
  }));
  check('editor UI hidden during play', inPlay.editorHidden);
  check('editor grid hidden during play', inPlay.gridVisible === false, String(inPlay.gridVisible));
  check('placement ghost cleared on play', inPlay.ghostGone);
  await shot(page, path.join(shotDir, '4-playing.png'));

  console.log('\npageerrors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r.pass);
  console.log(results.length - failed.length + '/' + results.length + ' checks passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
