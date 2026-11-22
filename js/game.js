/* Game core: scene, platforms, waves, player controller, enemy AI, main loop */
(function (G) {
  const pl = planck, V = pl.Vec2;
  const { C, clamp, lerp, rand, randi, pick } = G;

  const Game = (G.Game = {
    state: 'menu',        // menu | run | between | dying | over
    paused: false,
    modal: false,
    timeScale: 1,
    shake: 0,
    hitFlash: 0,
    time: 0,
  });

  /* ------------------------------------------------------------ setup */
  Game.init = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.probe = document.getElementById('safe-probe');
    G.Save.load();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.bgInit();
    this.newScene();
    G.Input.init(this);
    let last = performance.now(), acc = 0;
    const frame = (now) => {
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      try {
        if (!this.paused) {
          dt *= this.timeScale;
          acc += dt;
          let n = 0;
          while (acc >= C.DT && n < 6) { this.step(C.DT); acc -= C.DT; n++; }
          if (n === 6) acc = 0;
          this.frame(dt);
        }
        this.render();
      } catch (err) {
        // never let one bad frame kill the loop
        if (!this._errLogged) { this._errLogged = true; console.error('frame error', err); }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  Game.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.dpr = dpr; this.W = W; this.H = H;
    this.S = H / C.VIEW_H;
    let pad = 0;
    if (this.probe) pad = parseFloat(getComputedStyle(this.probe).paddingLeft) || 0;
    this.padL = pad;
    this.viewW = (W - pad) / this.S;       // visible width in metres
    if (this.world && this.state === 'menu') this.layoutMenuScene();
  };
  Game.sx = function (x) { return this.padL + x * this.S; };
  Game.sy = function (y) { return this.H - (y - C.Y_MIN) * this.S; };
  Game.wx = function (px) { return (px - this.padL) / this.S; };
  Game.wy = function (py) { return (this.H - py) / this.S + C.Y_MIN; };

  /* ------------------------------------------------------------ scene */
  Game.newScene = function () {
    // dispose old world completely
    this.world = new pl.World({ gravity: V(0, C.GRAV) });
    this.enemies = []; this.platforms = []; this.arrows = []; this.apples = [];
    this.debris = []; this.stuckT = []; this.auras = []; this.parts = []; this.popups = [];
    this.corpses = []; this.balloonsFx = [];
    this.player = null;
    this.state = 'menu'; this.timeScale = 1; this.shake = 0;
    this.run = { kills: 0, wave: 1, skulls: 0, startSkulls: G.Save.d.skulls };
    this.wave = 1; this.waveTimer = 0; this.spawnDelay = 0;
    this.appleTimer = rand(4, 8);
    this.msgs = [];
    // the stone tower (static terrain)
    const tw = this.world.createBody({ type: 'static' });
    const w = C.TOWER_X1 - C.TOWER_X0, h = C.TOWER_TOP + 14;
    tw.createFixture({
      shape: new pl.Box(w / 2, h / 2, V((C.TOWER_X0 + C.TOWER_X1) / 2, C.TOWER_TOP - h / 2), 0),
      friction: 0.9, filterCategoryBits: G.CAT.TERRAIN, filterMaskBits: 0xffff,
      userData: { kind: 'terrain', tower: true },
    });
    this.tower = tw;
    this.buildPlayer();
    this.layoutMenuScene();
    G.UI && G.UI.onScene && G.UI.onScene();
  };

  Game.applyStats = function () {
    const S = G.Save;
    this.stats = {
      maxHp: S.value('health'), maxSta: S.value('stamina'), regen: S.value('refresh'),
      pullRate: S.value('pull') * 0.08, dmg: S.value('damage'),
      lives: S.value('lives'), armor: S.value('armor'),
    };
  };

  Game.buildPlayer = function () {
    this.applyStats();
    const st = this.stats, lvl = st.armor;
    const armor = [{ part: 'head', kind: 'helmetHeavy', dur: 30 + 25 * lvl, absorb: Math.min(0.85, 0.3 + 0.07 * lvl), deflect: Math.min(0.5, 0.05 * lvl) }];
    if (lvl >= 2) armor.push({ part: 'uTorso', kind: 'chest', dur: 40 + 30 * (lvl - 2), absorb: Math.min(0.75, 0.25 + 0.06 * lvl), deflect: Math.min(0.4, 0.04 * lvl) });
    const skin = G.SKINS.find((s) => s.id === G.Save.d.skin) || G.SKINS[0];
    if (this.player) this.player.destroy();
    this.player = new G.Rig(this, { team: 'p', isPlayer: true, dir: 1, pose: 'stand', x: C.PLAYER_X, surfaceY: C.TOWER_TOP, hp: st.maxHp, armor, bowColor: skin.color });
    const p = this.player;
    p.sta = st.maxSta; p.lives = st.lives; p.regenDelay = 0;
    p.aimState = { active: false, pid: null, ax: 0, ay: 0, x: 0, y: 0, phi: 0.35, charge: 0, drawing: false };
    p.jumpCd = 0;
    this.slot = 0;
    this.syncSlots();
  };

  Game.rebuildPlayer = function () { this.buildPlayer(); };

  Game.syncSlots = function () {
    this.slots = G.Save.activeSlots();
    if (this.slot >= this.slots.length) this.slot = 0;
    this.player.arrowType = this.slots[this.slot];
  };
  Game.selectSlot = function (i) {
    if (i < 0 || i >= this.slots.length) return;
    this.slot = i; this.player.arrowType = this.slots[i]; G.Audio.click();
  };

  // menu: one target dummy enemy next to the menu column
  Game.layoutMenuScene = function () {
    // remove existing menu enemies and recreate at the right place
    for (const e of this.enemies) this.removeEnemy(e);
    this.enemies.length = 0;
    const L = G.LAYOUTS[0];
    this.spawnEnemy('plain', L, this.viewW * 0.69, 5.2, { frozen: true, grace: 0 });
  };

  /* ------------------------------------------------------------ platforms & enemies */
  Game.makePlatform = function (layout, ax, ay) {
    const blocks = [];
    for (const [gx, gy] of layout.blocks) {
      const b = this.world.createBody({ type: 'static', position: V(ax + gx, ay - 0.5 + gy) });
      b.createFixture({
        shape: new pl.Box(0.5, 0.5), density: 2, friction: 0.9, restitution: 0.1,
        filterCategoryBits: G.CAT.TERRAIN, filterMaskBits: 0xffff,
        userData: { kind: 'terrain', block: true },
      });
      blocks.push(b);
    }
    const p = { blocks, collapsed: false, alpha: 0, layout };
    this.platforms.push(p);
    return p;
  };

  Game.collapsePlatform = function (p) {
    if (p.collapsed) return;
    p.collapsed = true;
    for (const b of p.blocks) {
      b.setType('dynamic'); b.setAwake(true);
      b.setLinearVelocity(V(rand(-2, 2), rand(0.5, 3)));
      b.setAngularVelocity(rand(-3, 3));
      b.setLinearDamping(0.02);
    }
    G.Audio.rumble();
    this.shake = Math.max(this.shake, 0.25);
    for (const b of p.blocks) { const q = b.getPosition(); for (let i = 0; i < 6; i++) this.addPart(q.x + rand(-.5, .5), q.y + rand(-.4, .4), rand(-1.5, 1.5), rand(0, 2), rand(0.5, 1.1), rand(0.05, 0.12), '#8a8a8a', 'dust', 2); }
  };

  Game.removeEnemy = function (e) {
    if (e.platform) {
      const set = new Set(e.platform.blocks);
      this.stuckT = this.stuckT.filter((s) => !set.has(s.body));
      for (const b of e.platform.blocks) this.world.destroyBody(b);
      e.platform.blocks.length = 0; this.platforms = this.platforms.filter((p) => p !== e.platform);
    }
    e.rig.destroy();
  };

  Game.spawnEnemy = function (type, layout, ax, ay, o) {
    o = o || {};
    const T = G.ENEMY_TYPES[type], ws = this.waveSpec(this.wave);
    const platform = this.makePlatform(layout, ax, ay);
    platform.alpha = 0;
    const hp = Math.round(T.hp * (o.frozen ? 1 : ws.hpScale));
    const rig = new G.Rig(this, {
      team: 'e', dir: -1, pose: layout.pose, x: ax + (layout.standOffset || 0), surfaceY: ay, hp,
      armor: T.armor.map((a) => Object.assign({}, a, { dur: Math.round(a.dur * (o.frozen ? 1 : ws.hpScale)) })),
      alpha: 0,
    });
    const e = {
      rig, platform, type, state: 'idle', timer: o.grace !== undefined ? o.grace : rand(1.2, 3), frozen: !!o.frozen,
      drawT: 0, drawDur: 1, speed: 30, phi: Math.PI, dead: false, spawnT: 0,
      aimTarget: 'torso',
    };
    rig.enemy = e; this.enemies.push(e);
    return e;
  };

  Game.waveSpec = function (n) {
    return {
      count: Math.min(6, 1 + Math.floor(n / 2)),
      lightP: clamp((n - 1) * 0.12, 0, 0.5), heavyP: clamp((n - 3) * 0.07, 0, 0.45),
      err: Math.max(0.8, 7 - 0.45 * n) * Math.PI / 180,
      reload: [Math.max(1.5, 3.6 - 0.18 * n), Math.max(2.4, 5.2 - 0.25 * n)],
      speed: [26 + 0.4 * n, 32 + 0.5 * n],
      hpScale: 1 + 0.05 * (n - 1),
      dmg: 10 + 1.1 * n,
      drawDur: Math.max(0.7, 1.15 - 0.03 * n),
    };
  };

  Game.spawnWave = function (n) {
    const ws = this.waveSpec(n);
    const spots = [];
    const x0 = Math.max(C.TOWER_X1 + 3, this.viewW * 0.4) + 1.6, x1 = this.viewW * 0.9 - 1.6;
    for (let i = 0; i < ws.count; i++) {
      let best = null;
      for (let tries = 0; tries < 40; tries++) {
        const ax = rand(x0, Math.max(x0 + 1, x1)), ay = rand(4.3, 10.2);
        if (spots.every((s) => Math.abs(s.ax - ax) > 4.6 || Math.abs(s.ay - ay) > 3.4)) { best = { ax, ay }; break; }
      }
      if (!best) best = { ax: rand(x0, x1), ay: rand(4.3, 10.2) };
      spots.push(best);
    }
    spots.forEach((s, i) => {
      const r = Math.random();
      const type = r < ws.heavyP ? 'heavy' : r < ws.heavyP + ws.lightP ? 'light' : 'plain';
      let layout = pick(G.LAYOUTS);
      if (layout.id === 'stairs' && s.ay < 6.2) layout = G.LAYOUTS[0];
      this.spawnEnemy(type, layout, s.ax, s.ay, { grace: rand(1.4, 3.2) + i * 0.6 });
    });
    this.banner('WAVE ' + n);
    G.Audio.wave();
  };

  Game.banner = function (text) { this.msgs.push({ text, t: 2.2, max: 2.2 }); };

  /* ------------------------------------------------------------ run flow */
  Game.startRun = function () {
    if (this.state !== 'menu') return;
    this.state = 'run';
    this.run.startSkulls = G.Save.d.skulls;
    for (const e of this.enemies) { e.frozen = false; e.timer = rand(1.8, 3); }
    G.UI.onRunStart();
    this.banner('WAVE 1');
  };

  Game.endRun = function () {
    const S = G.Save.d;
    S.bestWave = Math.max(S.bestWave, this.run.wave);
    if (this.run.kills > 0) {
      S.leaders.push({ kills: this.run.kills, wave: this.run.wave, t: Date.now() });
      S.leaders.sort((a, b) => b.kills - a.kills || b.wave - a.wave);
      S.leaders.length = Math.min(S.leaders.length, 10);
    }
    G.Save.save();
    G.UI.onGameOver(this.run);
  };

  Game.toMenu = function () {
    this.newScene();
    G.UI.onMenu();
  };

  Game.addSkulls = function (n, x, y) {
    G.Save.d.skulls += n; this.run.skulls += n;
    if (x !== undefined) this.popups.push({ x, y, text: '+' + n, t: 1.1, max: 1.1, skull: true });
    G.UI.updateHud();
  };

  Game.killRig = function (rig, byFall) {
    if (!rig.alive) return;
    if (rig.isPlayer) return this.playerDied();
    const e = rig.enemy;
    rig.die(); e.dead = true;
    this.collapsePlatform(e.platform);
    const p = rig.pos();
    G.Audio.kill();
    this.run.kills++;
    const S = G.Save.d;
    S.score++;
    if (S.score >= C.SEASON_GOAL) {
      S.season++; S.score = 0; S.skulls += 100;
      this.banner('SEASON ' + (S.season - 1) + ' COMPLETE +100');
    }
    this.addSkulls(C.KILL_SKULLS, p.x, p.y + 1.2);
    G.UI.updateHud();
    this.timeScale = 0.35; this.slowT = 0.12;
    for (const b of rig.balloons) this.popBalloon(rig, b);
    rig.balloons.length = 0;
    this.corpses.push({ rig, t: 9, e });
    this.enemies = this.enemies.filter((x) => x !== e);
    if (this.state === 'menu') this.startRun();
  };

  Game.playerDied = function () {
    const p = this.player;
    if (p.lives > 0 && this.state !== 'dying') {
      p.lives--; p.hp = this.stats.maxHp; p.sta = this.stats.maxSta; p.invuln = 2;
      this.arrows = this.arrows.filter((a) => a.team !== 'e');
      this.aura(0, 'both'); this.banner('REVIVED');
      G.Audio.revive();
      return;
    }
    if (this.state === 'dying' || this.state === 'over') return;
    this.state = 'dying'; this.dyingT = 2.2; this.timeScale = 0.4;
    p.die(); p.aimState.active = false;
    G.Audio.die();
    this.shake = 0.6;
  };

  /* ------------------------------------------------------------ player controller */
  Game.jump = function () {
    const p = this.player;
    if (!p.alive || p.jumpCd > 0 || p.sta < 5) { if (p.alive && p.sta < 5) G.Audio.deny(); return; }
    p.sta -= 5; p.jumpCd = 0.55; p.regenDelay = 0.4;
    for (const n of G.RIG.PARTS) { const b = p.b[n], v = b.getLinearVelocity(); b.setLinearVelocity(V(v.x, Math.max(v.y, 10.5))); }
    G.Audio.jump();
    const q = p.pos();
    for (let i = 0; i < 6; i++) this.addPart(q.x + rand(-.4, .4), C.TOWER_TOP + 0.05, rand(-1.5, 1.5), rand(0.2, 1.4), rand(0.3, 0.6), rand(0.04, 0.09), '#9a9a9a', 'dust', 1);
  };

  Game.updatePlayer = function (dt) {
    const p = this.player, a = p.aimState, st = this.stats;
    if (!p.alive) return;
    p.jumpCd = Math.max(0, p.jumpCd - dt);
    const type = G.ARROW_BY_ID[p.arrowType] || G.ARROWS[0];
    if (a.active) {
      if (p.sta > 0.5) {
        if (!a.drawing) { a.drawing = true; G.Audio.draw(); }
        const before = a.charge;
        a.charge = Math.min(1, a.charge + st.pullRate * dt);
        p.sta -= (before < 1 ? 10 : 3) * type.sta * dt;
        p.regenDelay = 0.5;
      } else this.releaseAim();   // out of stamina: forced release with whatever charge exists
    } else {
      a.charge = 0;
    }
    p.sta = clamp(p.sta, 0, st.maxSta);
    if (!a.active) {
      p.regenDelay -= dt;
      if (p.regenDelay <= 0) p.sta = Math.min(st.maxSta, p.sta + st.regen * dt);
    }
    if (a.active) p.setAim(a.phi, a.charge);
    else p.setAim(a.phi * 0.5 + 0.1, 0);
    p.aim.phi += p.aimErr;
  };

  Game.beginAim = function (pid, x, y) {
    const a = this.player.aimState;
    if (!this.player.alive || this.modal) return;
    if (this.player.sta < 6) { G.Audio.deny(); }
    a.active = true; a.pid = pid; a.ax = x; a.ay = y; a.x = x; a.y = y; a.charge = 0; a.drawing = false;
    a.moved = false;
  };
  Game.moveAim = function (x, y) {
    const a = this.player.aimState; a.x = x; a.y = y;
    const dx = a.ax - x, dy = y - a.ay;
    if (Math.hypot(dx, dy) > 10) {
      a.moved = true;
      const sens = G.Save.d.settings.sens;
      a.phi = clamp(Math.atan2(dy * sens, dx), -0.55, 1.5);
    }
  };
  Game.releaseAim = function () {
    const p = this.player, a = p.aimState;
    if (!a.active) return;
    a.active = false;
    if (a.charge >= 0.12 && p.alive) this.playerFire(a.charge);
    a.charge = 0; a.drawing = false;
  };

  /* ------------------------------------------------------------ enemy AI */
  // ballistic solver: launch angle (world, enemy faces left) to hit target from nock point at speed v
  Game.solveAngle = function (sx, sy, tx, ty, v) {
    const g = C.ARROW_G, dx = Math.abs(tx - sx), dy = ty - sy;
    const disc = v * v * v * v - g * (g * dx * dx + 2 * dy * v * v);
    let th;
    if (disc < 0) th = Math.PI / 4;
    else th = Math.atan((v * v - Math.sqrt(disc)) / (g * dx));
    return tx < sx ? Math.PI - th : th;
  };

  Game.updateEnemy = function (e, dt) {
    const rig = e.rig, ws = this.waveSpec(this.state === 'menu' ? 1 : this.wave);
    if (e.spawnT < 0.5) { e.spawnT += dt; rig.alpha = platformAlpha(e.spawnT / 0.5); e.platform.alpha = rig.alpha; }
    if (!rig.alive) return;
    // fell into the abyss (balloon popped, knocked off...) counts as a kill
    if (rig.pos().y < -3) { this.killRig(rig, true); return; }
    const player = this.player;
    const target = player.alive ? player.pos() : { x: C.PLAYER_X, y: C.TOWER_TOP + 1.2 };
    const disabled = rig.stun > 0 || rig.lostFooting || !rig.alive;
    const nock = rig.hand('bow');
    if (e.frozen || disabled || !player.alive || this.state === 'between') {
      if (e.state === 'draw') { e.state = 'idle'; e.timer = 0.8; }
      if (!disabled) { rig.setAim(this.solveAngle(nock.x, nock.y, target.x, target.y, 30) - 0.0, 0); } else rig.clearAim();
      return;
    }
    if (e.state === 'idle') {
      rig.setAim(this.solveAngle(nock.x, nock.y, target.x, target.y, 30), 0);
      e.timer -= dt;
      if (e.timer <= 0 && e.spawnT >= 0.5) {
        e.state = 'draw'; e.drawT = 0; e.drawDur = ws.drawDur * rand(0.9, 1.2);
        e.speed = rand(ws.speed[0], ws.speed[1]);
        e.aimTarget = Math.random() < 0.3 ? 'head' : 'torso';
      }
    } else if (e.state === 'draw') {
      e.drawT += dt;
      const tpos = e.aimTarget === 'head' ? player.head.getPosition() : player.torso.getPosition();
      e.phi = this.solveAngle(nock.x, nock.y, tpos.x, tpos.y, e.speed);
      rig.setAim(e.phi, clamp(e.drawT / e.drawDur, 0, 1));
      rig.aim.phi += rig.aimErr;
      if (e.drawT >= e.drawDur) {
        const phi = e.phi + G.gauss() * ws.err + rig.aimErr;
        const h = rig.hand('bow');
        this.fireArrow({ team: 'e', type: 'default', x: h.x + Math.cos(phi) * 0.2, y: h.y + Math.sin(phi) * 0.2, phi, speed: e.speed, dmg: ws.dmg, owner: rig });
        G.Audio.enemyRelease();
        e.state = 'idle'; e.timer = rand(ws.reload[0], ws.reload[1]);
      }
    }
  };
  function platformAlpha(t) { return clamp(t, 0, 1); }

  /* ------------------------------------------------------------ waves / flow update */
  Game.updateFlow = function (dt) {
    if (this.state === 'run') {
      if (this.enemies.length === 0 && this.spawnDelay <= 0) {
        this.wave++; this.run.wave = this.wave;
        this.spawnDelay = 2.4; this.state = 'between';
        G.UI.updateHud();
      }
    } else if (this.state === 'between') {
      this.spawnDelay -= dt;
      if (this.spawnDelay <= 0) { this.state = 'run'; this.spawnWave(this.wave); this.spawnDelay = 0; }
    } else if (this.state === 'dying') {
      this.dyingT -= dt;
      if (this.dyingT <= 0) { this.state = 'over'; this.timeScale = 1; this.endRun(); }
    }
    // apples drift through the central airspace
    if (this.state === 'run' || this.state === 'between' || this.state === 'menu') {
      this.appleTimer -= dt;
      if (this.appleTimer <= 0 && this.apples.length < 2) {
        this.appleTimer = rand(6, 11);
        const r = Math.random();
        const type = r < 0.45 ? 'red' : r < 0.85 ? 'green' : 'gold';
        const x = rand(C.TOWER_X1 + 4, this.viewW * 0.55);
        this.apples.push({ x, y: rand(6.5, 12), y0: 0, type, t: 0, ph: rand(0, 6.28), vx: rand(-0.5, 0.3), life: 16 });
      }
    }
  };

  /* ------------------------------------------------------------ fixed step + per-frame */
  Game.step = function (dt) {
    this.time += dt;
    this.player.update(dt);
    for (const e of this.enemies) e.rig.update(dt);
    for (const c of this.corpses) c.rig.update(dt);
    this.updateArrows(dt);
    this.world.step(dt, 10, 8);
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0 && this.state !== 'dying') this.timeScale = 1; }
  };

  // variable-rate update (logic that doesn't need the fixed step)
  Game.frame = function (dt) {
    const rdt = Math.min(dt, 0.05);
    this.updatePlayer(rdt);
    for (const e of this.enemies.slice()) this.updateEnemy(e, rdt);
    this.updateFlow(rdt);
    this.updateStatus(rdt);
    this.updateApples(rdt);
    this.updateFx(rdt);
    this.shake = Math.max(0, this.shake - rdt * 1.5);
    this.hitFlash = Math.max(0, this.hitFlash - rdt * 2.2);
    this.player.update2 && this.player.update2(rdt);
    // housekeeping: corpses, falling blocks, debris
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i]; c.t -= rdt;
      if (c.t <= 0 || c.rig.pos().y < -9) { this.removeEnemy(c.e); this.corpses.splice(i, 1); }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.life -= rdt;
      if (d.life <= 0 || d.body.getPosition().y < -9) { this.world.destroyBody(d.body); this.debris.splice(i, 1); }
    }
    for (const m of this.msgs) m.t -= rdt;
    this.msgs = this.msgs.filter((m) => m.t > 0);
    this.saveT = (this.saveT || 0) + rdt;
    if (this.saveT > 4) { this.saveT = 0; G.Save.save(); }
  };

  // DoT / status ticks
  Game.updateStatus = function (dt) {
    const rigs = [this.player, ...this.enemies.map((e) => e.rig)];
    for (const r of rigs) {
      if (!r.alive) continue;
      if (r.poison) {
        r.poison.t -= dt; this.damage(r, r.poison.dps * dt, { dot: true });
        if (Math.random() < dt * 14) { const p = r.torso.getPosition(); this.addPart(p.x + rand(-.2, .2), p.y + rand(-.3, .5), rand(-.3, .3), rand(.5, 1.4), rand(.4, .8), rand(.04, .08), '#58D68D', 'dot', -1); }
        if (r.poison.t <= 0) r.poison = null;
      }
      if (r.burn) {
        r.burn.t -= dt; this.damage(r, r.burn.dps * dt, { dot: true });
        for (let i = 0; i < 2; i++) if (Math.random() < dt * 40) { const n = pick(G.RIG.PARTS), p = r.b[n].getPosition(); this.addPart(p.x + rand(-.1, .1), p.y + rand(-.1, .1), rand(-.4, .4), rand(1, 2.4), rand(.3, .6), rand(.05, .1), pick(['#E67E22', '#F5B041', '#E74C3C']), 'ember', -1); }
        if (r.burn.t <= 0) r.burn = null;
      }
      if (r.isPlayer && r.alive && !r.invuln && r.hp <= 0) this.killRig(r);
    }
  };

  Game.popBalloon = function (rig, bl) {
    const b = rig.b[bl.part]; if (!b) return;
    const p = b.getWorldPoint(V(0, 0.9));
    G.Audio.pop();
    for (let i = 0; i < 14; i++) this.addPart(p.x, p.y, rand(-4, 4), rand(-3, 4), rand(.3, .7), rand(.05, .11), '#E67E22', 'dot', 4);
  };

  Game.aura = function (t, kind) { this.auras.push({ t: 0, max: 1.3, kind }); };
})(window.G);
