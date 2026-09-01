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
