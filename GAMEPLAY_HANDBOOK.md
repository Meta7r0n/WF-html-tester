# THE WITHERED FARM
### Farmhand's Field Handbook — v0.39

*Issued by Lobster Labz Farm Operations. If found on the ground, dust it off and keep reading — the corn doesn't wait.*

> "A pitchfork, a flashlight, and the corn."

---

## Table of Contents

1. [The Story So Far](#1-the-story-so-far)
2. [Getting Started](#2-getting-started)
3. [Controls](#3-controls)
4. [Your Farmhand](#4-your-farmhand)
5. [The Hangar — Custom Pilot Builder](#5-the-hangar--custom-pilot-builder)
6. [The Armory — Weapons](#6-the-armory--weapons)
7. [Field Supplies — Throwables, Consumables & Pickups](#7-field-supplies--throwables-consumables--pickups)
8. [The Workbenches — Crafting the Portal Gun & Plow Shield](#8-the-workbenches--crafting-the-portal-gun--plow-shield)
9. [The Threats — Regular Enemies](#9-the-threats--regular-enemies)
10. [Mini-Bosses](#10-mini-bosses)
11. [The Farm — Map & Locations](#11-the-farm--map--locations)
12. [Vitals & HUD](#12-vitals--hud)
13. [Game Modes](#13-game-modes)
14. [Menus & Options](#14-menus--options)
15. [Field Notes: Developer Console](#15-field-notes-developer-console)
16. [Tips From the Field](#16-tips-from-the-field)
17. [Quick-Reference Card](#17-quick-reference-card)

---

## 1. The Story So Far

Before the helicopter even leaves the pad, you get a text.

> **drewbie:** hey fucker wyd?
> **you:** not much just rollin up, wbu?
> **drewbie:** I'm trying to get these orders out, but the farm called and said some wonky shits been going on. Go take care of it yeah?
> **you:** 🫡

That's the whole briefing. drewbie's your contact back at Farm Operations, you're the pilot, and "the farm" is exactly the kind of place that only calls when something has already gone badly wrong. You load up your farmhand (or your whole crew, if you brought friends), fly in low over the fields, and rappel down just inside the south gate.

From here on, the job is simple: clear what's out there. Every enemy you put down counts toward the farm's tally — in the local vocabulary, you don't "kill" something on this farm, you **wilt** it. The land itself is dying, the crops are wrong, and the things wandering the rows used to be something else. Four mini-bosses stand between you and a quiet farm, and if you're running solo, a fifth threat waits behind a locked barn door for those who go looking for it.

That's the short version. The long version involves a green shard, a barn key, a home-built Portal Gun, and something called Bearclaw2 that you will not want to meet unprepared. Read on.

---

## 2. Getting Started

From the main menu you choose how you want to run the farm:

- **Single-player →** — the full campaign: mini-boss progression, the crafting quest, and the final confrontation.
- **Online multiplayer →** — host or join a room with up to 4 players, across three modes (see [Game Modes](#13-game-modes)).
- **Options** — sound, display, voice chat, and control rebinding.
- **Farm Map** — a live overhead view of the surface and basement layouts, reachable any time from the main menu or the pause screen.

Before you drop in, you can also flip the difficulty switch:

- **Normal** — the standard fight.
- **Ultra** — more enemies (+33% roster size), faster spawns (+25%), tougher enemies (+25% health), and scarcer supplies (pickups spawn 25% less often, and healing/shield items restore 25% less per use). Choose this if Normal isn't making you sweat.

---

## 3. Controls

### Keyboard & Mouse

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump |
| `Shift` | Sprint |
| `Ctrl` | Crouch — tap while sprinting to slide |
| `W` / `S` | Climb / descend ladders |
| Left Click | Fire equipped weapon, or swing if it's melee |
| `V` | Quick melee, regardless of what's in your hands |
| Right Click | Aim down sights — steadier and more accurate, but slower to move, and sprinting is locked out entirely while aiming |
| `Q` (hold) | Raise the Plow Shield (once crafted) — see §8. Not a weapon slot, not the melee key: its own independent bind |
| `1`–`9` | Switch weapon by slot |
| Scroll Wheel | Cycle to the next/previous owned weapon |
| `R` | Reload |
| `G` | Throw the selected throwable |
| `T` | Cycle throwable type (Grenade / Dynamite / whatever else you're carrying) |
| `J` | Use a Jays pack |
| `E` | Interact — pick locks, work the Barn Key, open doors and gates, use the crafting workbench |
| `F` | Toggle your flashlight lantern |
| `B` | Hold to talk (when voice chat is on) |
| `Enter` | Open/send multiplayer text chat |
| `Esc` | Release the mouse / pause |
| `` ` `` (Backquote) | Open the developer console (single-player only) |

Every one of these can be reassigned under **Options → Controls**.

### Touch Controls

On a phone or tablet you get a left thumbstick for movement (push up or down on a ladder to climb it), a drag-anywhere-on-the-right look zone, and a row of action buttons: **Fire**, **Jump**, **Bash** (melee), **Load** (reload), **Swap** (next weapon), **Throw**, a throwable-type switcher, **Jays**, **Crouch**, **Aim**, **Shield**, **Use**, **Talk**, plus **Pause** and **Chat** buttons. Tap a weapon in your inventory strip to equip it directly, or hold Fire and drag to aim while shooting.

> **Field note:** the touch layout doesn't currently include a flashlight button — if you need your lantern on mobile, you'll need to rebind it to a control you can reach, or fight in daylight.

---

## 4. Your Farmhand

Five farmhands are cleared for single-player deployment. Every one of them carries the same starting arsenal and shares the full weapon pool — the only thing that changes hero to hero is what happens when things go badly for you.

You always start a run holding **Bare Knuckles** (your fists — reliable, free, always in your pocket) and the **Pipe Popper** shotgun, loaded and ready.

### Larry — *Double Barrel*
> "Shotgun farmhand. When downed, fire two wide-spread blasts, then stand back up with 25% health."

Larry doesn't die on the spot. A lethal hit drops him into a **Downed** state instead — he's granted a few seconds of invulnerability, forced onto a stripped-down Double Barrel, and given roughly 16 seconds to fire it twice before he bleeds out for real. Land both shots and he's back on his feet at 25% Pep. Miss the window and it's over.

### Smoke — *Chainsaw Hand*
> "At 25% health the chainsaw auto-equips for heavy melee. It returns to inventory once you recover above 55%."

No trigger needed — the instant Smoke's health drops to a quarter, the chainsaw snaps into his hand automatically (with a few seconds of invulnerability to cover the swap) and stays there, hitting far harder than any other melee option, until his health climbs back above 55%.

### Stoned — *Secret Stash*
> "The instant your health hits zero, a hidden stash saves you — back up with 50% health."

No prompt, no button, no way to fumble it. The moment Stoned would die, he's back at 50% Pep with a few seconds of cover fire. Simple and unstoppable — exactly once per life.

### Pyro — *Dy-No-Mite*
> "The instant your health hits zero, three sticks go off around you, clearing the area and healing you for what they take out."

Pyro's death save is also his best crowd control: three dynamite sticks detonate around him at the moment of death, wiping out everything close enough to matter, and every kill in the blast heals him further. A good Dy-No-Mite can turn a losing fight into a clean room.

### Jeff — *Knife Storm*
> "At 10% health, 5 knives burst out and clear the area — every kill from the storm heals you 15%."

Unlike the others, Jeff's trick fires *before* he'd otherwise die — the first hit that drops him through 10% health (while he's still standing) triggers a radial burst of five knives, each kill healing him 15%. It only fires once per life, so use that health cushion wisely.

> **On multiplayer:** every special above is single-player-only *except* Stoned's and Pyro's, which also work in co-op and Team Deathmatch (their specials don't rely on solo-only mechanics like the Downed state or an auto-swap weapon slot). None of them fire in Free-for-All — dying there is meant to cost something.

---

## 5. The Hangar — Custom Pilot Builder

If the classic five aren't your style, the **Hangar Custom Pilot Builder** lets you drop in as one of 123 community-approved aviation-hat pilots, each with a unique procedurally-generated head, paired with any of the five hero bodies (Larry, Smoke, Stoned, Pyro, or Jeff) as your build.

Saving a Hangar Pilot replaces your hero's classic emergency special with one shared mechanic:

**Ejection Seat** — a lethal hit launches you skyward and restores 50% Pep instead of killing you. You get **three downs** before the run ends for good (two ejections, then the third is final) — but **Extra Life** pickups, which appear after natural mini-boss defeats, raise that ceiling by one apiece.

Open the builder from either the single-player character screen or the online lobby ("Build pilot"). Search by token number or trait, preview Full Pilot or Head Detail framing, hit **Random approved pilot** if you're feeling lucky, or **Use classic hero heads** any time to go back to the standard five. The lobby version skips Jeff, since he's a solo-only body.

---

## 6. The Armory — Weapons

Weapon slots run `1`–`9`. Two more — the Downed Double Barrel and the Chainsaw — only ever appear automatically, as part of Larry's and Smoke's specials, and Jeff's Knife Storm isn't a held weapon at all (it's an automatic burst).

| Slot | Weapon | Type | Mag / Reserve | How you get it |
| :-: | --- | --- | --- | --- |
| 1 | **Bare Knuckles** | Melee | — | Always on hand |
| 2 | **Pipe Popper** | Pump shotgun | 6 / 42 | Starting weapon |
| 3 | **Tin Sixer** | Revolver | 6 / 60 | World pickup |
| 4 | **Fieldhand Carbine** | Automatic rifle | 24 / 144 | World pickup |
| 5 | **Carrot Cannon** | Shotgun | 6 / 36 | Carrot Warden's drop |
| 6 | **Scrap Railgun** | Charged rifle | 4 / 16 | World pickup |
| 7 | **Spray Torch** | Flamethrower | 80 / 240 fuel | World pickup |
| 8 | **The Claw** | Long-reach melee | — | Bear Claw's rematch drop |
| 9 | **Portal Gun** | Precision sidearm | 6 / 24 | Crafted only |
| — | **Seed Spitter** | Automatic LMG | 50 / 200 | The Gardener's drop |
| — | **The Glizzy Gat** | Bolt-action sniper rifle | 5 / 20 | World pickup, West Silo Row |

> **A note on the Seed Spitter's and Glizzy Gat's slots:** the keyboard only has number keys `1`–`9`, and they're all spoken for — so neither gets one. Both are still fully usable: scroll the mouse wheel to cycle to them, or tap them directly in the mobile inventory strip, same as any weapon once your loadout runs past nine.

### Weapon notes

**Bare Knuckles** — your fists. Free, unlimited, and surprisingly not useless (30 damage per hit, decent reach).

**Pipe Popper** — the reliable starting scattergun: 8 pellets, 15 damage each, short-to-mid range. Its one hidden trick: a **headshot on Beat Slayer always staggers him**, no matter how tanky he's built up to be — no other weapon guarantees that against him.

**Tin Sixer** — a tight, single-shot revolver built for precision over volume. Highest per-shot accuracy of any early-game gun, best used at range on a single target.

**Fieldhand Carbine** — the farm's only fully-automatic rifle. Big magazine, big reserve, moderate per-shot damage — your workhorse for sustained fights once you find it.

**Carrot Cannon** — Carrot Warden's boss drop, and a genuine upgrade over the Pipe Popper: more pellets, more damage, a much tighter spread that turns into real extra range, and a small per-pellet chance to land a critical hit.

**Scrap Railgun** — charges for just over half a second before firing a single, extremely accurate, high-damage shot. As a bit of flair, every shot also launches a piece of harmless flying junk (a trophy, a hot dog, a rubber chicken — purely cosmetic) alongside the real hitscan bolt.

**Spray Torch** — the flamethrower. A continuous damage cone rather than discrete shots, it burns through fuel instead of counting rounds — one full tank is about eight seconds of stream. Aiming down sights narrows the cone, extends the range, and turns up the heat for extra damage. It also tags surfaces with a spray decal as you fire — see [Options](#14-menus--options) for how to make that tag your own.

**The Claw** — Bear Claw's final drop, after you beat him twice. A melee weapon with absurd reach (over six meters — read: it's basically a ranged weapon that happens to swing), and a small chance on every hit to stun *whatever* it connects with, mini-bosses included.

**Portal Gun** — built, not found (see [The Workbench](#8-the-workbench--crafting-the-portal-gun)). Near-perfect accuracy and the highest raw damage of any sidearm. Against Bearclaw2 specifically, landing a headshot with it triggers a bonus critical hit and a real chance to stun him outright.

**Seed Spitter** — The Gardener's drop, and unmistakable the second you see it: a stubby, prohibition-era Tommy-gun body built around a drum magazine shaped like an actual sunflower, yellow petals and all. Under the theming it's a genuine LMG upgrade over the Fieldhand Carbine — a bigger drum, a faster rate of fire, and more damage per shot, at the cost of a slower reload once that drum finally runs dry.

**The Glizzy Gat** — a hotdog-in-a-bun sniper rifle, and not a joke stat-wise: it's the single hardest-hitting, longest-ranged, most accurate gun on the farm, at the cost of the slowest fire rate and longest reload in the game (a real bolt cycle between shots). Aiming down sights pulls a genuine scope zoom instead of the usual modest steadying-up FOV pull every other gun gets, and while it's your equipped weapon it always paints a **red laser dot** at your point of aim — visible to everyone, not just you, so in multiplayer a teammate (or an opponent) can see exactly when they're being lined up. Found on the West Silo Row's tallest deck, at the far end of both scaffolding walkways.

### Ammo types

Each gun draws from its own ammo pool, restocked by matching pickups scattered around the farm:

| Ammo | Used by | Pickup | Amount |
| --- | --- | --- | --- |
| Shells | Pipe Popper, Carrot Cannon | Pipe Shells | +16 |
| Light | Tin Sixer | Sixer Rounds | +24 |
| Carbine | Fieldhand Carbine | Carbine Rounds | +42 |
| Battery | Scrap Railgun | Batteries | +10 |
| Spraycan | Spray Torch | Spray Cans | +150 |
| Seed Drum | Seed Spitter | Seed Drums | +50 |
| Portal Cell | Portal Gun | *(none in the field — the 18 rounds you're granted at crafting are it)* | — |
| Glizzy Rounds | The Glizzy Gat | Glizzy Rounds | +8 |

---

## 7. Field Supplies — Throwables, Consumables & Pickups

### Throwables (`G` to throw, `T` to switch type)

| Throwable | Effect |
| --- | --- |
| **Grenade** | Standard fragmentation — solid blast radius, reliable damage, up to 6 carried. |
| **Dynamite** | Bigger radius and harder-hitting than a grenade, at the cost of carrying fewer (max 3). |
| **Pack of Smokes** | Bear Claw's first drop. Deals no damage at all — instead it fills the area with smoke that blocks line of sight for several seconds, letting you break contact or reposition unseen. |
| **Golden Boombox** | Beat Slayer's drop, and the nastiest one in your kit. Only one can be carried at a time. It doesn't explode on landing — it drops a lingering hazard zone that damages and slows anyone standing in it, blocks sprinting entirely, and actively **pulls nearby enemies toward its center** (yes, throw it into a crowd and watch them get reeled in). After several seconds it detonates for real, for serious damage. |

### Consumables

**Jays** (`J` to use) — the farm's field medicine. Stack up to 5. Using one runs for a few seconds: if you're hurt, it heals you over that window; if you're already at full health, it tops up your shield instead.

### Health & Shield pickups

| Pickup | Effect |
| --- | --- |
| **Pep Tonic** | Restores health ("Pep"). |
| **Guard Cell** | Restores shield ("Guard") — your health's first line of defense. |

### Power-ups

Four temporary buffs are scattered around the farm, each with a nice long respawn timer so you'll want to remember where you found them:

| Power-up | Effect |
| --- | --- |
| **Iron Hide** | Temporary invulnerability. |
| **Hot Sauce** | +50% weapon damage for a while. |
| **Jackrabbit Feet** | A solid movement speed boost. |
| **Rally Horn** | An instant heal-and-shield burst — in co-op or team matches, it shares that burst with any teammates standing nearby. |

### Weapon pickups

World spawns exist for the Tin Sixer, Fieldhand Carbine, Scrap Railgun, Spray Torch, and the Glizzy Gat — pick one up for the first time to add it to your inventory (with a starting stock of ammo), or walk over one you already own to top off its magazine and reserve.

---

## 8. The Workbenches — Crafting the Portal Gun & Plow Shield

Single-player has two crafting stations hidden inside the North Barn, one directly above the other. Both are entirely optional in multiplayer — co-op, FFA, and Team Deathmatch simply leave the barn unlocked from the start and skip the whole sequence.

### The Portal Gun (upper floor)

**Step one — earn the pieces.** Three of the four mini-bosses each drop a quest component when defeated:

- **Beat Slayer** → **Mysterious Green Shard**
- **Bear Claw** (first defeat) → **Metal Weapon Fragment**
- **Carrot Warden** → **Computer Chip**

A fourth mini-boss, **The Gardener**, drops the **Barn Key** instead of a component.

**Step two — unlock the barn.** Carry the Barn Key to any entrance of the North Barn — the south doors, the west doors, or the cellar hatch — and interact (`E`). The first use throws **every** entrance open at once, so you don't need to hunt down each door separately. The moment the barn unlocks, the workbench's own computer screen flips from "CRAFTING OFFLINE" to "CRAFTING ONLINE."

**Step three — find the bench.** Climb to the North Barn's upper floor and interact with the workbench. If you're missing pieces, it'll tell you exactly what's left to find. Once you're holding all three components, interacting assembles the **Portal Gun** on the spot and equips it immediately with 18 rounds ready to go.

**Step four — the payoff.** Firing up the freshly-built Portal Gun for the first time triggers a full cutscene: the wall begins to glow, a portal tears open on the barn's east wall, and **Bearclaw2** — a tougher, angrier version of the Bear Claw you already fought — steps through and crosses the room to meet you. When you're ready, any input brings you back into full control, weapon drawn, for the fight that ends the run. Once the cutscene finishes, that same computer screen flips again — from "CRAFTING ONLINE" to "BREACH DETECTED."

Defeating Bearclaw2 is single-player's actual win condition. Beat him and the farm goes quiet — literally; that's the line on your final report.

### The Plow Shield (cellar, directly below)

A second, independent workbench sits one floor down, in the North Barn Cellar — reachable through the same unlocked hatch. It builds a riot-style **Plow Shield**, and it doesn't wait on any boss fight.

**Step one — find the three pieces**, scattered out in the open world rather than dropped by anything:

- **Plow Disc** — barn yard, near the old stripped tractor
- **Harness Straps** — the horse stable
- **Reinforcing Plate** — the silo deck

**Step two — assemble it.** With the barn unlocked (same key, same gate as the Portal Gun above) and all three pieces in hand, interact with the cellar workbench to weld the shield together.

**Using it** is nothing like a normal weapon or the melee key — it has its own dedicated bind (`Q` by default):

- **Passive, always on:** the moment it's assembled, hits landing on your back take noticeably less damage — no button required. This works whether the shield is raised or not.
- **Active, hold to raise:** holding `Q` brings the shield up in front of you. While raised, frontal hits are cut down dramatically, movement slows (similar to aiming), and firing/reloading/switching weapons is locked out entirely — you're committed to blocking. Pressing melee (`V`) while raised swings a **shield bash** instead of your usual melee attack.

---

## 9. The Threats — Regular Enemies

Four enemy types make up the rank and file. Each behaves a little differently once it notices you:

| Enemy | Style | What to know |
| --- | --- | --- |
| **The Reaper** | Long-reach melee | Notices you from farther away than most, thanks to its longer weapon, but still has nothing ranged to throw. Keep your distance and it can't touch you. |
| **The Howler** | Ranged spotter | Spots you from a long way off but can't actually hurt you until it closes in and gets a tight flashlight lock — once it does, its beam ticks steady damage over time. Break line of sight or close the gap fast to shut it down. |
| **The Gaper** | Basic brawler | A straightforward puncher with slightly more speed than the others — no gimmick, just don't get complacent. |
| **The Grinner** | Ambush melee | Short senses and short reach, built to sneak up rather than chase from range. A small chance on every claw hit adds a light bleed. |

All four share the same basic playbook: wander when they haven't noticed you, go on alert once they spot or hear you, chase, then attack once they're close enough. Lose them for long enough and they'll eventually drift back to idle — but they'll follow you up and down stairs and across ladders if the chase is still on.

---

## 10. Mini-Bosses

Four mini-bosses stand between you and a quiet farm — plus the rematch that only the crafting quest unlocks. Their *identities* and attacks are the same everywhere; only the **order they show up in** changes depending on how you're playing.

### Beat Slayer
The kiter. Rather than closing distance like everything else on the farm, Beat Slayer keeps his range, throws his boombox at you from a distance, and only rushes in if you're caught in his own blast zone. Landing a **Pipe Popper headshot** always staggers him — his one reliable weakness.
- **On defeat:** drops the **Golden Boombox** throwable (plus, solo only, the **Mysterious Green Shard**).

### Bear Claw
A long-reach melee brawler — his claw has more range than almost anything you'll swing back at him. Take enough hits landing on him in a row and he'll vent a smoke cloud and retreat to reposition before re-engaging, so don't expect one clean, uninterrupted fight.
- **First defeat:** drops **Pack of Smokes** (plus, solo only, the **Metal Weapon Fragment**).
- **He comes back tougher.** His second appearance — internally the same fight, scaled up — hits harder, moves faster, and has significantly more health.
- **Final defeat:** drops **The Claw** weapon instead.

### Carrot Warden
A hybrid: he'll melee you up close, but at range he unloads a spread of seed pellets that punishes standing still. Keep moving and use cover to blunt the volleys.
- **On defeat:** drops the **Carrot Cannon** (plus, solo only, the **Computer Chip**).

### The Gardener
Solo-only, and the final regular encounter before the crafting quest closes out. A hugely built-up sunflower figure with her own distinct face — one half a bare pink welt-marked stare, the other half blacked out behind a wide, white-toothed grin. She periodically raises her watering can to summon reinforcements, and spits a visible volley of seeds at you every few seconds — watch for the wind-up and get out of the line of fire. Expect this fight to bring extra company.
- **On defeat:** drops the **Barn Key** — and the **Seed Spitter**, a full weapon on top of the quest item.

### Bearclaw2
The finale. The Bear Claw you already beat, back through a portal, angrier and considerably stronger — this is the fight the entire crafting quest builds toward, and beating him is what actually ends a single-player run. Bring the Portal Gun: a headshot with it lands a bonus critical hit and has a real chance to stun him outright.

### Two progression tracks

**Single-player** (a fixed quest order, gated on your running kill count):

| Wilted count | Encounter | Drops |
| ---: | --- | --- |
| 33 | Beat Slayer | Golden Boombox · Green Shard |
| 66 | Bear Claw | Pack of Smokes · Metal Fragment |
| 99 | Carrot Warden | Carrot Cannon · Computer Chip |
| 132 | The Gardener | Barn Key · Seed Spitter |
| *(craft the Portal Gun)* | **Bearclaw2** | *the run's final fight* |

**Co-op / Free-for-all / Team Deathmatch** (no crafting quest — everyone just keeps fighting the farm's escalating threat list):

| Wilted count | Encounter |
| ---: | --- |
| 33 | Carrot Warden |
| 66 | Bear Claw |
| 99 | Bear Claw's rematch |
| 132 | Beat Slayer |

---

## 11. The Farm — Map & Locations

Pull up the **Farm Map** from the main menu or the pause screen for a live, two-panel view — surface on one side, the tunnel network below on the other, both on the same coordinated grid.

**Above ground:**
- **The Barn** — the original structure, tucked near "The Good Spot" signpost, with its own basement stair gate.
- **North Barn** — a two-floor structure with a workbench upstairs. Locked behind three entrances (south doors, west doors, cellar hatch) until the Barn Key is used.
- **Silo Row** — a cluster of silos to the north, reachable by a ground stair.
- **Corn Maze** — sprawling and genuinely large; enemies that spot you inside will path the rows rather than walk through them.
- **Horse Stable** — out east, with its own overlook and ground stair.
- **The Well** — a secret, one-way drop point on the surface that dumps you straight into the basement's Generator Hall. Great as an escape route, useless for climbing back out — and enemies can't follow you down it.
- **The Gardener's Greenhouses** — a west wing running the farm's full south-to-north length, entered through two gaps in the old west fence line. Three long greenhouses, each playing differently: the **Seedling House** is open and clear for running-and-gunning, with low benches you can jump straight onto; the **Grow House** has taller benches you can't mount, forcing you around them; the **Mature House** is dense with full-grown plants that block line of sight and some paths outright, weaving door-to-door. Outside stand three tall water tanks with ladders to their decks, and scattered nutrient pallets that kick up a blocking dust cloud if you shoot them — the same trick as a Pack of Smokes, just free and rechargeable on a cooldown.
- **West Silo Row** — three tall, rounded-top grain-silo towers further out past the water tanks, right up against the west fence — a different silhouette from the flagship Silo Row's water-tower look up north. Each has its own west-facing ladder up to a walkway that wraps the whole tower, and two elevated scaffolding bridges link all three walkways into one continuous high line running the length of the wing. From each walkway, a spiral of small jump ledges climbs the dome above it to a tiny apex platform — no ladder up there, just a run of real jumps, so it's a route a dedicated player has to earn. The Glizzy Gat waits at the far (north) end.

**Below ground:** a connected tunnel network linking Basement, Utility Room, Root Cellar, Grenade Room, Generator Hall, Relay Room, Secret Cache, Silo Access, and North Barn Cellar — reachable through six separate surface hatches plus the interactive Barn Stair Gate.

---

## 12. Vitals & HUD

- **Pep** — your health bar. Runs low, flashes red, regenerates on its own once you're out of danger for a few seconds.
- **Guard** — your shield, the buffer that absorbs damage before Pep does.
- **Ammo readout** — current magazine over reserve; goes red when you're running low, and swaps to your weapon's name entirely for melee weapons.
- **Jays counter** — how many Jays packs you're currently holding (max 5), with a reminder that `J` uses one.
- **Throwable readout** — your currently selected throwable, its key, and how many you're carrying.
- **Buff chips** — active countdown timers for Iron Hide, Hot Sauce, and Jackrabbit Feet whenever they're running, plus indicators if you're stunned or slowed.
- **Component tracker** — three slots tracking your Green Shard, Metal Fragment, and Computer Chip progress toward the Portal Gun.
- **Hangar Downs** — for saved pilots only: how many ejections you've used against your current limit.

---

## 13. Game Modes

| Mode | Players | What it is |
| --- | ---: | --- |
| **Single-player** | 1 | The full campaign — mini-boss progression, the crafting quest, and Bearclaw2's finale. |
| **Co-op** | Up to 4 | Everyone fights the farm's enemies and bosses together. No friendly fire, shared kill count. |
| **Free-for-all** | Up to 4 | Pure player-vs-player. First to 15 kills clears the farm. |
| **Team Deathmatch** | 2 vs 2 | Same PvP pacing as FFA, but scored as two teams racing to a combined 25 kills. |

Online rooms are hosted with a shareable six-character room code — host a room, or drop a friend's code into **Join room** to connect. The host chooses the mode before opening the room, and can start the match as soon as it's ready without waiting for a full lobby.

---

## 14. Menus & Options

- **Main Menu** — pick single-player or online multiplayer, set difficulty, or jump to Options / the Farm Map.
- **Online Multiplayer Lobby** — choose your hosting mode (Co-op / FFA / Team Deathmatch), your farmhand, host or join a room, and watch the live roster fill in.
- **Character Select** (single-player) — pick one of the five classic farmhands, or launch the Hangar Pilot Builder.
- **Options** — Sound (Master, Effects, Music, Wind sliders), Voice Chat (on/off, hold-to-talk volume), Display brightness, an auto-equip toggle for picked-up weapons, a **Spray Torch Signature** upload (drop in your own PNG or JPEG, under 512KB — it gets resized and burned into your flamethrower's spray tags so your mark is genuinely yours), and full control rebinding.
- **Farm Map** — the live two-panel surface/underground view described above, with your position and any teammates' positions marked live.
- **Pause Menu** — resume, jump to Options or the Map without losing your place, restart the run, or return to the main menu.

---

## 15. Field Notes: Developer Console

Tucked behind the backtick key (`` ` ``) is a single-player-only developer console, useful for testing builds and loadouts without grinding a full run. It's not part of the intended playthrough, but it's there if you go looking:

```text
help                 list every command
list                 show the current item/weapon registry
spawn <id>            spawn a specific registered item
enemy [type] [count]  spawn regular enemies (max 10 at a time)
boss <name>            spawn a mini-boss immediately
killenemies             clear the current enemy roster
wilted <count>           set your kill counter directly
resetenemies             reset the enemy roster
god / invuln / godmode   toggle invulnerability
heal                     restore full health
refillammo / ammo        top off every owned weapon
tp <x> <z> / teleport    teleport to a coordinate
craftall                 grant every Portal Gun component + the Barn Key
clear                    clear the console log
close                    close the console
```

---

## 16. Tips From the Field

- **The Pipe Popper's headshot stagger is free real estate against Beat Slayer.** No other gun guarantees it — line up the shot before you commit to a fight with him.
- **Golden Boombox is a weapon, not just Beat Slayer's toy.** Once you've got one, throw it into a cluster of regular enemies and let its pull effect do the crowd control for you.
- **A ladder is a panic button.** Climbing one grants you continuously-refreshed invulnerability for as long as you're on it — a clean way to break contact when you're overwhelmed, on the surface or underground.
- **Crouch-sprint to slide.** Tapping crouch mid-sprint launches a fast slide instead of just dropping your speed — useful for closing distance or ducking under a swing.
- **Pack of Smokes doesn't do damage — that's the point.** Use it to vanish and reposition, not as a grenade replacement.
- **The Well only goes one way.** It's a great emergency exit into the basement, but you can't climb back up through it, and enemies can't follow you down.
- **Aiming down sights locks out sprinting entirely, weapon aside.** Don't hold ADS while repositioning — release it the moment you're done shooting.
- **The Barn Key opens everything at once.** You don't need to track down each individual door — one use, every entrance swings open.
- **The Plow Shield protects your back before you ever press the key.** Once it's assembled, don't wait for a firefight to matter — you're already taking less damage from behind at all times.
- **Extra Lives only queue for saved Hangar Pilots**, and only after a *natural* mini-boss defeat — one spawned from the developer console won't grant one.

---

## 17. Quick-Reference Card

```
MOVE        W A S D              INTERACT      E
LOOK        Mouse                RELOAD        R
JUMP        Space                MELEE         V
SPRINT      Shift                THROW         G
CROUCH/SLIDE Ctrl                SWITCH THROW  T
FIRE        Left Click           USE JAYS      J
AIM         Right Click          LANTERN       F
SHIELD      Q (hold)             TALK          B (hold)
WEAPON SLOT 1-9                  DEV CONSOLE   ` (solo only)
CYCLE WEAPON Scroll Wheel
PAUSE       Esc
```

*Farm Operations thanks you for your service. Try not to become part of the crop.*
