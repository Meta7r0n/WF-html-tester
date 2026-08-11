import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../assets/aviation-heads/manifest.json', import.meta.url), 'utf8'));
const manifestScript = readFileSync(new URL('../assets/aviation-heads/manifest.js', import.meta.url), 'utf8');
const packScript = readFileSync(new URL('../assets/aviation-heads/aviation-head-pack.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const heroStart = html.indexOf('const HERO = (() => {');
const heroEnd = html.indexOf('/* ============================== [KILLCAM] =============================', heroStart);
const heroScript = html.slice(heroStart, heroEnd);

test('proposal manifest contains exactly the 123 approved aviation_hat characters', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.count, 123);
  assert.equal(manifest.items.length, 123);
  assert.equal(manifest.contract, '0x0322f6f11a94cfb1b5b6e95e059d8deb2bf17d6a');
  assert.deepEqual(manifest.trait, { head: 'aviation_hat' });

  const ids = new Set();
  for (const item of manifest.items) {
    assert.equal(Number.isInteger(item.tokenId), true);
    assert.equal(ids.has(item.tokenId), false, `duplicate token ${item.tokenId}`);
    ids.add(item.tokenId);
    assert.equal(item.id, `aviation-${item.tokenId}`);
    assert.equal(item.name, `Cryptoon Goon #${item.tokenId}`);
    assert.match(item.sourceUrl, new RegExp(`/${item.tokenId}$`));
    assert.match(item.imageUrl, /^https:\/\//);
    assert.equal(item.traits.head, 'aviation_hat');
    assert.equal(typeof item.traits.body, 'string');
    assert.equal(typeof item.traits.accessory, 'string');
    assert.equal(item.designSeed, item.tokenId);
  }
});

test('source trait tuples are unique and every procedural head gets a unique identity stitch code', () => {
  const traitKeys = manifest.items.map(item => [
    item.traits.body,
    item.traits.eyes || 'none',
    item.traits.mouth || 'none',
    item.traits.accessory
  ].join('|'));
  assert.equal(new Set(traitKeys).size, 123);
  assert.match(packScript, /ordinalByToken = new Map/);
  assert.match(packScript, /for \(let bit = 0; bit < 7; bit \+= 1\)/);
  assert.match(packScript, /const hat = aviationHat\(item, group, api\)/);
  assert.match(packScript, /const blue = api\.MAT\.toon\(COLOR\.blue\)/);
  assert.equal(new Set(manifest.items.map((item, index) => index + 1)).size, 123);
});

function loadPack() {
  const context = vm.createContext({ console });
  vm.runInContext(`${manifestScript}\n${packScript}`, context);
  return context.AVIATION_HEAD_PACK;
}

test('head pack exposes a stable data/search API with no marketplace runtime dependency', () => {
  const pack = loadPack();
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.count, 123);
  assert.equal(pack.list().length, 123);
  assert.equal(pack.get(manifest.items[0].tokenId).tokenId, manifest.items[0].tokenId);
  assert.equal(pack.get(`#${manifest.items[1].tokenId}`).tokenId, manifest.items[1].tokenId);
  assert.equal(pack.get('not-approved'), null);
  assert.ok(pack.search('gold_skeleton').length > 0);
  assert.ok(pack.search(String(manifest.items[20].tokenId)).some(item => item.tokenId === manifest.items[20].tokenId));
  assert.doesNotMatch(packScript, /fetch\s*\(/);
});

test('all 123 heads execute through the adapter contract', () => {
  class Group {
    constructor() {
      this.children = [];
      this.userData = {};
      this.position = { set() {} };
      this.rotation = { x: 0, y: 0, z: 0 };
    }
    add(child) { this.children.push(child); }
  }
  class Batch {
    box() {}
    sphere() {}
    cyl() {}
    torus() {}
    custom() {}
    build() {}
  }
  const primitive = () => ({});
  const api = {
    THREE: { Group },
    MAT: { toon(value) { return value; } },
    PRIM: {
      Batch,
      sph: primitive,
      box: primitive,
      cone: primitive,
      cyl: primitive,
      torus: primitive
    },
    helpers: {
      disc() {},
      oval() {},
      bar() {},
      arc() {}
    }
  };
  const pack = loadPack();
  for (const item of pack.list()) {
    const group = new Group();
    const skin = pack.headSkin(item.tokenId, { face: 0, ink: 0, accent: 0 });
    assert.equal(pack.buildHead(item.tokenId, group, skin, api), true, `failed token ${item.tokenId}`);
    assert.equal(group.userData.aviationTokenId, item.tokenId);
  }
});

test('v0.35 integrates Hangar pilots with the shared rig, persistence, and multiplayer payloads', () => {
  const manifestIndex = html.indexOf('assets/aviation-heads/manifest.js');
  const packIndex = html.indexOf('assets/aviation-heads/aviation-head-pack.js');
  const gameIndex = html.indexOf('const BUILD = Object.freeze({');
  assert.ok(manifestIndex >= 0 && packIndex > manifestIndex && gameIndex > packIndex);
  assert.match(html, /function build\(id, appearance\)/);
  assert.match(html, /headBase\(head, headSkin, \{ noPetals: aviationItem \? true/);
  assert.match(html, /AVIATION_HEAD_PACK\.buildHead/);
  assert.match(html, /id="aviationBuilder"/);
  assert.match(html, /id="aviationTokenGrid"/);
  assert.match(html, /id="aviationBodyChoices"/);
  assert.match(html, /Hangar Custom<br\/>Pilot Builder/);
  assert.match(html, /id="hangarPilotStartBtn"/);
  assert.match(html, /#hangarPilotStartBtn\[hidden\],#heroChoices\[hidden\]\{display:none;\}/);
  assert.match(html, /if \(heroChoices\) heroChoices\.hidden = !!item/);
  assert.match(html, /wilted-farms\.hangar-pilot\.v1/);
  assert.match(html, /LEGACY_STORAGE_KEY = 'wilted-farms\.aviation-avatar\.v1'/);
  assert.match(html, /syncBody && state\.enabled && COOP\.selectCharacter/);
  assert.match(html, /function sanitizeAviationToken/);
  assert.match(html, /type: 'characterChoice', characterId: chosen, aviationTokenId: requestedAviationTokenId/);
  assert.match(html, /metadata: \{[\s\S]*aviationTokenId: requestedAviationTokenId/);
  assert.match(html, /CAST\.build\(desired, desiredAviationToken \? \{ aviationTokenId: desiredAviationToken \}/);
  assert.match(html, /if \(COOP\.selectCharacter\(bodyId\) && AVIATION_AVATAR\.enabled\) AVIATION_AVATAR\.selectBody\(bodyId\)/);
  assert.match(html, /function selectBody\(id\)[\s\S]*state\.bodyId = validBody\(id\)/);
});

test('portrait snapshots retain pixels, resize per caller, and face the authored -Z side', () => {
  assert.match(html, /preserveDrawingBuffer: true/);
  assert.match(html, /portraitRenderer\.setSize\(width, height, false\)/);
  assert.match(html, /portraitCamera\.aspect = width \/ height/);
  assert.match(html, /portraitCamera\.position\.set\(0, 0\.92, -2\.05\)/);
  assert.match(html, /portraitRenderer\.clear\(\);[\s\S]*portraitRenderer\.render\(portraitScene, portraitCamera\)/);
});

test('classic heroes share the blue aviation cap while Pyro alone keeps goggles', () => {
  const headsStart = html.indexOf('const HEADS = {');
  const headsEnd = html.indexOf('/* ---------------- COLLARS ---------------- */', headsStart);
  const heads = html.slice(headsStart, headsEnd);
  for (const id of ['playerBluecap', 'playerMasked', 'playerStoned', 'pilot']) {
    const start = heads.indexOf(`${id}(group, skin)`);
    let next = heads.indexOf('\n    },', start);
    if (next < 0) next = heads.length;
    assert.ok(start >= 0 && next > start, `missing ${id} head builder`);
    assert.match(heads.slice(start, next), /aviationCap\(group\)/, `${id} must use the shared cap`);
  }
  const pyroStart = heads.indexOf('playerPyro(group, skin)');
  const pyroEnd = heads.indexOf('\n    },', pyroStart);
  const pyro = heads.slice(pyroStart, pyroEnd);
  assert.match(pyro, /browGoggles\(group\)/);
  assert.doesNotMatch(pyro, /aviationCap\(group\)/);
});

function createHeroHarness() {
  const events = { revives: [], launches: [], invuln: [], toasts: [] };
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  const context = vm.createContext({
    THREE: { Vector3 },
    CONFIG: {
      hangarPilot: { baseDownLimit: 3, ejectionHealPct: 50, ejectionForce: 12.5, ejectionInvuln: 3 },
      player: { maxHealth: 100, downedTime: 16 },
      heroSpecial: {
        invulnDuration: 4, stonedHealPct: 50, pyroBaseHealPct: 15,
        pyroKillHealPct: 15, pyroStickOffset: 1.8,
        knivesLowHealthPct: 10, knivesRadius: 6.5, knivesKillHealPct: 15
      }
    },
    AVIATION_AVATAR: { enabled: true },
    GAME: { isCoop: false },
    COOP: { matchMode: 'coop', localCharacterId: 'playerBluecap' },
    PLAYER: {
      position: new Vector3(), health: 100, isDead: true,
      reviveAt(pct, reset) { events.revives.push([pct, reset]); this.isDead = false; },
      launchUp(force) { events.launches.push(force); return true; },
      grantInvuln(seconds) { events.invuln.push(seconds); }, heal() {}, finishDowned() {}
    },
    WEAPON: {
      currentId: 'pipePopper', beginHeroSpecial() { return true; }, endHeroSpecial() {}
    },
    THROWABLE: { definitions: { dynamite: { blastRadius: 7.2 } } },
    ENEMY: { blast() { return 0; } },
    UI: {
      setPilotLives() {}, toast(message) { events.toasts.push(message); }, specialFlash() {},
      showDowned() {}, setDownedTimer() {}, hideDowned() {}
    },
    AUDIO: { jump() {}, blast() {}, playerDie() {} },
    FX: { spawnParticle() {}, explosion() {}, tracer() {} },
    TEX: { puff() { return {}; } }, PAL: { cream: 1, blueGray: 2 },
    UTIL: { rng(min, max) { return (min + max) / 2; } }, console
  });
  vm.runInContext(heroScript + '\n;globalThis.__hero = HERO;', context);
  return { hero: context.__hero, events };
}

test('Hangar Ejection Seat recovers twice at 50%, then makes down three terminal', () => {
  const { hero, events } = createHeroHarness();
  hero.resetRun();
  assert.equal(hero.beginDowned(), true);
  assert.equal(hero.beginDowned(), true);
  assert.equal(hero.beginDowned(), false);
  assert.equal(hero.runOver, true);
  assert.equal(hero.pilotDowns, 3);
  assert.equal(hero.pilotDownLimit, 3);
  assert.deepEqual(events.revives, [[50, false], [50, false]]);
  assert.deepEqual(events.launches, [12.5, 12.5]);
});

test('each stacked Extra Life moves the terminal down threshold up by one', () => {
  const { hero, events } = createHeroHarness();
  hero.resetRun();
  assert.equal(hero.addExtraLife(), true);
  assert.equal(hero.pilotDownLimit, 4);
  assert.equal(hero.pilotRecoveriesRemaining, 3);
  assert.equal(hero.beginDowned(), true);
  assert.equal(hero.beginDowned(), true);
  assert.equal(hero.beginDowned(), true);
  assert.equal(hero.beginDowned(), false);
  assert.equal(hero.runOver, true);
  assert.equal(events.revives.length, 3);
});

test('mini-pilot lives use a one-visible queued pickup with randomized safe anchors', () => {
  assert.match(html, /const PILOT_LIFE_ANCHORS = \[[\s\S]*\{ x:/);
  assert.match(html, /define\('pilotExtraLife',[\s\S]*type: 'pilotLife'/);
  assert.match(html, /function buildPilotLifeVisual\(parent\)[\s\S]*CAST\.build\(castId, appearance\)/);
  assert.match(html, /function queuePilotLife\(options\)[\s\S]*pilotLifeQueue\+\+[\s\S]*if \(!pilotLifePickup\) spawnNextPilotLife/);
  assert.match(html, /if \(!scene \|\| pilotLifePickup \|\| pilotLifeQueue <= 0\) return null/);
  assert.match(html, /if \(p\.pilotLife && pilotLifePickup === p\)[\s\S]*spawnNextPilotLife\(false\)/);
  assert.match(html, /PICKUP\.queuePilotLife\(\{ devSpawn: !!e\.devSpawn \}\)/);
  assert.match(html, /message\.type === 'boss2Defeated'[\s\S]*PICKUP\.queuePilotLife\(\)/);
});
