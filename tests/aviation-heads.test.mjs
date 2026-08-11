import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../assets/aviation-heads/manifest.json', import.meta.url), 'utf8'));
const manifestScript = readFileSync(new URL('../assets/aviation-heads/manifest.js', import.meta.url), 'utf8');
const packScript = readFileSync(new URL('../assets/aviation-heads/aviation-head-pack.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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

test('v0.34 integrates cosmetics with the shared rig, builder, persistence, and multiplayer payloads', () => {
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
  assert.match(html, /wilted-farms\.aviation-avatar\.v1/);
  assert.match(html, /syncBody && state\.enabled && COOP\.selectCharacter/);
  assert.match(html, /function sanitizeAviationToken/);
  assert.match(html, /type: 'characterChoice', characterId: chosen, aviationTokenId: requestedAviationTokenId/);
  assert.match(html, /metadata: \{[\s\S]*aviationTokenId: requestedAviationTokenId/);
  assert.match(html, /CAST\.build\(desired, desiredAviationToken \? \{ aviationTokenId: desiredAviationToken \}/);
});
