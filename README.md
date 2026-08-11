# The Withered Farm

Browser-based rubber-hose horror FPS prototype by Lobster Labz, built as a
single-page Three.js game with solo, co-op, free-for-all, and team deathmatch
modes.

- **Current alpha:** `v0.30`
- **Working branch:** `A-test-v0.30-NORTH-BARN-TRAVERSAL-HATCH`
- **Baseline:** `A-test-v0.29-EAST-NORTH-BARN-EXPANSION`

## What changed in v0.30

- Rebuilt the North Barn stairwell: the twelve steps now run east/west and exit
  into the broad center of the upper deck.
- Added a two-leaf **floor gate** over the stairs. Press `E` (or tap **Use**) to
  open or close it. Closed leaves restore a real walkable upper floor; open
  leaves expose the stair route and stand upright as visible guards.
- Made the floor gate host-authoritative in online modes. Its state is relayed
  to the room and included for late joiners.
- Cleared the two full-depth stable dividers and moved remaining cover out of
  the central lanes, improving movement for players and enemies.
- Added two stable roof routes: a step-height-safe exterior stair for every
  actor and a faster hay-bale jump route for players.
- Added a North Barn hatch and a new `28 × 20 m` underground cellar. The room
  connects directly to the existing northeast room, with cover, lighting,
  enemy markers, pickups, and matching surface/underground map entries.
- Updated browser/menu version labels, controls, the farm map, and this README
  for `v0.30`.

## Run the game

The deployed build can run from GitHub Pages. For local testing, serve the
repository over HTTP so browsers can load GLB and audio files correctly:

```bash
git clone https://github.com/Meta7r0n/WF-html-tester.git
cd WF-html-tester
git switch A-test-v0.30-NORTH-BARN-TRAVERSAL-HATCH
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

Opening `index.html` directly through a `file://` URL is not recommended.

## Game modes

| Mode | Players | Current behavior |
| --- | ---: | --- |
| Single-player | 1 | Full farm, enemy roster, bosses, drops, hero specials, and progression |
| Online co-op | Up to 4 | Host-authoritative enemy simulation with shared farm combat |
| Free-for-all | Up to 4 | Player-only PvP with ring spawns, scoring, kill feed, and respawns |
| Team Deathmatch | 2 vs 2 | Team-scored PvP with friendly-fire handling |

Multiplayer uses PeerJS for room discovery/signaling and WebRTC data channels
between players. The host owns the authoritative enemy state and relays it to
joining clients. GitHub Pages remains a static client host.

## Current run

- Explore the surface farm, original barn, corn maze, stable, two-floor North
  Barn, silo region, vertical routes, and underground network.
- Fight four regular enemy roles with different sight, range, damage, and
  behavior rules.
- Collect weapons, ammo, throwables, buffs, Jays healing items, and boss drops.
- Choose Normal or Ultra difficulty from the main menu.
- Continue exploring after the first completion goal to reach later encounters.
- Use the farm map, proximity radar, options, rebindable controls, text chat,
  and optional push-to-talk voice chat.

### Mini-boss progression

| Wilted count | Encounter | Behavior / reward |
| ---: | --- | --- |
| 33 | Carrot Warden | Main completion encounter; ranged seed pressure and the Carrot Cannon drop |
| 66 | Bear Claw | Long-reach claw fight with smoke-and-retreat behavior |
| 99 | Bear Claw rematch | Longbone model, stronger rematch stats, and The Claw drop |
| 132 | Beat Slayer | Ranged/kiting boombox encounter and Golden Boombox drop |

Boss visuals have procedural fallbacks. If a GLB or the GLTF loader cannot be
loaded, the encounter remains playable.

### Playable farmhands

| Farmhand | Emergency special |
| --- | --- |
| Larry | Downed-only Double Barrel recovery |
| Smoke | Low-health Chainsaw Hand |
| Stoned | Secret Stash automatic recovery |
| Pyro | Dy-No-Mite death-save blast |
| Jeff | Low-health Knife Storm |

The multiplayer picker currently exposes Larry, Smoke, Stoned, and Pyro.

## Controls

All keyboard bindings can be changed under **Options → Controls**.

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump |
| `Shift` | Sprint |
| `Ctrl` | Crouch; crouch while sprinting to slide |
| Left click | Fire / use equipped melee weapon |
| Right click | Aim down sights |
| `V` | Quick melee |
| `R` | Reload |
| `1–8` | Select weapon slot |
| `G` | Throw selected throwable |
| `J` | Use Jays |
| `E` | Interact with the North Barn floor gate |
| `F` | Toggle lantern |
| `B` | Hold to talk when voice chat is enabled |
| `Enter` | Open/send multiplayer text chat |
| `Esc` | Release pointer lock / pause |
| Backtick | Open the single-player developer console |

Touch devices receive a movement stick, drag-to-look zone, combat/action
buttons, a **Use** interaction button, throwable switching, chat, pause,
crouch, aim, and push-to-talk controls. Gameplay canvas gestures are captured
so they do not scroll the page.

## Developer console

The console is available only during an active single-player run. Press
backtick, type a command, and press `Enter`.

```text
help
list
spawn <id>
enemy [reaper|howler|gaper|grinner] [count]
boss <warden|bearclaw|bearclaw2|beatslayer>
killenemies
resetenemies
clear
close
```

`spawn <id>` accepts registered weapon, ammo, pickup, throwable, consumable,
and buff identifiers. Use `list` for the current registry.

## Project layout

```text
index.html   Complete game client, UI, gameplay systems, and networking
assets/      GLB characters, hero reference art, and menu/gameplay music
README.md    Current build and testing documentation
```

The code is intentionally kept in one HTML entry point for rapid alpha
iteration and GitHub Pages deployment. Major systems are marked with searchable
module headers such as `[CONFIG]`, `[LEVEL]`, `[PLAYER]`, `[ENEMY]`, `[COOP]`,
and `[GAME]`.

### Runtime dependencies

The page currently loads these browser libraries from CDNs:

- Three.js r128
- Three.js `GLTFLoader` r128
- PeerJS 1.5.4

An internet connection is therefore required even when serving the repository
locally unless those dependencies are vendored in a future build.

## Boss asset startup pipeline

1. Start every GLB request as soon as the WebGL renderer exists.
2. Build the farm while model downloads and parsing continue.
3. Warm shared geometry, materials, shaders, and textures through an off-screen
   WebGL render.
4. Create boss rigs, animation mixers, hit proxies, and shadows once.
5. Keep staged bosses invisible and non-raycastable until progression or a
   developer-console command activates them.

Assets covered by this pipeline:

- `assets/carrot_rogue_character.glb`
- `assets/skeleton_lobster.glb`
- `assets/longbone_bear_claw.glb`
- `assets/boombox_cat.glb`

## Alpha notes

- Use HTTPS (GitHub Pages) or localhost for microphone permission and the most
  reliable multiplayer/browser behavior.
- Room availability depends on PeerJS signaling and successful WebRTC
  connectivity between players.
- The host remains the authority for PvE state; this is not yet a dedicated
  authoritative game-server architecture.
- This is an active test branch, not a production release.
