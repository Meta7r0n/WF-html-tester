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
