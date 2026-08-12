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
const portalCutStart = html.indexOf('const PORTALCUTSCENE = (() => {');
const portalCutEnd = html.indexOf('/* ============================== [HERO] ===============================', portalCutStart);
const portalCutscene = html.slice(portalCutStart, portalCutEnd);
const inputStart = html.indexOf('const INPUT = (() => {');
const inputEnd = html.lastIndexOf('\n', html.indexOf('[PLAYER]', inputStart));
const inputSource = html.slice(inputStart, inputEnd);

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
  const railing = { present: true };
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
      setAllNorthBarnAccess(open) {
        Object.keys(accesses).forEach(id => {
          accesses[id].open = !!open;
          accesses[id].changes.push(accesses[id].open);
        });
      },
      setNorthBarnRailing(present) { railing.present = !!present; return true; },
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
  return { quest: context.__quest, enemy, spawns, accesses, railing, game: context.GAME, window: windowMock, resumeCalls };
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

test('the Barn Key opens every North Barn entrance at once, then each toggles independently', () => {
  assert.match(html, /animated\.northBarnDoor = \{[\s\S]*collider: mainDoorSolid/);
  assert.match(html, /animated\.northBarnWestDoor = \{[\s\S]*collider: westDoorSolid/);
  assert.match(html, /animated\.northBarnHatch = hatch/);
  assert.match(html, /function nearNorthBarnDoor\([\s\S]*position\.z - door\.z/);
  assert.match(html, /function nearNorthBarnWestDoor\([\s\S]*position\.z - door\.z/);
  assert.match(html, /function nearNorthBarnHatch\([\s\S]*position\.z - hatch\.z/);
  assert.match(html, /door\.collider\.enabled = door\.target < 0\.5 && door\.openness < 0\.06/);
  assert.match(html, /hatch\.ladder\.enabled = hatch\.target > 0\.5 && hatch\.openness > 0\.55/);
  assert.match(html, /if \(!hatch\.keyed\) \{[\s\S]*hatch\.target = dx \* dx \+ dz \* dz/);
  assert.match(html, /function setAllNorthBarnAccess\(open, immediate\) \{[\s\S]*setNorthBarnDoor\(open, immediate\)[\s\S]*setNorthBarnWestDoor\(open, immediate\)[\s\S]*setNorthBarnHatch\(open, immediate\)/);
  assert.match(quest, /function nearAccess\(p\)[\s\S]*LEVEL\.northBarnAccessAt/);
  assert.match(quest, /if \(!state\.barnKey\)[\s\S]*LOCKED — KEY REQUIRED/);
  assert.match(quest, /state\.barnUnlocked = true;[\s\S]*LEVEL\.setAllNorthBarnAccess\(true\)/);
  const collectBody = quest.slice(quest.indexOf('function collect('), quest.indexOf('function spawnGardener('));
  assert.doesNotMatch(collectBody, /setNorthBarnAccess/);

  const h = createQuestHarness();
  h.quest.start();
  assert.equal(h.quest.collect('barnKey'), true);
  assert.deepEqual(Object.values(h.accesses).map(access => access.open), [false, false, false],
    'collecting the key must not open any entrance');
  assert.equal(h.quest.interact({ x: 48, y: 0, z: -55 }), true);
  assert.equal(h.quest.state.barnUnlocked, true);
  assert.deepEqual(Object.values(h.accesses).map(access => access.open), [true, true, true],
    'using the key on any single entrance opens all three at once');
  h.quest.interact({ x: 48, y: 0, z: -55 });
  assert.equal(h.accesses.south.open, false, 'later E interactions toggle entrances independently');
  assert.equal(h.accesses.west.open, true, 'toggling one entrance after the initial unlock leaves the others alone');
  assert.equal(h.accesses.hatch.open, true, 'toggling one entrance after the initial unlock leaves the others alone');
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

test('the Gardener drops both the Barn Key and the Seed Spitter, and the LMG is wired end to end', () => {
  // CONFIG def: an automatic LMG, distinct from the Fieldhand Carbine, with
  // its own ammo pool and a slot past the 9 keyboard hotkeys.
  assert.match(html, /id: 'seedSpitter'[\s\S]*slot: 10[\s\S]*ammoType: 'seedDrum'/);
  assert.match(html, /seedSpitter:[\s\S]*magSize: 50[\s\S]*automatic: true[\s\S]*damage: 20/);
  // A real ammo pickup exists for it (unlike the Portal Gun, which has none).
  assert.match(html, /define\('seedDrumPack', \{[\s\S]*ammoType: 'seedDrum'/);
  assert.match(html, /\{ id: 'seedDrumPack',/);
  // The boss-drop weapon pickup exists and is NOT part of the static spawns
  // list (mirrors carrotCannonWeapon/theClawWeapon's own comments/pattern).
  assert.match(html, /define\('seedSpitterWeapon', \{[\s\S]*weaponId: 'seedSpitter'/);
  assert.doesNotMatch(html, /\{ id: 'seedSpitterWeapon',/);
  // ENEMY.die()'s isGardener branch spawns both drops together.
  const gardenerDeathBranch = html.slice(html.indexOf('if (e.isGardener) {'), html.indexOf('} else if (e.isBoss) {'));
  assert.match(gardenerDeathBranch, /PICKUP\.spawn\('barnKey', \{ x:e\.pos\.x, y:e\.pos\.y, z:e\.pos\.z \}/);
  assert.match(gardenerDeathBranch, /PICKUP\.spawn\('seedSpitterWeapon', \{ x:e\.pos\.x\+0\.8, y:e\.pos\.y, z:e\.pos\.z \}/);
  // The pickup-message slot hint only ever names a real keyboard digit.
  assert.match(html, /slot <= 9 \? 'slot ' \+ slot : 'cycle weapons to equip'/);
});

test('QUEST hands the Portal Gun payoff to PORTALCUTSCENE instead of playing it inline', () => {
  assert.match(quest, /PORTALCUTSCENE\.play\(GAME\.camera,/);
  assert.match(quest, /get cutsceneActive\(\) \{ return typeof PORTALCUTSCENE !== 'undefined' && PORTALCUTSCENE\.active; \}/);
  assert.doesNotMatch(quest, /cutsceneTimer/, 'the old inline timer/portal-growth logic should be fully removed, not duplicated');
});

function createPortalCutsceneHarness() {
  const spawnedBosses = [];
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
  function makeBoss() {
    return {
      pos: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      vel: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      group: { position: { copy(p) {} } },
      yaw: 0
    };
  }
  class Object3D {
    constructor() { this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { setScalar() {} }; this.material = { opacity: 1 }; this.parent = null; }
    traverse() {}
  }
  const poseEntityCalls = [];
  const context = vm.createContext({
    CONFIG: {
      render: { fov: 62, near: 0.1, far: 500 },
      portalCutscene: {
        portalPos: { x: 62.45, y: 5.7, z: -72.8 }, portalRotY: Math.PI / 2,
        bossRestPos: { x: 59, y: 4.6, z: -75 },
        openDuration: 2.2, walkDuration: 2.4,
        wideCam: { x: 51, y: 6.6, z: -79.5 }, wideLook: { x: 60.5, y: 5.0, z: -74 },
        holdCam: { x: 54, y: 5.6, z: -71 }, holdLook: { x: 59, y: 5.0, z: -75 },
        blendStart: 2.2, blendEnd: 4.6
      }
    },
    UTIL: {
      clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
      lerp(a, b, t) { return a + (b - a) * t; }
    },
    THREE: {
      PerspectiveCamera: class extends Object3D { constructor() { super(); this.aspect = 1; } updateProjectionMatrix() {} lookAt() {} },
      Mesh: Object3D, TorusGeometry: class {}, MeshBasicMaterial: class {}
    },
    ENEMY: {
      spawnBoss2(appearance) { const b = makeBoss(); spawnedBosses.push(b); return b; },
      poseEntity(e, t) { poseEntityCalls.push([e, t]); }
    },
    CAST: { build() { return { rig: { root: new Object3D() } }; } },
    HERO: { castId: 'scarf' },
    AVIATION_AVATAR: { enabled: false, soloCastId(fallback) { return fallback; }, tokenId: null },
    PLAYER: { position: { x: 58.3, y: 4.6, z: -76.7 } },
    WORLD: { groundAt() { return 4.6; } },
    UI: { toast() {} },
    window: windowMock,
    setTimeout() {}, console
  });
  vm.runInContext(portalCutscene + '\n;globalThis.__portalCutscene = PORTALCUTSCENE;', context);
  const mod = context.__portalCutscene;
  mod.init({ add() {} }, { aspect: 1.6 });
  return { mod, window: windowMock, spawnedBosses, poseEntityCalls };
}

test('PORTALCUTSCENE only hands off to gameplay on a real gesture, not its own timer', () => {
  const h = createPortalCutsceneHarness();
  const doneCalls = [];
  h.mod.play({ aspect: 1.6 }, () => doneCalls.push(true));
  assert.equal(h.mod.active, true);

  // Advance past the portal-open beat -- Bearclaw2 should spawn. The walk
  // phase itself only starts stepping on the following update() call.
  h.mod.update(2.3);
  assert.equal(h.spawnedBosses.length, 1, 'Bearclaw2 spawns once the portal finishes opening');
  h.mod.update(0.1);
  assert.ok(h.poseEntityCalls.length > 0, 'the walk-out is driven by ENEMY.poseEntity, not just a position lerp');

  // One big update() call blows straight past the whole walk -- this used
  // to call onDone() (-> GAME.resumeAfterQuestCutscene() -> INPUT.requestLock())
  // immediately from this timer-driven call.
  h.mod.update(3);
  assert.equal(h.mod.active, true, 'still an active cutscene, now holding on the revealed boss');
  assert.deepEqual(doneCalls, [], 'onDone must NOT fire from the timer-driven update() call');

  // Further simulated time changes nothing.
  h.mod.update(5);
  h.mod.update(5);
  assert.deepEqual(doneCalls, [], 'no amount of additional simulated time substitutes for a real gesture');

  // A real gesture is what's allowed to end it.
  h.window.trigger('pointerdown');
  assert.deepEqual(doneCalls, [true], 'a real gesture hands off exactly once');
  assert.equal(h.mod.active, false);

  // A stray second gesture afterward is a no-op (listener already detached).
  h.window.trigger('pointerdown');
  assert.deepEqual(doneCalls, [true], 'the handoff never double-fires');
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

// Builds a minimal document/window/performance so INPUT's own event
// listeners (registered in init()) run for real, including the pointer-lock
// handshake requestLock()/exitPointerLock() need to flip `engaged`. This
// sidesteps two live-testing dead ends: headless Chromium won't reliably
// grant real pointer lock outside a trusted gesture (confirmed live --
// INPUT.engaged stayed false after a real click), and even when it does,
// distinguishing "debounced" from "not wired" needs frame-exact control
// over elapsed time that a real browser's render loop can't give here.
function makeEventTarget(types) {
  const listeners = {};
  types.forEach(t => { listeners[t] = []; });
  return {
    addEventListener(type, fn) { if (listeners[type]) listeners[type].push(fn); },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      const i = listeners[type].indexOf(fn);
      if (i >= 0) listeners[type].splice(i, 1);
    },
    trigger(type, evt) { (listeners[type] || []).slice().forEach(fn => fn(evt || {})); }
  };
}

function createInputHarness() {
  const documentMock = Object.assign(
    makeEventTarget(['keydown', 'keyup', 'mousemove', 'mousedown', 'mouseup', 'contextmenu',
      'pointerlockchange', 'pointerlockerror', 'wheel', 'gesturestart']),
    {
      pointerLockElement: null,
      exitPointerLock() { documentMock.pointerLockElement = null; documentMock.trigger('pointerlockchange'); }
    }
  );
  const windowMock = Object.assign(makeEventTarget(['keydown', 'keyup', 'blur']), { matchMedia: undefined });
  let nowValue = 0;
  const performanceMock = { now: () => nowValue };
  const elementMock = {
    style: {},
    requestPointerLock() { documentMock.pointerLockElement = elementMock; documentMock.trigger('pointerlockchange'); }
  };
  const context = vm.createContext({
    document: documentMock, window: windowMock, performance: performanceMock,
    setTimeout: () => 0, clearTimeout: () => {}, console
  });
  vm.runInContext(inputSource + '\n;globalThis.__input = INPUT;', context);
  const INPUT = context.__input;
  INPUT.init(elementMock);
  return { INPUT, documentMock, windowMock, setNow: v => { nowValue = v; } };
}

test('mouse wheel cycles weapons, debounced, and only while actually engaged', () => {
  assert.match(inputSource, /prevWeapon: false/, 'prevWeapon must be a real action, not just a local variable');
  assert.match(inputSource, /addEventListener\('wheel', e => \{[\s\S]*if \(!engaged \|\| mode === 'touch'\) return;/);
  assert.match(inputSource, /triggerAction\(e\.deltaY > 0 \? 'nextWeapon' : 'prevWeapon'\)/);
  assert.match(html, /if \(INPUT\.consumePress\('nextWeapon'\)\) cycleWeapon\(1\);\s*\n\s*if \(INPUT\.consumePress\('prevWeapon'\)\) cycleWeapon\(-1\);/);

  const h = createInputHarness();
  assert.equal(h.INPUT.engaged, false, 'starts disengaged');

  // Disengaged: scrolling must do nothing at all.
  h.documentMock.trigger('wheel', { deltaY: 100, preventDefault() {} });
  assert.equal(h.INPUT.consumePress('nextWeapon'), false, 'wheel is ignored before pointer lock engages');

  // requestLock() rate-limits re-locking against its own lastRequest clock
  // (both start at 0 here), so give it real elapsed time first -- a real
  // browser's now() is never actually 0 at the moment a player locks in.
  h.setNow(1000);
  h.INPUT.requestLock();
  assert.equal(h.INPUT.engaged, true, 'requestLock synchronously engages in this mock');

  h.documentMock.trigger('wheel', { deltaY: 100, preventDefault() {} });
  assert.equal(h.INPUT.consumePress('nextWeapon'), true, 'scroll down pulses nextWeapon while engaged');
  assert.equal(h.INPUT.consumePress('prevWeapon'), false);

  // A second notch inside the debounce window must be swallowed, exactly
  // the failure mode a real trackpad's flurry of small deltaY events would
  // otherwise hit (cycling more than one weapon per physical scroll click).
  h.setNow(1050);
  h.documentMock.trigger('wheel', { deltaY: -100, preventDefault() {} });
  assert.equal(h.INPUT.consumePress('prevWeapon'), false, 'a second tick inside the debounce window is dropped');

  // Past the debounce window, scrolling the other way pulses prevWeapon.
  h.setNow(1200);
  h.documentMock.trigger('wheel', { deltaY: -100, preventDefault() {} });
  assert.equal(h.INPUT.consumePress('prevWeapon'), true, 'scroll up pulses prevWeapon once debounced');
  assert.equal(h.INPUT.consumePress('nextWeapon'), false);

  // Releasing the lock re-disengages, and wheel goes back to doing nothing.
  h.INPUT.releaseLock();
  assert.equal(h.INPUT.engaged, false);
  h.setNow(2000);
  h.documentMock.trigger('wheel', { deltaY: 100, preventDefault() {} });
  assert.equal(h.INPUT.consumePress('nextWeapon'), false, 'wheel is ignored again once disengaged');
});
