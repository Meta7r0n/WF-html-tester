# tools/

Verification harnesses. None of these are shipped — `index.html` is the whole
game and has no build step.

## Running anything here

Every harness drives a headless Chromium against a **served** copy of the game
with the CDN `<script src>` tags rewritten to local files. `index.html` itself
loads Three.js, GLTFLoader and PeerJS from CDNs, which the sandbox cannot
reach, so pointing a harness at the raw file gets you a blank page.

```sh
node tools/make-preview.js <outdir>    # writes <outdir>/preview.html + vendor/
cd <outdir> && python3 -m http.server 8934
```

Then, from the repo root:

```sh
node tools/gamepad-test.js             # 31 checks
node tools/gamepad-stability-test.js   # 15 checks
```

Both default to `http://localhost:8934/preview.html`; pass a URL to override.
Both exit non-zero on any failure or any `pageerror`, so they work as a gate.

Run them **from the repo root**, not from inside `tools/` — they resolve the
shared harness as `./render-audit/harness`.

## What's here

| file | what it covers |
|---|---|
| `gamepad-test.js` | Gamepad behaviour: stick mapping, dead zone, look curve, buttons, analog triggers, rebinding, capture, rumble, hot-unplug. |
| `gamepad-stability-test.js` | Gamepad settings resilience: what a corrupt, hand-edited or stale `localStorage` blob does to the pad. |
| `editor-test.js` | Editor and engine layer: registry, capture scope, place/move/delete/undo, save/load, playtest, collider leak checks. Takes a full URL. |
| `editor-mouse-test.js` | The editor as a *person* drives it: real clicks, drags, wheel, hit-testing. Exists because the editor once passed every programmatic check while being completely unclickable. Takes a full URL. |
| `editor-mode-test.js` | The editor as a *mode*: can it be found from the menu, and can you get back out? Covers menu/pause entry, grid snap, framing, Exit, and a playtest that has to start a run first. Exists because for two commits the editor was reachable only by an undocumented F2. |
| `campaign-migration-test.js` | Campaign content migration and ownership: proves a cluster moved into map data without changing what the farm is, and that the map layer now *owns* it — moving a farm tree moves the farm's collider, "New map" spares the farm, revert restores it. See below. |
| `render-audit/` | Exposure/tonal capture harness and the quality gate. Has its own README covering three silent measurement failures worth reading before trusting any number it prints. |
| `viewmodel/` | Weapon viewmodel capture. |
| `make-preview.js` | Builds the served, CDN-free copy the harnesses need. |
| `import-aviation-heads.mjs` | One-off asset import. |

## Why the gamepad has two suites

`gamepad-test.js` asks "does a controller work". It installs a virtual pad over
`navigator.getGamepads` **before** the page script runs, so it exercises the
real polling path in `INPUT` rather than calling internals.

`gamepad-stability-test.js` asks a different question: "what happens when the
saved settings are not what the code that wrote them would have produced".
`localStorage` is user-writable, shared across every version this origin has
ever run, and survives changes to the code that wrote it — so it is untrusted
input. The pad settings are the ones where a bad value fails *silently*: a NaN
dead zone makes `!(mag > dead)` true for every reading, which kills both sticks
with nothing logged and no way for a player to work out why. That suite seeds
each hostile value directly into storage and checks the game still comes up
sane.

Adjacent and **not** covered: the same unchecked-load path applies to the audio,
brightness and graphics settings. A corrupt `master` still reaches
`AUDIO.setMasterVolume` unvalidated. Only the pad fields are clamped in
`SETTINGS.load()` today.

## Known trap

Under software rasterisation (`--use-angle=swiftshader`) the renderer runs at
roughly 1 fps. Wall-clock waits mean nothing; count rendered frames instead.
The shared harness exposes `window.__waitFrames(n)` for exactly this.

## Verifying a campaign migration

`campaign-migration-test.js` has two jobs. Run without a compare argument it
asserts the migration's own properties — the fragment is real map data, it
passes `MAPIO.validate`, every type it names is in the registry, and it
survives a JSON round trip — plus the ownership properties: its objects are
live map-layer instances under `LEVEL.root`, moving one moves the farm's own
collider, a snapshot carries the edit while the authored rows stay clean, and
neither "New map" nor a save of the player's map disturbs the farm.

The other job is proving the farm did not move. Build a preview of the
previous commit and one of the working tree, serve them on **different ports**
(the game runs at about 1 fps under swiftshader — two headless browsers on one
server just starve each other), then:

```sh
node tools/campaign-migration-test.js 8971 --digest base.json
node tools/campaign-migration-test.js 8972 --digest new.json
node tools/campaign-migration-test.js --compare base.json new.json
```

**Run the control first.** Digest the same build twice and compare it against
itself; if that does not pass, nothing the tool says about your change means
anything. Two earlier versions of this file failed exactly there:

- Hashing one frame of `GAME.scene` reported a confident difference that
  survived a same-build control. `PROPS.registerBoil` and `registerWobble`
  perturb position and rotation every frame, so it was hashing the clock.
- Trying to identify the animated meshes by sampling twice and keeping what
  held still failed its control too — a slowly-boiling mesh can land on the
  same 5-decimal value eight frames apart.

What survives the control is splitting the question. *Where* everything is
comes from `WORLD`'s arrays, written once at build time and never animated, so
they compare exactly — and they are sensitive to a shifted RNG stream, because
`PROPS.tree` feeds its random trunk height straight into `WORLD.addFloor`.
*What* was built comes from a key no rigid animation can touch (vertex count +
local bounding-box size + scale), compared as a multiset over `LEVEL.root`.

**And run a negative control after.** Move one tree half a metre in a throwaway
build; the comparison must fail and name the collider. A migration test that
cannot fail is not evidence.

### The digest has been blind three times. Check your field names.

Every line in the collision digest is built by naming fields on a record. Three
of the four kinds named fields the record does not have, and each one passed a
migration it should have caught:

| line | what it read | what the record actually has |
|---|---|---|
| `ladder` | `l.x`, `l.z`, `l.id` | `minX/maxX`, `snapX/snapZ`, `topExit*`, `bottomExit*`, `tag` |
| `spawn` | `m.x`, `m.y`, `m.z`, `m.tag`, `m.id` | `position` (a `Vector3`), `kind`, `layerId` |
| `portal` | `p.id` only | a full box, `from`/`to`, `normalX/Z`, `enabled` |

The spawn line is the instructive one: all five names were wrong, so every
marker in the farm digested to the identical string
`spawn|undefined,undefined,undefined|`, and 58 markers compared equal to each
other. A whole kind can be silently absent from the comparison while the
summary line still prints a confident hash and a plausible count.

If you add a kind, or touch one of these lines, read the constructor in
`WORLD` — not your memory of it — and then prove the line can fail with a
negative control aimed at that kind specifically.

### Regions

`WORLD.regions` is the fifth captured kind: named records describing a place
(`cornMaze`, `northBarnStair`) that `ENEMY` steers by. They are serialised
whole into the digest, because the interesting part of a region is usually not
a coordinate — a shifted RNG stream regenerates the maze's grid of openings
while every bounding number stays put.

A region declares `axes` naming which of its own fields are world coordinates,
so `SANDBOX.translate` can move it. Anything unnamed must not move: cell
indices and the opening grid are not positions. The suite drives capture,
release and translate directly (including a dotted path that resolves to
nothing, and a name replaced by a second builder), because no shipped builder
exercises them yet — the two regions belong to clusters that have not
migrated, which is the same "written with nothing using it" state the ladder
branch was in when its digest turned out to be blind.

### A trap, and the rename that closed it

`SANDBOX.instances` is the **player's** objects, and `count` is its length —
`count === instances.length`, always. `SANDBOX.all` additionally includes the
farm's own objects, the campaign clusters `LEVEL` builds through the map
layer. Only picking and `CAMPAIGN`'s snapshot/release want `all`.

It was briefly the other way round, and that is why the names are what they
are. When `instances` meant everything, seven call sites across two suites
read `instances[0]` to mean "the thing I just placed" and silently got a tree
at (-27, 26). One of them deleted a farm tree instead of its own object and
still reported a pass. The dangerous reading should not be the one you get by
default.

### Fixtures

`WORLD.fixtures` is the sixth captured kind and shares regions' machinery: a
named record that owns collision and has state a player can change. The four
today are the North Barn's two door sets, its stair railing, and the barn
stair gate. A door holds a live reference to its own `WORLD` solid and drives
`collider.enabled` as its leaves swing, which is why it cannot just be
geometry.

They are deliberately **not** in the collision digest — the records hold
`THREE.Group` references, and a fixture's position is already in its
collider's box, which the digest compares exactly. The suite asserts the four
**by name**, so a migration cannot silently drop or swap one; a count would
not catch a swap.

The checks to keep an eye on are the behavioural ones. The failure this
refactor could produce is not a missing fixture, it is a door that still
animates and no longer blocks — or one that blocks while standing open, which
looks perfectly fine in a screenshot. So the suite drives the real doors
through `LEVEL`'s public API and watches `collider.enabled` on each side of
the swing, and checks that the stair gate's state still reaches
`worldState()`, since that is the one piece of fixture state that crosses the
network to a co-op peer.

## A self-inflicted trap worth naming

`pkill -f "http.server"` — or any `pkill -f` whose pattern matches the shell
command you are typing it in — **kills your own shell**, which surfaces as
exit code 144 and looks like the test crashed. It has happened four times in
this project. Serve each build on its own port and let the servers be; do not
try to tidy them up mid-run.
