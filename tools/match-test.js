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

  /* ============ the loop that makes custom levels a feature ============
     Build a level, SAVE it, come back to the main menu, pick it out of a
     list, play it, and beat it. Saving was already possible; being able to
     choose a saved level from the menu is what turns it into something you
     can hand to a friend. */
  const authored = await page.evaluate(async () => {
    const out = {};
    // Start from a clean slate so a re-run does not inherit stored levels.
    MAPIO.listSaved().slice().forEach(n => MAPIO.deleteLocal(n));

    EDITOR.enter('menu');
    SANDBOX.newMap('blank');
    SANDBOX.name = 'Gauntlet';
    const place = (type, x, z, props) => {
      const inst = EDITOR._place(type, new THREE.Vector3(x, 0, z));
      if (inst && props) {
        inst.data.properties = Object.assign(inst.data.properties || {}, props);
        return SANDBOX.rebuild(inst) || inst;
      }
      return inst;
    };
    place('spawn_player', 2, 2);
    place('spawn_enemy', 6, 2);
    place('boss_beat_slayer', 14, 2, { wilted: 0 });
    place('boss_bear_claw', -14, 2, { wilted: 2 });
    EDITOR._save();
    out.saved = MAPIO.listSaved();
    EDITOR.exit();
    return out;
  });
  check('saving in the editor puts the level in the saved list',
    authored.saved.join(',') === 'Gauntlet', authored.saved.join(','));

  // Back at the main menu, the level has to be findable and described.
  const listed = await page.evaluate(() => {
    UI.showStart();
    const btn = document.getElementById('startCustomBtn');
    const out = { hasButton: !!btn };
    if (btn) btn.click();
    const card = document.getElementById('customLevels');
    out.cardVisible = !!card && !card.classList.contains('hidden');
    out.startHidden = document.getElementById('start').classList.contains('hidden');
    const rows = document.querySelectorAll('#customLevelList .custom-level');
    out.rowCount = rows.length;
    out.rowName = rows[0] ? rows[0].querySelector('.custom-level-name').textContent : '';
    out.rowMeta = rows[0] ? rows[0].querySelector('.custom-level-meta').textContent : '';
    const play = rows[0] ? rows[0].querySelector('[data-play-level]') : null;
    out.hasPlay = !!play;
    // The Play button must actually be reachable, not merely present.
    if (play) {
      const r = play.getBoundingClientRect();
      const top = document.elementFromPoint(
        Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      out.playClickable = top === play || play.contains(top);
    }
    return out;
  });
  check('the main menu offers Custom Levels', listed.hasButton);
  check('it opens a chooser and gets the main menu out of the way',
    listed.cardVisible && listed.startHidden);
  check('the saved level is listed by name', listed.rowCount === 1 && listed.rowName === 'Gauntlet',
    listed.rowCount + ' row(s): ' + listed.rowName);
  check('the row describes the level without opening it',
    /blank ground/.test(listed.rowMeta) && /2 bosses @ 0\/2 wilted/.test(listed.rowMeta),
    listed.rowMeta);
  check('the row has a genuinely clickable Play button',
    listed.hasPlay && listed.playClickable);

  // Play it: through the real button, the real handler.
  await page.evaluate(() => {
    document.querySelector('#customLevelList [data-play-level]').click();
  });
  await frames(2);
  const chose = await page.evaluate(() => ({
    loaded: GAME.customLevel,
    terrain: SANDBOX.terrain,
    // Choosing a level goes to hero select, like every other single-player
    // start -- not straight into the run.
    heroSelectUp: !document.getElementById('playerSelect').classList.contains('hidden'),
    entered: GAME.entered
  }));
  check('choosing a level loads it and names it', chose.loaded === 'Gauntlet', String(chose.loaded));
  check("...and brings its own terrain with it", chose.terrain === 'blank', chose.terrain);
  check('it asks which farmhand first, like any single-player start',
    chose.heroSelectUp && chose.entered === false);

  // Through the real hero button, the real handler.
  await page.evaluate(() => { document.getElementById('scarfHeroBtn').click(); });
  await page.waitForTimeout(2500);
  await frames(4);
  const running = await page.evaluate(() => ({
    entered: GAME.entered,
    armed: MATCH.active,
    total: MATCH.total,
    px: +PLAYER.position.x.toFixed(1),
    pz: +PLAYER.position.z.toFixed(1),
    terrain: LEVEL.terrain,
    // The level's own objects are live, and the farm's are not.
    farmLive: WORLD.solids.filter(s => s.enabled !== false && s.tag !== 'fence').length
  }));
  check('the run starts', running.entered === true);
  check('its boss rules are armed', running.armed && running.total === 2, String(running.total));
  check('the player starts at the authored spawn',
    Math.abs(running.px - 2) < 1.5 && Math.abs(running.pz - 2) < 1.5,
    running.px + ',' + running.pz);
  check('the run is on the level\'s blank ground, not the farm',
    running.terrain === 'blank', running.terrain);

  /* ---------------------------- beating it ----------------------------
     The win condition is the one the author actually declared: every boss
     they placed. Driven through QUEST.bossDefeated, which is where all four
     of ENEMY's boss death sites already report to. */
  const beat = await page.evaluate(() => {
    const out = {};
    MATCH.update(0);                       // beat_slayer at 0
    out.firstOut = MATCH.rules.filter(r => r.spawned).length;
    QUEST.bossDefeated('beatSlayer', ENEMY.boss3);
    out.afterFirst = { defeated: MATCH.defeated, won: MATCH.won };
    MATCH.update(2);                       // bear_claw at 2
    out.bothOut = MATCH.rules.every(r => r.spawned);
    QUEST.bossDefeated('bearClaw', ENEMY.boss2);
    out.afterSecond = { defeated: MATCH.defeated, won: MATCH.won };
    return out;
  });
  check('the first boss comes out at its threshold', beat.firstOut === 1, String(beat.firstOut));
  check('putting it down counts one objective, not the level',
    beat.afterFirst.defeated === 1 && beat.afterFirst.won === false,
    JSON.stringify(beat.afterFirst));
  check('the second boss comes out at its own threshold', beat.bothOut);
  check('putting every authored boss down BEATS the level',
    beat.afterSecond.defeated === 2 && beat.afterSecond.won === true,
    JSON.stringify(beat.afterSecond));

  const ended = await page.evaluate(() => ({
    endCardUp: !document.getElementById('endGame').classList.contains('hidden')
  }));
  check('beating it shows the end card', ended.endCardUp);

  /* --------- retrying, and getting back to the campaign ---------------- */
  const retry = await page.evaluate(async () => {
    const out = {};
    const liveBefore = SANDBOX.instances.length;
    // "Again" is the button a player presses after dying — the retry that
    // matters for a level someone built to be hard.
    document.getElementById('againBtn').click();
    await new Promise(r => requestAnimationFrame(r));
    out.stillCustom = GAME.customLevel === 'Gauntlet';
    out.objectsIntact = SANDBOX.instances.length === liveBefore;
    // A retry has to re-arm, or the second attempt is a level with no bosses.
    out.rearmed = MATCH.active && MATCH.defeated === 0 && MATCH.won === false;
    out.spawnAgain = [+PLAYER.position.x.toFixed(1), +PLAYER.position.z.toFixed(1)];
    return out;
  });
  check('retrying keeps the level loaded', retry.stillCustom && retry.objectsIntact);
  check('retrying resets the boss ladder', retry.rearmed);
  check('retrying puts the player back at the authored spawn',
    Math.abs(retry.spawnAgain[0] - 2) < 1.5 && Math.abs(retry.spawnAgain[1] - 2) < 1.5,
    retry.spawnAgain.join(','));

  const backToCampaign = await page.evaluate(() => {
    const out = {};
    // "Start over" on the end card is the way back to the menu.
    document.getElementById('startOverBtn').click();
    out.clearedOnExit = GAME.customLevel === null;
    out.terrainBack = LEVEL.terrain === 'farm';
    out.mapEmpty = SANDBOX.count === 0;
    // And the farm is a farm again.
    out.farmLive = WORLD.solids.filter(s => s.enabled !== false).length > 1000;
    out.disarmed = MATCH.active === false;
    /* The consequence, which is the reason this matters: with MATCH still
       armed, ENEMY.update hands the boss slots to a finished match while
       QUEST stands down for it, so the next campaign run would have no boss
       encounters at all. */
    out.questBackInCharge = QUEST.updateProgress(0) === false && MATCH.active === false;
    // And no editor markers left standing in the world behind the menu.
    out.noStrayMarkers = SANDBOX.all.every(i =>
      !(i.object3D && i.object3D.userData.editorMarker && i.object3D.visible));
    return out;
  });
  check('leaving a custom level puts the campaign farm back',
    backToCampaign.clearedOnExit && backToCampaign.terrainBack &&
    backToCampaign.mapEmpty && backToCampaign.farmLive,
    JSON.stringify(backToCampaign));
  check('and disarms its match, handing bosses back to the campaign',
    backToCampaign.disarmed && backToCampaign.questBackInCharge);
  check('and leaves no editor markers standing in the world',
    backToCampaign.noStrayMarkers);

  const campaign = await page.evaluate(() => {
    const out = {};
    // Choosing Single-player must clear any level left loaded, or the
    // campaign would run with someone else's objects standing in it.
    GAME.loadCustomLevel('Gauntlet');
    out.loaded = GAME.customLevel === 'Gauntlet';
    document.getElementById('enterBtn').click();
    out.clearedByCampaign = GAME.customLevel === null;
    out.terrain = LEVEL.terrain;
    out.mapEmpty = SANDBOX.count === 0;
    return out;
  });
  check('picking Single-player clears a loaded custom level',
    campaign.loaded && campaign.clearedByCampaign && campaign.terrain === 'farm' &&
    campaign.mapEmpty, JSON.stringify(campaign));

  /* ------------------------ import and delete -------------------------- */
  const manage = await page.evaluate(() => {
    const out = {};
    UI.showStart();
    document.getElementById('startCustomBtn').click();
    // A file from a friend: validated, then saved under its own name.
    const wire = {
      formatVersion: 1,
      metadata: { name: "Friend's Gauntlet" },
      environment: { terrain: 'blank' },
      objects: [
        { id: 'a', type: 'spawn_player', transform: { position: { x: 0, y: 0, z: 0 } } },
        { id: 'b', type: 'boss_gardener', transform: { position: { x: 8, y: 0, z: 0 } },
          properties: { wilted: 7 } }
      ]
    };
    out.imported = GAME.importCustomLevel(wire, 'fallback');
    out.names = MAPIO.listSaved().slice().sort();

    // Junk is refused with a reason, not stored.
    out.junkRefused = GAME.importCustomLevel({ nope: true }, 'junk') === false;
    out.namesAfterJunk = MAPIO.listSaved().length;
    out.notice = document.getElementById('customLevelNotice').textContent;

    GAME.deleteCustomLevel('Gauntlet');
    out.afterDelete = MAPIO.listSaved().slice().sort();
    return out;
  });
  check('a level imported from a file is saved under its own name',
    manage.imported && manage.names.join('|') === "Friend's Gauntlet|Gauntlet",
    manage.names.join('|'));
  check('an invalid file is refused with a reason, not stored',
    manage.junkRefused && manage.namesAfterJunk === 2, manage.notice);
  check('deleting a level removes it from the list',
    manage.afterDelete.join('|') === "Friend's Gauntlet", manage.afterDelete.join('|'));

  // Clean up so a second run of this suite starts from nothing.
  await page.evaluate(() => {
    MAPIO.listSaved().slice().forEach(n => MAPIO.deleteLocal(n));
    UI.showStart();
  });

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
