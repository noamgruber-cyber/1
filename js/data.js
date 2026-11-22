/* Static game data: constants, arrows, upgrades, enemy types, platform layouts */
(function (G) {
  G.C = {
    GRAV: -22,          // ragdoll gravity (m/s^2)
    ARROW_G: 7,         // arrow gravity (low = slow, floaty arcs like the reference)
    DT: 1 / 120,        // fixed physics step
    VIEW_H: 10,         // visible world height in metres (a character is ~25% of the screen)
    Y_MIN: -0.5,        // world y at bottom of the screen
    TOWER_TOP: 2.6,     // top of the player's tower (~31% up the screen)
    TOWER_X0: 2.2,      // tower = 3 columns of stone, floating in from the left edge
    TOWER_X1: 6.1,
    PLAYER_X: 4.15,
    BLOCK: 0.8,         // enemy platform block size
    CONTROL_FRAC: 0.36, // left fraction of the screen that is the CONTROL AREA
    SEASON_GOAL: 70,
    AD_REWARD: 200,
    KILL_SKULLS: 3,
    MAX_STUCK: 25,
  };

  // order = order of the right-hand list in the menu
  G.ARROWS = [
    { id: 'default', name: 'DEFAULT', cost: 0, sta: 1.0, dmg: 1.0, desc: 'Balanced single arrow' },
    { id: 'poison', name: 'POISON', cost: 150, sta: 1.2, dmg: 0.85, desc: 'Poison damage over time' },
    { id: 'electro', name: 'ELECTRO', cost: 300, sta: 1.4, dmg: 0.9, desc: 'Shock + stun, scrambles muscles' },
    { id: 'fire', name: 'FIRE', cost: 400, sta: 1.4, dmg: 0.9, desc: 'Ignites targets (burn DoT)' },
    { id: 'balloon', name: 'BALLOON', cost: 300, sta: 1.3, dmg: 0.4, desc: 'Lifts enemies off their platform' },
    { id: 'shot', name: 'SHOT', cost: 500, sta: 1.8, dmg: 1.5, desc: 'Heavy knockback, shatters armor' },
    { id: 'minigun', name: 'MINIGUN', cost: 750, sta: 1.8, dmg: 0.4, desc: 'Rapid spread of mini arrows' },
  ];
  G.ARROW_BY_ID = Object.fromEntries(G.ARROWS.map((a) => [a.id, a]));

  // permanent upgrades (center column). value(level) = base + inc * level
  G.UPGRADES = [
    { id: 'armor', name: 'ARMOR', cost: 250, inc: 1, base: 0, color: 'red', max: 12, fmt: (v) => String(v) },
    { id: 'health', name: 'HEALTH', cost: 50, inc: 25, base: 100, color: 'red', max: 40, fmt: (v) => String(v) },
    { id: 'lives', name: 'LIVES', cost: 100, inc: 1, base: 0, color: 'red', max: 5, fmt: (v) => '+' + v },
    { id: 'stamina', name: 'STAMINA', cost: 100, inc: 50, base: 100, color: 'blue', max: 40, fmt: (v) => String(v) },
    { id: 'refresh', name: 'STAMINA REFRESH', cost: 100, inc: 0.4, base: 8, color: 'blue', max: 25, fmt: (v) => v.toFixed(1) + '/s' },
    { id: 'pull', name: 'PULL SPEED', cost: 200, inc: 3, base: 9, color: 'orange', max: 10, fmt: (v) => String(v) },
    { id: 'damage', name: 'DAMAGE', cost: 50, inc: 3, base: 12, color: 'orange', max: 40, fmt: (v) => String(v) },
    { id: 'slots', name: 'ARROW SLOTS', cost: 1000, inc: 1, base: 2, color: 'orange', max: 4, fmt: (v) => String(v) },
  ];
  G.UP_BY_ID = Object.fromEntries(G.UPGRADES.map((u) => [u.id, u]));
  G.upValue = (u, lvl) => u.base + u.inc * lvl;
  // costs scale with the level already bought
  G.upCost = (u, lvl) => Math.round((u.cost * (1 + 0.3 * lvl)) / 5) * 5;

  // enemy archetypes. HP is scaled per wave in game.js
  G.ENEMY_TYPES = {
    plain: { hp: 30, armor: [], tint: '#FFFFFF' },
    light: { hp: 50, armor: [{ part: 'head', kind: 'helmetLight', dur: 28, absorb: 0.5, deflect: 0.15 }] },
    heavy: {
      hp: 90,
      armor: [
        { part: 'head', kind: 'helmetHeavy', dur: 90, absorb: 0.8, deflect: 0.45 },
        { part: 'uTorso', kind: 'chest', dur: 60, absorb: 0.5, deflect: 0.2 },
      ],
    },
  };

  // Platform layouts. blocks are in block units relative to the standing block (gx, gy).
  G.LAYOUTS = [
    { id: 'flat', pose: 'stand', blocks: [[-1, 0], [0, 0], [1, 0]] },
    { id: 'kneel', pose: 'kneel', blocks: [[-1, 0], [0, 0], [1, 0]] },
    { id: 'split', pose: 'split', blocks: [[-1.45, 0], [1.45, 0]], standOffset: 0 },
    { id: 'stairs', pose: 'stand', blocks: [[0, 0], [1, -1], [2, -2]] },
    { id: 'gap', pose: 'stand', blocks: [[-1.6, 0], [0, 0], [1.6, 0]] },
  ];

  G.SKINS = [
    { id: 'gold', name: 'GOLD BOW', color: '#F5B041', cost: 0 },
    { id: 'crimson', name: 'CRIMSON BOW', color: '#E74C3C', cost: 120 },
    { id: 'azure', name: 'AZURE BOW', color: '#5DADE2', cost: 120 },
    { id: 'emerald', name: 'EMERALD BOW', color: '#58D68D', cost: 200 },
    { id: 'violet', name: 'VIOLET BOW', color: '#AF7AC5', cost: 200 },
  ];
})(window.G);
