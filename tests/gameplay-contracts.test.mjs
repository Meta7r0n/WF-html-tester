import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const questStart = html.indexOf('const QUEST = (() => {');
const questEnd = html.indexOf('/* ============================== [GAME] =============================== */', questStart);
const quest = html.slice(questStart, questEnd);
const statsStart = html.indexOf('const RUNSTATS = (() => {');
const statsEnd = html.indexOf('const QUEST = (() => {', statsStart);
const runStatsSource = html.slice(statsStart, statsEnd);

test('visible and runtime build labels identify v0.38', () => {
  assert.match(html, /<title>The Withered Farm — v0\.38<\/title>/);
  assert.match(html, /WC v0\.38/);
  assert.match(html, /version: 'v0\.38'/);
  assert.match(html, /branch: 'A-test-v0\.38-BARN-CRAFTING-FIX'/);
  assert.doesNotMatch(html, /WC v0\.37/);
});

function createQuestHarness(overrides = {}) {
  const spawns = [];
  const accesses = {
    south: { open: false, changes: [] },
    west: { open: false, changes: [] },
    hatch: { open: false, changes: [] }
  };
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  }
  const enemy = {
    kills: 0,
    spawnBoss3: options => { spawns.push(['beatSlayer', options]); return {}; },
    spawnBoss2: (appearance, options) => {
      spawns.push(['bearClaw', appearance, options]);
      return { pos: { set() {} }, group: { position: { copy() {} } } };
    },
    spawnBoss: options => { spawns.push(['carrotWarden', options]); return {}; },
    spawnGrunt: () => ({
      alive: true, def: { stats: {} }, group: { scale: { setScalar() {} } },
      headProxy: { scale: { multiplyScalar() {} } }, bodyProxy: { scale: { multiplyScalar() {} } }
    }),
    clearQuestEnemies() {}
  };
  // Tracks addEventListener/removeEventListener registrations so a test can
  // fire a fake 'pointerdown'/'keydown' the same way a real user gesture
  // would, without depending on any real browser or real elapsed time.
  const listeners = { pointerdown: [], keydown: [] };
  const windowMock = {
    addEventListener(type, fn) { if (listeners[type]) listeners[type].push(fn); },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      const i = listeners[type].indexOf(fn);
      if (i >= 0) listeners[type].splice(i, 1);
    },
    trigger(type) { listeners[type].slice().forEach(fn => fn()); }
  };
  const resumeCalls = [];
  const context = vm.createContext({
    CONFIG: { progress: {
      singleBeatSlayerThreshold: 33, singleBearClawThreshold: 66,
      singleCarrotWardenThreshold: 99, singleGardenerThreshold: 132
    } },
    GAME: { mode: 'single', complete() {}, resumeAfterQuestCutscene() { resumeCalls.push(true); } },
    PLAYER: { layerId: 'surface' },
    ENEMY: enemy,
    INPUT: { clearActions() {}, releaseLock() {} },
    WEAPON: { grantWeapon() {}, setCurrent() {} },
    LEVEL: overrides.LEVEL || {
      setNorthBarnAccess(id, open) {
        accesses[id].open = !!open;
        accesses[id].changes.push(accesses[id].open);
      },
      isNorthBarnAccessOpen(id) { return accesses[id].open; },
      northBarnAccessAt(p) {
        if (p.x < 36) return { id: 'west', label: 'west barn doors' };
        if (p.x > 55 && p.z < -70) return { id: 'hatch', label: 'cellar hatch' };
        return { id: 'south', label: 'south barn doors' };
      }
    },
    UI: { toast() {}, setBoss() {} }, RUNSTATS: { milestone() {}, bossStart() {}, weapon() {} },
    WORLD: { groundAt() { return 0; } },
    THREE: {
      Vector3,
      Mesh: class { constructor() { this.position = { set() {} }; this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { setScalar() {} }; this.material = {}; } },
      TorusGeometry: class {}, MeshBasicMaterial: class {}, CircleGeometry: class {}
    },
    window: windowMock,
    document: { getElementById() { return null; } }, performance: { now() { return 0; } },
    setTimeout() {}, console
  });
  vm.runInContext(quest + '\n;globalThis.__quest = QUEST;', context);
  return { quest: context.__quest, enemy, spawns, accesses, game: context.GAME, window: windowMock, resumeCalls };
}

function createRunStatsHarness() {
  let now = 100;
  const clockSpan = { textContent: '' };
  const runClock = { classList: { toggle() {} }, querySelector() { return clockSpan; } };
  const report = { innerHTML: '' };
  const context = vm.createContext({
    performance: { now() { return now; } },
    document: { getElementById(id) { return id === 'runClock' ? runClock : id === 'runStats' ? report : null; } },
    GAME: { mode: 'single' },
    CONFIG: { ultra: { active: true } },
    HERO: { label: 'Larry' },
    AVIATION_AVATAR: { enabled: false, tokenId: null },
    console
  });
  vm.runInContext(runStatsSource + '\n;globalThis.__runStats = RUNSTATS;', context);
  return { stats: context.__runStats, report, advance(ms) { now += ms; } };
}

test('single-player boss order is cumulative-quantity gated', () => {
  const ordered = [
    "stage: 1, id: 'beatSlayer'",
    "stage: 2, id: 'bearClaw'",
    "stage: 3, id: 'carrotWarden'",
    "stage: 4, id: 'gardener'"
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const next = quest.indexOf(marker);
    assert.ok(next > cursor, `missing or out-of-order progression marker: ${marker}`);
    cursor = next;
  }
  assert.match(html, /singleBeatSlayerThreshold: 33/);
  assert.match(html, /singleBearClawThreshold: 66/);
  assert.match(html, /singleCarrotWardenThreshold: 99/);
  assert.match(html, /singleGardenerThreshold: 132/);
  assert.match(quest, /wilted < encounter\.threshold/);
  assert.match(quest, /state\.encounterSpawned = true;[\s\S]*spawnEncounter\(encounter\)/);
  const startBody = quest.slice(quest.indexOf('function start()'), quest.indexOf('function collect('));
  assert.doesNotMatch(startBody, /spawnBoss|spawnGardener/);
});

test('quantity boundaries execute the real quest state machine exactly once', () => {
  const h = createQuestHarness();
  h.quest.start();
  assert.equal(h.quest.state.stage, 1);
  assert.equal(h.quest.updateProgress(32), false);
  assert.deepEqual(h.spawns, []);
  assert.equal(h.quest.updateProgress(33), true);
  assert.equal(h.quest.updateProgress(500), false);
  assert.deepEqual(h.spawns.map(s => s[0]), ['beatSlayer']);

  h.enemy.kills = 65;
  h.quest.bossDefeated('beatSlayer', {});
  assert.equal(h.quest.updateProgress(65), false);
  assert.equal(h.quest.updateProgress(66), true);
  h.enemy.kills = 98;
  h.quest.bossDefeated('bearClaw', {});
  assert.equal(h.quest.updateProgress(98), false);
  assert.equal(h.quest.updateProgress(99), true);
  h.enemy.kills = 131;
  h.quest.bossDefeated('carrotWarden', {});
  assert.equal(h.quest.updateProgress(131), false);
  assert.equal(h.quest.updateProgress(132), true);
  assert.deepEqual(h.spawns.map(s => s[0]), ['beatSlayer', 'bearClaw', 'carrotWarden']);
  assert.equal(h.quest.gardener.alive, true);
  h.quest.bossDefeated('gardener', h.quest.gardener);
  assert.equal(h.quest.state.stage, 5);
});

test('boss defeat advances the stage without directly spawning the next encounter', () => {
  const defeatBody = quest.slice(quest.indexOf('function bossDefeated('), quest.indexOf('function nearAccess('));
  assert.match(defeatBody, /id === encounter\.id[\s\S]*state\.stage\+\+[\s\S]*state\.encounterSpawned = false/);
  assert.doesNotMatch(defeatBody, /spawnBoss|spawnGardener/);
  assert.match(html, /GAME\.mode !== 'single'[\s\S]*bossWiltThreshold/);
  assert.match(html, /GAME\.mode !== 'single' && GAME\.complete\) GAME\.complete\(kills\)/);
});

test('quest inventory is fixed, deduplicated, and multiplayer-gated', () => {
  assert.match(html, /const COMPONENTS = \['greenShard', 'metalFragment', 'computerChip'\]/);
  assert.match(html, /COMPONENTS\.indexOf\(id\) < 0 \|\| state\.components\[id\]/);
  assert.match(html, /GAME\.mode === 'single'/);
  assert.match(html, /type: 'quest', questId: 'barnKey'/);
  assert.match(html, /runScoped: options\.runScoped === undefined \? def\.type === 'quest'/);
  assert.match(html, /if \(p\.runScoped\)[\s\S]*items\.splice\(i, 1\)/);
});

test('all North Barn entrances share the Barn Key but keep independent open states', () => {
  assert.match(html, /animated\.northBarnDoor = \{[\s\S]*collider: mainDoorSolid/);
  assert.match(html, /animated\.northBarnWestDoor = \{[\s\S]*collider: westDoorSolid/);
  assert.match(html, /animated\.northBarnHatch = hatch/);
  assert.match(html, /function nearNorthBarnDoor\([\s\S]*position\.z - door\.z/);
  assert.match(html, /function nearNorthBarnWestDoor\([\s\S]*position\.z - door\.z/);
  assert.match(html, /function nearNorthBarnHatch\([\s\S]*position\.z - hatch\.z/);
  assert.match(html, /door\.collider\.enabled = door\.target < 0\.5 && door\.openness < 0\.06/);
  assert.match(html, /hatch\.ladder\.enabled = hatch\.target > 0\.5 && hatch\.openness > 0\.55/);
  assert.match(html, /if \(!hatch\.keyed\) \{[\s\S]*hatch\.target = dx \* dx \+ dz \* dz/);
  assert.match(quest, /function nearAccess\(p\)[\s\S]*LEVEL\.northBarnAccessAt/);
  assert.match(quest, /if \(!state\.barnKey\)[\s\S]*LOCKED — KEY REQUIRED/);
  assert.match(quest, /state\.barnUnlocked = true;[\s\S]*LEVEL\.setNorthBarnAccess\(access\.id, true\)/);
  const collectBody = quest.slice(quest.indexOf('function collect('), quest.indexOf('function spawnGardener('));
  assert.doesNotMatch(collectBody, /setNorthBarnAccess/);

  const h = createQuestHarness();
  h.quest.start();
  assert.equal(h.quest.collect('barnKey'), true);
  assert.deepEqual(Object.values(h.accesses).map(access => access.open), [false, false, false],
    'collecting the key must not open any entrance');
  assert.equal(h.quest.interact({ x: 48, y: 0, z: -55 }), true);
  assert.equal(h.quest.state.barnUnlocked, true);
  assert.equal(h.accesses.south.open, true, 'the first E interaction uses the key and opens that entrance');
  assert.equal(h.accesses.west.open, false, 'the west doors remain physically closed until used');
  assert.equal(h.accesses.hatch.open, false, 'the cellar hatch remains physically closed until used');
  h.quest.interact({ x: 33, y: 0, z: -66 });
  assert.equal(h.accesses.west.open, true, 'the unlocked west doors open with E');
  h.quest.interact({ x: 58, y: 0, z: -73.5 });
  assert.equal(h.accesses.hatch.open, true, 'the unlocked cellar hatch opens with E');
  h.quest.interact({ x: 48, y: 0, z: -55 });
  assert.equal(h.accesses.south.open, false, 'later E interactions toggle entrances independently');
  h.quest.reset();
  assert.deepEqual(Object.values(h.accesses).map(access => access.open), [false, false, false],
    'a restart closes and relocks all three entrances');
  h.game.mode = 'coop';
  h.quest.start();
  assert.deepEqual(Object.values(h.accesses).map(access => access.open), [true, true, true],
    'non-solo modes bypass the solo key quest and remain traversable');
});

test('Gardener rolling and simultaneous summon caps are both four', () => {
  assert.match(html, /filter\(t => now - t < 60\)/);
  assert.match(html, /4 - gardener\.gardenerSummons\.length, 4 - gardener\.gardenerSpawnTimes\.length/);
  assert.match(html, /if \(e\.gardenerSummon\) e\.respawnAt = 0/);
  assert.match(html, /function clearQuestEnemies\(\)[\s\S]*e\.isGardener[\s\S]*e\.gardenerSummon/);
});

test('Portal Gun tuning and Bearclaw2 stun lockout are explicit', () => {
  assert.match(html, /id: 'portalGun'[\s\S]*fireInterval: 0\.72[\s\S]*damage: 86/);
  assert.match(html, /portalHeadshotCritMultiplier: 1\.5/);
  assert.match(html, /portalHeadshotStunChance: 0\.25/);
  assert.match(html, /portalHeadshotStunDuration: 2\.0/);
  assert.match(html, /portalStunImmunity: 3\.0/);
});

test('the Portal Gun cutscene only hands off to gameplay on a real gesture, not its own timer', () => {
  assert.match(quest, /awaitingCutsceneContinue = true;[\s\S]*attachCutsceneSkipListener\(\)/);

  // No point counts as a barn-door access here -- interact()'s crafting
  // branch is only reachable once nearAccess() finds nothing, and this
  // test's crafting-station coordinates don't correspond to a real door.
  const h = createQuestHarness({ LEVEL: { setNorthBarnAccess() {}, isNorthBarnAccessOpen() { return false; }, northBarnAccessAt() { return null; } } });
  h.quest.start();
  h.quest.state.components.greenShard = true;
  h.quest.state.components.metalFragment = true;
  h.quest.state.components.computerChip = true;
  h.quest.state.barnKey = true;
  h.quest.state.barnUnlocked = true;
  assert.equal(h.quest.interact({ x: 58.3, y: 3.5, z: -76.7 }), true);
  assert.equal(h.quest.cutsceneActive, true, 'crafting starts the portal cutscene');

  // One big dt blows straight past the 5.2s buildup and spawns Bearclaw2 --
  // this used to call GAME.resumeAfterQuestCutscene() (-> INPUT.requestLock())
  // immediately, straight from this timer-driven update() call.
  h.quest.update(6, false);
  assert.equal(h.quest.state.stage, 6, 'Bearclaw2 spawning still advances the stage on schedule');
  assert.deepEqual(h.spawns.map(s => s[0]).filter(id => id === 'bearClaw'), ['bearClaw'],
    'Bearclaw2 still spawns on schedule');
  assert.deepEqual(h.resumeCalls, [], 'resumeAfterQuestCutscene must NOT fire from the timer-driven update() call');
  assert.equal(h.quest.cutsceneActive, true, 'still treated as a cutscene while awaiting the real gesture');

  // Further update() calls with no real gesture must never let it through either.
  h.quest.update(1, false);
  h.quest.update(1, false);
  assert.deepEqual(h.resumeCalls, [], 'no amount of additional simulated time substitutes for a real gesture');

  // The real gesture -- a genuine click or keypress -- is what's allowed to trigger it.
  h.window.trigger('pointerdown');
  assert.deepEqual(h.resumeCalls, [true], 'a real gesture hands off exactly once');
  assert.equal(h.quest.cutsceneActive, false);

  // A second stray gesture afterward must be a no-op (listener already detached).
  h.window.trigger('pointerdown');
  assert.deepEqual(h.resumeCalls, [true], 'the handoff never double-fires');
});

test('run statistics count ammo after consumption and use monotonic time', () => {
  const decrement = html.indexOf('s.mag--;');
  const event = html.indexOf("RUNSTATS.ammo(currentId, 1)", decrement);
  assert.ok(decrement >= 0 && event > decrement && event - decrement < 150);
  assert.match(html, /const now = \(\) => performance\.now\(\)/);
  assert.match(html, /schemaVersion: SCHEMA_VERSION/);
  assert.match(html, /const SCHEMA_VERSION = 2/);
  assert.match(html, /RUNSTATS\.down\(\)/);
  assert.match(html, /RUNSTATS\.damage\(Math\.min/);
  assert.match(html, /RUNSTATS\.defeat\(zone/);
  assert.match(html, /class="run-report-grid"/);
  assert.match(html, /if \(!record \|\| !running\) return/);
});

test('end-of-run field report executes tracked combat values and renders the scorecard', () => {
  const h = createRunStatsHarness();
  h.stats.begin('single', 'local');
  h.stats.start();
  h.advance(1250);
  h.stats.down();
  h.stats.damage(87.5);
  h.stats.defeat('head', false, false);
  h.stats.ammo('pipePopper', 2);
  h.stats.bossStart('beatSlayer', 'Beat Slayer', false);
  h.advance(2750);
  h.stats.damage(500);
  h.stats.defeat('body', true, false);
  h.stats.bossDefeat('beatSlayer');
  h.stats.finalize('completed');
  h.stats.render();
  assert.equal(h.stats.record.schemaVersion, 2);
  assert.equal(h.stats.record.downs, 1);
  assert.equal(h.stats.record.combat.enemiesDefeated, 2);
  assert.equal(h.stats.record.combat.bossesDefeated, 1);
  assert.equal(h.stats.record.combat.headshotDefeats, 1);
  assert.equal(h.stats.record.combat.damageDealt, 587.5);
  assert.match(h.report.innerHTML, /Final Field Report/);
  assert.match(h.report.innerHTML, /Headshots/);
  assert.match(h.report.innerHTML, /Beat Slayer/);
  assert.match(h.report.innerHTML, /Ultra difficulty/);
});

test('pause owns its options and clears transient input', () => {
  assert.doesNotMatch(html, /UI\.el\.pause\.addEventListener\('click', enter\)/);
  assert.match(html, /const pauseButtons = \['resumeBtn', 'pauseOptionsBtn', 'pauseMapBtn', 'pauseRestartBtn', 'pauseMenuBtn'\]/);
  assert.match(html, /function clearTransientInput\(\)[\s\S]*mouseDX = mouseDY = 0/);
  assert.match(html, /QUEST\.update\(dt, simRunning\)/);
  assert.match(html, /#options\{z-index:44;\}/);
  assert.match(html, /id="options"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /e\.code === 'Escape'[\s\S]*UI\.hideOptions\(\)/);
});

test('developer reset cannot poison later natural progression', () => {
  assert.match(html, /e\.devSpawn = false;/);
  assert.match(html, /wilted: cmdWilted/);
  assert.match(html, /QUEST\.reset\(\);[\s\S]*ENEMY\.reset\(\);[\s\S]*PICKUP\.reset\(\);[\s\S]*QUEST\.start\(\)/);
});
