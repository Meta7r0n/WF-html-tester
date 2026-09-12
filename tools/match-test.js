// Authored matches: a blank map, bosses placed on it, and a per-boss kill
// threshold that decides when each one shows up.
//
// Separate from editor-test.js (does the engine layer work) and
// campaign-migration-test.js (did the farm survive) because this covers the
// thing neither does: whether a player can build a match, set its difficulty
// curve, and hand the file to someone else.
//
// The checks here lean on two facts that are easy to get wrong and invisible
// when you do:
//
//   1. A boss threshold is a NUMBER in the file. Stored as the input's
//      string, "25" >= 25 still passes by coercion, and the bug only
//      surfaces when something sorts or sums them.
//   2. QUEST's campaign encounter chain is welded to the farm's buildings.
//      On a blank map it can never complete, so an authored map has to
//      supersede it rather than run alongside it.
//
//   node tools/match-test.js <port|url>
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
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);

  const frames = n => page.evaluate(count => new Promise(res => {
    let left = count;
    const tick = () => { if (--left <= 0) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), n);

  /* ------------------------- bosses are placeable ---------------------- */
  const registry = await page.evaluate(() => {
    const cats = REGISTRY.categories();
    const bosses = cats.filter(c => c.name === 'Bosses')[0];
    return {
      hasCategory: !!bosses,
      ids: bosses ? bosses.items.map(i => i.id) : [],
      // Every boss entry must declare which encounter it drives, or MATCH
      // cannot tell it apart from an ordinary marker.
      allTagged: bosses ? bosses.items.every(i => !!i.bossEncounter) : false,
      // And every one must offer a threshold the author can change.
      allHaveThreshold: bosses
        ? bosses.items.every(i => i.properties && i.properties.wilted &&
            i.properties.wilted.type === 'number')
        : false
    };
  });
  check('the object browser has a Bosses category', registry.hasCategory);
  check('all five bosses are placeable', registry.ids.length === 5, registry.ids.join(','));
  check('each boss declares the encounter it drives', registry.allTagged);
  check('each boss exposes a numeric Wilted threshold', registry.allHaveThreshold);

  /* --------------------------- build a match --------------------------- */
  const built = await page.evaluate(() => {
    const out = {};
    EDITOR.enter('menu');
    SANDBOX.newMap('blank');
    out.terrain = SANDBOX.terrain;

    const place = (type, x, z, props) => {
      const inst = EDITOR._place(type, new THREE.Vector3(x, 0, z));
      if (inst && props) {
        inst.data.properties = Object.assign(inst.data.properties || {}, props);
        return SANDBOX.rebuild(inst) || inst;
      }
      return inst;
    };
    place('spawn_player', 0, 0);
    place('boss_beat_slayer', 10, 0, { wilted: 5 });
    place('boss_bear_claw', -10, 0, { wilted: 12 });
    place('boss_carrot_warden', 0, 14, { wilted: 30 });
    // Authored out of order on purpose -- the ladder must come back sorted.
    place('boss_gardener', 0, -14, { wilted: 1 });

    out.placed = SANDBOX.count;
    const ladder = MATCH.preview();
    out.order = ladder.map(r => r.encounter);
    out.thresholds = ladder.map(r => r.wilted);
    out.thresholdTypes = ladder.map(r => typeof r.wilted);
    out.positions = ladder.map(r => [r.position.x, r.position.z].join(','));
    return out;
  });
  check('a new blank map starts on blank ground', built.terrain === 'blank', built.terrain);
  check('the match placed its spawn and four bosses', built.placed === 5, String(built.placed));
  check('the boss ladder is sorted by threshold, not click order',
    built.thresholds.join(',') === '1,5,12,30', built.thresholds.join(','));
  check('...and names the right encounter at each step',
    built.order.join(',') === 'gardener,beatSlayer,bearClaw,carrotWarden', built.order.join(','));
  check('each boss keeps the position it was placed at',
    built.positions.join(' ') === '0,-14 10,0 -10,0 0,14', built.positions.join(' '));

  /* -------------------- thresholds survive a round trip ---------------- */
  const trip = await page.evaluate(() => {
    const out = {};
    const map = SANDBOX.serialize();
    out.terrainInFile = map.environment && map.environment.terrain;
    const bosses = map.objects.filter(o => /^boss_/.test(o.type));
    out.bossesInFile = bosses.length;
    // The value in the FILE has to be a number. Stored as a string it still
    // compares correctly against a kill count by coercion, so nothing here
    // would fail -- until a later feature sorts or sums these.
    out.allNumeric = bosses.every(o => typeof o.properties.wilted === 'number');
    out.valid = MAPIO.validate(map).ok;

    // Through JSON and back, the way a shared file actually travels.
    const wire = JSON.parse(JSON.stringify(map));
    const res = SANDBOX.load(wire);
    out.reloaded = res.ok;
    out.terrainAfter = SANDBOX.terrain;
    const ladder = MATCH.preview();
    out.thresholdsAfter = ladder.map(r => r.wilted).join(',');
    out.orderAfter = ladder.map(r => r.encounter).join(',');

    // A map that says nothing about terrain is a pre-terrain file and means
    // the farm -- every map saved before this feature existed.
    const legacy = JSON.parse(JSON.stringify(map));
    delete legacy.environment;
    out.legacyValid = MAPIO.validate(legacy).ok;
    SANDBOX.load(legacy);
    out.legacyTerrain = SANDBOX.terrain;

    // And a nonsense terrain is rejected rather than silently treated as farm.
    const bad = JSON.parse(JSON.stringify(map));
    bad.environment = { terrain: 'moon' };
    const report = MAPIO.validate(bad);
    out.badRejected = !report.ok;
    out.badMessage = report.errors[0] || '';
    return out;
  });
  check('the file records its terrain', trip.terrainInFile === 'blank', String(trip.terrainInFile));
  check('the file carries all four bosses', trip.bossesInFile === 4, String(trip.bossesInFile));
  check('a threshold is stored as a NUMBER, not the input string', trip.allNumeric);
  check('the authored map validates', trip.valid);
  check('it survives JSON and reloads', trip.reloaded && trip.terrainAfter === 'blank',
    trip.terrainAfter);
  check('the ladder is unchanged after the round trip',
    trip.thresholdsAfter === '1,5,12,30' && trip.orderAfter === 'gardener,beatSlayer,bearClaw,carrotWarden',
    trip.thresholdsAfter);
  check('a map with no environment block still loads (pre-terrain file)',
    trip.legacyValid && trip.legacyTerrain === 'farm', trip.legacyTerrain);
  check('an unknown terrain is rejected, not silently treated as farm',
    trip.badRejected, trip.badMessage);

  /* ------------------- the threshold drives the spawn ------------------- */
  // Back to the authored blank match, then run it.
  const armed = await page.evaluate(() => {
    const out = {};
    SANDBOX.newMap('blank');
    const place = (type, x, z, props) => {
      const inst = EDITOR._place(type, new THREE.Vector3(x, 0, z));
      if (inst && props) {
        inst.data.properties = Object.assign(inst.data.properties || {}, props);
        return SANDBOX.rebuild(inst) || inst;
      }
      return inst;
    };
    place('spawn_player', 0, 0);
    place('boss_beat_slayer', 12, 0, { wilted: 3 });
    out.notArmedYet = MATCH.active === false;
    SANDBOX.activateGameplay();
    out.armed = MATCH.active === true;
    out.ruleCount = MATCH.rules.length;

    // Below the threshold: nothing.
    MATCH.update(2);
    out.quietBelow = MATCH.rules.every(r => !r.spawned) && ENEMY.bossState3 === 'inactive';
    // At it: the boss appears, at the authored position.
    MATCH.update(3);
    out.firedAt = MATCH.rules[0].spawned === true;
    out.bossLive = ENEMY.bossState3 === 'active';
    return out;
  });
  check('MATCH is not armed while editing', armed.notArmedYet);
  check('starting a run arms the authored match', armed.armed && armed.ruleCount === 1,
    String(armed.ruleCount));
  check('below the threshold no boss appears', armed.quietBelow);
  check('at the threshold the boss spawns', armed.firedAt && armed.bossLive);

  const placement = await page.evaluate(() => ({
    // Ground-resolved, so compare x/z -- y is whatever the arena floor is.
    x: +ENEMY.boss3.pos.x.toFixed(1),
    z: +ENEMY.boss3.pos.z.toFixed(1)
  }));
  check('the boss spawned where the author put it, not at the campaign point',
    Math.abs(placement.x - 12) < 1.5 && Math.abs(placement.z) < 1.5,
    placement.x + ',' + placement.z);

  /* --------- an authored match supersedes the campaign chain ------------ */
  const supersede = await page.evaluate(() => {
    const out = {};
    // QUEST's chain is welded to the farm's buildings. With a match armed it
    // must stand down rather than race MATCH for the same boss slots.
    out.questStandsDown = QUEST.updateProgress(999) === false;
    SANDBOX.deactivateGameplay();
    out.disarmed = MATCH.active === false;
    return out;
  });
  check('QUEST\'s campaign chain stands down for an authored match',
    supersede.questStandsDown);
  check('leaving play disarms the match', supersede.disarmed);

  /* ------------ a map with no bosses changes nothing at all ------------- */
  const plain = await page.evaluate(() => {
    const out = {};
    SANDBOX.newMap('farm');
    EDITOR._place('prop_barrel', new THREE.Vector3(3, 0, 3));
    SANDBOX.activateGameplay();
    out.notArmed = MATCH.active === false;
    out.terrain = SANDBOX.terrain;
    SANDBOX.deactivateGameplay();
    SANDBOX.newMap('farm');
    EDITOR.exit();
    return out;
  });
  check('a map that declares no bosses leaves the campaign alone',
    plain.notArmed && plain.terrain === 'farm');

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
