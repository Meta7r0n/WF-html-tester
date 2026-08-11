import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('single-player boss progression is ordered and threshold spawning is isolated', () => {
  const ordered = [
    "id === 'beatSlayer' && state.stage === 1",
    "id === 'bearClaw' && state.stage === 2",
    "id === 'carrotWarden' && state.stage === 3",
    "id === 'gardener' && state.stage === 4",
    "id === 'bearclaw2' && state.stage === 6"
  ];
  let cursor = -1;
  for (const marker of ordered) {
    const next = html.indexOf(marker);
    assert.ok(next > cursor, `missing or out-of-order progression marker: ${marker}`);
    cursor = next;
  }
  assert.match(html, /GAME\.mode !== 'single'[\s\S]*bossWiltThreshold/);
});

test('quest inventory is fixed, deduplicated, and multiplayer-gated', () => {
  assert.match(html, /const COMPONENTS = \['greenShard', 'metalFragment', 'computerChip'\]/);
  assert.match(html, /COMPONENTS\.indexOf\(id\) < 0 \|\| state\.components\[id\]/);
  assert.match(html, /GAME\.mode === 'single'/);
  assert.match(html, /type: 'quest', questId: 'barnKey'/);
});

test('Gardener rolling and simultaneous summon caps are both four', () => {
  assert.match(html, /filter\(t => now - t < 60\)/);
  assert.match(html, /4 - gardener\.gardenerSummons\.length, 4 - gardener\.gardenerSpawnTimes\.length/);
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
});
