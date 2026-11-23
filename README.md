# Ragdoll Archery Defense

A 2D physics-ragdoll stickman archery wave-survival game (landscape, touch-first) — web prototype of the design spec.
Vanilla JS + Canvas 2D + [Planck.js](https://piqnt.com/planck.js/) (Box2D port, vendored in `vendor/`). No build step.

## Run

```
python3 -m http.server 8000   # any static server works; opening index.html directly also works
# then open http://localhost:8000 (on a phone: use your LAN IP, rotate to landscape)
```

## Controls

| Action | Touch | Desktop |
|---|---|---|
| Aim / charge | Press & hold in the left **CONTROL AREA**, drag (slingshot: drag away from the target direction) | Mouse drag |
| Fire | Release | Release |
| Jump (5 stamina) | **JUMP** button on the tower | `Space` / `W` / `↑` |
| Switch arrow | Radio buttons on the tower's left wall | `1`–`6` |
| Pause | `||` bottom-right | `Esc` / `P` |

Shooting from the CONTROL AREA in the menu starts the run. Drag back like a real bow: drag direction sets the angle, drag length sets how far the string is pulled (power). There is no aiming UI. Pulling and firing cost stamina; **PULL SPEED** caps how fast the string can follow your finger. A headshot on a character without a helmet is instantly lethal.

## What's implemented (maps to the spec)

- **Active ragdoll** (`js/rig.js`): 11 bodies / 10 revolute joints with angle limits, per-joint PD muscle torques with gravity feed-forward, balance assist on the pelvis, 2-bone IK for the draw arm, self-collision filtered via negative collision groups. Poses: stand, kneel, split. Death disables the muscles and the bow detaches as its own rigid body.
- **Arrows** (`js/arrows.js`): custom ballistic flight with a swept ray-cast per physics tick (no tunnelling), arrows embed into limbs/terrain in the body's local frame (cap 25 per ragdoll), mid-air arrow-vs-arrow collisions, head ×2.5 / torso ×1 / limb ×0.5 damage, limb hits tint red and throw the aim off, armor absorbs/deflects with sparks and physically falls off when broken.
- **7 arrow types**: Default, Poison (DoT), Electro (stun + muscle convulsion), Fire (burn + ember trail), Balloon (lifts limb), Shot (heavy, armor-shattering knockback), Minigun (7-arrow spread with star sparkles).
- **Enemies** (`js/game.js`): unarmored / light helmet / heavy knight, four platform pose layouts, closed-form ballistic solver with a Gaussian angular error that tightens per wave plus faster reloads, more enemies and more armor. Dying switches the platform blocks to dynamic bodies so it crumbles into the abyss. Enemies knocked off (balloon, shot) and falling out of the world count as kills.
- **Apples**: red = health, green = stamina, gold = both, with generous trigger radius and rising red/blue auras.
- **Economy / meta**: Skulls (+3 per kill), 8 permanent upgrades with scaling costs (ARMOR, HEALTH, LIVES, STAMINA, STAMINA REFRESH, PULL SPEED, DAMAGE, ARROW SLOTS), arrow unlocks + slot equip, seasonal `SCORE x/70`, local leaderboard, bow skins shop, settings (sound, haptics, aim sensitivity, aim-assist line), save in `localStorage`.
- **Mock monetization**: the rewarded ad (+200) is a 3-second simulated video and the skull bundle in the shop is a free demo — wire real SDKs where marked in `js/ui.js` (`openAd`, `openShop`).
- **Juice**: blood particles that bounce off stone, screen shake, kill slow-mo, synthesized WebAudio SFX (no assets), snow/parallax-square background.

## Layout

```
index.html, css/style.css
js/util.js   math helpers          js/rig.js     ragdoll rig + PD controller
js/data.js   tuning data           js/game.js    scene, waves, player controller, enemy AI
js/save.js   persistence           js/arrows.js  projectiles, hits, status effects, particles
js/audio.js  WebAudio SFX          js/render.js  canvas rendering + diegetic tower HUD
js/input.js  pointer/keyboard      js/ui.js      DOM menu, modals
```

Tuning knobs live in `js/data.js` (`G.C`, upgrades, arrows, enemy types, layouts) and `Game.waveSpec` in `js/game.js`.

## Notes / deviations

- Physics runs at a fixed 120 Hz (10 velocity / 8 position iterations); arrows are simulated analytically and ray-cast rather than being rigid bodies.
- Unity/Godot was suggested as the production stack; this prototype uses the spec's web alternative so it runs anywhere.
- Seasons: reaching 70 score advances the season and grants +100 skulls.
