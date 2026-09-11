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

---

## 14. Phase 5: the scatter cluster is finished

Phase 4 gave the map layer ownership of the scatter's trees, rocks and
stumps, but left the collapsed outbuilding and its dressing inline — which is
why `CAMPAIGN.open().build()` still took a type filter, to interleave with
`LEVEL`'s own code either side of the ruin. That is now gone. `buildScatter`
is one line:

```js
CAMPAIGN.open('scatter', parent).build();
```

`LEVEL` holds none of that cluster: not a coordinate, not a colour, not the
rubble heap. Thirty-four objects, all data.

### What it took

- **`PROPS.ruin`** extracted, built around the origin where the original
  added `-25` to every x and z inline. Same RNG draws in the same order, so
  the heap is the same heap.
- **`prop_barrel` gained a colour property**, because the farm's barrel by
  the ruin is deliberately `blueDeep` where an unspecified one picks at
  random. Hex string, so it survives a JSON round trip; blank falls back to
  the random pick rather than to black.
- **`prop_sign` gained board size and colours**, because CONDEMNED is a small
  rust-on-cream board on a short post, not the default. All optional, so a
  sign placed in the editor still needs nothing but its text.
- **`spawn_enemy`**, a placeable `WORLD.addSpawn`. Registered in `build()`
  rather than `activate()` on purpose: a spawn marker is world data, not a
  gameplay entity, so it wants the capture scope that makes delete and move
  work.

### Two bugs this uncovered

**`SANDBOX` only translated solids.** `instantiate` shifted `handle.solids`
from origin to the placed position and silently ignored ladders, portals and
spawn markers. Nothing had exercised that until `spawn_enemy` — the farm's
enemy spawn would have stayed at (0, 0, 0) and enemies would have appeared in
the wrong field. Now a shared `translate(handle, dx, dy, dz)` moves all four
kinds, including a ladder's snap and exit points, and `setTransform` uses the
same helper so dragging works too. The migration digest proves it: spawn
marker positions are part of the collision hash, and the hash is unchanged.

**Editor markers rendered during play.** Visibility was toggled only by
`activateGameplay`/`deactivateGameplay`, which run on PLAY and on entering
the editor — nothing hid a marker created while the editor was closed, which
is every marker the farm itself places, since `LEVEL` builds at boot. A red
post-and-diamond stood in the field by the ruin during a real run. Markers
are now visible **iff the editor is on screen**: hidden at instantiate unless
`EDITOR.active`, and `exit()` hides them too, so leaving by the front door
does not leave gizmos standing in the farm.

It surfaced as three extra meshes in the digest, which is the digest doing
its job. The digest now excludes gizmo subtrees — tested by ancestry, not by
`visible`, because a visibility filter would also swallow a real mesh that
had wrongly been hidden, which is exactly what this is for.

### Verified

Farm byte-identical to the previous commit: collision hash
`f195dbadd6f09853`, 1335 solids, 15 ladders, 58 spawn markers, 3169 meshes.
Migration suite 35/35.

---

## 15. Audit: what the harder clusters actually depend on

The scatter went first because it had no quest, door or portal dependencies.
The brief singles out the North Barn, cellar, doors and underground routes as
places that "may contain assumptions about hardcoded world objects" and says
not to break them without understanding them first. This is that
understanding, done before touching anything.

### Cluster sizes and shapes

| builder | lines | solids | ladders | portals | spawns | animated |
|---|---|---|---|---|---|---|
| `buildBasement`  | 881 | 36 | 2 | 1 | 6 | 7 |
| `buildNorthBarn` | 316 | 20 | 0 | 0 | 5 | 3 |
| `buildBarn`      | 162 | 24 | 0 | 0 | 2 | 0 |
| `buildSilo`      | 118 |  9 | 1 | 0 | 2 | 0 |

`animated` is the column that matters. It counts objects the builder hands to
`LEVEL.animated`, which other systems then drive.

### Three real blockers, in order of severity

**1. Interactive objects have no place in the registry contract.** A registry
entry is `build(ctx, d) -> Object3D`: geometry, and nothing else. But
`animated.northBarnDoor` is `{ west, east, collider, open, target, openness }`
— it holds a **live reference to its own WORLD solid** and drives
`collider.enabled` as the leaves swing (`poseNorthBarnDoor`). There is
nowhere in the current contract to hang "this is a door, here is its
collider, here is how to open it." Migrating any door, hatch or gate needs
that contract extended first; migrating geometry alone would produce a barn
whose doors are scenery.

**2. Builders write ad-hoc properties onto `WORLD` that the capture scope
cannot see.** Exactly two:

```js
WORLD.cornMaze       = { ... }   // buildCornMaze -> ENEMY navigation graph
WORLD.northBarnStair = { ... }   // buildNorthBarn -> ENEMY stair pursuit AI
```

Neither is one of the four captured kinds, so neither is recorded, released
or translated. Delete a migrated North Barn in the editor and
`WORLD.northBarnStair` still points at coordinates for a barn that is gone,
and `ENEMY.northBarnStairPursuitActive` keeps steering grunts up a staircase
that no longer exists. Any migration of those two clusters has to make region
data capturable first.

**3. Spawn `kind` tags are load-bearing identity, not labels.**
`ENEMY.spawnAdditional` filters with `!usedMarkerKinds.has(m.kind)` against a
Set of kind strings, so **each distinct kind hosts exactly one enemy for the
whole run**, and the reservation logic routes by regex on the tag
(`/^north_barn_/`, `/^corn_maze_/`). Preserving marker positions through a
migration is not enough; the tags have to survive exactly, and duplicates are
silently ineligible rather than an error.

This one bit immediately: `spawn_enemy` shipped in the previous commit
defaulting every placed marker to kind `'editor'`, so placing five enemy
spawns in the editor would have produced one enemy and no diagnostic. Fixed
here — a blank tag now derives a unique one from the instance id, and a tag
typed by hand is left alone, since deliberately sharing one to cap a region
is legitimate.

### One thing that is NOT a bug

`worldState()` syncs only `barnStairGateOpen`, and `COOP.sendWorldInteraction`
hard-rejects any id but `barn_stair_floor_gate` — so North Barn door state
never reaches a joining player. That looks like a multiplayer desync until you
follow `QUEST.interact`, which opens with `if (!isSinglePlayer()) return
false;`. Every one of QUEST's eleven entry points is gated the same way, and
`QUEST.start` deliberately opens all three barn entrances and drops the
railing in co-op and PvP, with a comment saying why. The barn's door state is
single-player-only by design. Worth recording, because the shape of the code
invites exactly the wrong conclusion.

### Recommended order

**`buildSilo` next**, not the North Barn. It is the smallest cluster, has no
animated objects, and — usefully — is the only near-term candidate with a
**ladder**, which would be the first real exercise of the ladder branch of
`SANDBOX.translate` (added in the previous commit with nothing yet using it).
`buildBarn` after it: bigger, still no interactive objects.

The North Barn and the basement come last, and only after blockers 1 and 2
are cleared, because both are gated on engine work rather than on content.

---

## 16. Phase 6: Silo Row, and the first ladder to move

Taken next on the audit's recommendation: smallest cluster, no animated
objects, and the only near-term candidate with a **ladder**. `buildSilo` went
from 118 lines to one:

```js
CAMPAIGN.open('silo', parent).build();
```

Eight objects: the tower, two flanking silos, the deck crate, lantern and
sign, and both spawn markers.

### Decomposition

The tower is **one object**, not a kit. Legs, bracing, deck, rails, ladder
and tank ship together because nothing there is separately placeable — you
would never move the rails without the deck they stand on. The flanking
silos, the deck dressing and the spawns are separate, because you might.

`prop_silo_tower` is deliberately **not** `sized`. Its ladder exit points and
deck height are authored constants the rest of the farm's traversal depends
on; a scaled one would be a climbable structure whose ladder no longer lands
on its own deck.

### Two builders had to learn where they land

`PROPS.crate` and `PROPS.hayBale` both do:

```js
if (y < 0.05) blobShadow(...)
```

A registry builder works at the local origin, so `y` is 0 even for a crate
destined for the silo deck at 8.2 — and the crate would have grown a ground
shadow eight metres in the air. Both now take an explicit `groundY`, and the
registry entries feed it `transform.position.y`. `prop_lantern` gained a
`height` property for the same class of reason: the registry baked in 1.2,
and the deck lantern wants 0.7.

### The digest was blind exactly where it mattered

The first run came back byte-identical, and that result was worthless. The
ladder line read:

```js
lines.push('ladder|' + [l.x, l.z, l.minY, l.maxY] ... + (l.id || ''));
```

A ladder has none of `x`, `z` or `id` — `WORLD.addLadder` produces
`minX/maxX`, `snapX/snapZ`, `topExit*`, `bottomExit*` and `tag`. So the
digest recorded `undefined,undefined` and compared the vertical extent alone.
It passed the first migration ever to move a ladder without once looking at
where the ladder went.

Fixed to record all sixteen positional fields plus tag, layers and flags. The
comparison then still passed — and a negative control proves it means
something now. Moving the tower 0.5 m shifts every x-coordinate on the ladder
by exactly 0.5:

```
base : minX 1.1  maxX 2.9  snapX 2.0  topExitX 2.0  bottomExitX 2.0
moved: minX 1.6  maxX 3.4  snapX 2.5  topExitX 2.5  bottomExitX 2.5
```

That is `SANDBOX.translate`'s ladder branch working — the box, the snap point
and both exit points all travelling with the object. It was written in phase
5 with nothing exercising it; this is the first thing that does.

The collision hash changed from `f195dbadd6f09853` to `e8f24fc989c41b3f` for
this reason alone: the digest now records more. Both builds agree on the new
value, which is the claim that matters.

### The suite no longer counts by hand

Seven assertions hardcoded "34 objects" and broke the moment a second cluster
migrated. They now derive the expectation from `CAMPAIGN` itself — every
authored object in every live fragment should be a live instance, checked per
fragment. That is the real invariant, and it does not need editing next time.

### Verified

Farm byte-identical: `e8f24fc989c41b3f`, 1335 solids, 15 ladders, 58 spawn
markers, 3169 meshes. Migration suite 42/42 across both clusters.

---

## 17. Phase 7: the barn, and rotation as a build argument

The last low-risk cluster on the audit's list. `buildBarn` went from 162
lines to one call; 22 objects — the shell, five hay bales, a barrel, three
crates, three cans, two bottles, three lanterns, the workbench, the pitchfork
and both spawn markers.

Three clusters are now map data: scatter (34), Silo Row (8), barn (22).

### Rotation had to become a build argument

The barn is the first cluster where an authored **rotation** changes how many
numbers come out of the seeded stream:

```js
hayBale: rotY || UTIL.rng(-0.4, 0.4)          // 0 is falsy -> draws
crate:   rotY === undefined ? UTIL.rng(...) : rotY   // 0 is fine -> no draw
```

All five barn hay bales carry a non-zero rotation, so none of them draws.
The registry's hardcoded `0` would have drawn five times, shifting every prop
built after the barn. So `rotationInBuilder` now exists alongside
`scaleInBuilder`: the entry takes `transform.rotation` as an argument,
SANDBOX leaves the group at rotation 0, and a rotation change rebuilds
because geometry depends on it.

Crate is the mirror image. It only draws when rotation is **undefined**, and
`buildBarn` has exactly one crate authored that way. `spin: 'random'` is how
that is said in data — the builder passes `undefined` and takes its draw.
Authoring a fixed rotation there instead would have looked identical and
consumed one number fewer.

Worth stating plainly: I got this backwards at first and had to correct it.
`crate` looked like the broken one because both builders read `rotY`; only
reading the two conditions side by side shows `||` and `=== undefined` behave
differently on zero.

### Signatures that do not mean what the position implies

`PROPS.lantern(parent, x, y, z, hang)` — the fourth argument is a **cable
length** that draws a cylinder, not a rotation. The barn's three lanterns use
0.9, 0.5 and 0, so `hang` is now a property. Crate size varies across the
farm (0.85 on the silo deck, 1.0 and 0.9 in the barn), so it is
`transform.scale` with `scaleInBuilder` — which meant going back and giving
the already-migrated silo crate an explicit 0.85, since it had been relying
on the registry's hardcoded value.

`CAMPAIGN.obj()` gained an explicit scale argument for that, and stopped
prefixing ids with `scatter_` — it was writing `scatter_silo_tower` for a
silo object. Fragment ids are spelled out now.

### Verified

Farm byte-identical on the first run: `e8f24fc989c41b3f`, 1335 solids, 15
ladders, 58 spawn markers, 3169 meshes. Migration suite 42/42 across three
clusters, 64 objects — and because phase 6 made the suite derive its
expectations from CAMPAIGN, adding a third cluster needed no test edits at
all.

### What is left

`buildBasement` (881 lines, 7 animated) and `buildNorthBarn` (316 lines, 3
animated) are what remain of the named systems, and both are gated on the two
engine blockers from section 15 — the registry contract cannot express a door
that owns its collider, and `WORLD.cornMaze`/`WORLD.northBarnStair` are
ad-hoc properties the capture scope cannot see. Those are engine work, not
content work.

---

## 18. Phase 8: regions become a captured kind

First of the two engine blockers from section 15, and the smaller one. No
content moved in this phase — this is the engine work that has to exist
before the North Barn can move at all.

### The constraint

`WORLD` captures four kinds: solids, ladders, portals and spawn markers. A
builder wraps its work in `beginCapture()/endCapture()`, and `release(handle)`
un-registers exactly what it added. That is what makes deletion possible, and
`SANDBOX.translate` is what makes moving possible.

Two builders wrote outside all of it:

```js
WORLD.cornMaze       = { ... }   // buildCornMaze  -> ENEMY navigation graph
WORLD.northBarnStair = { ... }   // buildNorthBarn -> ENEMY stair pursuit
```

Plain properties on `WORLD`, set by assignment. Not a captured kind, so
nothing releases them and nothing moves them. Migrate the North Barn with
that still true and you get a barn you can delete in the editor whose stair
record still names coordinates inside it, with `ENEMY` steering grunts up a
staircase that is no longer there — silently, because a stale record looks
exactly like a live one.

The asymmetry was already visible: `reset()` cleared `cornMaze` and not
`northBarnStair`. Harmless only because nothing calls `reset()` today.

### The shape

`regions` is now the fifth captured kind:

```js
WORLD.addRegion(name, data, axes)   // register, and capture
WORLD.region(name)                  // read
```

`data` is whatever record the builder wants — a region is not a box, and
forcing one into a min/max shape would lose the corn maze's entire point.
`axes` names which of its own fields are world coordinates, so
`SANDBOX.translate` can move it without knowing anything about it:

```js
{ x: ['x', 'bounds.minX', 'bounds.maxX'],
  y: ['baseY', 'topY'],
  z: ['baseZ', 'topZ', 'bounds.minZ', 'bounds.maxZ'] }
```

Dotted paths reach nested fields. Anything unnamed stays put, which is the
important half: the maze's `open` grid and its entrance cell indices are not
positions, and a translate that bumped every number it found would corrupt
them. A path that does not resolve to a number is skipped rather than
created, so a typo in an axis list leaves the record alone instead of
writing `NaN` into it.

Release handles a map rather than a list, and drops a name only if it is
still holding the record that was captured — a later builder may have
replaced it, and that replacement belongs to whoever captured *it*.

### One hardcoded box moved into its region

`northBarnStairPursuitActive` carried the barn's own footprint as a literal:

```js
const inBarn = (x, z) => x > 32 && x < 64 && z > -79 && z < -54;
```

That is a hardcoded world assumption of exactly the kind the brief says to
find before breaking. Left there, moving a migrated North Barn would move
the stair run and leave the "am I in the barn" test behind — a half-migration
that reads as an AI bug, not a data bug. It is `bounds` on the region now, so
the whole record travels together.

### The digest was under-recording three kinds out of four

Phase 6 found that the ladder line named fields a ladder does not have. That
fix was never swept across the rest, and the rest had the same disease —
fields written from memory instead of from the constructor:

```js
lines.push('portal|' + (p.id || ''));                                  // the box, layers and enabled flag: not recorded
lines.push('spawn|' + [m.x, m.y, m.z] ... + (m.tag || m.id || ''));    // a marker has none of x, y, z, tag or id
```

A spawn marker is `{ position: Vector3, kind, layerId }`. So every one of the
farm's 58 markers digested to the identical string
`spawn|undefined,undefined,undefined|`, and the digest could not have seen a
marker move, a marker vanish, or a `kind` tag change — the tags section 15
established are load-bearing identity, where a duplicate silently costs you
an enemy. Both lines now record what the constructors actually produce, and
regions serialise whole, because the interesting part of a region is usually
not a coordinate: a shifted RNG stream would regenerate the maze's opening
grid differently while every bounding number stayed exactly where it was.

### Verified

Control first: the base build digested twice compares clean, so the tool's
output means something.

Base vs new is **not** byte-identical, and that is the correct result — the
new build records two region lines the old build had no concept of. What
matters is that they are the *only* difference:

```
only in new : region|cornMaze|{...}
only in new : region|northBarnStair|{...}
(0 line(s) only in base, 2 only in new)
PASS  same solids count    1335 vs 1335
PASS  same ladders count   15 vs 15
PASS  same portals count   1 vs 1
PASS  same spawns count    58 vs 58
PASS  same meshes count    3169 vs 3169
PASS  every built mesh matches in geometry and scale   3169 meshes
```

**Zero** lines only in base is the claim that matters: nothing was removed
and nothing moved. Two lines were added. And the digest is now genuinely
watching portals and spawn markers while it says so.

Negative control: a build identical to the new one except
`northBarnStair.bounds.minX: 32 -> 33` — one character, in a field no
geometry reads. It fails on exactly that line and nothing else:

```
only in base: region|northBarnStair|{..."bounds":{"minX":32,...}}
only in new : region|northBarnStair|{..."bounds":{"minX":33,...}}
(1 line(s) only in base, 1 only in new)
```

The `_translate` test hook was added to SANDBOX after the first digest, so
the whole digest was retaken with it present: `8749ca8da68b7c30` both
times, identical. Inert by measurement rather than by argument.

Migration suite **51/51** — the existing 42 plus nine that drive the region
mechanism directly, because no shipped builder does. They cover capture,
read-back, translate (asserting the exact vector `[15,3,17,5,105,-53,47]`
across three dotted paths), indices left alone, an axis path resolving to
nothing creating nothing, release, release *not* touching regions it did
not capture, and a name replaced by a second builder surviving the first
handle's release.

### Blocker 1 was misdiagnosed in section 15

Section 15 said the registry contract `build(ctx, d) -> Object3D` "cannot
express an interactive object" and would have to be extended. Working
through the region case shows that is the wrong diagnosis, and acting on it
would have meant changing a contract that is fine.

A door does not need the contract to carry it out. It needs to *register*
itself the way a collider does — during `build()`, into a captured kind, so
the capture scope SANDBOX already opens records it and release/translate
handle it for free. The contract stays exactly as it is; what was missing
was a kind, not a return type. Blocker 1 is therefore the same shape as
blocker 2 with a different consumer, which is also why it is worth doing
next while the mechanism is fresh.

Two facts found while confirming this, both in its favour:

- All 30 call sites for the interactive records live inside `LEVEL`'s own
  IIFE. Everything outside goes through exported functions
  (`LEVEL.setBarnStairGate`, `LEVEL.setNorthBarnRailing`).
- `animated` is on LEVEL's export list but nothing reads `LEVEL.animated`.

So the refactor is contained to one module.

### What this does not do

Nothing is migrated. `buildNorthBarn` is still 316 lines of authored
construction. This phase only makes it possible for the region half not to
break when that happens.

---

## 19. Phase 9: fixtures — interactive objects that own their collision

The second engine blocker, and the one section 15 got wrong.

### What section 15 said, and why it was wrong

> A registry entry is `build(ctx, d) -> Object3D`: geometry, and nothing
> else. [...] There is nowhere in the current contract to hang "this is a
> door, here is its collider, here is how to open it." Migrating any door,
> hatch or gate needs that contract extended first.

The observation was right and the conclusion was not. `animated.northBarnDoor`
really does hold a live reference to its own `WORLD` solid and really does
drive it as the leaves swing:

```js
door.collider.enabled = door.target < 0.5 && door.openness < 0.06;
gate.portal.enabled   = gate.openness > 0.55;
```

But a door does not need the *contract* to carry it out of the builder. It
needs to **register itself during `build()`**, the way a collider does, into
a kind the capture scope records. Then release and translate reach it for
free and `build(ctx, d) -> Object3D` stays exactly as it is. What was
missing was a kind, not a return type — which is the same answer phase 8
found for regions, with a different consumer.

Worth stating plainly because the wrong version was sitting in these notes
as a plan: it would have meant redesigning a contract that four migrated
clusters already depend on, to solve a problem the contract does not have.

### The shape

```js
WORLD.addFixture(name, data, axes)   // register, and capture
WORLD.fixture(name)                  // read
```

Identical machinery to regions — one `_addNamed` behind both — differing
only in who reads it: `LEVEL` animates and poses fixtures, `QUEST` opens and
closes them through `LEVEL`'s exported functions. Both now return the record
itself rather than the capture wrapper, so they read like every other
registration on `WORLD` (`const solid = WORLD.addFloor(...)`).

Four moved off LEVEL's private `animated` object: `northBarnDoor`,
`northBarnWestDoor`, `northBarnRailing`, `barnStairGate`. The axes are just
`x` and `z`, and it is worth being clear about why a door needs them at all
when its pivots are `THREE.Group`s that already travel with the object's own
group: the numeric `x`/`z` are what `nearNorthBarnDoor` and
`nearBarnStairGate` compare the player's position against. A door moved
without them would swing correctly in its new place and still only open from
where it used to be.

The railing takes no axes at all. It has no numeric position — just a group
and a collider, both already captured, both already travelling.

### What stayed behind, and why

The basement hatches. They are a *list* (`animated.basementHatches`) with two
named pointers into it (`basementHatch`, `northBarnHatch`), not a singleton,
and deciding what a list-valued fixture should look like belongs with the
basement migration that actually needs one — not with a refactor doing
something else. `animated` now holds only pure animation plus the hatches,
and says so.

### Two facts that made this cheap

- All 30 call sites are inside `LEVEL`'s own IIFE. Everything outside goes
  through exported functions (`LEVEL.setBarnStairGate`,
  `LEVEL.setNorthBarnRailing`, `COOP` → `LEVEL.setBarnStairGate`).
- `animated` is on LEVEL's export list, but nothing anywhere reads
  `LEVEL.animated`.

So this is a single-module change with no external surface.

### The regression to fear is not the one the mechanism is about

Capture and translate are the *point*, but they are also the part the phase-8
assertions already cover. The risk unique to this change is a door that
still animates and no longer blocks — or, worse and invisible in any
screenshot, one that blocks while standing open. So the new checks drive the
real doors through `LEVEL`'s public API and watch the collider:

```
a shut main door blocks
opening the main door clears its collider
shutting it puts the collider back
the west door does the same
the railing drops and comes back
the stair gate still owns a live portal
gate state still reaches worldState (multiplayer sync)
```

The gate check matters because its state is the one thing here that crosses
the network: `worldState()` syncs `barnStairGateOpen`, and `COOP` rejects
every id but `barn_stair_floor_gate`. Break that lookup and co-op desyncs
silently.

Fixtures are deliberately **not** in the collision digest — their records
hold `THREE.Group` references, and a fixture's position is already in its
collider's box, which the digest compares exactly. The suite asserts the four
by name instead of by count, so a future migration cannot silently drop or
swap one.

### Verified

Farm **byte-identical** to the regions commit: `8749ca8da68b7c30`, 7/7 on the
comparison, 1335 solids, 15 ladders, 1 portal, 58 spawn markers, 3169 meshes.
Four interactive records changed homes and nothing in the world moved.

Migration suite **65/65** (51 + 14 fixture checks). All three editor suites
green: `editor-test` 40/40, `editor-mode-test` 25/25, `editor-mouse-test`
22/22.

`editor-test` failed its first run with a bare `TimeoutError`, and the commit
went out saying so with the cause unresolved. It was contention, not code:
that run was first in a chain that overlapped the migration suite, so three
headless browsers were sharing one ~1 fps software rasteriser against a 90 s
boot wait. The other two suites started after the migration run finished and
both passed. Re-run alone — 0 Chrome processes on the machine at launch — it
returns 40/40.

Two process notes, since both cost real time:

- The chain used `... | tail -4` per suite, which truncated the exception and
  left "name: 'TimeoutError'" with no stack and nothing saying what it was
  waiting for. A failing run is exactly when the output matters most; do not
  tail a suite that might throw.
- Do not run suites concurrently on this machine to save wall clock. Two
  browsers is the practical ceiling and even that starves; at three, a pass
  and a timeout are indistinguishable.

### What is left

`buildNorthBarn` (316 lines) and `buildBasement` (881 lines). Neither is
gated on engine work any more — regions and fixtures were the two blockers,
and both are cleared. The basement still needs one decision this phase
deliberately did not make: its hatches are a list with two named pointers
into it, so a list-valued fixture has to be designed rather than assumed.
