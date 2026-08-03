# WF-html-tester

## v0.07.00 Co-op Foundation

The current build opens on a mode menu with:

- **Single-player** — the complete v0.06.08-BM farm run.
- **Online co-op** — a two-player direct WebRTC lobby. One player hosts, the
  other joins, and they exchange the generated connection codes through the
  lobby. Once connected, both clients see the other farmhand and gunfire is
  relayed through the host before being resolved locally.

This first multiplayer step intentionally keeps the GitHub Pages deployment
static. It does not require a game server yet; a later milestone can replace
the manual offer/answer exchange with a room-code signaling service and move
the shared enemy simulation to an authoritative match server.

### First co-op test

1. Open the build in two browser tabs or devices.
2. On the first, choose **Online co-op → Host room →**, then copy its host code.
3. On the second, choose **Online co-op → Join room →**, paste the host code, and create an answer.
4. Copy the answer back to the host, paste it into the host's input, and choose **Finish connection**.

Both screens should enter the farm, show the other farmhand on the radar, and
relay gunfire through the host. Enemy movement, pickups, revival, and shared
completion remain single-client systems until the authoritative match layer is
added.

## v0.07.01 Carrot Rogue Boss Visual

The Carrot Warden now loads the supplied `assets/carrot_rogue_character.glb`
with its embedded materials and `IdleBob` / `RunCycle` animations. Boss
collision, headshots, melee, seed blasts, radar, and the endgame trigger remain
separate from the visual asset. If the optional loader or asset is unavailable,
the procedural boss visual remains as a fallback.
