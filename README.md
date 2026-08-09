# WF-html-tester

## v0.07.00 Co-op Foundation

The current build opens on a mode menu with:

- **Single-player** — the complete v0.06.08-BM farm run.
- **Online co-op** — a two-player direct WebRTC lobby. One player hosts, the
  other joins, and they share a short room code through the lobby. Once
  connected, both clients see the other farmhand and gunfire is relayed
  through the host before being resolved locally.

The GitHub Pages client remains static. PeerJS Cloud handles only the initial
WebRTC signaling handshake; gameplay data still travels peer-to-peer after the
connection opens. The transport seam can later point at a Lobster Labz-owned
PeerServer, while the shared enemy simulation can move to an authoritative
match server in a later multiplayer milestone.

### First co-op test

1. Open the build in two browser tabs or devices.
2. On the first, choose **Online co-op → Host room →** and wait for the six-character room code.
3. Share that one code with the second screen (the **Share room code** button uses the phone’s share sheet when available, or copies it).
4. On the second, choose **Online co-op → Join room →**, enter the code, and tap **Join room**.

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

## v0.07.02 Co-op Lobby

The manual multi-kilobyte SDP offer/answer exchange has been removed from the
normal path. Rooms now use a six-character `WF••••` code, with clear states for
opening the lobby, waiting for a teammate, connecting, missing rooms, and
timeouts. The prior direct game-message seam is preserved so future server
authority can be added without changing the farm gameplay modules.

## v0.07.03 Player Cast

Co-op farmhands now use two distinct original Three.js rigs instead of the
generic enemy silhouette. The host appears as the **Bluecap Scout** with a
blue cap, striped scarf, patched rust shorts, bright boots, and a compact
field rifle. The joining farmhand appears as the **Masked Runner** with a
muted cap, tired orange-lidded eyes, gray face covering, gold chain, patched
shorts, large rust boots, and a red backpack. Character identity, movement,
climbing, sprinting, and dead state are sent with the existing co-op messages;
enemy and combat logic remain separate.

## v0.07.04 Hero Specials

Single-player now opens a hero picker. The Scarf Scout gets a downed-only
double-barrel recovery weapon: two wide-spread, high-damage shots revive the
player at 25% health. The Masked Runner has a chainsaw-hand special that
auto-equips at 25% health and stows after recovering above 55%. Co-op keeps its
host/join farmhand roles.

Enemy spawning now uses an explicit sunflower-only roster, so playable heroes
cannot appear as enemies. Jays pickups add a five-item consumable stack; press
`J` (or tap **Jays** on mobile) to regenerate 5 Pep per second for five
seconds, switching to slower Guard regeneration when Pep is full.

### Hero/pickup polish

The Jays world pickup now uses a green, hop-like fluffy cluster visual. Public
surface and basement supplies are spaced across their rooms and routes without
changing their quantities; the hidden cache also contains a Jays pack and a
grenade bundle.

The Scarf Scout's downed special now uses a clearly separated two-barrel,
break-action view model. The Masked Runner's low-health special is a temporary,
aimable chainsaw weapon swap with a visible guide bar and high-damage melee;
holding the fire surface repeats the melee swing, including on mobile.

## v0.07.05 Pause Menu

The in-game pause card now includes a mobile-friendly **Main menu** action. It
resets the active run through the same safe path as the end-game start-screen
button, stops any co-op transport, releases input capture, and returns to the
single-player / online co-op mode selector without changing the current run on
the branch until the player chooses a new one.

## v0.23-CFP Alpha Lab deployment

This branch is prepared for a private Cloudflare Worker deployment. The game
files live under `public/`, while `worker.js` runs first and serves the game
only after a short-lived, signed tester session is established.

### Cloudflare setup

1. Create or open the Worker connected to this repository and set its
   production branch to `v0.23-CFP` (do not use `main`).
2. Leave **Build command** empty and use `npx wrangler deploy` for the deploy
   command. The repository already contains `wrangler.jsonc` and the Worker
   entry point.
3. After the first deployment, open **Worker → Settings → Variables & Secrets**
   and add these as encrypted secrets:
   - `LAB_PIN`: the current shared tester PIN. Choose a new value for this
     release; do not reuse a PIN that has appeared in chat or documentation.
   - `SESSION_SECRET`: a long random signing secret. Generate one locally, for
     example with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
4. Add the custom domain `alpha.lobsterlabz.com` to the Worker. Keep this
   address out of the public navigation until the alpha is ready.

The PIN and signing key are runtime secrets; neither is included in the
repository or sent to the browser. Rotating `LAB_PIN` changes tester access,
and rotating `SESSION_SECRET` immediately invalidates existing sessions. The
in-Worker attempt counter is only a small edge-local brake, so add a Cloudflare
Rate Limiting rule if this endpoint is ever opened to a larger audience.
