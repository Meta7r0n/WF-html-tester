# The Withered Farm

Browser-based rubber-hose horror FPS prototype by Lobster Labz, built as a
single-page Three.js game with solo, co-op, free-for-all, and team deathmatch
modes.

- **Current alpha:** `v0.36`
- **Working branch:** `A-test-v0.36-PAUSE-BARN-STATS`
- **Baseline:** `A-test-v0.35-HANGAR-PILOT-EJECTION-LIVES`

## What changed in v0.36

- Makes **Options** a real child modal above the pause card. Opening it from
  Pause now covers and blocks the pause controls, owns keyboard focus, closes
  with `Esc`, and returns focus to the button that opened it.
- Reframes Hangar pilot portraits from the selected rig's measured bounds so
  tall hats and short body presets cannot be clipped. The builder now includes
  switchable **Full Pilot** and **Head Detail** views and renders the large
  preview at a higher resolution.
- Replaces the North Barn's decorative, parked-open west panels with a second
  animated double door and authoritative world blocker.
- Makes the North Barn cellar hatch a keyed, interactive route. Its ladder is
  disabled while the lid is shut for both players and enemies, while the cellar
  itself remains reachable through the underground room and tunnel network.
- The Barn Key can be used at the south doors, west doors, or cellar hatch.
  The first use unlocks the barn; each entrance then keeps its own open/closed
  state and toggles with `E` or **Use**.
- Replaces the plain completion dump with a dark end-of-match field report
  inspired by survival-mode scorecards. It shows total enemies wilted,
  headshot finishes, downs, boss defeats, damage, ammo fired, active/elapsed
  time, and an expandable boss/loadout breakdown.

## What changed in v0.35

- Renames the character tool to **Hangar Custom Pilot Builder** and fixes its
  blank preview. The reusable portrait renderer now retains its drawing buffer,
  resizes for the larger builder frame, and photographs the authored face side.
- Standardizes the classic playable cast on one blue aviation cap. Larry,
  Smoke, Stoned, and Jeff wear it; Pyro is the sole classic goggles character.
- Gives every saved Hangar pilot **Ejection Seat** instead of the selected
  body's classic emergency special. A lethal hit restores 50% Pep, launches the
  pilot upward, and returns control through the normal gravity/landing solver.
- Tracks Hangar downs across the run. Downs one and two eject; down three is
  terminal and opens Game Over. A restart resets the counter.
- Adds personal **Extra Life** pickups after natural mini-boss defeats. Each is
  a miniature of the player's selected pilot on an ejection seat. Defeats queue
  one reward each, only one mini pilot is visible at a time, and every collected
  reward raises the terminal down threshold by one for that run.
- Keeps old v0.34 saved selections through a one-time local-storage migration.

## What changed in v0.34

- Adds a procedural Three.js head pack for all 123 community-approved
  `aviation_hat` characters in the badbad (formerly Cryptoon Goonz)
  collection. The source manifest keeps the token ID, item link, reference
  image link, and complete available trait metadata for each approved entry.
- Builds each selected head on demand from its body, eyes, mouth, and accessory
  traits. A seven-stitch brim code guarantees a distinct generated head for
  every approved token, including traits that share a broader procedural style.
- Adds an Aviation Farmhand builder to single-player character selection and
  the multiplayer lobby, with token/trait search, pagination, random selection,
  and Larry, Smoke, Stoned, Pyro, or Jeff body presets.
- Keeps the aviation head cosmetic: the existing hero rig, animation,
  equipment, hitboxes, gameplay stats, and selected emergency special remain
  unchanged.
- Saves the local choice in the browser and synchronizes the approved token ID
  in PeerJS roster, join, state, chat, kill-feed, scoreboard, and intro data.
  The game never fetches marketplace art while running.
- Preserves v0.33's cumulative mini-boss quantities and keyed North Barn door.

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
git switch A-test-v0.36-PAUSE-BARN-STATS
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
| 132 | The Gardener | Drops the Barn Key; use it at a North Barn door or cellar hatch with `E` |
| Portal Gun crafted | Bearclaw2 | Longbone rematch and the final single-player completion encounter |

Co-op retains the established multiplayer thresholds: Carrot Warden at 33,
Bear Claw at 66, its rematch at 99, and Beat Slayer at 132.

When the local character is a saved Hangar pilot, each natural mini-boss defeat
also queues one personal mini-pilot Extra Life at a randomized safe surface
location. Developer-spawned bosses do not award lives.

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

The multiplayer picker exposes Larry, Smoke, Stoned, and Pyro. The Hangar
builder exposes those same four synchronized bodies in its lobby context and
also exposes Jeff when opened from single-player selection. A saved Hangar
pilot uses the body's rig, palette, stats, and equipment, but replaces its
classic emergency special with Ejection Seat.

### Hangar pilot head pack

The source roster is the community-approved
[OpenSea `aviation_hat` filter](https://opensea.io/collection/badbad?traits=%5B%7B%22traitType%22%3A%22head%22%2C%22values%22%3A%5B%22aviation_hat%22%5D%7D%5D).
The approved roster is stored in `assets/aviation-heads/manifest.json` for
tools and `manifest.js` for the static browser build. `aviation-head-pack.js`
is an adapter-based geometry module: it receives Three.js and the game's
primitive helpers from `CAST`, then returns only the selected head subtree.

The 123 entries are 123 unique source trait tuples, not 123 unrelated sculpting
systems. Across the approved set there are 11 body treatments, 42 eye traits,
51 mouth traits, and 33 accessories. Closely related editorial traits can share
a procedural geometry family, while the complete trait tuple and unique
seven-stitch brim code keep every token identity distinct.

To refresh the manifest from saved OpenSea collection pages:

```bash
node tools/import-aviation-heads.mjs --html-dir=/path/to/saved/pages
```

The importer asserts that the result contains exactly 123 unique approved
characters and rejects anything outside the `head=aviation_hat` filter.

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
| `E` | Interact; use the Barn Key, operate both North Barn doors, the cellar hatch, gates, or the workbench |
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
index.html                       Complete game client, UI, gameplay, and networking
assets/aviation-heads/           Approved manifest and procedural Three.js head pack
assets/                          GLB characters, hero reference art, and music
tools/import-aviation-heads.mjs  Reproducible OpenSea manifest importer
tests/                           Progression and aviation-pack contract tests
README.md                        Current build and testing documentation
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
