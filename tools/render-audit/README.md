# Render audit harness

Headless-Chromium tooling for measuring how the game actually looks: boot it,
stand somewhere specific, point the camera somewhere specific, and read the
frame back as numbers.

It exists because judging a render by eye across an 8-frame set does not scale,
and because three separate silent failures in this measurement chain produced
weeks of confident, wrong conclusions. All three are described below, because
each one looked exactly like a real rendering problem right up until it didn't.

## Running

The game loads Three.js, GLTFLoader and PeerJS from CDNs. Vendor them locally
into a `preview.html` first (the CDN copies are also fine if the machine has
network access, but the capture runs are long and a flaky fetch wastes one):

```sh
cp index.html preview.html
sed -i -e 's#https://cdnjs.cloudflare.com/.*/three.min.js#vendor/three.min.js#' \
       -e 's#https://cdn.jsdelivr.net/.*/GLTFLoader.js#vendor/GLTFLoader.js#' \
       -e 's#https://cdn.jsdelivr.net/.*/peerjs.min.js#vendor/peerjs.min.js#' preview.html
python3 -m http.server 8934
```

Then:

| command | what it does |
|---|---|
| `node vantage.js` | **run this first.** Teleports to all eight vantage points and reports whether each is actually reachable and correctly aimed. Nothing measured downstream means anything until this is clean. |
| `node capture.js <outDir>` | screenshots all eight points into `shots/<outDir>/` |
| `node tonal.js shots/<dir>` | measures a capture set — p01/p50/p99, shadow%, edge, saturation |
| `node sanity.js` | proves the light control surface is connected, by asking for an answer that is not in doubt |
| `node try.js` | probes named candidate light rigs across all eight points in one boot |

Under `swiftshader` the game renders at roughly 1fps, so a full run takes
minutes. That is the software rasteriser, not a performance regression.

## The three silent failures

Every one of these produced plausible-looking numbers while measuring something
other than what it claimed to.

**1. The camera never pointed where it was told.** `PLAYER` exposed `yaw` and
`pitch` as getters with no setters, so `PLAYER.yaw = 0.28` was discarded without
error in sloppy mode. Every "vantage point" in every harness pointed wherever
the player happened to be facing. Fixed in the game by adding `PLAYER.setLook()`
(the dev console's `tp` could not aim either, which made it half-useless for
playtesting); `harness.js` uses it.

**2. The player was photographed mid-fall.** Each point's `y` was a hand-guessed
constant rather than resolved against the floor. Sampling ten consecutive frames
at the north barn showed the median going 97, 102, 91, 22, 23, 23 as the player
dropped from y=2.96 to 0. A single sample landed anywhere on that curve, which
is why the same parameters "measured differently" run to run and why a parameter
search optimised against noise. `goTo()` now resolves `y` from `WORLD.groundAt`,
waits for the position to hold, and warns when a point cannot be reached.

**3. Light parameters never reached the renderer.** Test code guarded on
`if (window.RENDERCORE && ...)`. The game declares `const RENDERCORE = ...` at
top level, and **a top-level `const` does not become a property of `window`** —
it lives in the global lexical environment, reachable by bare name only. So the
guard was always false, `syncLights()` never ran, and every light value written
landed in `CONFIG` and stopped there. Symptom: cutting every light by 36% moved
the measured median by one point. Grade parameters were unaffected, because
`RENDERCORE` re-reads `CONFIG.render.grade` every frame — so grade experiments
appeared to work while every light axis looked inert, which is a much more
confusing failure than everything breaking at once.

`__applyParams` now throws rather than guarding, and `sanity.js` exists to prove
the control surface before any light experiment is believed.

## The lesson worth keeping

All three were *silent*. Nothing threw, nothing logged, and every run produced
numbers that looked like data. The defence is not more careful code — it is
asking the instrument a question whose answer you already know, and refusing to
believe it until it gets that one right. `vantage.js` and `sanity.js` are that
question for position/aim and for lighting respectively. Run them first.

A corollary that keeps mattering: a mean over a frame set hides a bimodal
distribution. Judge per frame, and treat spread as its own metric.

## Notes about the scene that affect measurement

- The sky is `MAT.flat` — an unlit `MeshBasicMaterial` — so it does not respond
  to lighting at all. With all lights at 5%, the yard frame still reads a median
  of 76 while silo-west collapses to 7, purely because the yard frame is mostly
  sky. In any frame, only the lit geometry responds to the light rig.
- `MeshToonMaterial` samples its gradient at `dotNL * 0.5 + 0.5`, **not**
  `saturate(dotNL)`. With the four-step ramp used here, a surface merely
  perpendicular to the key still collects 0.796 of it, and one turned fully away
  still collects 0.227. Those wrap terms are why shaded surfaces do not simply
  go black, and why per-orientation light budgets are not just `cos(theta)`.
