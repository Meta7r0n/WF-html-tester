# The Withered Farm

Browser-based rubber-hose horror FPS prototype by Lobster Labz, built as a
single-page Three.js game with solo, co-op, free-for-all, and team deathmatch
modes.

- **Current alpha:** `v0.33`
- **Working branch:** `A-test-v0.33-BOSS-QUANTITY-BARN-DOOR`
- **Baseline:** `A-test-v0.32-BARN-CRAFTING-PORTAL-GUN`

## What changed in v0.33

- Keeps v0.32's single-player order—Beat Slayer, Bear Claw, Carrot Warden,
  then The Gardener—but restores cumulative Wilted triggers at 33, 66, 99,
  and 132 regular enemies. A boss defeat only unlocks the next threshold; it
  no longer spawns the next encounter immediately.
- Adds a visible hinged double door to the North Barn's real south entrance.
  It has a world collider, stays shut after collecting the Barn Key, and only
  unlocks/opens when the key is used with `E` (or **Use** on touch devices).
- Keeps Bearclaw2 tied to the Portal Gun crafting sequence rather than another
  enemy quantity.
- Removes old run-scoped quest drops on restart, prevents Gardener summons
  from joining the normal respawn pool, and clears developer-spawn markers on
  reset so natural progression remains testable.
- Adds the `wilted <count>` developer command for boundary testing without
  grinding four full enemy waves.

## Run the game

The deployed build can run from GitHub Pages. For local testing, serve the
repository over HTTP so browsers can load GLB and audio files correctly:

```bash
git clone https://github.com/Meta7r0n/WF-html-tester.git
cd WF-html-tester
git switch A-test-v0.33-BOSS-QUANTITY-BARN-DOOR
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

### Single-player mini-boss progression

| Wilted count | Encounter | Behavior / reward |
| ---: | --- | --- |
| 33 | Beat Slayer | Ranged/kiting boombox encounter, Golden Boombox, and Green Shard |
| 66 | Bear Claw | Long-reach claw fight, Pack of Smokes, and Metal Weapon Fragment |
| 99 | Carrot Warden | Ranged seed pressure, Carrot Cannon, and Computer Chip |
| 132 | The Gardener | Drops the Barn Key; use it at the North Barn door with `E` |
| Portal Gun crafted | Bearclaw2 | Longbone rematch and the final single-player completion encounter |

Co-op retains the established multiplayer thresholds: Carrot Warden at 33,
Bear Claw at 66, its rematch at 99, and Beat Slayer at 132.

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
| `1–9` | Select weapon slot |
| `G` | Throw selected throwable |
| `J` | Use Jays |
| `E` | Interact; use the Barn Key, operate barn doors/gates, or use the workbench |
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
boss <warden|bearclaw|bearclaw2|beatslayer|gardener>
killenemies
wilted <count>
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
