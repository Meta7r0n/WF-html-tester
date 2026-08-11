import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const questStart = html.indexOf('const QUEST = (() => {');
const questEnd = html.indexOf('/* ============================== [GAME] =============================== */', questStart);
const quest = html.slice(questStart, questEnd);

test('visible and runtime build labels identify v0.34', () => {
  assert.match(html, /<title>The Withered Farm — v0\.34<\/title>/);
  assert.match(html, /WC v0\.34/);
  assert.match(html, /version: 'v0\.34'/);
  assert.match(html, /branch: 'A-test-v0\.34-AVIATION-DAO-CHARACTER-BUILDER'/);
  assert.doesNotMatch(html, /WC v0\.33/);
});

function createQuestHarness() {
  const spawns = [];
  const door = { open: false, changes: [] };
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  }
  const enemy = {
    kills: 0,
    spawnBoss3: options => { spawns.push(['beatSlayer', options]); return {}; },
    spawnBoss2: (appearance, options) => { spawns.push(['bearClaw', appearance, options]); return {}; },
    spawnBoss: options => { spawns.push(['carrotWarden', options]); return {}; },
    spawnGrunt: () => ({
      alive: true, def: { stats: {} }, group: { scale: { setScalar() {} } },
      headProxy: { scale: { multiplyScalar() {} } }, bodyProxy: { scale: { multiplyScalar() {} } }
    }),
    clearQuestEnemies() {}
  };
  const context = vm.createContext({
    CONFIG: { progress: {
      singleBeatSlayerThreshold: 33, singleBearClawThreshold: 66,
      singleCarrotWardenThreshold: 99, singleGardenerThreshold: 132
    } },
    GAME: { mode: 'single', complete() {} },
    ENEMY: enemy,
    LEVEL: {
      setNorthBarnDoor(open) { door.open = !!open; door.changes.push(door.open); },
      nearNorthBarnDoor() { return true; }, isNorthBarnDoorOpen() { return door.open; }
    },
    UI: { toast() {}, setBoss() {} }, RUNSTATS: { milestone() {}, bossStart() {}, weapon() {} },
    WORLD: { groundAt() { return 0; } }, THREE: { Vector3 },
    document: { getElementById() { return null; } }, performance: { now() { return 0; } },
    setTimeout() {}, console
  });
  vm.runInContext(quest + '\n;globalThis.__quest = QUEST;', context);
  return { quest: context.__quest, enemy, spawns, door };
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
  const defeatBody = quest.slice(quest.indexOf('function bossDefeated('), quest.indexOf('function nearDoor('));
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

test('North Barn has a keyed animated door and authoritative collision blocker', () => {
  assert.match(html, /animated\.northBarnDoor = \{[\s\S]*collider: mainDoorSolid/);
  assert.match(html, /function nearNorthBarnDoor\([\s\S]*position\.z - door\.z/);
  assert.match(html, /door\.collider\.enabled = door\.target < 0\.5 && door\.openness < 0\.06/);
  assert.match(quest, /function nearDoor\(p\) \{ return LEVEL\.nearNorthBarnDoor\(p, 'surface'\); \}/);
  assert.match(quest, /if \(!state\.barnKey\)[\s\S]*LOCKED — KEY REQUIRED/);
  assert.match(quest, /state\.barnUnlocked = true;[\s\S]*LEVEL\.setNorthBarnDoor\(true\)/);
  const collectBody = quest.slice(quest.indexOf('function collect('), quest.indexOf('function spawnGardener('));
  assert.doesNotMatch(collectBody, /setNorthBarnDoor\(true/);

  const h = createQuestHarness();
  h.quest.start();
  assert.equal(h.quest.collect('barnKey'), true);
  assert.equal(h.door.open, false, 'collecting the key must not open the door');
  assert.equal(h.quest.interact({ x: 48, y: 0, z: -55 }), true);
  assert.equal(h.quest.state.barnUnlocked, true);
  assert.equal(h.door.open, true, 'the first E interaction uses the key and opens the door');
  h.quest.interact({ x: 48, y: 0, z: -55 });
  assert.equal(h.door.open, false, 'later E interactions toggle the unlocked door');
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

test('run statistics count ammo after consumption and use monotonic time', () => {
  const decrement = html.indexOf('s.mag--;');
  const event = html.indexOf("RUNSTATS.ammo(currentId, 1)", decrement);
  assert.ok(decrement >= 0 && event > decrement && event - decrement < 150);
  assert.match(html, /const now = \(\) => performance\.now\(\)/);
  assert.match(html, /schemaVersion: SCHEMA_VERSION/);
  assert.match(html, /if \(!record \|\| !running\) return/);
});

test('pause owns its options and clears transient input', () => {
  assert.doesNotMatch(html, /UI\.el\.pause\.addEventListener\('click', enter\)/);
  assert.match(html, /const pauseButtons = \['resumeBtn', 'pauseOptionsBtn', 'pauseMapBtn', 'pauseRestartBtn', 'pauseMenuBtn'\]/);
  assert.match(html, /function clearTransientInput\(\)[\s\S]*mouseDX = mouseDY = 0/);
  assert.match(html, /QUEST\.update\(dt, simRunning\)/);
});

test('developer reset cannot poison later natural progression', () => {
  assert.match(html, /e\.devSpawn = false;/);
  assert.match(html, /wilted: cmdWilted/);
  assert.match(html, /QUEST\.reset\(\);[\s\S]*ENEMY\.reset\(\);[\s\S]*PICKUP\.reset\(\);[\s\S]*QUEST\.start\(\)/);
});
