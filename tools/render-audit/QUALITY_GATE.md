# Quality Gate — derived from the reference, not from guesswork

`node tonal.js <dir>` measures any set of images — our captures *and* the
reference stills (it decodes jpg/webp/png).

## The reference, measured

Five Mouse P.I. For Hire stills live in `scratchpad/reference/`. This is what
they actually are:

| frame | p01 | p50 | p99 | rms | shadow% | high% | edge |
|---|---|---|---|---|---|---|---|
| saloon interior | 23 | 74 | 255 | 51.5 | 38.3 | 7.0 | 89.4 |
| camp firefight | 15 | **86** | 230 | 68.0 | 36.2 | 19.0 | 44.3 |
| circus boss | 8 | 51 | 236 | 64.1 | 60.3 | 12.3 | 57.1 |
| laboratory | 0 | 42 | 249 | 62.5 | 62.1 | 7.3 | 107.9 |
| skeleton alley | 0 | 49 | 240 | 65.0 | 61.1 | 8.5 | 118.1 |
| **mean** | **9.2** | **60.4** | **242** | **62.2** | **51.6** | **10.8** | **83.4** |

The shape of that is the whole art direction in one table: **a dark image with
small brilliant accents.** Median 60. Over half of every frame below value 64.
True black actually present — p01 of 9. And still a p99 of 242, because the
characters and the light sources are near-white. High% is only 10.8: the bright
things are *small*.

## What the old gate got wrong

The previous version of this file demanded p50 in 70–160 and failed any frame
with shadow% over 55. Both numbers were invented before anyone measured the
reference, and **that gate would have failed three of the five reference frames
for being too dark.** It also never measured p01 at all, while true black is the
single most distinctive property of the target look.

Anything in git history that cites the 70–160 band was scored against a target
that does not match the reference. Re-measure before trusting it.

## The gate

Our farm is a daylight exterior; the reference set skews to night interiors, so
we do not chase the 60 mean literally. The open-air reference frame — the camp
firefight at p50 86 — is the closest comparable, and the band is centred there
with headroom.

| metric | target | why |
|---|---|---|
| **p50** | **75–130** per frame | centred on the one open-air reference frame (86), with room for a sunny farm to sit above it |
| **p01** | **≤ 20** | true black must be present in the scene, not just in HUD text. Reference mean is 9. This was missing from the old gate entirely. |
| **p99** | **≥ 235** | keep a real white point everywhere. Reference mean 242. |
| **shadow%** (<64) | **25–50** | reference runs 36–62. "Lots of shadow" is the target, not a failure. |
| **high%** (>192) | **≤ 25** | bright things should be small and deliberate. Reference mean 10.8. |
| **rms** | **≥ 55** | contrast. Reference mean 62.2. |
| **edge** | **≥ 60** | linework density. Reference spans 44–118 — the high end is brick and machinery detail, which is a materials/geometry question, not a grade one. |
| **sat** | **12–28** | **we stay in COLOUR.** The reference measures sat ≈ 0 because it is black and white. Do not chase this one. It is the single axis where matching the reference would be wrong. |
| **spread** | max(p50)/min(p50) < 2.0 | judged across the daylight set |

Judge **per frame**, never on the set mean. A mean over a bimodal set reads as
comfortable while half the frames are broken — that has already happened here
once, with a mean of 96 covering frames at 24 and 142.

## Before any of the above means anything

Run `node vantage.js`. If it reports a point that does not land where asked, or
not grounded, or aimed wrong, fix that first — three separate silent failures in
this measurement chain have already produced confident wrong conclusions. See
`tools/render-audit/README.md` for what they were.

For light experiments specifically, run `node sanity.js` too: it proves the
control surface responds before you believe any light result.

## Subjective gate

Judged by eye against the reference stills. All must hold:

1. **True blacks are present** in-scene, and large areas of the frame sit in them.
2. **Bright accents are small** — characters, muzzle flashes, light sources.
3. **Every object is grounded** — visible contact shadow, nothing floats.
4. **Forms are modelled** — clear key direction, lit and shadowed planes.
5. **Linework is confident and consistent** — no dropped or blobby outlines.
6. **Film-stock texture is present** — grain that lives in the render.
7. **Depth reads front-to-back** — fog separates planes instead of erasing them.
8. **HUD stays out of the way** — the frame belongs to the game.
9. **Motion reads as rubberhose** — squash/stretch, follow-through, arcs.

## Regression gate (non-negotiable)

- Zero `pageerror` from the capture harness.
- Game boots, plays, and the quest/coop/AI systems still function.
- Holds 60fps at 1280x720 on real hardware. (Headless runs ~1fps under
  swiftshader; that is the software rasteriser, not a regression.)
