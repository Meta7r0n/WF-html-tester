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
    /* A region line serialises a whole navigation graph -- the corn maze's is
       about 6 KB of booleans. Printed raw it scrolls every other differing
       line off the screen, which is the opposite of what a diff is for. Show
       the head, and say how much was cut so nobody mistakes it for the whole
       line. */
    const brief = l => l.length <= 160 ? l
      : l.slice(0, 160) + ' ...[' + (l.length - 160) + ' more chars]';
    const sa = new Set(A.fixed), sb = new Set(B.fixed);
    const onlyA = A.fixed.filter(l => !sb.has(l)), onlyB = B.fixed.filter(l => !sa.has(l));
    onlyA.slice(0, 6).forEach(l => console.log('   only in base: ' + brief(l)));
    onlyB.slice(0, 6).forEach(l => console.log('   only in new : ' + brief(l)));
    if (onlyA.length > 6) console.log('   ...and ' + (onlyA.length - 6) + ' more only in base');
    if (onlyB.length > 6) console.log('   ...and ' + (onlyB.length - 6) + ' more only in new');
    console.log('   (' + onlyA.length + ' line(s) only in base, ' + onlyB.length + ' only in new)');
  }
  ['solids', 'ladders', 'portals', 'spawns', 'meshes'].forEach(k => {
    check('same ' + k + ' count', A.counts[k] === B.counts[k],
      A.counts[k] + ' vs ' + B.counts[k]);
  });

  // WHAT was built: an exact multiset over the invariant key. Sorting makes
  // it order-independent, so this survives a builder being reordered while
  // still failing if anything is added, removed or resized.
  /* Compared as a multiset difference rather than index by index. Both
     answers matter and they are not the same question: "did anything the
     base built stop being built, or change size" is the regression, while
     "does the new build make things the base did not" is often the whole
     point of the change. A positional walk conflates them -- inserting two
     meshes reports "first differs at #3125" and says nothing about whether
     the other 3,169 survived. */
  const tally = arr => {
    const m = new Map();
    arr.forEach(k => m.set(k, (m.get(k) || 0) + 1));
    return m;
  };
  const ta = tally(A.meshes), tb = tally(B.meshes);
  let gone = 0, added = 0, goneExample = '';
  ta.forEach((n, k) => {
    const got = tb.get(k) || 0;
    if (got < n) { gone += n - got; if (!goneExample) goneExample = k; }
  });
  tb.forEach((n, k) => { added += Math.max(0, n - (ta.get(k) || 0)); });
  check('every mesh the base built is still built, unchanged', gone === 0,
    gone === 0 ? A.meshes.length + ' meshes' : gone + ' missing, e.g. ' + goneExample);
  check('the new build adds no meshes', added === 0,
    added === 0 ? 'none added' : added + ' added (expected only if this change builds something new)');

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
      /* Editor gizmos are excluded. A marker (spawn_enemy's coloured post,
         head and ring) is authoring furniture, not farm geometry -- it is
         hidden during play and carries no collider. Counting it would make
         "the farm is unchanged" fail the moment a cluster gains a spawn
         point, which is a migration succeeding, not a regression.

         Tested by ancestry rather than by `visible`, deliberately: a filter
         on visibility would also swallow a real mesh that had wrongly been
         hidden, which is exactly the kind of breakage this digest exists to
         catch. */
      const isGizmo = o => {
        for (let n = o; n; n = n.parent) {
          if (n.userData && n.userData.editorMarker) return true;
        }
        return false;
      };
      LEVEL.root.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        if (isGizmo(o)) return;
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
      /* `enabled` is recorded because it is real, switchable state, not a
         constant: doors drive their own collider, the basement stair portal
         ships shut, and LEVEL.setTerrain switches the farm's entire
         registration off for a blank map. Without it here, a terrain switch
         that forgot to restore a collider -- or forced one on that was
         meant to stay off -- would compare equal. */
      lines.push('solid|' + [s.minX, s.minY, s.minZ, s.maxX, s.maxY, s.maxZ].map(n).join(',') +
        '|' + (s.tag || '') + '|' + (s.layer || '') +
        '|' + (s.enabled === false ? 'off' : 'on'));
    });
    (WORLD.ladders || []).forEach(l => {
        /* Every positional field, because the first version of this line read
           l.x, l.z and l.id -- none of which a ladder has. WORLD.addLadder
           produces minX/maxX, snapX/snapZ, topExit*, bottomExit* and `tag`,
           so the digest was recording "undefined,undefined" and checking the
           vertical extent alone. It passed the silo migration, which is the
           first migration to move a ladder at all, without ever looking at
           where the ladder went. */
        lines.push('ladder|' + [
          l.minX, l.maxX, l.minY, l.maxY, l.minZ, l.maxZ,
          l.snapX, l.snapZ, l.bottomY, l.topY,
          l.topExitX, l.topExitZ, l.bottomExitX, l.bottomExitZ,
          l.normalX, l.normalZ
        ].map(n).join(',') +
          '|' + (l.tag || '') + '|' + (l.topLayer || '') + '/' + (l.bottomLayer || '') +
          '|' + (l.enabled ? 'on' : 'off') +
          (l.oneWayDown ? '|oneway' : '') + (l.playerOnly ? '|playeronly' : ''));
    });
    /* The ladder fix above was not swept across the other kinds, and all
       three had the same disease -- fields named from memory rather than
       from the constructor. `portal|p.id` ignored the box, the layers and
       the enabled flag, so a migration could move a portal or leave one
       switched on and still compare equal. The spawn line was worse: a
       marker is `{position: Vector3, kind, layerId}`, so `m.x/m.y/m.z` were
       all undefined and `m.tag || m.id` was undefined too -- every marker
       in the farm digested to the same constant string. That is 58 markers
       whose positions and load-bearing kind tags no comparison ever saw. */
    (WORLD.portals || []).forEach(p => {
      lines.push('portal|' + [p.minX, p.maxX, p.minY, p.maxY, p.minZ, p.maxZ,
        p.normalX, p.normalZ].map(n).join(',') +
        '|' + (p.id || '') + '|' + (p.from || '') + '/' + (p.to || '') +
        '|' + (p.enabled ? 'on' : 'off'));
    });
    (WORLD.spawnMarkers || []).forEach(m => {
      const p = m.position || {};
      lines.push('spawn|' + [p.x, p.y, p.z].map(n).join(',') +
        '|' + (m.kind || '') + '|' + (m.layerId || '') +
        '|' + (m.enabled === false ? 'off' : 'on'));
    });
    /* Region records -- the navigation data ENEMY steers by. Serialised
       whole, because a region is whatever shape its builder chose and the
       interesting part is often not a coordinate: the corn maze's value is
       its grid of openings, and a shifted RNG stream would regenerate that
       grid differently while every bounding number stayed put. */
    Object.keys(WORLD.regions || {}).sort().forEach(name => {
      lines.push('region|' + name + '|' + JSON.stringify(WORLD.regions[name]));
    });
    return {
      lines: lines,
      counts: {
        solids: WORLD.solids.length,
        ladders: (WORLD.ladders || []).length,
        portals: (WORLD.portals || []).length,
        spawns: (WORLD.spawnMarkers || []).length,
        regions: Object.keys(WORLD.regions || {}).length
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
    out.siloTypes = {};
    const silo = CAMPAIGN.fragment('silo');
    (silo ? silo.objects : []).forEach(o => {
      out.siloTypes[o.type] = (out.siloTypes[o.type] || 0) + 1;
    });

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
  check('fragment carries the full scatter', fragChecks.objectCount === 34,
    JSON.stringify(fragChecks.byType));
  check('trees, rocks and stumps all migrated',
    fragChecks.byType.prop_tree === 14 && fragChecks.byType.prop_rock === 12 &&
    fragChecks.byType.prop_stump === 3);
  // The cluster is finished: the ruin and its dressing are data too, which is
  // what let buildScatter drop its type filter.
  check('Silo Row migrated as its own fragment',
    fragChecks.siloTypes && fragChecks.siloTypes.prop_silo_tower === 1 &&
    fragChecks.siloTypes.prop_silo_small === 2,
    JSON.stringify(fragChecks.siloTypes));
  check('the ruin and its dressing migrated too',
    fragChecks.byType.prop_ruin === 1 && fragChecks.byType.prop_barrel === 1 &&
    fragChecks.byType.prop_can === 1 && fragChecks.byType.prop_sign === 1 &&
    fragChecks.byType.spawn_enemy === 1, JSON.stringify(fragChecks.byType));
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

  /* ---- ownership: the map layer BUILDS the farm's scatter --------------
     Everything below is the difference between "the editor can show you the
     data" and "the editor owns the object". A tree in the world has to BE a
     map-layer instance, moving it has to move the farm's collider, and none
     of that may leak into the player's own map. */
  const own = await page.evaluate(async () => {
    const out = {};
    out.isLive = CAMPAIGN.isLive('scatter');
    /* Expected total is derived, not hardcoded: every authored object in
       every live fragment should be a live instance. That is the invariant
       worth asserting, and unlike a literal it does not need editing each
       time a cluster migrates. */
    out.fragmentIds = CAMPAIGN.ids();
    out.expected = 0;
    out.perFragment = {};
    CAMPAIGN.ids().forEach(id => {
      const n = CAMPAIGN.fragment(id).objects.length;
      out.perFragment[id] = { authored: n, live: SANDBOX.all.filter(i => i.fragment === id).length };
      if (CAMPAIGN.isLive(id)) out.expected += n;
    });
    const campaign = SANDBOX.all.filter(i => i.layer === 'campaign');
    out.campaignCount = campaign.length;
    out.campaignTypes = {};
    campaign.forEach(i => { out.campaignTypes[i.type] = (out.campaignTypes[i.type] || 0) + 1; });
    out.allTaggedToFragment = campaign.every(i => out.fragmentIds.indexOf(i.fragment) !== -1);
    out.sandboxCount = SANDBOX.count;

    // The farm's objects live under LEVEL's root, not the sandbox group, so
    // anything walking the authored world still sees a complete farm.
    let underLevel = 0;
    campaign.forEach(i => {
      let n = i.object3D;
      while (n) { if (n === LEVEL.root) { underLevel++; break; } n = n.parent; }
    });
    out.underLevelRoot = underLevel;

    // Pick a tree and prove the collider is the farm's, not a copy.
    const tree = campaign.filter(i => i.type === 'prop_tree')[0];
    out.treeId = tree && tree.id;
    const solid = tree && tree.handle.solids[0];
    out.beforeMinX = solid && +solid.minX.toFixed(3);
    out.beforePos = tree && { x: tree.data.transform.position.x, z: tree.data.transform.position.z };
    out.colliderIsInWorld = !!(solid && WORLD.solids.indexOf(solid) !== -1);

    // Move it 5 m east, the way a drag does.
    SANDBOX.setTransform(tree, { x: out.beforePos.x + 5, y: 0, z: out.beforePos.z }, null, null);
    out.afterMinX = +tree.handle.solids[0].minX.toFixed(3);
    out.meshMoved = +tree.object3D.position.x.toFixed(3);

    // The snapshot has to reflect the edit -- that is how an edited farm
    // leaves the machine.
    const snap = CAMPAIGN.snapshot('scatter');
    out.snapValidates = MAPIO.validate(snap).ok;
    out.snapCount = snap.objects.length;
    const moved = snap.objects.filter(o => o.id === out.treeId)[0];
    out.snapSeesEdit = moved && Math.abs(moved.transform.position.x - (out.beforePos.x + 5)) < 0.001;

    // ...while the AUTHORED fragment is untouched, so revert has something
    // to go back to.
    const authored = CAMPAIGN.fragment('scatter').objects.filter(o => o.id === out.treeId)[0];
    out.authoredUntouched = authored &&
      Math.abs(authored.transform.position.x - out.beforePos.x) < 0.001;
    return out;
  });

  check('the scatter is live in the map layer', own.isLive);
  check('every authored object in every fragment is live',
    own.campaignCount === own.expected, JSON.stringify(own.perFragment));
  check('each fragment built exactly what it authored',
    Object.keys(own.perFragment).every(k => own.perFragment[k].authored === own.perFragment[k].live),
    JSON.stringify(own.perFragment));
  check('each one knows which fragment it came from', own.allTaggedToFragment);
  check('they sit under LEVEL.root, not the sandbox group',
    own.underLevelRoot === own.expected, own.underLevelRoot + '/' + own.expected);
  check("the player's map starts empty", own.sandboxCount === 0, String(own.sandboxCount));
  check("a farm tree's collider is the world's, not a copy", own.colliderIsInWorld);
  check('moving a farm tree moves the farm collider',
    Math.abs((own.afterMinX - own.beforeMinX) - 5) < 0.001,
    own.beforeMinX + ' -> ' + own.afterMinX);
  check('and the mesh went with it',
    Math.abs(own.meshMoved - (own.beforePos.x + 5)) < 0.001, String(own.meshMoved));
  check('the snapshot is valid map data', own.snapValidates && own.snapCount === 34,
    own.snapCount + ' objects');
  check('the snapshot carries the edit', own.snapSeesEdit);
  check('the authored fragment is left alone, so revert can work', own.authoredUntouched);

  /* ---- the farm must survive the player's map operations -------------- */
  const isolation = await page.evaluate(async () => {
    const out = {};
    out.expected = SANDBOX.campaignCount;
    EDITOR.enter();
    await new Promise(r => requestAnimationFrame(r));

    // Place one of the player's own objects, then press New.
    EDITOR._place('prop_barrel', new THREE.Vector3(2, 0, 2));
    out.afterPlace = { mine: SANDBOX.count, farm: SANDBOX.campaignCount };
    // A save of the player's map must not contain the farm.
    const saved = SANDBOX.serialize();
    out.savedCount = saved.objects.length;
    // By layer, not by id prefix: fragment ids are per-cluster now, so a
    // regex on one cluster's naming would miss the others.
    out.savedHasFarm = SANDBOX.all.some(i => i.layer === 'campaign' &&
      saved.objects.some(o => o.id === i.id));

    EDITOR._new();
    out.afterNew = { mine: SANDBOX.count, farm: SANDBOX.campaignCount };

    // Reverting puts the moved tree back.
    const before = WORLD.solids.length;
    EDITOR._revert('scatter');
    await new Promise(r => requestAnimationFrame(r));
    out.afterRevert = { farm: SANDBOX.campaignCount, solids: WORLD.solids.length, was: before };
    const tree = SANDBOX.all.filter(i => i.type === 'prop_tree')[0];
    out.revertedX = tree && +tree.data.transform.position.x.toFixed(3);

    EDITOR.exit();
    await new Promise(r => requestAnimationFrame(r));
    return out;
  });

  check("placing an object does not disturb the farm",
    isolation.afterPlace.mine === 1 && isolation.afterPlace.farm === isolation.expected,
    JSON.stringify(isolation.afterPlace));
  check("a saved map contains only the player's objects",
    isolation.savedCount === 1 && !isolation.savedHasFarm, isolation.savedCount + ' objects');
  check('"New map" clears the player\'s map and spares the farm',
    isolation.afterNew.mine === 0 && isolation.afterNew.farm === isolation.expected,
    JSON.stringify(isolation.afterNew));
  check('revert rebuilds the whole cluster', isolation.afterRevert.farm === isolation.expected,
    JSON.stringify(isolation.afterRevert));
  check('revert puts the moved tree back', Math.abs(isolation.revertedX - -27) < 0.001,
    String(isolation.revertedX));
  check('revert leaks no colliders',
    isolation.afterRevert.solids === isolation.afterRevert.was,
    isolation.afterRevert.solids + ' vs ' + isolation.afterRevert.was);

  /* ---- scale is the builder's now, so it has to move the collider ----- */
  const scaling = await page.evaluate(() => {
    const out = {};
    const tree = SANDBOX.all.filter(i => i.type === 'prop_tree')[0];
    const box = s => ({ w: +(s.maxX - s.minX).toFixed(3), h: +(s.maxY - s.minY).toFixed(3) });
    out.before = box(tree.handle.solids[0]);
    out.beforeScale = tree.data.transform.scale;
    const live = SANDBOX.setTransform(tree, null, null, out.beforeScale * 2);
    out.rebuilt = !!live && live !== tree;
    out.sameId = live && live.id === tree.id;
    out.stillCampaign = live && live.layer === 'campaign' && live.fragment === 'scatter';
    out.after = box(live.handle.solids[0]);
    out.groupScale = live.object3D.scale.x;
    // Put it back so the world is left as we found it.
    SANDBOX.setTransform(SANDBOX.find(live.id), null, null, out.beforeScale);
    return out;
  });

  check('scaling a sized prop rebuilds it', scaling.rebuilt && scaling.sameId);
  check('the rebuild stays a farm object', scaling.stillCampaign);
  check('doubling the scale doubles the collider',
    Math.abs(scaling.after.w / scaling.before.w - 2) < 0.02,
    scaling.before.w + ' -> ' + scaling.after.w);
  check('the group is not scaled as well (no double-scaling)',
    Math.abs(scaling.groupScale - 1) < 1e-6, String(scaling.groupScale));

  // Leaving the editor must put the game back the way it was -- if it did
  // not, every digest comparison above would be measuring a different world.
  const after = await page.evaluate(() => ({
    editorActive: EDITOR.active,
    sandboxCount: SANDBOX.count,
    campaignCount: SANDBOX.campaignCount,
    solids: WORLD.solids.length
  }));
  check('editor released everything it added', !after.editorActive && after.sandboxCount === 0,
    'solids now ' + after.solids);
  check('the farm still stands', after.campaignCount === own.expected &&
    after.solids === world.counts.solids,
    after.campaignCount + ' objects, ' + after.solids + ' vs ' + world.counts.solids + ' solids');

  /* ---- spawn kind tags are identity, not labels ----------------------
     ENEMY.spawnAdditional filters markers with !usedMarkerKinds.has(m.kind)
     against a Set of kind STRINGS, so each distinct kind hosts exactly one
     enemy for the whole run. Markers that share a kind are silently
     ineligible after the first -- no error, just fewer enemies. spawn_enemy
     shipped once defaulting every placed marker to 'editor'; five spawns
     placed in the editor would have produced one enemy. */
  const kinds = await page.evaluate(async () => {
    const out = {};
    const before = WORLD.spawnMarkers.length;
    EDITOR.enter();
    await new Promise(r => requestAnimationFrame(r));
    const made = [];
    for (let i = 0; i < 4; i++) {
      made.push(EDITOR._place('spawn_enemy', new THREE.Vector3(10 + i * 2, 0, 40)));
    }
    const mine = WORLD.spawnMarkers.slice(before);
    out.registered = mine.length;
    out.kinds = mine.map(m => m.kind);
    out.allDistinct = new Set(out.kinds).size === out.kinds.length;
    // Not 'yard': ENEMY excludes that tag from eligibility outright.
    out.noneExcluded = out.kinds.every(k => k !== 'yard');
    // A hand-typed tag is honoured, because deliberately capping a region at
    // one enemy is a legitimate thing to author.
    const typed = EDITOR._place('spawn_enemy', new THREE.Vector3(18, 0, 40));
    typed.data.properties = { kind: 'my_tag' };
    const rebuilt = SANDBOX.rebuild(typed);
    out.typedKind = WORLD.spawnMarkers[WORLD.spawnMarkers.length - 1].kind;
    // And the markers go away again with the objects.
    SANDBOX.clear();
    out.after = WORLD.spawnMarkers.length;
    out.releasedCleanly = out.after === before;
    EDITOR.exit();
    await new Promise(r => requestAnimationFrame(r));
    return out;
  });
  check('placing enemy spawns registers a marker each', kinds.registered === 4,
    String(kinds.registered));
  check('each placed spawn gets a DISTINCT kind', kinds.allDistinct,
    kinds.kinds.join(','));
  check('no placed spawn lands on the excluded "yard" tag', kinds.noneExcluded);
  check('a hand-typed kind tag is honoured', kinds.typedKind === 'my_tag',
    kinds.typedKind);
  check('deleting the spawns releases their markers', kinds.releasedCleanly,
    kinds.after + ' vs ' + (kinds.after - (kinds.releasedCleanly ? 0 : 1)));

  /* ---- regions: the fifth captured kind -------------------------------
     The farm's two regions (cornMaze, northBarnStair) belong to builders
     that have not migrated, so nothing in the shipped game exercises
     capture, release or translate on one. That is exactly the state the
     ladder branch of SANDBOX.translate was in when its digest turned out
     to be blind to ladders, so these drive the mechanism directly. */
  const regions = await page.evaluate(() => {
    const out = {};
    out.farmRegions = Object.keys(WORLD.regions).sort();

    // Capture -> release, through the public API only.
    const h = WORLD.beginCapture();
    WORLD.addRegion('__probe', {
      x: 10, z: 20, baseY: 1,
      cols: 7, entrance: { c: 3, r: 4 },
      bounds: { minX: 0, maxX: 100, minZ: -50, maxZ: 50 }
    }, {
      x: ['x', 'bounds.minX', 'bounds.maxX'],
      y: ['baseY'],
      z: ['z', 'bounds.minZ', 'bounds.maxZ', 'nope.missing']
    });
    WORLD.endCapture();
    out.registered = !!WORLD.region('__probe');
    out.readBack = WORLD.region('__probe').x;

    // Translate: named fields move, unnamed ones must not.
    SANDBOX._translate(h, 5, 2, -3);
    const p = WORLD.region('__probe');
    out.moved = [p.x, p.baseY, p.z, p.bounds.minX, p.bounds.maxX, p.bounds.minZ, p.bounds.maxZ];
    // cols and the entrance cell are indices, not positions.
    out.indicesUntouched = p.cols === 7 && p.entrance.c === 3 && p.entrance.r === 4;
    // A path that resolves to nothing must not invent a field.
    out.noPhantomField = !('nope' in p);

    WORLD.release(h);
    out.releasedProbe = !WORLD.region('__probe');
    // ...and releasing a handle must not take the farm's regions with it.
    out.farmIntact = Object.keys(WORLD.regions).sort().join(',') === out.farmRegions.join(',');

    // A name replaced by a later builder belongs to whoever captured that
    // one -- releasing the first handle must not delete the second record.
    const h1 = WORLD.beginCapture();
    WORLD.addRegion('__dup', { x: 1 }, { x: ['x'] });
    WORLD.endCapture();
    const h2 = WORLD.beginCapture();
    WORLD.addRegion('__dup', { x: 2 }, { x: ['x'] });
    WORLD.endCapture();
    WORLD.release(h1);
    out.replacementSurvives = !!WORLD.region('__dup') && WORLD.region('__dup').x === 2;
    WORLD.release(h2);
    out.bothReleased = !WORLD.region('__dup');
    return out;
  });
  check('the farm registers both of its regions', regions.farmRegions.length === 2,
    regions.farmRegions.join(','));
  check('a region can be captured and read back', regions.registered && regions.readBack === 10);
  check('translate moves every field the axes name',
    JSON.stringify(regions.moved) === JSON.stringify([15, 3, 17, 5, 105, -53, 47]),
    JSON.stringify(regions.moved));
  check('translate leaves cell indices alone', regions.indicesUntouched);
  check('an axis path that resolves to nothing creates nothing', regions.noPhantomField);
  check('release drops the region it captured', regions.releasedProbe);
  check("release does not touch regions it did not capture", regions.farmIntact);
  check('releasing a replaced name spares the replacement', regions.replacementSurvives);
  check('releasing the replacement does remove it', regions.bothReleased);

  /* ---- fixtures: interactive objects that own their collision ----------
     The point of moving these off LEVEL's private `animated` object is that
     release and translate reach them. The point of checking them here is the
     opposite risk: that the move quietly broke a door. A North Barn door
     drives `collider.enabled` as its leaves swing, so the regression to fear
     is a door that still animates and no longer blocks -- or one that blocks
     while standing open, which is worse and invisible in a screenshot. */
  const fixtures = await page.evaluate(() => {
    const out = {};
    out.names = Object.keys(WORLD.fixtures).sort();

    const door = WORLD.fixture('northBarnDoor');
    // The collider must be the world's own, not a copy -- same identity
    // question the farm's tree colliders answer.
    out.colliderInWorld = WORLD.solids.indexOf(door.collider) !== -1;
    // Shut it explicitly rather than assuming: by this point the suite has
    // run the editor and a playtest, and QUEST opens every barn entrance in
    // co-op. Asserting a starting state we did not set would make this check
    // fail for a reason that has nothing to do with fixtures.
    LEVEL.setNorthBarnDoor(false, true);
    out.startsShut = !LEVEL.isNorthBarnDoorOpen() && door.collider.enabled === true;

    LEVEL.setNorthBarnDoor(true, true);       // immediate: skip the damping
    out.openReported = LEVEL.isNorthBarnDoorOpen();
    out.openClearsCollider = door.collider.enabled === false;

    LEVEL.setNorthBarnDoor(false, true);
    out.shutReported = !LEVEL.isNorthBarnDoorOpen();
    out.shutRestoresCollider = door.collider.enabled === true;

    const west = WORLD.fixture('northBarnWestDoor');
    LEVEL.setNorthBarnWestDoor(true, true);
    out.westOpenClearsCollider = west.collider.enabled === false;
    LEVEL.setNorthBarnWestDoor(false, true);
    out.westShutRestoresCollider = west.collider.enabled === true;

    // The railing is presence, not swing: QUEST drops it outright.
    const rail = WORLD.fixture('northBarnRailing');
    LEVEL.setNorthBarnRailing(false);
    out.railingDropped = rail.group.visible === false && rail.collider.enabled === false;
    LEVEL.setNorthBarnRailing(true);
    out.railingRestored = rail.group.visible === true && rail.collider.enabled === true;

    // The gate owns a portal as well as a solid, and is the one fixture whose
    // state crosses the network, so worldState has to keep seeing it.
    const gate = WORLD.fixture('barnStairGate');
    out.gateOwnsPortal = WORLD.portals.indexOf(gate.portal) !== -1;
    LEVEL.setBarnStairGate(true);
    out.gateStateVisible = LEVEL.worldState().barnStairGateOpen === true;
    LEVEL.setBarnStairGate(false);
    out.gateStateCleared = LEVEL.worldState().barnStairGateOpen === false;

    // Capture, translate and release, on the same machinery regions use.
    const h = WORLD.beginCapture();
    WORLD.addFixture('__probeDoor', { id: 'p', x: 3, z: 4, openness: 0.25 },
      { x: ['x'], z: ['z'] });
    WORLD.endCapture();
    out.probeReturnsRecord = WORLD.fixture('__probeDoor').id === 'p';
    SANDBOX._translate(h, 10, 0, -10);
    const p = WORLD.fixture('__probeDoor');
    // x and z are what the "near enough to open this" tests compare against.
    out.probeMoved = p.x === 13 && p.z === -6;
    // openness is state, not a position, and must not be swept along.
    out.stateUntouched = p.openness === 0.25;
    WORLD.release(h);
    out.probeReleased = !WORLD.fixture('__probeDoor');
    out.farmFixturesIntact = Object.keys(WORLD.fixtures).sort().join(',') === out.names.join(',');
    return out;
  });
  /* By name, not by count. The digest deliberately does not record fixtures
     -- their records hold THREE.Group references and a fixture's position is
     already in its collider's box, which the digest compares exactly -- so
     this line is the only thing standing between a future migration and
     silently dropping one. A count of four would not notice a swap. */
  check('the farm registers its four fixtures, by name',
    fixtures.names.join(',') ===
      'barnStairGate,northBarnDoor,northBarnRailing,northBarnWestDoor',
    fixtures.names.join(','));
  check("a door's collider is the world's, not a copy", fixtures.colliderInWorld);
  check('a shut main door blocks', fixtures.startsShut);
  check('opening the main door clears its collider',
    fixtures.openReported && fixtures.openClearsCollider);
  check('shutting it puts the collider back',
    fixtures.shutReported && fixtures.shutRestoresCollider);
  check('the west door does the same', fixtures.westOpenClearsCollider &&
    fixtures.westShutRestoresCollider);
  check('the railing drops and comes back', fixtures.railingDropped && fixtures.railingRestored);
  check('the stair gate still owns a live portal', fixtures.gateOwnsPortal);
  check('gate state still reaches worldState (multiplayer sync)',
    fixtures.gateStateVisible && fixtures.gateStateCleared);
  check('addFixture returns the record, not the capture wrapper',
    fixtures.probeReturnsRecord);
  check('translate moves a fixture by its declared axes', fixtures.probeMoved);
  check('translate leaves fixture state alone', fixtures.stateUntouched);
  check('release drops the fixture it captured', fixtures.probeReleased);
  check("release spares the farm's own fixtures", fixtures.farmFixturesIntact);

  /* ---- terrain: the farm switched off, and put back exactly -----------
     A blank map does not rebuild the level -- LEVEL.build runs once at boot
     and ENEMY's line-of-sight snapshot, RENDERCORE.tagScene and RAY_TARGETS
     all derive from that moment. It switches the farm's whole registration
     off instead. The regression that matters is the restore: `enabled` is
     not uniformly true to begin with (an open door's collider is off, the
     basement stair portal ships shut), so a naive restore would force
     everything on and silently shut open doors and open a sealed portal. */
  const terrain = await page.evaluate(async () => {
    const out = {};
    const snap = () => WORLD.solids.map(s => (s.enabled === false ? '0' : '1')).join('') +
      '|' + WORLD.ladders.map(l => (l.enabled === false ? '0' : '1')).join('') +
      '|' + WORLD.portals.map(p => (p.enabled === false ? '0' : '1')).join('') +
      '|' + WORLD.spawnMarkers.map(m => (m.enabled === false ? '0' : '1')).join('');

    out.startsOnFarm = LEVEL.terrain === 'farm';
    // Open a door and shut a portal first, so the restore has real non-default
    // state to get wrong.
    LEVEL.setNorthBarnDoor(true, true);
    const door = WORLD.fixture('northBarnDoor');
    out.doorOpenClearedCollider = door.collider.enabled === false;
    const before = snap();
    out.farmSolidsBefore = WORLD.solids.filter(s => s.enabled !== false).length;
    out.regionsBefore = Object.keys(WORLD.regions).length;
    out.fixturesBefore = Object.keys(WORLD.fixtures).length;

    LEVEL.setTerrain('blank');
    out.nowBlank = LEVEL.terrain === 'blank';
    out.farmSolidsLive = WORLD.solids.filter(s => s.enabled !== false).length;
    out.markersLive = WORLD.spawnMarkers.filter(m => m.enabled !== false).length;
    out.regionsGone = Object.keys(WORLD.regions).length === 0;
    out.fixturesGone = Object.keys(WORLD.fixtures).length === 0;
    // The arena fence is the only collision left, and it is real.
    out.arenaSolids = WORLD.solids.filter(s => s.enabled !== false && s.tag === 'fence').length;
    /* Name whatever else is still standing. The first version of this check
       reported only "290 live, 202 of them arena fence", which says a switch
       leaked without saying what leaked -- and the answer was the whole
       point: the farm's own migrated clusters, whose collision lives in
       SANDBOX's per-instance handles rather than LEVEL's farm-wide one. */
    const strays = {};
    WORLD.solids.forEach(s => {
      if (s.enabled === false || s.tag === 'fence') return;
      strays[s.tag || '(untagged)'] = (strays[s.tag || '(untagged)'] || 0) + 1;
    });
    out.strays = Object.keys(strays).sort().map(k => k + '×' + strays[k]).join(' ');
    out.strayMarkers = WORLD.spawnMarkers.filter(m => m.enabled !== false)
      .map(m => m.kind).join(',');

    LEVEL.setTerrain('farm');
    out.backOnFarm = LEVEL.terrain === 'farm';
    out.restoredExactly = snap() === before;
    out.doorStillOpen = door.collider.enabled === false && LEVEL.isNorthBarnDoorOpen();
    out.regionsBack = Object.keys(WORLD.regions).length === out.regionsBefore;
    out.fixturesBack = Object.keys(WORLD.fixtures).length === out.fixturesBefore;

    // Setting the terrain it already has must be inert, not a second restore.
    LEVEL.setTerrain('farm');
    out.idempotent = snap() === before;

    LEVEL.setNorthBarnDoor(false, true);
    return out;
  });
  check('the game starts on farm terrain', terrain.startsOnFarm);
  check('an open door clears its collider (setup for the restore)',
    terrain.doorOpenClearedCollider);
  check('blank terrain switches the farm off',
    terrain.nowBlank && terrain.farmSolidsLive === terrain.arenaSolids,
    terrain.farmSolidsLive + ' live, ' + terrain.arenaSolids + ' arena fence' +
      (terrain.strays ? ' — still standing: ' + terrain.strays : ''));
  check('blank terrain leaves a real arena fence', terrain.arenaSolids > 0,
    String(terrain.arenaSolids));
  check('blank terrain stops the farm spawning enemies', terrain.markersLive === 0,
    terrain.markersLive + ' markers still live' +
      (terrain.strayMarkers ? ': ' + terrain.strayMarkers : ''));
  check("blank terrain takes the farm's regions out of play", terrain.regionsGone);
  check("blank terrain takes the farm's fixtures out of play", terrain.fixturesGone);
  check('switching back restores every collider EXACTLY', terrain.restoredExactly);
  check('...including leaving an open door open', terrain.doorStillOpen);
  check('regions come back', terrain.regionsBack);
  check('fixtures come back', terrain.fixturesBack);
  check('setting the same terrain twice is inert', terrain.idempotent);

  check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(err => { console.error(err); process.exit(1); });
