# Viewmodel motion tooling

Two harnesses for judging first-person weapon animation. Both exist because
a single still cannot show whether a motion works, and because eyeballing a
motion is how "the sprint pose is far too extreme" survived a whole wave.

Neither renders the world: they freeze the game's rAF loop, step
`PLAYER`/`WEAPON`/`FX` by hand at a fixed dt, and redraw only the viewmodel
scene. Frames are therefore exactly spaced in simulated time no matter how
loaded the machine is — under swiftshader a real-time capture runs at well
under 1fps and says nothing at all about timing.

## `vmcap.js` — contact sheets

    tools/viewmodel/serve-and-run.sh node tools/viewmodel/vmcap.js <tag> [groups]

Groups: `fire auto reload switch ads idle move look` (default `all`).
Writes one JPEG contact sheet per motion. `VMCROP` and `VMSCALE` set the
crop; `{"x":0,"y":0,"w":1280,"h":720}` at 0.36 shows the whole frame, which
is what you want for anything about composition.

Every frame is labelled with the sim state it was caught in —
`g`rounded / `S`printing / `A`iming and the speed ratio. Sheets used to be
unable to distinguish a sprint pose from a player who was still falling and
therefore never sprinting at all.

## `muzzle-probe.js` — numbers

    tools/viewmodel/serve-and-run.sh node tools/viewmodel/muzzle-probe.js

Tracks where the muzzle actually lands on screen, in pixels of a 720p frame,
through each motion, and reports peak-to-peak travel. Peak-to-peak muzzle
travel is the honest single number for how much a piece of viewmodel motion
is worth looking at, and it turns "too small" and "too extreme" into
measurements. It is what caught a 12-gauge blast moving the muzzle less far
than the idle breathing did.

**It flips the weapon to automatic for the take.** Semi-autos read a press,
not a held action, and there is no pointer lock in a headless page to
generate one — without that flip the probe measures a gun that never fires
and reports the idle drift as the recoil. Fire path, timings and recoil are
otherwise identical either way.

## `serve-and-run.sh`

Serves the worktree on 9102 for the duration of one command and retries the
run a few times. The sandbox reaps background processes between tool calls,
so the preview server has to live inside the same invocation as whatever
uses it. Expects a `preview.html` next to `index.html` with the CDN script
tags pointed at a local `vendor/`.
