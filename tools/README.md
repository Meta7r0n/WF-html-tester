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
