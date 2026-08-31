// Engine/editor vertical slice: drives the exact success sequence from the
// milestone brief, end to end, against the real game.
//
//   Launch -> Enter Editor -> Object Browser -> choose a real Withered Farm
//   object -> place it -> select it -> move/rotate/delete -> save -> reload
//   -> PLAY -> object exists in actual gameplay -> return to Editor
//
// Drives the editor's own command surface (the same functions its buttons
// call) rather than reaching into internals, so a passing run means the UI
// path works, not just that some private function does.
//
//   node tools/editor-test.js [url]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./render-audit/harness');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log((pass ? ' PASS ' : '*FAIL*') + ' ' + name + (detail ? '   ' + detail : ''));
}

(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = await H.boot(page, url);
  const read = fn => page.evaluate(fn);
  const frames = n => page.evaluate(k => window.__waitFrames(k), n);

  // ---- 1. game booted, campaign intact -------------------------------
  const boot = await read(() => ({
    solids: WORLD.solids.length,
    hasLevel: typeof LEVEL !== 'undefined',
    hasRegistry: typeof REGISTRY !== 'undefined',
    hasSandbox: typeof SANDBOX !== 'undefined',
    hasEditor: typeof EDITOR !== 'undefined',
    entries: REGISTRY.all().length,
    cats: REGISTRY.categories().map(c => c.name)
  }));
  check('game boots with campaign world built', boot.solids > 500, boot.solids + ' colliders');
  check('engine modules exist', boot.hasRegistry && boot.hasSandbox && boot.hasEditor);
  check('registry is populated', boot.entries > 20, boot.entries + ' entries');
  check('object browser has categories', boot.cats.length >= 4, boot.cats.join(', '));

  const campaignSolids = boot.solids;

  // ---- 2. enter editor ------------------------------------------------
  await page.evaluate(() => EDITOR.enter());
  await frames(2);
  const inEditor = await read(() => ({
    active: EDITOR.active,
    hasCam: !!EDITOR.camera,
    panelVisible: !document.getElementById('editor').classList.contains('hidden'),
    browserItems: document.querySelectorAll('#edBrowser [data-place]').length,
    locked: INPUT.engaged
  }));
  check('editor mode entered', inEditor.active && inEditor.hasCam);
  check('editor UI is visible', inEditor.panelVisible);
  check('object browser rendered from registry', inEditor.browserItems > 20,
    inEditor.browserItems + ' buttons');
  check('pointer lock released for the cursor', inEditor.locked === false);

  // ---- 3. place a real Withered Farm object ---------------------------
  const placed = await read(() => {
    const inst = EDITOR._place('prop_barrel', { x: 6, y: 0, z: 14 });
    return inst ? { id: inst.id, type: inst.type, count: SANDBOX.count,
                    solids: WORLD.solids.length } : null;
  });
  check('placed an object into the world', !!placed && placed.count === 1,
    placed ? placed.id + ' ' + placed.type : 'null');
  check('placing registered its collision', placed && placed.solids > campaignSolids,
    placed ? campaignSolids + ' -> ' + placed.solids : '');

  // ---- 4. selection ----------------------------------------------------
  const sel = await read(() => ({
    id: EDITOR.selection && EDITOR.selection.id,
    inspector: document.getElementById('edInspector').innerHTML.indexOf('Barrel') !== -1
  }));
  check('placed object is selected', sel.id === placed.id, String(sel.id));
  check('inspector shows the selection', sel.inspector);

  // ---- 5. move --------------------------------------------------------
  const moved = await read(() => {
    const i = SANDBOX.find(EDITOR.selection.id);
    const solid = i.handle.solids[0];
    const beforeX = solid ? solid.minX : null;
    SANDBOX.setTransform(i, { x: 20, y: 0, z: 30 }, null, null);
    return {
      pos: i.data.transform.position,
      colliderMovedBy: solid ? +(solid.minX - beforeX).toFixed(2) : null,
      worldX: i.object3D.position.x
    };
  });
  check('move updates the object', moved.pos.x === 20 && moved.pos.z === 30,
    JSON.stringify(moved.pos));
  check('move drags its collider with it', moved.colliderMovedBy === 14,
    'collider moved ' + moved.colliderMovedBy + ' (expected 14)');

  // ---- 6. rotate ------------------------------------------------------
  const rot = await read(() => {
    const i = SANDBOX.find(EDITOR.selection.id);
    SANDBOX.setTransform(i, null, Math.PI / 2, null);
    return { data: i.data.transform.rotation, mesh: i.object3D.rotation.y };
  });
  check('rotate updates the object', Math.abs(rot.data - Math.PI / 2) < 1e-6 &&
    Math.abs(rot.mesh - Math.PI / 2) < 1e-6, 'yaw=' + rot.data.toFixed(3));

  // ---- 7. duplicate ---------------------------------------------------
  const dup = await read(() => {
    EDITOR._duplicate(SANDBOX.find(EDITOR.selection.id));
    return { count: SANDBOX.count, selected: EDITOR.selection && EDITOR.selection.id };
  });
  check('duplicate makes a second object', dup.count === 2, dup.count + ' objects');

  // ---- 8. delete + undo/redo ------------------------------------------
  const del = await read(() => {
    const before = WORLD.solids.length;
    EDITOR._delete(SANDBOX.find(EDITOR.selection.id));
    return { count: SANDBOX.count, solidsFreed: before - WORLD.solids.length };
  });
  check('delete removes the object', del.count === 1, del.count + ' left');
  check('delete releases its collision', del.solidsFreed > 0,
    del.solidsFreed + ' colliders freed');

  const undone = await read(() => { EDITOR.undo(); return SANDBOX.count; });
  check('undo restores a deleted object', undone === 2, undone + ' objects');
  const redone = await read(() => { EDITOR.redo(); return SANDBOX.count; });
  check('redo re-deletes it', redone === 1, redone + ' objects');

  // ---- 9. place an enemy + a pickup (gameplay entities) ---------------
  await read(() => {
    EDITOR._place('enemy_howler', { x: 10, y: 0, z: 18 });
    EDITOR._place('spawn_player', { x: 4, y: 0, z: 12 });
  });
  const mixed = await read(() => ({
    count: SANDBOX.count,
    types: SANDBOX.instances.map(i => i.type)
  }));
  check('enemy and spawn placed', mixed.count === 3, mixed.types.join(', '));

  // ---- 10. save + reload ----------------------------------------------
  const saved = await read(() => {
    SANDBOX.name = 'HarnessMap';
    EDITOR._save();
    const raw = localStorage.getItem('wf-map-HarnessMap');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? {
      version: parsed.formatVersion,
      objects: parsed.objects.length,
      types: parsed.objects.map(o => o.type),
      firstPos: parsed.objects[0].transform.position
    } : null;
  });
  check('map saved to storage', !!saved && saved.objects === 3,
    saved ? 'v' + saved.version + ', ' + saved.objects + ' objects' : 'nothing stored');
  check('map stores registry ids, not geometry', !!saved &&
    saved.types.every(t => /^(prop_|enemy_|pickup_|spawn_)/.test(t)), saved && saved.types.join(', '));

  const reloaded = await read(() => {
    EDITOR._new();
    const empty = SANDBOX.count;
    EDITOR._load('HarnessMap');
    return {
      empty: empty, count: SANDBOX.count,
      pos: SANDBOX.instances[0].data.transform.position,
      name: SANDBOX.name
    };
  });
  check('new map clears the world', reloaded.empty === 0);
  check('load restores every object', reloaded.count === 3, reloaded.count + ' objects');
  check('load restores transforms', reloaded.pos.x === 20 && reloaded.pos.z === 30,
    JSON.stringify(reloaded.pos));

  // ---- 11. validation rejects bad maps --------------------------------
  const bad = await read(() => ({
    future: MAPIO.validate({ formatVersion: 99, objects: [] }),
    unknown: MAPIO.validate({ formatVersion: 1, objects: [{ id: 'a', type: 'nope', transform: { position: { x: 0, y: 0, z: 0 } } }] }),
    dupes: MAPIO.validate({ formatVersion: 1, objects: [
      { id: 'a', type: 'prop_barrel', transform: { position: { x: 0, y: 0, z: 0 } } },
      { id: 'a', type: 'prop_barrel', transform: { position: { x: 1, y: 0, z: 0 } } }] }),
    nanPos: MAPIO.validate({ formatVersion: 1, objects: [{ id: 'a', type: 'prop_barrel', transform: { position: { x: NaN, y: 0, z: 0 } } }] }),
    noVersion: MAPIO.validate({ objects: [] })
  }));
  check('rejects a future format version', !bad.future.ok &&
    /format version/i.test(bad.future.errors[0]), bad.future.errors[0]);
  check('rejects an unknown object type', !bad.unknown.ok &&
    /unknown type/.test(bad.unknown.errors[0]), bad.unknown.errors[0]);
  check('rejects duplicate ids', !bad.dupes.ok && /Duplicate/.test(bad.dupes.errors[0]),
    bad.dupes.errors[0]);
  check('rejects a malformed position', !bad.nanPos.ok, bad.nanPos.errors[0]);
  check('rejects a missing formatVersion', !bad.noVersion.ok, bad.noVersion.errors[0]);

  // ---- 12. PLAY -- the object must exist in actual gameplay -----------
  const beforePlay = await read(() => ({
    enemies: ENEMY.debugCount ? ENEMY.debugCount() : null,
    pickups: PICKUP.items.length
  }));
  await page.evaluate(() => EDITOR.play());
  await frames(4);
  const inPlay = await read(() => ({
    editorActive: EDITOR.active,
    panelHidden: document.getElementById('editor').classList.contains('hidden'),
    playerAt: { x: +PLAYER.position.x.toFixed(1), z: +PLAYER.position.z.toFixed(1) },
    // The placed barrel is a real prop in the real scene with real collision.
    barrelSolids: WORLD.solids.filter(s => s.minX > 18 && s.maxX < 24 && s.minZ > 28 && s.maxZ < 34).length,
    sandboxObjects: SANDBOX.count
  }));
  check('PLAY leaves editor mode', !inPlay.editorActive && inPlay.panelHidden);
  check('PLAY moved the player to the authored spawn',
    inPlay.playerAt.x === 4 && inPlay.playerAt.z === 12, JSON.stringify(inPlay.playerAt));
  check('placed object exists in gameplay with collision',
    inPlay.barrelSolids > 0, inPlay.barrelSolids + ' colliders at the placed position');
  check('sandbox survives the transition', inPlay.sandboxObjects === 3);

  // ---- 13. return to editor -------------------------------------------
  await page.evaluate(() => EDITOR.enter());
  await frames(2);
  const back = await read(() => ({
    active: EDITOR.active,
    count: SANDBOX.count,
    pos: SANDBOX.instances[0].data.transform.position,
    types: SANDBOX.instances.map(i => i.type).sort().join(',')
  }));
  check('returned to editor', back.active);
  check('edited world preserved across play', back.count === 3 &&
    back.pos.x === 20 && back.pos.z === 30, back.types);

  // ---- 14. campaign still intact --------------------------------------
  const campaign = await read(() => ({
    solids: WORLD.solids.length,
    spawnMarkers: WORLD.spawnMarkers.length,
    ladders: WORLD.ladders.length,
    portals: WORLD.portals.length,
    weaponOk: typeof WEAPON !== 'undefined' && !!WEAPON.update,
    levelOk: !!LEVEL.animated
  }));
  check('campaign colliders survive editing',
    campaign.solids >= campaignSolids, campaign.solids + ' (started ' + campaignSolids + ')');
  check('campaign world systems intact',
    campaign.spawnMarkers > 0 && campaign.ladders > 0 && campaign.portals > 0 &&
    campaign.weaponOk && campaign.levelOk,
    'markers=' + campaign.spawnMarkers + ' ladders=' + campaign.ladders + ' portals=' + campaign.portals);

  // ---- 15. capture/release leaves no residue ---------------------------
  const residue = await read(() => {
    const before = WORLD.solids.length;
    for (let i = 0; i < 12; i++) EDITOR._place('prop_crate', { x: 40 + i, y: 0, z: 40 });
    const peak = WORLD.solids.length;
    SANDBOX.instances.filter(i => i.type === 'prop_crate').forEach(i => SANDBOX.remove(i));
    return { before: before, peak: peak, after: WORLD.solids.length };
  });
  check('repeated place/delete leaks no colliders',
    residue.after === residue.before,
    residue.before + ' -> ' + residue.peak + ' -> ' + residue.after);

  console.log('\npageerrors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r.pass);
  console.log(results.length - failed.length + '/' + results.length + ' checks passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
