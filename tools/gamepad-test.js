// Gamepad verification. Playwright cannot attach a physical pad, so a virtual
// one is installed over navigator.getGamepads BEFORE the page script runs and
// driven from the test. That exercises the real polling path in INPUT -- the
// same code a real pad would hit -- rather than calling internals directly.
//
//   node tools/gamepad-test.js [url]
//
// Needs a preview.html served somewhere (see tools/render-audit/README.md for
// how that is built and why the CDN tags are vendored for it).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
// The shared boot/goTo harness lives with the render-audit tools, not beside
// this file -- './harness' resolved to nothing and the script died on require
// before it could run a single check.
const H = require('./render-audit/harness');

const VIRTUAL_PAD = () => {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: false, touched: false, value: 0 });
  const pad = {
    id: 'Virtual Test Pad (STANDARD GAMEPAD)', index: 0, connected: true,
    mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: buttons,
    vibrationActuator: {
      // Record instead of buzz, so the rumble hooks are observable.
      log: [],
      playEffect: function (type, opts) { this.log.push({ type: type, opts: opts }); return Promise.resolve('complete'); }
    }
  };
  window.__pad = pad;
  window.__padSet = function (patch) {
    // Reset FIRST. It used to run last, so `{reset:true, axes:[...]}` -- the
    // natural way to write "clear everything, then push the stick here" --
    // silently zeroed the axes it had just been given, and the left-stick
    // tests failed against a pad that was never actually deflected.
    if (patch.reset) {
      pad.axes = [0, 0, 0, 0];
      pad.buttons.forEach(b => { b.pressed = false; b.value = 0; });
    }
    if (patch.axes) for (let i = 0; i < patch.axes.length; i++) pad.axes[i] = patch.axes[i];
    if (patch.buttons) {
      Object.keys(patch.buttons).forEach(k => {
        const v = patch.buttons[k];
        pad.buttons[k].pressed = v > 0.5;
        pad.buttons[k].value = v;
      });
    }
    pad.timestamp = performance.now();
  };
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: function () { return [pad]; }
  });
};

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? ' PASS ' : '*FAIL*') + ' ' + name + (detail ? '   ' + detail : ''));
}

(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(VIRTUAL_PAD);
  const errors = await H.boot(page, url);

  const set = p => page.evaluate(x => window.__padSet(x), p);
  const frames = n => page.evaluate(k => window.__waitFrames(k), n);
  const read = fn => page.evaluate(fn);

  // ---- detection -------------------------------------------------------
  await frames(2);
  check('pad detected', await read(() => INPUT.padConnected));
  check('pad name reported', (await read(() => INPUT.padName)).indexOf('Virtual Test Pad') === 0,
    await read(() => INPUT.padName));
  check('standard mapping flagged', await read(() => INPUT.padStandard));

  // ---- left stick -> movement -----------------------------------------
  await set({ reset: true }); await frames(2);
  const idle = await read(() => { const m = INPUT.moveAxes(); return { x: +m.x.toFixed(3), y: +m.y.toFixed(3) }; });
  check('idle stick is still', idle.x === 0 && idle.y === 0, JSON.stringify(idle));

  // Inside the dead zone (0.16 default) nothing should move.
  await set({ axes: [0.10, 0, 0, 0] }); await frames(2);
  const dz = await read(() => { const m = INPUT.moveAxes(); return +Math.hypot(m.x, m.y).toFixed(3); });
  check('dead zone swallows idle drift', dz === 0, 'mag=' + dz);

  await set({ axes: [0, -1, 0, 0] }); await frames(2);
  const fwd = await read(() => { const m = INPUT.moveAxes(); return { x: +m.x.toFixed(2), y: +m.y.toFixed(2) }; });
  check('stick up walks forward', fwd.y > 0.9 && Math.abs(fwd.x) < 0.05, JSON.stringify(fwd));

  await set({ reset: true, axes: [1, 0, 0, 0] }); await frames(2);
  const rgt = await read(() => { const m = INPUT.moveAxes(); return { x: +m.x.toFixed(2), y: +m.y.toFixed(2) }; });
  check('stick right strafes right', rgt.x > 0.9 && Math.abs(rgt.y) < 0.05, JSON.stringify(rgt));

  // Analog: half deflection must be meaningfully slower than full.
  await set({ reset: true, axes: [0, -0.55, 0, 0] }); await frames(2);
  const half = await read(() => +INPUT.moveAxes().y.toFixed(2));
  check('movement is analog, not binary', half > 0.2 && half < 0.85, 'half-push=' + half);

  // ---- right stick -> look --------------------------------------------
  await set({ reset: true }); await frames(3);
  const yaw0 = await read(() => PLAYER.yaw);
  await set({ axes: [0, 0, 1, 0] });
  await frames(8);
  await set({ reset: true }); await frames(2);
  const yaw1 = await read(() => PLAYER.yaw);
  check('right stick turns the camera', Math.abs(yaw1 - yaw0) > 0.02,
    'dyaw=' + (yaw1 - yaw0).toFixed(3));
  check('stick right turns right (yaw decreases)', yaw1 < yaw0,
    yaw0.toFixed(3) + ' -> ' + yaw1.toFixed(3));

  // Pitch, and then the same push with Invert Y on must go the other way.
  await page.evaluate(() => { SETTINGS.setPadInvertY(false); });
  await set({ reset: true }); await frames(2);
  await page.evaluate(() => PLAYER.setLook(0, 0));
  const p0 = await read(() => PLAYER.pitch);
  await set({ axes: [0, 0, 0, 1] }); await frames(8);
  await set({ reset: true }); await frames(2);
  const pNormal = (await read(() => PLAYER.pitch)) - p0;

  await page.evaluate(() => { SETTINGS.setPadInvertY(true); });
  await page.evaluate(() => PLAYER.setLook(0, 0));
  await set({ axes: [0, 0, 0, 1] }); await frames(8);
  await set({ reset: true }); await frames(2);
  const pInverted = await read(() => PLAYER.pitch);
  check('stick down looks down', pNormal < 0, 'dpitch=' + pNormal.toFixed(3));
  check('invert Y flips vertical look', pInverted > 0 && pNormal < 0,
    'normal=' + pNormal.toFixed(3) + ' inverted=' + pInverted.toFixed(3));
  await page.evaluate(() => { SETTINGS.setPadInvertY(false); });

  // Sensitivity should scale the same push.
  await page.evaluate(() => { SETTINGS.setPadSensitivity(0.5); PLAYER.setLook(0, 0); });
  await set({ axes: [0, 0, 1, 0] }); await frames(6);
  await set({ reset: true }); await frames(2);
  const slow = Math.abs(await read(() => PLAYER.yaw));
  await page.evaluate(() => { SETTINGS.setPadSensitivity(2.0); PLAYER.setLook(0, 0); });
  await set({ axes: [0, 0, 1, 0] }); await frames(6);
  await set({ reset: true }); await frames(2);
  const fast = Math.abs(await read(() => PLAYER.yaw));
  check('sensitivity scales look rate', fast > slow * 2,
    'x0.5=' + slow.toFixed(3) + '  x2.0=' + fast.toFixed(3));
  await page.evaluate(() => { SETTINGS.setPadSensitivity(1); });

  // ---- buttons ---------------------------------------------------------
  await set({ reset: true }); await frames(2);
  await set({ buttons: { 0: 1 } }); await frames(2);
  const jumpDown = await read(() => INPUT.actions.jump);
  await set({ reset: true }); await frames(2);
  const jumpUp = await read(() => INPUT.actions.jump);
  check('A presses and releases jump', jumpDown === true && jumpUp === false,
    'down=' + jumpDown + ' up=' + jumpUp);

  // Analog trigger: below the 0.35 threshold is not a press, above it is.
  await set({ buttons: { 7: 0.2 } }); await frames(2);
  const softPull = await read(() => INPUT.actions.fire);
  await set({ buttons: { 7: 0.9 } }); await frames(2);
  const hardPull = await read(() => INPUT.actions.fire);
  await set({ reset: true }); await frames(2);
  check('trigger respects its threshold', softPull === false && hardPull === true,
    'soft=' + softPull + ' hard=' + hardPull);

  // ---- the release guard ----------------------------------------------
  // Hold W, then press and release the pad button bound to the same action.
  // The old code cleared the action on the pad's release and stopped the
  // player dead while W was still down.
  await page.evaluate(() => { SETTINGS.setPadBinding('jump', 0); });
  await page.keyboard.down('Space');
  await frames(2);
  await set({ buttons: { 0: 1 } }); await frames(2);
  await set({ reset: true }); await frames(2);
  const heldThrough = await read(() => INPUT.actions.jump);
  await page.keyboard.up('Space'); await frames(2);
  const releasedAfter = await read(() => INPUT.actions.jump);
  check('pad release does not cancel a held key', heldThrough === true && releasedAfter === false,
    'duringPadRelease=' + heldThrough + ' afterKeyUp=' + releasedAfter);

  // Same rule between two keys that share one action (both Shifts = sprint).
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ShiftRight');
  await frames(2);
  await page.keyboard.up('ShiftRight');
  await frames(2);
  const stillSprinting = await read(() => INPUT.actions.sprint);
  await page.keyboard.up('ShiftLeft'); await frames(2);
  const sprintCleared = await read(() => !INPUT.actions.sprint);
  check('releasing one of a shared pair keeps the action',
    stillSprinting === true && sprintCleared === true,
    'afterOneUp=' + stillSprinting + ' afterBothUp=' + sprintCleared);

  // ---- rebinding + persistence ----------------------------------------
  const bindResult = await read(() => SETTINGS.setPadBinding('reload', 3));
  check('rebind reports the bumped action', bindResult.ok === true && bindResult.bumpedAction === 'nextWeapon',
    JSON.stringify(bindResult));
  const afterBind = await read(() => INPUT.getPadBindings());
  check('bumped action is left unbound, not shared',
    afterBind.reload === 3 && afterBind.nextWeapon === null,
    'reload=' + afterBind.reload + ' nextWeapon=' + afterBind.nextWeapon);

  await set({ buttons: { 3: 1 } }); await frames(2);
  const reloadOnY = await read(() => INPUT.actions.reload);
  await set({ reset: true }); await frames(2);
  check('rebound button drives the new action', reloadOnY === true);

  const stored = await read(() => JSON.parse(localStorage.getItem('wf-settings-v1')).padmap);
  check('binding persisted to localStorage', stored && stored.reload === 3 && stored.nextWeapon === null,
    JSON.stringify({ reload: stored && stored.reload, nextWeapon: stored && stored.nextWeapon }));

  await page.evaluate(() => SETTINGS.resetPadBindings());
  const afterReset = await read(() => INPUT.getPadBindings());
  check('reset restores defaults', afterReset.reload === 2 && afterReset.nextWeapon === 3,
    JSON.stringify({ reload: afterReset.reload, nextWeapon: afterReset.nextWeapon }));

  // A round trip through applyPadBindings must preserve a deliberate null.
  await page.evaluate(() => { INPUT.applyPadBindings({ shield: null, jump: 5 }); });
  const applied = await read(() => INPUT.getPadBindings());
  check('applyPadBindings honours an explicit null',
    applied.shield === null && applied.jump === 5,
    JSON.stringify({ shield: applied.shield, jump: applied.jump }));
  await page.evaluate(() => SETTINGS.resetPadBindings());

  // ---- rebind capture --------------------------------------------------
  // A button already held when the row opens must be ignored until released,
  // or opening the row with the pad would instantly re-assign that button.
  await set({ buttons: { 1: 1 } }); await frames(2);
  await page.evaluate(() => UI.setPadRebinding('shield'));
  await frames(3);
  const capturedWhileHeld = await read(() => INPUT.getPadBindings().shield);
  await set({ reset: true }); await frames(2);
  await set({ buttons: { 1: 1 } }); await frames(3);
  const capturedAfterCycle = await read(() => INPUT.getPadBindings().shield);
  await set({ reset: true }); await frames(2);
  check('capture ignores a button already down', capturedWhileHeld === 15,
    'shield=' + capturedWhileHeld);
  check('capture takes the next fresh press', capturedAfterCycle === 1,
    'shield=' + capturedAfterCycle);
  check('capture ends the listening state', (await read(() => UI.padRebindingAction)) === null);

  // While listening, the pad must not also play the game.
  await page.evaluate(() => { SETTINGS.resetPadBindings(); UI.setPadRebinding('shield'); });
  await set({ buttons: { 0: 1 } }); await frames(1);
  const jumpedWhileListening = await read(() => INPUT.actions.jump);
  await page.evaluate(() => UI.setPadRebinding(null));
  await set({ reset: true }); await frames(2);
  check('listening pad does not drive the game', jumpedWhileListening === false);
  await page.evaluate(() => SETTINGS.resetPadBindings());

  // ---- rumble ----------------------------------------------------------
  await page.evaluate(() => { window.__pad.vibrationActuator.log.length = 0; SETTINGS.setPadRumble(true); });
  await page.evaluate(() => INPUT.rumble(0.6, 0.3, 100));
  const rumbled = await read(() => window.__pad.vibrationActuator.log.length);
  await page.evaluate(() => { window.__pad.vibrationActuator.log.length = 0; SETTINGS.setPadRumble(false); });
  await page.evaluate(() => INPUT.rumble(0.6, 0.3, 100));
  const silent = await read(() => window.__pad.vibrationActuator.log.length);
  await page.evaluate(() => SETTINGS.setPadRumble(true));
  check('rumble fires when enabled', rumbled === 1, 'calls=' + rumbled);
  check('rumble respects the off switch', silent === 0, 'calls=' + silent);

  // Firing a weapon should reach the actuator through applyKick.
  await page.evaluate(() => { window.__pad.vibrationActuator.log.length = 0; });
  await set({ buttons: { 7: 1 } });
  await frames(10);
  await set({ reset: true }); await frames(2);
  const fireRumbles = await read(() => window.__pad.vibrationActuator.log.length);
  check('firing rumbles the pad', fireRumbles > 0, 'calls=' + fireRumbles);

  // ---- disconnect ------------------------------------------------------
  await set({ buttons: { 0: 1 } }); await frames(2);
  await page.evaluate(() => {
    window.__pad.connected = false;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [null] });
  });
  await frames(3);
  const afterUnplug = await read(() => ({
    connected: INPUT.padConnected,
    jump: INPUT.actions.jump,
    move: +Math.hypot(INPUT.moveAxes().x, INPUT.moveAxes().y).toFixed(3)
  }));
  check('unplug clears held buttons and movement',
    afterUnplug.connected === false && afterUnplug.jump === false && afterUnplug.move === 0,
    JSON.stringify(afterUnplug));

  console.log('\npageerrors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r.pass);
  console.log(results.length - failed.length + '/' + results.length + ' checks passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
