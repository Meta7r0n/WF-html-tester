# Withered Farm → engine + editor: architectural assessment

Written before any code changed, from reading the source rather than assuming.
Line numbers are as of `8cd1ec0`.

## 1. Current architecture

One 31,700-line `index.html`. No build step, no bundler, no `import`. ~36
top-level IIFE modules, each `const NAME = (() => { ... })()`, in dependency
order, cross-referencing each other by bare global name at *call* time (very
often behind `typeof X !== 'undefined'` guards). Three.js r128, GLTFLoader and
PeerJS come in as three CDN `<script src>` tags.

That single-file shape is a real constraint, not an accident: the game runs
from `file://` with no server. Splitting into ES modules would require CORS and
a server and would break that. **The engine boundary therefore has to be
enforced by module contract, not by file path.** The brief allows this
("architectural separation is more important than the filenames").

## 2. Level/world construction

`LEVEL.build(scene)` (12034) calls ~30 `buildX(root)` functions in sequence.
Every one is imperative: it creates meshes into a `THREE.Group` and separately
registers collision by calling `WORLD.add/addFloor`. Art and collider are
authored side by side deliberately so they cannot drift.

There is no data. Coordinates are literals in code. ~5,400 lines of it.

## 3. Reusable systems already present

Genuinely reusable as-is: `PRIM` (primitive builders + auto ink outline),
`MAT`/`TEX` (cached material/texture factories), `PROPS` (10 prop builders,
uniform `(parent, x, z, opts)` shape), `RENDERCORE`, `INPUT`, `AUDIO`, `FX`,
`WORLD`'s query side (`groundAt`, `canOccupy`, `portalAt`).

## 4. Object/entity creation mechanisms

Three, with three different shapes:

| system | entry point | returns |
|---|---|---|
| props | `PROPS.barrel(parent, x, z, opts)` etc. | `THREE.Group`/mesh |
| pickups | `PICKUP.spawn(defId, position, options)` | tracked item |
| enemies | `ENEMY.spawnGrunt(id, point)` | entity |

All three are callable at arbitrary positions at runtime — the dev console
already does exactly that. **This is the key enabler: the editor can reuse
gameplay construction code directly, with no duplication.**

## 5. Hardcoded world content

Everything. Fences, barn, silos, greenhouses, the whole basement network,
every sign, every prop cluster. Plus `MAPVIEW` keeps a hand-maintained
*duplicate* of many of those coordinates for the menu map, which its own
comment admits and asks people to keep in sync by hand.

## 6. Save/load today

`SETTINGS` → `localStorage['wf-settings-v1']`, player preferences only.
`LEVEL.worldState()`/`applyWorldState()` serialise a handful of door/gate
booleans for multiplayer sync. **No world persistence of any kind exists.**

## 7. Existing registries

`PICKUP.definitions` is the only real one — `define(id, def)` into a plain
object, with `registerHandler(type, fn)`. `ENEMY.roster` is a flat id array.
Bosses are a hardcoded alias table inside `DEVCONSOLE`. `CAST.ROSTER`,
`HEADS`, `HANDS`, `COLLARS` are character registries with the right instincts.

`DEVCONSOLE`'s `spawn`/`list` is a **dispatcher over three unrelated lookups,
not a registry.** It resolves a string to one of three subsystems by trying
each in turn. Useful as a source of registry *content*; wrong shape to build on.

## 8. Major architectural obstacles

1. **`WORLD` cannot forget.** `solids`/`ladders`/`portals`/`spawnMarkers` are
   append-only with no ownership. Nothing can remove one collider without
   knowing its array index, and nothing records who added it. An editor must
   be able to delete. *This is the one true blocker and it needs a real fix.*
2. **No separation between "the campaign farm" and "the world".** `LEVEL.root`
   is one group built once at boot.
3. **Systems assume campaign geometry exists** — QUEST, the North Barn doors,
   the basement portals, boss spawn points, `MAPVIEW`'s mirrored coordinates.
   Migrating campaign content into map data would break these; that migration
   is explicitly a later phase.
4. **Pointer lock owns the mouse during play**, so an editor needs the lock
   released to have a cursor for panels and picking.

## 9. Recommended incremental refactor

Additive only, in this order:

1. `WORLD.beginCapture()/endCapture()` → a handle recording everything a
   builder registered, and `WORLD.release(handle)` to undo it. Fixes obstacle
   1 without touching any of LEVEL's 5,400 lines.
2. `REGISTRY` — one authoritative table of placeable definitions whose
   `create()` calls the *existing* PROPS/PICKUP/ENEMY code.
3. `SANDBOX` — the editable world layer: its own `THREE.Group` plus an
   instance list, living alongside the campaign rather than replacing it.
4. `MAPIO` — versioned serialise/validate/parse.
5. `EDITOR` — mode, free-fly camera, pick/place/move/rotate/delete/duplicate,
   history, browser, inspector, playtest.

## 10. Proposed first vertical slice

**The campaign farm stays exactly as it is and becomes the backdrop.** The
editor authors a *sandbox layer* on top of it. Map data describes only that
layer.

This is the adapter approach the brief asks for. It gets the full
place→select→move→save→load→play→return loop working end to end without
editing a single line of `LEVEL`, so the campaign cannot regress — and it
leaves the later "migrate campaign content into map data" phase with a proven
map format and a proven loader to migrate *into*.

Coordinate system: metres, Y-up, right-handed, ground at y=0, `rotation` a
single Y-axis yaw in radians (everything in the game is yaw-only), plus a
`layerId` because this world has a real basement.

---

## 11. Phase 2: migrating campaign content (first cluster landed)

The slice in section 10 shipped and the format held, so the campaign started
moving into it. First cluster: `buildScatter`'s trees, rocks and stumps —
picked because it is self-contained, with no quest, door, portal or
multiplayer dependency to reason about.

### The constraint that shapes everything here: RNG order

`LEVEL.build()` opens with `UTIL.setSeed(90210)` and every builder after it
draws from that one stream. `PROPS.tree` alone takes eight numbers (trunk
height, lean, canopy colour, five lobe radii), and its random trunk height
goes straight into `WORLD.addFloor`, so it is baked into collision as well as
into the art.

The consequence is easy to miss and expensive to get wrong: **moving a
builder, or replaying its contents in a different order, redraws everything
constructed after it.** Not just the cluster being migrated — the corn maze,
the silos, the basement. So:

- fragments store authored order and `CAMPAIGN.replay` walks them in it;
- each call site stays exactly where it was in `build()`;
- `replay(id, handlers, types)` takes a type filter *specifically* so a
  partially-migrated builder can interleave migrated and inline content
  without reordering either. `buildScatter` replays trees+rocks, builds its
  collapsed outbuilding inline as before, then replays stumps — because the
  ruin generates a wood texture whose RNG draw sat between them.

That filter argument is scaffolding. It comes out when nothing inline is left.

### What is now true

- `CAMPAIGN` holds fragments in the *same* format MAPIO validates and SANDBOX
  loads. Not a similar format — the same one, so the editor opens a fragment
  with no importer.
- `buildScatter` holds no coordinates. There is deliberately no fallback copy
  inside LEVEL: a second list is a second source of truth, and it would
  diverge on the first edit.
- `PROPS.stump` was extracted from three inline `PRIM` calls so the cluster
  could name a type; `prop_stump` is registered and placeable.
- `prop_rock` and `prop_tree` build at **unit size** in the registry. They
  used to start at 0.8, which made editor "scale 1" mean 0.8 and would have
  shown a fragment authored at 1.1 as 0.88.
- `LEVEL.root` is exposed (getter only) — the handle the map layer needs to
  take a cluster over, and the scope a harness needs to measure the authored
  farm without entities walking through it.

### Known gaps, deliberately left

1. **Both copies are in the scene.** Loading the scatter fragment in the
   editor puts its trees on top of the ones `LEVEL` already built. LEVEL
   still owns construction; the fragment is still only the data it reads.
   Giving the map layer ownership — LEVEL skipping a cluster the map supplies
   — is the next slice, and it is what makes editing the campaign real.
2. **Editor scale is approximate for collision.** SANDBOX scales an
   instance's group but not its collider (documented in SANDBOX itself). The
   campaign path is exact, because it passes scale into the builder. Fixing
   the editor properly needs a selection-preserving rebuild on scale change.

### Verifying a migration: what a digest has to survive

`tools/campaign-migration-test.js` compares a build of the previous commit
against a build of the working tree. Two earlier versions of it were wrong in
ways worth recording, because both *looked* like they had caught a real bug:

1. Hashing one frame of `GAME.scene` reported a difference — which survived a
   control run of the same build against itself. `registerBoil` and
   `registerWobble` perturb position and rotation every frame, so it was
   hashing the clock.
2. Identifying the animated meshes empirically (sample twice, keep what held
   still) failed its control too: a slowly-boiling mesh can land on the same
   5-decimal value eight frames apart, so the "stable" set was itself random.

What works is splitting the question in two. **Where** everything is comes
from `WORLD`'s arrays, which are written once at build time and never
animated — compared exactly, and sensitive to a shifted RNG stream because
tree collider heights are drawn from it. **What** was built comes from an
animation-invariant key per mesh (vertex count + local bounding-box size +
scale), compared as a multiset over `LEVEL.root`.

Run the control before trusting the result, and a negative control after:
perturbing one tree by 0.5 m must fail the comparison and name the collider.

---

## 12. Phase 3: the editor becomes a mode you can find

The first two phases built the editor and proved the map format on real
campaign content, but left it reachable only by pressing F2 — undocumented,
and only from inside a running match. A feature nobody can find is not
shipped. This phase closed that.

### Entry and exit are now a contract, not a keystroke

`GAME` exposes exactly three functions to `EDITOR`, and they are the whole
relationship:

- **`openEditor()`** — hides the menus and enters. Reachable from a **Map
  Editor** button on the start screen and another on the pause card. Opening
  from the main menu works at all because `LEVEL.build(scene)` already runs at
  boot: the farm exists before a match does, so there is a world to fly
  around without starting one.
- **`startPlaytest()`** — the piece that was missing. PLAY from a
  menu-opened editor had nothing to play into: no HUD, no quest, no pointer
  lock, because `entered` was still false. It now starts a real single-player
  run through `startSingleHero`, the same path the menu uses, with only the
  insertion cutscene skipped (`restart(skipIntro)`). Deliberately not a
  bespoke reset — a playtest that begins from a different state than a real
  run is testing the wrong game.
- **`closeEditor()`** — decides where "back" is from state it owns: the pause
  card mid-run, the start screen otherwise.

`EDITOR` records `openedFrom` on entry so this stays correct when F2 is used
instead of a button. The new **Exit** button leaves the mode entirely, which
is distinct from PLAY handing off to the game — before this, the only way out
of a menu-opened editor was into a match.

### Editing additions

- **Grid snap**, on by default at 0.5 m, with 0.25/0.5/1/2 in the toolbar.
  Snaps X and Z only: a raycast lands an object *on* something — a catwalk, a
  silo deck — and quantising that height would lift it off or sink it in.
  Without snap, lining two props up produces coordinates like 6.5851 and the
  inspector shows a number nobody typed.
- **F frames the selection**, distance from the object's own bounding box so
  a stump and a barn fill about the same screen area. The approach angle is
  kept rather than reset; being snapped to a fixed viewpoint every time is
  disorienting.

### A version label that cannot go stale again

The start card's eyebrow read `WC v0.38` for four releases while the corner
badge on the *same card* read the real number, because the eyebrow was typed
into the HTML. It is now stamped from `BUILD` at boot alongside the badge.
This is the third time a hand-maintained copy of the version has drifted on
this project; the fix is always the same one.

`tools/editor-mode-test.js` covers this phase — entry from both places, snap,
framing, Exit landing in the right place, and a playtest that starts a run
and drops the player at the authored spawn. Like the mouse suite it asserts
hit-testability rather than trusting that a click landed.

---

## 13. Phase 4: the map layer owns the scatter

Phase 2 moved the scatter's coordinates into map data, but `replay()` handed
each row to a builder and forgot it — the farm got trees, and nothing
afterwards knew which tree came from which row. The editor could *show* you
the data and could not change what the game drew. This phase closes that.

### What changed

`LEVEL.buildScatter` no longer calls `PROPS.*` at all. It calls
`CAMPAIGN.open('scatter', root)` and builds through **SANDBOX**, so every
tree, rock and stump comes back as a live instance with a `WORLD` capture
handle: selectable, movable, deletable, releasing its collider when it goes.
Click a tree in the editor, drag it, and the farm's collider moves with it.

Objects are parented under a `campaign:scatter` group inside `LEVEL.root`
rather than the sandbox group. The farm's scene graph stays the farm's, and
anything that walks it — the render audit, the migration digest — still sees
a complete world.

### The blocker that had to be cleared first: scale

`SANDBOX` applied `transform.scale` to the returned *group*. That was
tolerable while the editor only authored new objects and fatal the moment
`LEVEL` built the farm through the same path, for two reasons:

- **Geometry.** `PROPS.tree` scales its trunk and canopy by the argument but
  **not** its lean (`rng(-0.7, 0.7)`) or its sag. A unit tree group-scaled to
  1.1 is a visibly different tree from one built at 1.1.
- **Collision.** The builder calls `WORLD.addFloor` with the size it was
  handed, so a group-scaled prop got a collider that never grew — a 1.1 tree
  with a 1.0 hitbox.

So registry entries gained `scaleInBuilder`. Those props take
`transform.scale` as a builder argument, `SANDBOX` leaves the group at scale
1, and a scale change rebuilds the object because its geometry and its
collider both depend on it. `setTransform` therefore returns the live
instance — usually the same one, but a new one after a rebuild — and callers
holding a selection must take the return value.

### Layers, and the thing that would otherwise be a disaster

Instances now carry `layer` ('sandbox' or 'campaign') and a `fragment` id.
Three places care:

- `clear()` spares campaign objects, so **"New map" no longer bulldozes the
  farm's trees**.
- `serialize()` excludes them, so a saved map does not swallow a copy of the
  farm and double every tree on reload.
- The status line counts them separately, because counting the farm's trees
  among the things an author placed is meaningless to them.

This introduced a trap worth naming, and the first fix for it was wrong.
`instances` initially meant *everything*, with `owned` as the player's subset
— which left the dangerous reading as the default one. Seven call sites
across two suites read `instances[0]` meaning "the thing I just placed" and
silently got a tree at (-27, 26); one deleted a farm tree instead of its own
object **and still reported a pass**. So the names were inverted:
`instances` is the player's objects (`count === instances.length`, always)
and `all` is everything. Only picking and CAMPAIGN's snapshot/release want
`all`.

### Editing the farm, and getting the result out

The map panel's fragment row is no longer a load button — there is nothing to
load, because the objects are already in the world. It offers the two things
dragging cannot do:

- **Revert** rebuilds the cluster from the authored rows, restoring anything
  deleted. It re-rolls procedural variation (a tree's lean is drawn at build
  time), so reverted trees stand in the right places but do not lean the way
  they did.
- **Export** writes `CAMPAIGN.snapshot(id)` — the fragment as it stands now,
  edits included — as map JSON.

`CAMPAIGN.fragment()` still returns the *authored* rows, untouched by
editing, which is what gives Revert something to go back to.

### Verified

The farm is byte-identical to the previous commit: same collision hash
`f195dbadd6f09853` (1335 solids, 15 ladders, 58 spawn markers) and the same
mesh multiset over `LEVEL.root`. That is the whole safety argument — the
migration changed who owns the trees, not where they stand — and it holds
because the objects are built by the same builders, with the same arguments,
in the same authored order, at the same point in `LEVEL.build`.
