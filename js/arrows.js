/* Projectiles, hit resolution, damage, status effects, apples, particles */
(function (G) {
  const pl = planck, V = pl.Vec2;
  const Game = G.Game;
  const { C, clamp, lerp, rand, pick } = G;

  /* ------------------------------------------------------------ firing */
  Game.fireArrow = function (o) {
    const mini = !!o.mini;
    const a = {
      team: o.team, type: o.type, x: o.x, y: o.y, px: o.x, py: o.y,
      vx: Math.cos(o.phi) * o.speed, vy: Math.sin(o.phi) * o.speed,
      len: mini ? 0.55 : o.type === 'shot' ? 1.15 : 1.0, dmg: o.dmg, owner: o.owner,
      mini, heavy: o.type === 'shot', age: 0, trail: [], alive: true, tick: 0,
    };
    this.arrows.push(a);
    return a;
  };

  Game.playerFire = function (charge) {
    const p = this.player, st = this.stats;
    const type = G.ARROW_BY_ID[p.arrowType] || G.ARROWS[0];
    if (this.state === 'menu') this.startRun();
    const speed = this.arrowSpeed(charge);
    const dmg = st.dmg * type.dmg * lerp(0.55, 1.15, charge);
    p.sta = Math.max(0, p.sta - 4 * type.sta);
    const phi = p.aim ? p.aim.phi : p.aimState.phi;
    const h = p.hand('bow');
    const ox = h.x + Math.cos(phi) * 0.25, oy = h.y + Math.sin(phi) * 0.25;
    if (type.id === 'minigun') {
      for (let i = 0; i < 7; i++) {
        const ph = phi + (i - 3) * 0.022 + rand(-0.012, 0.012);
        this.fireArrow({ team: 'p', type: 'minigun', x: ox, y: oy + (i - 3) * 0.04, phi: ph, speed: speed * rand(0.95, 1.05), dmg, owner: p, mini: true });
      }
    } else this.fireArrow({ team: 'p', type: type.id, x: ox, y: oy, phi, speed, dmg, owner: p });
    G.Audio.release(type.id);
    p.regenDelay = 0.45;
    this.shake = Math.max(this.shake, 0.05 + 0.05 * charge);
    // recoil
    p.b.uTorso.applyLinearImpulse(V(-0.05 * charge, 0), p.b.uTorso.getWorldCenter(), true);
  };

  /* ------------------------------------------------------------ arrow simulation */
  function reflect(vx, vy, nx, ny, k) {
    const d = vx * nx + vy * ny;
    return [(vx - 2 * d * nx) * k, (vy - 2 * d * ny) * k];
  }

  Game.updateArrows = function (dt) {
    const arr = this.arrows;
    for (let i = arr.length - 1; i >= 0; i--) {
      const a = arr[i];
      if (!a.alive) { arr.splice(i, 1); continue; }
      a.px = a.x; a.py = a.y;
      a.vy -= C.ARROW_G * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.age += dt; a.tick++;
      if (a.tick % 2 === 0) { a.trail.push(a.x, a.y); if (a.trail.length > 14) a.trail.splice(0, 2); }
      if (a.y < C.Y_MIN - 8 || a.x > this.viewW + 14 || a.x < -14 || a.age > 9) { a.alive = false; continue; }
      this.arrowTrailFx(a, dt);
      // swept test (previous tip -> current tip) so thin limbs and fast arrows are never tunnelled
      let best = null;
      this.world.rayCast(V(a.px, a.py), V(a.x, a.y), (fixture, point, normal, fraction) => {
        const ud = fixture.getUserData();
        if (!ud) return -1;
        if (ud.kind === 'part') { if (ud.rig.team === a.team) return -1; }
        else if (ud.kind !== 'terrain') return -1;
        best = { fixture, point: { x: point.x, y: point.y }, normal: { x: normal.x, y: normal.y }, ud };
        return fraction;
      });
      if (best && (!a.spent || best.ud.kind === 'terrain')) { this.onArrowHit(a, best); if (!a.alive) continue; }
      if (a.team === 'p') {
        for (const ap of this.apples) {
          if (ap.dead) continue;
          const r = 0.9; // generous trigger radius
          if (G.ptSegDist2(ap.x, ap.y, a.px, a.py, a.x, a.y) <= r * r) this.popApple(ap);
        }
        // arrow vs arrow in mid-air
        for (const b of arr) {
          if (!b.alive || b.team === a.team || b.team === 'x' || a.team === 'x') continue;
          const ta = [a.x - a.vx / Math.hypot(a.vx, a.vy) * a.len, a.y - a.vy / Math.hypot(a.vx, a.vy) * a.len];
          const tb = [b.x - b.vx / Math.hypot(b.vx, b.vy) * b.len, b.y - b.vy / Math.hypot(b.vx, b.vy) * b.len];
          if (G.segSegDist2(a.x, a.y, ta[0], ta[1], b.x, b.y, tb[0], tb[1]) < 0.09 || G.segSegDist2(a.px, a.py, a.x, a.y, b.px, b.py, b.x, b.y) < 0.04) {
            this.arrowClash(a, b);
            if (!a.alive) break;
          }
        }
      }
    }
  };

  Game.arrowClash = function (a, b) {
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    for (let i = 0; i < 9; i++) this.addPart(x, y, rand(-4, 4), rand(-4, 4), rand(0.15, 0.35), rand(0.04, 0.08), pick(['#fff', '#F5B041', '#ddd']), 'spark', 0);
    G.Audio.clang();
    // heavy / non-mini player arrows survive a collision with a weak arrow? keep it simple: both break
    a.alive = false; b.alive = false;
  };

  Game.arrowTrailFx = function (a, dt) {
    if (a.type === 'fire' && a.tick % 2 === 0) this.addPart(a.x - a.vx * 0.01, a.y - a.vy * 0.01, rand(-0.5, 0.5), rand(0.2, 1.2), rand(0.25, 0.5), rand(0.06, 0.12), pick(['#E67E22', '#F5B041', '#E74C3C']), 'ember', -1);
    else if ((a.type === 'minigun' || a.type === 'electro' || a.type === 'poison' || a.type === 'balloon' || a.type === 'shot') && a.tick % 4 === 0)
      this.addPart(a.x, a.y, rand(-0.4, 0.4), rand(-0.4, 0.4), rand(0.25, 0.45), a.type === 'minigun' ? 0.11 : 0.08, a.type === 'poison' ? '#58D68D' : a.type === 'electro' ? '#F4D03F' : '#fff', a.type === 'poison' ? 'dot' : 'star', 0);
  };

  /* ------------------------------------------------------------ hit resolution */
  Game.stick = function (a, body, point, list) {
    const sp = Math.hypot(a.vx, a.vy) || 1, dx = a.vx / sp, dy = a.vy / sp;
    const tip = V(point.x + dx * 0.2, point.y + dy * 0.2);
    const local = body.getLocalPoint(tip);
    const s = { type: a.type, lx: local.x, ly: local.y, la: Math.atan2(dy, dx) - body.getAngle(), len: a.len, body, mini: a.mini, ember: a.type === 'fire' ? 1.8 : 0 };
    list.push(s);
    return s;
  };

  Game.onArrowHit = function (a, hit) {
    const ud = hit.ud, body = hit.fixture.getBody();
    if (ud.kind === 'terrain') {
      this.stick(a, body, hit.point, this.stuckT);
      if (this.stuckT.length > 90) this.stuckT.shift();
      for (let i = 0; i < 5; i++) this.addPart(hit.point.x, hit.point.y, rand(-2, 2) + hit.normal.x * 2, rand(0.5, 3), rand(0.2, 0.4), rand(0.04, 0.08), pick(['#aaa', '#888', '#fff']), 'spark', 3);
      G.Audio.stone();
      a.alive = false;
      return;
    }
    this.hitRig(a, hit, ud.rig, ud.part, body);
  };

  Game.hitRig = function (a, hit, rig, part, body) {
    const sp = Math.hypot(a.vx, a.vy) || 1, dx = a.vx / sp, dy = a.vy / sp;
    const pt = hit.point;
    const dead = !rig.alive;
    const isHead = part === 'head';
    const mult = isHead ? 2.5 : part === 'uTorso' || part === 'pelvis' ? 1 : 0.5;
    let dmg = a.dmg, deflected = false;
    const piece = !dead && (part === 'head' || part === 'uTorso') ? rig.armorOn(part) : null;
    if (piece) {
      const shot = a.type === 'shot';
      const chance = piece.deflect * (shot ? 0.15 : 1) * (a.mini ? 1.5 : 1);
      if (Math.random() < chance) deflected = true;
      piece.dur -= dmg * (shot ? 3.5 : 1) * (deflected ? 0.3 : 1);
      piece.flash = 0.18;
      if (!deflected) dmg *= 1 - piece.absorb;
      if (piece.dur <= 0) this.detachArmor(rig, piece);
    }
    if (rig.isPlayer && rig.invuln > 0) { deflected = true; dmg = 0; }

    if (deflected) {
      // metallic clang + sparks; the arrow bounces away harmlessly
      G.Audio.clang();
      for (let i = 0; i < 10; i++) this.addPart(pt.x, pt.y, rand(-4, 4) + hit.normal.x * 3, rand(-1, 5), rand(0.12, 0.3), rand(0.03, 0.07), pick(['#fff', '#F5B041', '#ffe9a8']), 'spark', 3);
      const n = hit.normal, r = reflect(a.vx, a.vy, n.x, n.y, 0.35);
      a.vx = r[0] + rand(-2, 2); a.vy = r[1] + rand(0, 4); a.x = pt.x + n.x * 0.08; a.y = pt.y + n.y * 0.08;
      a.px = a.x; a.py = a.y; a.team = 'x'; a.dmg = 0; a.spent = true;
      if (piece && piece.worn) body.applyLinearImpulse(V(dx * 0.1, dy * 0.1), V(pt.x, pt.y), true);
      return;
    }

    let hpDmg = dmg * mult;
    // knockback impulse at the point of impact
    const imp = (a.mini ? 0.009 : a.heavy ? 0.12 : 0.022) * sp;
    body.applyLinearImpulse(V(dx * imp, dy * imp), V(pt.x, pt.y), true);
    // embed
    this.stick(a, body, pt, rig.stuck);
    if (rig.stuck.length > C.MAX_STUCK) rig.stuck.shift();
    a.alive = false;
    // gore
    const n = Math.min(30, Math.round(6 + hpDmg * 0.9));
    for (let i = 0; i < n; i++) this.addPart(pt.x, pt.y, dx * rand(1, 6) + rand(-3, 3), dy * rand(0.5, 4) + rand(-1, 4), rand(1.2, 2.6), rand(0.04, 0.09), '#E74C3C', 'blood', 4);
    rig.tint[part] = Math.min(1, rig.tint[part] + (mult < 1 ? 0.55 : 0.4));
    if (dead) { G.Audio.hit(false); return; }
    G.Audio.hit(a.heavy);
    if (isHead && !piece) { G.Audio.headshot(); this.popups.push({ x: pt.x, y: pt.y + 0.6, text: 'HEADSHOT', t: 0.9, max: 0.9 }); }
    if (mult < 1) { // limb hit throws the aim off for a moment
      const arm = part.indexOf('Arm') >= 0;
      rig.flinch = 1;
      rig.aimErr += rand(-1, 1) * (arm ? 0.3 : 0.12);
      rig.aimErr = clamp(rig.aimErr, -0.5, 0.5);
    }
    // status effects
    const t = a.type;
    if (t === 'poison') { rig.poison = { t: 5, dps: 3 + a.dmg * 0.35 }; }
    else if (t === 'fire') { rig.burn = { t: 3.2, dps: 4 + a.dmg * 0.25 }; G.Audio.ignite(); }
    else if (t === 'electro') {
      rig.addStun(1.4); hpDmg += a.dmg * 0.4; G.Audio.zap();
      for (let i = 0; i < 12; i++) this.addPart(pt.x, pt.y, rand(-5, 5), rand(-5, 5), rand(0.1, 0.3), rand(0.03, 0.06), '#F4D03F', 'spark', 0);
    } else if (t === 'balloon') {
      if (rig.balloons.length < 3) { rig.balloons.push({ part, t: 4.5, infl: 0 }); G.Audio.inflate(); }
    } else if (t === 'shot') { rig.addStun(0.6); this.shake = Math.max(this.shake, 0.3); }

    if (rig.isPlayer) {
      this.hitFlash = 1; this.shake = Math.max(this.shake, 0.35);
      G.Audio.hurt();
      if (G.Save.d.settings.haptics && navigator.vibrate) navigator.vibrate(isHead ? 60 : 30);
    }
    this.damage(rig, hpDmg, { part });
  };

  Game.damage = function (rig, amt, info) {
    if (!rig.alive || amt <= 0) return;
    if (rig.isPlayer && rig.invuln > 0) return;
    rig.hp -= amt;
    if (rig.hp <= 0) { rig.hp = 0; this.killRig(rig); }
  };

  Game.detachArmor = function (rig, piece) {
    piece.worn = false;
    const part = piece.part, b = rig.b[part], pos = b.getPosition();
    const body = this.world.createBody({ type: 'dynamic', position: pos, angle: b.getAngle() });
    const dims = piece.kind === 'chest' ? [0.16, 0.26] : [0.22, 0.2];
    body.createFixture({ shape: new pl.Box(dims[0], dims[1]), density: 1.5, friction: 0.5, restitution: 0.35, filterCategoryBits: G.CAT.DEBRIS, filterMaskBits: G.CAT.TERRAIN });
    const v = b.getLinearVelocity();
    body.setLinearVelocity(V(v.x + rand(-3, 3) - rig.dir * 1.5, v.y + rand(2, 6)));
    body.setAngularVelocity(rand(-9, 9));
    this.debris.push({ kind: 'armor', piece: piece.kind, dir: rig.dir, body, dims, life: 6 });
    G.Audio.clang();
    for (let i = 0; i < 10; i++) this.addPart(pos.x, pos.y, rand(-4, 4), rand(0, 5), rand(0.15, 0.35), rand(0.03, 0.06), pick(['#fff', '#aaa']), 'spark', 3);
  };

  /* ------------------------------------------------------------ apples */
  Game.updateApples = function (dt) {
    for (let i = this.apples.length - 1; i >= 0; i--) {
      const a = this.apples[i];
      a.t += dt; a.life -= dt; a.x += a.vx * dt;
      if (a.y0 === 0) a.y0 = a.y;
      a.y = a.y0 + Math.sin(a.t * 1.7 + a.ph) * 1.3;
      if (a.dead || a.life <= 0 || a.x < C.TOWER_X1 + 2) this.apples.splice(i, 1);
    }
    for (let i = this.auras.length - 1; i >= 0; i--) { this.auras[i].t += dt; if (this.auras[i].t > this.auras[i].max) this.auras.splice(i, 1); }
  };

  Game.popApple = function (ap) {
    ap.dead = true;
    const col = { red: '#E74C3C', green: '#58D68D', gold: '#F4D03F' }[ap.type];
    for (let i = 0; i < 22; i++) this.addPart(ap.x, ap.y, rand(-5, 5), rand(-3, 6), rand(0.4, 0.9), rand(0.05, 0.12), i % 4 === 0 ? '#fff' : col, 'dot', 4);
    G.Audio.pop(); G.Audio.pickup();
    const p = this.player;
    if (!p.alive) return;
    if (ap.type === 'red' || ap.type === 'gold') p.hp = this.stats.maxHp;
    if (ap.type === 'green' || ap.type === 'gold') p.sta = this.stats.maxSta;
    this.aura(0, ap.type === 'red' ? 'red' : ap.type === 'green' ? 'blue' : 'both');
    this.popups.push({ x: ap.x, y: ap.y + 0.6, text: ap.type === 'red' ? 'HEALTH' : ap.type === 'green' ? 'STAMINA' : 'FULL RESTORE', t: 1, max: 1 });
  };

  /* ------------------------------------------------------------ particles */
  Game.addPart = function (x, y, vx, vy, life, size, color, kind, g) {
    const P = this.parts;
    if (P.length > 1100) P.shift();
    P.push({ x, y, vx, vy, life, max: life, size, color, kind, g: g || 0, rot: rand(0, 6.28), stuck: false, bounces: 0 });
  };

  Game.updateFx = function (dt) {
    // solid rects for blood collision: tower + live platform blocks
    const solids = [{ x0: C.TOWER_X0, x1: C.TOWER_X1, y0: -20, y1: C.TOWER_TOP }];
    for (const p of this.platforms) if (!p.collapsed) for (const b of p.blocks) { const q = b.getPosition(); solids.push({ x0: q.x - 0.5, x1: q.x + 0.5, y0: q.y - 0.5, y1: q.y + 0.5 }); }
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0 || p.y < C.Y_MIN - 3) { P.splice(i, 1); continue; }
      if (p.stuck) continue;
      p.vy -= p.g * 6 * dt;
      if (p.kind === 'dust' || p.kind === 'ember' || p.kind === 'dot') { p.vx *= 1 - 1.5 * dt; }
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (p.kind === 'blood') {
        let hit = false;
        for (const s of solids) {
          if (nx > s.x0 && nx < s.x1 && ny > s.y0 && ny < s.y1) {
            // push out along the axis of least penetration and bounce
            const dl = nx - s.x0, dr = s.x1 - nx, db = ny - s.y0, dt2 = s.y1 - ny;
            const m = Math.min(dl, dr, db, dt2);
            if (m === dt2) { p.y = s.y1 + 0.01; p.vy = -p.vy * 0.35; p.vx *= 0.7; }
            else if (m === dl) { p.x = s.x0 - 0.01; p.vx = -p.vx * 0.35; }
            else if (m === dr) { p.x = s.x1 + 0.01; p.vx = -p.vx * 0.35; }
            else { p.y = s.y0 - 0.01; p.vy = -p.vy * 0.3; }
            p.bounces++; hit = true;
            if (Math.abs(p.vy) < 1.2 && m === dt2) { p.stuck = true; p.life = Math.min(p.life, rand(1.2, 3)); }
            break;
          }
        }
        if (!hit) { p.x = nx; p.y = ny; }
      } else { p.x = nx; p.y = ny; }
    }
    for (let i = this.popups.length - 1; i >= 0; i--) { const q = this.popups[i]; q.t -= dt; q.y += dt * 1.2; if (q.t <= 0) this.popups.splice(i, 1); }
    // embers from stuck burning arrows
    for (const s of this.stuckT) if (s.ember > 0) { s.ember -= dt; if (Math.random() < dt * 20) { const w = s.body.getWorldPoint(V(s.lx, s.ly)); this.addPart(w.x, w.y, rand(-.3, .3), rand(.5, 1.5), rand(.3, .5), rand(.05, .1), pick(['#E67E22', '#F5B041']), 'ember', -1); } }
    for (const e of this.enemies) for (const s of e.rig.stuck) if (s.ember > 0) { s.ember -= dt; if (Math.random() < dt * 20) { const w = s.body.getWorldPoint(V(s.lx, s.ly)); this.addPart(w.x, w.y, rand(-.3, .3), rand(.5, 1.5), rand(.3, .5), rand(.05, .1), pick(['#E67E22', '#F5B041']), 'ember', -1); } }
  };
})(window.G);
