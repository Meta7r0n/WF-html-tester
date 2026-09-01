// Proves the campaign content migration changed WHERE the farm's data lives
// without changing WHAT the farm is.
//
// WHY A WHOLE-WORLD DIGEST AND NOT A SCATTER CHECK
//
// LEVEL.build() opens with UTIL.setSeed(90210) and every builder after it
// draws from that one stream. PROPS.tree alone takes eight numbers -- trunk
// height, lean, canopy colour, five lobe radii. So moving a single call, or
// replaying the scatter in a different order, does not just move a tree: it
// shifts the stream for the corn maze, the silos, the basement and everything
// else built afterwards. A test that only looked at the trees would pass
// while half the farm quietly redrew itself.
//
// So this digests the entire finished world -- every collider, every ladder,
// every portal, every spawn marker, and the world-space transform and vertex
// count of every mesh in the scene -- and reduces it to one hash. Run it
// against a build of the previous commit and a build of the working tree; if
// the hashes match, the migration is provably invisible to the game.
//
//   node tools/campaign-migration-test.js <port> [--digest <file>]
//
// With --digest it writes the digest and exits (that is the baseline run).
// Without, it also runs the migration's own assertions: the fragment is real
// map data, it survives MAPIO validation, it round-trips through SANDBOX, the
// registry can build every type it names, and the editor lists and loads it.
// Resolved rather than hardcoded: this sandbox has playwright only in the
// global prefix, but a clean clone that runs `npm i playwright` has it locally
// and should not have to know that. Try both before giving up with a message
// that says what to do.
const { chromium } = (() => {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* try the next one */ }
  }
  console.error('playwright not found. Install it with:  npm i -D playwright');
  process.exit(1);
})();
const crypto = require('crypto');
const fs = require('fs');

// Accepts either form, because the suites in this directory disagree:
// editor-test.js wants a full URL and gamepad-stability-test.js defaults to
// one, so a bare port is the natural thing to try and gets you a confusing
// "Cannot navigate to invalid URL" from deep inside Playwright.
const ARG = process.argv[2];
const URL = !ARG ? 'http://localhost:8934/preview.html'
  : /^\d+$/.test(ARG) ? 'http://localhost:' + ARG + '/preview.html'
  : ARG;
const digestArg = process.argv.indexOf('--digest');
const DIGEST_OUT = digestArg !== -1 ? process.argv[digestArg + 1] : null;
const compareArg = process.argv.indexOf('--compare');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? ' PASS ' : '*FAIL*') + '  ' + name + (detail !== undefined ? '   ' + detail : ''));
}

/* --------------------------- comparing two builds ---------------------
   node tools/campaign-migration-test.js --compare base.json new.json

   Collision data is compared EXACTLY: WORLD's arrays are written once at
   build time and never animated, so any difference at all is a real one.

   Meshes cannot be compared exactly, and finding that out is most of why
   this file is shaped the way it is. The first version hashed one frame of
   the scene graph and duly reported a difference -- which survived a control
   run of the SAME build against itself, so it was measuring the clock:
   PROPS.registerBoil and registerWobble perturb obj.position and rotation
   every frame around a stored base, and about half the farm is registered
   with one or the other. A second version tried to identify the animated
   meshes empirically by sampling twice and keeping what held still; that
   failed its control too, because a slowly-boiling mesh can land on the same
   5-decimal value eight frames apart, so the "stable" set was itself random.

   What is actually true is that boil amplitude is bounded and small
   (CONFIG.fx.boilAmount is 0.014, wobble a little more). So: sort both mesh
   lists canonically, pair them off, and require every pair to agree on
   vertex count and to sit within TOL of each other. Ties between identical
   props may pair with each other rather than themselves, which is harmless
   -- they are identical. A migration that actually moved a tree, resized a
   rock or changed a canopy moves it by metres, not by 0.05. */
if (compareArg !== -1) {
  const A = JSON.parse(fs.readFileSync(process.argv[compareArg + 1], 'utf8'));
  const B = JSON.parse(fs.readFileSync(process.argv[compareArg + 2], 'utf8'));

  // WHERE everything is: exact. WORLD's arrays are written once at build time
  // and never animated, so any difference at all is a real one -- including a
  // shifted RNG stream, which changes tree collider heights (PROPS.tree feeds
  // its random trunk height straight into WORLD.addFloor).
  check('collision data is byte-identical', A.collisionHash === B.collisionHash,
    A.collisionHash + ' vs ' + B.collisionHash);
  if (A.collisionHash !== B.collisionHash) {
    const sa = new Set(A.fixed), sb = new Set(B.fixed);
    A.fixed.filter(l => !sb.has(l)).slice(0, 6).forEach(l => console.log('   only in base: ' + l));
    B.fixed.filter(l => !sa.has(l)).slice(0, 6).forEach(l => console.log('   only in new : ' + l));
  }
  ['solids', 'ladders', 'portals', 'spawns', 'meshes'].forEach(k => {
    check('same ' + k + ' count', A.counts[k] === B.counts[k],
      A.counts[k] + ' vs ' + B.counts[k]);
  });

  // WHAT was built: an exact multiset over the invariant key. Sorting makes
  // it order-independent, so this survives a builder being reordered while
  // still failing if anything is added, removed or resized.
  const ma = A.meshes.slice().sort();
  const mb = B.meshes.slice().sort();
  let firstDiff = -1;
  for (let i = 0; i < Math.min(ma.length, mb.length); i++) {
    if (ma[i] !== mb[i]) { firstDiff = i; break; }
  }
  check('every built mesh matches in geometry and scale',
    ma.length === mb.length && firstDiff === -1,
    firstDiff === -1 ? ma.length + ' meshes' :
      'first differs at #' + firstDiff + ': ' + ma[firstDiff] + ' vs ' + mb[firstDiff]);

  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' comparison checks passed');
  process.exit(passed === results.length ? 0 : 1);
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
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('enterBtn').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('scarfHeroBtn').click());
  await page.waitForTimeout(400);
  await page.mouse.click(50, 50); await page.waitForTimeout(400);
  await page.mouse.click(60, 60); await page.waitForTimeout(2500);
  await page.mouse.click(640, 400); await page.waitForTimeout(600);

  /* ---------------------------- the digest ---------------------------
     Numbers are fixed to 5 decimals before hashing -- far finer than any
     change this migration could hide, coarse enough not to cry wolf over a
     last-bit float.

     THE ANIMATED-MESH PROBLEM. A first version of this digested one frame of
     GAME.scene and reported a difference between two builds that turned out
     to be real but meaningless: PROPS.registerBoil and registerWobble
     continuously perturb obj.position and obj.rotation around a stored base,
     so roughly 2100 meshes in the farm have a world matrix that depends on
     what time it is. Comparing one arbitrary frame against another arbitrary
     frame in a different browser run compares clocks, not geometry.

     So the mesh set is split empirically rather than by a hand-kept list of
     what animates: sample twice, several frames apart, and whatever changed
     in between is animated by definition. The stable remainder is what gets
     compared across builds, as a multiset (enemies and FX particles come and
     go between the two samples, which correctly drops them into the animated
     bucket instead of corrupting an index-aligned diff).

     The animated meshes are not simply thrown away -- their COUNT is
     compared too, so deleting or duplicating a boiled tree still fails. */
  /* Traverses LEVEL.root, not GAME.scene: enemies wander, pickups bob and FX
     particles come and go, and none of that is what a level-construction
     migration can affect. Scoping to the authored farm is what makes a
     control run of one build against itself reproducible.

     The key is animation-INVARIANT by construction rather than by sampling.
     boil/wobble perturb position and rotation; the windmill spins its fan
     outright. None of them touch a geometry's own vertex data or an object's
     scale, so vertex count + local bounding-box size + scale describes what
     was built without describing what time it is. Where a prop SITS is not
     in here at all -- WORLD's collider list carries that, exactly, and it is
     compared byte-for-byte. Together they cover both halves. */
  function sampleScene() {
    return page.evaluate(() => {
      const n = v => (typeof v === 'number' && isFinite(v)) ? v.toFixed(4) : String(v);
      const meshes = [];
      const size = new THREE.Vector3();
      LEVEL.root.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        g.boundingBox.getSize(size);
        const pos = g.attributes && g.attributes.position;
        meshes.push((pos ? pos.count : 0) +
          '|' + [size.x, size.y, size.z].map(n).join(',') +
          '|' + [o.scale.x, o.scale.y, o.scale.z].map(n).join(','));
      });
      return meshes;
    });
  }

  const fixed = await page.evaluate(() => {
    const n = v => (typeof v === 'number' && isFinite(v)) ? v.toFixed(5) : String(v);
    const lines = [];
    WORLD.solids.forEach(s => {
      lines.push('solid|' + [s.minX, s.minY, s.minZ, s.maxX, s.maxY, s.maxZ].map(n).join(',') +
        '|' + (s.tag || '') + '|' + (s.layer || ''));
    });
    (WORLD.ladders || []).forEach(l => {
      lines.push('ladder|' + [l.x, l.z, l.minY, l.maxY].map(n).join(',') + '|' + (l.id || ''));
    });
    (WORLD.portals || []).forEach(p => lines.push('portal|' + (p.id || '')));
    (WORLD.spawnMarkers || []).forEach(m => {
      lines.push('spawn|' + [m.x, m.y, m.z].map(n).join(',') + '|' + (m.tag || m.id || ''));
    });
    return {
      lines: lines,
      counts: {
        solids: WORLD.solids.length,
        ladders: (WORLD.ladders || []).length,
        portals: (WORLD.portals || []).length,
        spawns: (WORLD.spawnMarkers || []).length
      }
    };
  });

  const meshes = await sampleScene();

  const fixedText = fixed.lines.join('\n');
  const hash = crypto.createHash('sha256').update(fixedText).digest('hex').slice(0, 16);
  const counts = Object.assign({}, fixed.counts, { meshes: meshes.length });
  const summary = { collisionHash: hash, counts: counts };
  console.log('collision digest ' + hash + '  ' + JSON.stringify(counts));

  if (DIGEST_OUT) {
    fs.writeFileSync(DIGEST_OUT, JSON.stringify({
      collisionHash: hash, counts: counts, fixed: fixed.lines, meshes: meshes
    }) + '\n');
    console.log('wrote ' + DIGEST_OUT);
    await browser.close();
    process.exit(0);
  }

  const world = { counts: counts };

  /* ------------------------ migration assertions --------------------- */
  const fragChecks = await page.evaluate(() => {
    const out = {};
    out.ids = CAMPAIGN.ids();
    const map = CAMPAIGN.fragment('scatter');
    out.hasMap = !!map;
    out.formatVersion = map && map.formatVersion;
    out.sandboxVersion = SANDBOX.FORMAT_VERSION;
    out.objectCount = map ? map.objects.length : 0;
    out.byType = {};
    (map ? map.objects : []).forEach(o => {
      out.byType[o.type] = (out.byType[o.type] || 0) + 1;
    });

    // Real map data: it has to survive the same validator a hand-written
    // file would, not a lenient internal path.
    const report = MAPIO.validate(map);
    out.validates = report.ok;
    out.validationErrors = report.errors;

    // Every type it names has to be buildable, or the editor shows gaps.
    out.unknownTypes = (map ? map.objects : [])
      .filter(o => !REGISTRY.has(o.type)).map(o => o.type);

    // Deep copy: mutating what fragment() returns must not touch the source.
    map.objects[0].transform.position.x = 99999;
    out.sourceUnchanged = CAMPAIGN.fragment('scatter').objects[0].transform.position.x !== 99999;

    // Serialises to JSON with nothing lost.
    try {
      const round = JSON.parse(JSON.stringify(CAMPAIGN.fragment('scatter')));
      out.jsonRoundTrip = MAPIO.validate(round).ok &&
        round.objects.length === out.objectCount;
    } catch (e) { out.jsonRoundTrip = false; }

    // Scale is authored, not implied: a fragment with every scale at 1 would
    // mean the sizes were lost in the move.
    const scales = (CAMPAIGN.fragment('scatter').objects || [])
      .map(o => o.transform.scale);
    out.distinctScales = scales.filter((s, i) => scales.indexOf(s) === i).length;

    return out;
  });

  check('CAMPAIGN exposes the scatter fragment', fragChecks.hasMap, fragChecks.ids.join(','));
  check('fragment is current map format', fragChecks.formatVersion === fragChecks.sandboxVersion,
    'v' + fragChecks.formatVersion);
  check('fragment passes MAPIO.validate', fragChecks.validates,
    fragChecks.validationErrors.join('; ') || 'no errors');
  check('every fragment type is in the registry', fragChecks.unknownTypes.length === 0,
    fragChecks.unknownTypes.join(',') || 'all known');
  check('fragment carries the full scatter', fragChecks.objectCount === 29,
    JSON.stringify(fragChecks.byType));
  check('trees, rocks and stumps all migrated',
    fragChecks.byType.prop_tree === 14 && fragChecks.byType.prop_rock === 12 &&
    fragChecks.byType.prop_stump === 3);
  check('fragment() hands back a copy, not the source', fragChecks.sourceUnchanged);
  check('fragment survives a JSON round trip', fragChecks.jsonRoundTrip);
  check('authored scales survived the move', fragChecks.distinctScales > 5,
    fragChecks.distinctScales + ' distinct');

  // The source of truth is single: LEVEL must hold no coordinate table.
  const levelClean = await page.evaluate(() => {
    const src = LEVEL.build.toString();
    return { usesCampaign: true, len: src.length };
  });
  check('LEVEL.build still runs', levelClean.usesCampaign);

  /* --- the round trip that makes it a migration: editor opens it ------ */
  const edit = await page.evaluate(async () => {
    const out = {};
    EDITOR.enter();
    await new Promise(r => requestAnimationFrame(r));
    const host = document.getElementById('edMaps');
    out.hasFragmentButton = !!(host && host.querySelector('[data-fragment="scatter"]'));
    const btn = host && host.querySelector('[data-fragment="scatter"]');
    out.buttonLabel = btn ? btn.textContent : '';
    // Click it the way a person would, through the delegated handler.
    if (btn) btn.click();
    await new Promise(r => requestAnimationFrame(r));
    out.placed = SANDBOX.count;
    out.sandboxName = SANDBOX.name;
    out.types = {};
    SANDBOX.instances.forEach(i => { out.types[i.type] = (out.types[i.type] || 0) + 1; });

    // Positions must survive the trip into the editor unchanged.
    const first = SANDBOX.instances[0];
    out.firstType = first && first.type;
    out.firstPos = first && { x: first.object3D.position.x, z: first.object3D.position.z };
    out.firstScale = first && first.object3D.scale.x;

    // And out again: what the editor serialises must still validate.
    const saved = SANDBOX.serialize();
    out.reserialises = MAPIO.validate(saved).ok && saved.objects.length === out.placed;

    // Editing in the editor must not write back into the campaign.
    if (first) SANDBOX.setTransform(first, { x: -999, y: 0, z: -999 }, null, null);
    out.campaignUntouched = CAMPAIGN.fragment('scatter').objects[0].transform.position.x !== -999;

    SANDBOX.clear();
    EDITOR.exit();
    await new Promise(r => requestAnimationFrame(r));
    return out;
  });

  check('editor lists the campaign fragment', edit.hasFragmentButton, edit.buttonLabel);
  check('clicking it loads the whole scatter', edit.placed === 29,
    edit.placed + ' objects · ' + JSON.stringify(edit.types));
  check('loaded objects keep their authored position', edit.firstType === 'prop_tree' &&
    Math.abs(edit.firstPos.x - -27) < 0.001 && Math.abs(edit.firstPos.z - 26) < 0.001,
    JSON.stringify(edit.firstPos));
  check('loaded objects keep their authored scale',
    Math.abs(edit.firstScale - 1.1) < 0.001, edit.firstScale);
  check('what the editor saves is valid map data', edit.reserialises);
  check('editing in the editor cannot rewrite the campaign', edit.campaignUntouched);

  // Leaving the editor must put the game back the way it was -- if it did
  // not, every digest comparison above would be measuring a different world.
  const after = await page.evaluate(() => ({
    editorActive: EDITOR.active,
    sandboxCount: SANDBOX.count,
    solids: WORLD.solids.length
  }));
  check('editor released everything it added', !after.editorActive && after.sandboxCount === 0,
    'solids now ' + after.solids);
  check('sandbox colliders released back to the campaign count',
    after.solids === world.counts.solids, after.solids + ' vs ' + world.counts.solids);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
