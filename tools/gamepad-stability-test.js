// Gamepad stability: what happens when the stored settings are NOT what the
// code that wrote them would have produced.
//
// localStorage is user-writable, shared across every version this origin has
// ever run, and survives changes to the code that wrote it. The setters in
// SETTINGS all validate; load() historically did not, and the pad settings
// fail silently when a bad value gets through -- a NaN dead zone makes
// `!(mag > dead)` true for every reading, so both sticks go dead with nothing
// logged. This seeds each hostile value directly into storage BEFORE the page
// script runs, then boots and checks the game came up sane.
//
// Deliberately does not enter gameplay: every assertion here is about module
// initialisation, so each scenario is a cheap page load rather than a full
// match start.
//
//   node tools/gamepad-stability-test.js [url]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const URL = process.argv[2] || 'http://localhost:8934/preview.html';
const KEY = 'wf-settings-v1';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log((pass ? ' PASS ' : '*FAIL*') + ' ' + name + (detail ? '   ' + detail : ''));
}

// Each scenario: a stored settings blob, and an assertion over what the game
// resolved it to. `read` runs in the page after boot.
const SCENARIOS = [
  {
    name: 'NaN dead zone does not kill the sticks',
    stored: { padDeadZone: NaN },          // serialises to null
    read: () => ({ dz: SETTINGS.padDeadZone, def: CONFIG.input.padDeadZone }),
    // null means absent, so it must land on the DEFAULT, not on the floor
    // of the valid range -- see the num() comment in SETTINGS.
    ok: r => r.dz === r.def,
    show: r => 'deadZone=' + r.dz + ' (default ' + r.def + ')'
  },
  {
    name: 'garbage dead zone falls back to the default',
    stored: { padDeadZone: 'wide-open' },
    read: () => ({ dz: SETTINGS.padDeadZone, def: CONFIG.input.padDeadZone }),
    ok: r => r.dz === r.def,
    show: r => 'deadZone=' + r.dz
  },
  {
    name: 'out-of-range dead zone is clamped, not rejected',
    stored: { padDeadZone: 0.99 },
    read: () => ({ dz: SETTINGS.padDeadZone }),
    ok: r => r.dz === 0.40,
    show: r => 'deadZone=' + r.dz
  },
  {
    name: 'null sensitivity does not kill look',
    stored: { padSensitivity: null },
    read: () => ({ s: SETTINGS.padSensitivity }),
    ok: r => r.s === 1,
    show: r => 'sens=' + r.s
  },
  {
    name: 'absurd sensitivity is clamped',
    stored: { padSensitivity: 1e9 },
    read: () => ({ s: SETTINGS.padSensitivity }),
    ok: r => r.s === 2.5,
    show: r => 'sens=' + r.s
  },
  {
    name: 'duplicate buttons resolve to one owner',
    // Both defaults live on separate buttons; storage puts them on one.
    stored: { padmap: { fire: 7, ads: 7 } },
    read: () => INPUT.getPadBindings(),
    ok: r => !(r.fire === 7 && r.ads === 7) && (r.fire === 7 || r.ads === 7),
    show: r => 'fire=' + r.fire + ' ads=' + r.ads
  },
  {
    name: 'a duplicate never leaves two actions on one button',
    stored: { padmap: { jump: 4, melee: 4, reload: 4 } },
    read: () => INPUT.getPadBindings(),
    ok: r => [r.jump, r.melee, r.reload].filter(v => v === 4).length === 1,
    show: r => 'jump=' + r.jump + ' melee=' + r.melee + ' reload=' + r.reload
  },
  {
    name: 'fractional index is dropped, default kept',
    stored: { padmap: { jump: 2.7 } },
    read: () => INPUT.getPadBindings(),
    ok: r => r.jump === 0,                  // PAD_DEFAULTS.jump
    show: r => 'jump=' + r.jump
  },
  {
    name: 'negative index is dropped, default kept',
    stored: { padmap: { reload: -3 } },
    read: () => INPUT.getPadBindings(),
    ok: r => r.reload === 2,
    show: r => 'reload=' + r.reload
  },
  {
    name: 'absurd index is dropped, default kept',
    stored: { padmap: { shield: 9999 } },
    read: () => INPUT.getPadBindings(),
    ok: r => r.shield === 15,
    show: r => 'shield=' + r.shield
  },
  {
    name: 'string index is dropped, default kept',
    stored: { padmap: { interact: 'RB' } },
    read: () => INPUT.getPadBindings(),
    ok: r => r.interact === 5,
    show: r => 'interact=' + r.interact
  },
  {
    name: 'a deliberate unbind still survives the trip',
    stored: { padmap: { prevWeapon: null, lantern: null } },
    read: () => INPUT.getPadBindings(),
    ok: r => r.prevWeapon === null && r.lantern === null,
    show: r => 'prevWeapon=' + r.prevWeapon + ' lantern=' + r.lantern
  },
  {
    name: 'padmap of the wrong type is ignored wholesale',
    stored: { padmap: 'not-an-object' },
    read: () => INPUT.getPadBindings(),
    ok: r => r.fire === 7 && r.jump === 0,
    show: r => 'fire=' + r.fire + ' jump=' + r.jump
  },
  {
    name: 'a totally corrupt blob leaves every default intact',
    raw: '{"padDeadZone":{},"padSensitivity":[],"padmap":[1,2,3],"padRumble":"maybe"}',
    read: () => ({
      dz: SETTINGS.padDeadZone, s: SETTINGS.padSensitivity,
      rumble: SETTINGS.padRumble, fire: INPUT.getPadBindings().fire,
      def: CONFIG.input.padDeadZone
    }),
    ok: r => r.dz === r.def && r.s === 1 && r.rumble === true && r.fire === 7,
    show: r => JSON.stringify(r)
  },
  {
    name: 'unparseable JSON leaves every default intact',
    raw: '{{{not json at all',
    read: () => ({ dz: SETTINGS.padDeadZone, s: SETTINGS.padSensitivity, def: CONFIG.input.padDeadZone }),
    ok: r => r.dz === r.def && r.s === 1,
    show: r => JSON.stringify(r)
  }
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [];

  for (const s of SCENARIOS) {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    page.on('pageerror', e => errors.push(s.name + ': ' + e.message));
    const blob = s.raw !== undefined ? s.raw : JSON.stringify(s.stored);
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, v); } catch (e) {}
    }, [KEY, blob]);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('loading');
      return !el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
    }, { timeout: 90000 });
    const r = await page.evaluate(s.read);
    check(s.name, s.ok(r), s.show ? s.show(r) : '');
    await page.close();
  }

  console.log('\npageerrors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r.pass);
  console.log(results.length - failed.length + '/' + results.length + ' checks passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})();
