/* All canvas drawing: background, stone, ragdolls, arrows, particles, diegetic tower HUD */
(function (G) {
  const Game = G.Game;
  const { C, clamp, mix } = G;
  const RED = '#E74C3C', WHITE = '#FFFFFF', STONE = '#6B6B6B';

  /* ------------------------------------------------------------ arrow sprite (shared with menu previews) */
  // tip at (0,0), pointing +x, tail at (-len,0). Drawn in whatever coordinate system the caller set up.
  G.drawArrowShape = function (ctx, type, len) {
    len = len || 1;
    const col = {
      default: { head: '#FFFFFF', fl: '#FFFFFF' }, poison: { head: '#2ECC71', fl: '#2ECC71' },
      electro: { head: '#FFF3B0', fl: '#F4D03F' }, fire: { head: '#E67E22', fl: '#E67E22' },
      balloon: { head: '#9A9A9A', fl: '#BDBDBD' }, shot: { head: '#F1C40F', fl: '#E74C3C' },
      minigun: { head: '#FFFFFF', fl: '#E67E22' },
    }[type] || { head: '#fff', fl: '#fff' };
    const s = type === 'minigun' ? 0.7 : 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.045 * s;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-0.05, 0); ctx.stroke();
    // fletching
    ctx.fillStyle = col.fl; ctx.strokeStyle = col.fl; ctx.lineWidth = 0.03 * s;
    if (type === 'fire') {
      for (const k of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-len + 0.02, 0);
        ctx.quadraticCurveTo(-len - 0.12 * s, 0.05 * k, -len - 0.2 * s, 0.14 * k * s);
        ctx.quadraticCurveTo(-len - 0.05 * s, 0.1 * k * s, -len + 0.2 * s, 0.01 * k);
        ctx.closePath(); ctx.fillStyle = k > 0 ? '#E67E22' : '#F5B041'; ctx.fill();
      }
    } else {
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-len + 0.0, 0); ctx.lineTo(-len - 0.1 * s, 0.1 * k * s); ctx.lineTo(-len + 0.12 * s, 0.1 * k * s); ctx.lineTo(-len + 0.24 * s, 0);
        ctx.closePath(); ctx.fill();
      }
    }
    // head
    ctx.fillStyle = col.head; ctx.strokeStyle = col.head;
    if (type === 'electro') {
      ctx.lineWidth = 0.05; ctx.beginPath();
      ctx.moveTo(-0.22, 0); ctx.lineTo(-0.12, 0.07); ctx.lineTo(-0.1, 0.01); ctx.lineTo(0.0, 0.08);
      ctx.moveTo(-0.22, 0); ctx.lineTo(-0.12, -0.07); ctx.lineTo(-0.1, -0.01); ctx.lineTo(0.0, -0.08);
      ctx.moveTo(-0.22, 0); ctx.lineTo(0.06, 0); ctx.stroke();
    } else if (type === 'balloon') {
      G.rrect(ctx, -0.32, -0.065, 0.32, 0.13, 0.065); ctx.fill();
      ctx.fillStyle = '#E67E22'; G.rrect(ctx, -0.12, -0.065, 0.12, 0.13, 0.065); ctx.fill();
    } else if (type === 'shot') {
      ctx.beginPath(); ctx.moveTo(0.06, 0); ctx.lineTo(-0.28, 0.13); ctx.lineTo(-0.2, 0); ctx.lineTo(-0.28, -0.13); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(0.02, 0); ctx.lineTo(-0.17 * s, 0.065 * s); ctx.lineTo(-0.17 * s, -0.065 * s); ctx.closePath(); ctx.fill();
    }
  };

  G.drawSkull = function (ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = color || '#fff';
    ctx.beginPath(); ctx.arc(0, -0.1, 0.5, 0, Math.PI * 2); ctx.fill();
    G.rrect(ctx, -0.28, 0.2, 0.56, 0.4, 0.1); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-0.2, -0.08, 0.14, 0, 6.3); ctx.arc(0.2, -0.08, 0.14, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0.08); ctx.lineTo(-0.07, 0.22); ctx.lineTo(0.07, 0.22); ctx.fill();
    ctx.restore();
  };

  G.arrowPreview = function (canvas, type) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const len = type === 'minigun' ? 0.55 : 1;
    c.save(); c.translate(w * 0.5 + (len * w * 0.17), h / 2);
    const sc = w * 0.34; c.scale(sc, sc);
    if (type === 'minigun') {
      for (const o of [-0.17, 0, 0.17]) { c.save(); c.translate(0, o); c.rotate(o * 0.3); G.drawArrowShape(c, 'minigun', 0.8); c.restore(); }
    } else G.drawArrowShape(c, type, len);
    c.restore();
  };

  /* ------------------------------------------------------------ background */
  Game.bgInit = function () {
    this.bgSquares = []; this.snow = [];
    for (let i = 0; i < 12; i++) this.bgSquares.push({ x: Math.random(), y: Math.random(), s: 60 + Math.random() * 160, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.12, d: 0.2 + Math.random() * 0.6 });
    for (let i = 0; i < 80; i++) this.snow.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, vy: 6 + Math.random() * 14, vx: -4 - Math.random() * 6, a: 0.2 + Math.random() * 0.5 });
  };

  Game.drawBackground = function (ctx) {
    const W = this.W, H = this.H, t = this.time;
    ctx.fillStyle = '#333333'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(58,58,58,0)'); g.addColorStop(1, 'rgba(20,20,20,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const q of this.bgSquares) {
      const x = ((q.x * W * 1.4 - t * 6 * q.d) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2, y = q.y * H;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q.r + t * q.vr);
      ctx.fillStyle = 'rgba(66,66,66,' + (0.35 + q.d * 0.3) + ')';
      ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
      ctx.restore();
    }
    for (const s of this.snow) {
      const x = ((s.x * W + s.vx * t) % W + W) % W, y = ((s.y * H + s.vy * t) % H + H) % H;
      ctx.fillStyle = 'rgba(255,255,255,' + s.a * 0.6 + ')';
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.3); ctx.fill();
    }
  };

  /* ------------------------------------------------------------ stone */
  function block(ctx, w, h, alpha, tone) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tone || STONE; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(-w / 2, h / 2 - 0.06, w, 0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-w / 2, -h / 2, w, 0.05); ctx.fillRect(w / 2 - 0.04, -h / 2, 0.04, h);
    ctx.globalAlpha = 1;
  }
  G.HUD_FONT = 'Rye, "Rockwell Extra Bold", Rockwell, Georgia, serif';

  // the tower: three columns of square stones with merlons on the outer corners
  Game.drawTower = function (ctx) {
    const x0 = C.TOWER_X0, x1 = C.TOWER_X1, top = C.TOWER_TOP, w = (x1 - x0) / 3;
    for (let y = top; y > C.Y_MIN - w; y -= w) {
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(x0 + w * (i + 0.5), y - w / 2);
        block(ctx, w - 0.03, w - 0.03, 1, '#6E6E6E'); ctx.restore();
      }
    }
    ctx.fillStyle = '#6E6E6E';
    ctx.fillRect(x0, top - 0.02, 0.42, 0.36); ctx.fillRect(x1 - 0.42, top - 0.02, 0.42, 0.36);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x0, top + 0.28, 0.42, 0.06); ctx.fillRect(x1 - 0.42, top + 0.28, 0.42, 0.06);
  };

  Game.drawPlatforms = function (ctx) {
    const B = C.BLOCK;
    for (const p of this.platforms) {
      for (const b of p.blocks) {
        const q = b.getPosition();
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(b.getAngle());
        block(ctx, B - 0.02, B - 0.02, p.alpha, '#666666');
        ctx.restore();
      }
    }
  };

  /* ------------------------------------------------------------ ragdolls */
  function bodyFrame(ctx, b, fn) {
    const p = b.getPosition();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); fn(); ctx.restore();
  }

  Game.drawRig = function (ctx, rig) {
    if (!rig.b.head) return;
    const D = G.RIG.DIM, b = rig.b;
    ctx.globalAlpha = rig.alpha;
    const col = (n, back) => mix(back ? '#C9C9C9' : '#F2F2F2', RED, rig.tint[n]);
    const capsule = (n, back) => bodyFrame(ctx, b[n], () => {
      const d = D[n]; ctx.fillStyle = col(n, back); G.rrect(ctx, -d.hw, -d.hh - d.hw * 0.4, d.hw * 2, d.hh * 2 + d.hw * 0.8, d.hw); ctx.fill();
    });
    // back limbs, core, front limbs (painter's order)
    capsule('uArmR', true); capsule('lArmR', true); capsule('uLegR', true); capsule('lLegR', true);
    capsule('uLegL'); capsule('lLegL');
    capsule('pelvis'); capsule('uTorso');
    bodyFrame(ctx, b.head, () => { ctx.fillStyle = col('head'); ctx.beginPath(); ctx.arc(0, 0, D.head.r, 0, 6.3); ctx.fill(); });
    for (const a of rig.armor) if (a.worn) this.drawArmor(ctx, rig, a);
    this.drawBow(ctx, rig);
    capsule('uArmL'); capsule('lArmL');
    for (const s of rig.stuck) this.drawStuck(ctx, s);
    for (const bl of rig.balloons) this.drawBalloon(ctx, rig, bl);
    ctx.globalAlpha = 1;
    // floating health bar tracks the head's position and tilt
    if (rig.alive && !rig.isPlayer) {
      bodyFrame(ctx, b.head, () => {
        const w = 0.75, h = 0.14, y = D.head.r + 0.42;
        ctx.fillStyle = 'rgba(120,20,20,0.55)'; ctx.fillRect(-w / 2, y, w, h);
        ctx.fillStyle = '#E2323C'; ctx.fillRect(-w / 2, y, w * clamp(rig.hp / rig.maxHp, 0, 1), h);
        if (rig.poison) { ctx.fillStyle = '#58D68D'; ctx.fillRect(-w / 2, y - 0.07, w * clamp(rig.poison.t / 5, 0, 1), 0.04); }
        if (rig.burn) { ctx.fillStyle = '#E67E22'; ctx.fillRect(-w / 2, y - 0.07, w * clamp(rig.burn.t / 3.2, 0, 1), 0.04); }
      });
    }
    if (rig.stun > 0 && rig.alive) {
      const p = rig.head.getPosition();
      ctx.strokeStyle = '#F4D03F'; ctx.lineWidth = 0.06; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = this.time * 8 + i * 2.1; ctx.moveTo(p.x + Math.cos(a) * 0.4, p.y + 0.45 + Math.sin(a) * 0.15); ctx.lineTo(p.x + Math.cos(a + 0.5) * 0.52, p.y + 0.45 + Math.sin(a + 0.5) * 0.22); }
      ctx.stroke();
    }
  };

  // great helm (player: eye slits + breathing holes, heavy enemy: crusader cross), kettle hat, plated chest
  Game.drawArmor = function (ctx, rig, a) {
    const flash = a.flash > 0, body = rig.b[a.part];
    const steel = flash ? '#FFFFFF' : '#8C8C8C', light = flash ? '#FFFFFF' : '#A6A6A6', dark = '#3A3A3A';
    bodyFrame(ctx, body, () => {
      ctx.scale(rig.dir, 1);
      if (a.kind === 'helmetHeavy') {
        ctx.fillStyle = steel; G.rrect(ctx, -0.3, -0.27, 0.6, 0.6, 0.2); ctx.fill();
        ctx.fillStyle = light; G.rrect(ctx, -0.3, 0.08, 0.6, 0.25, 0.16); ctx.fill();     // domed top
        ctx.fillStyle = dark; G.rrect(ctx, -0.04, -0.02, 0.33, 0.1, 0.04); ctx.fill();    // visor band
        if (rig.isPlayer) {
          ctx.fillStyle = '#EDEDED'; ctx.fillRect(0.03, 0.02, 0.1, 0.025); ctx.fillRect(0.17, 0.02, 0.1, 0.025);
          ctx.fillStyle = dark; for (const [hx, hy] of [[0.06, -0.12], [0.13, -0.12], [0.2, -0.12], [0.09, -0.19], [0.16, -0.19]]) { ctx.beginPath(); ctx.arc(hx, hy, 0.025, 0, 6.3); ctx.fill(); }
        } else {
          ctx.fillStyle = flash ? '#fff' : '#F39C12';
          ctx.fillRect(0.1, -0.26, 0.08, 0.5); ctx.fillRect(-0.08, -0.01, 0.38, 0.08);   // crusader cross
        }
      } else if (a.kind === 'helmetLight') {
        ctx.fillStyle = steel;
        ctx.beginPath(); ctx.moveTo(-0.33, 0.03); ctx.quadraticCurveTo(-0.24, 0.42, 0.02, 0.5); ctx.quadraticCurveTo(0.26, 0.42, 0.33, 0.03); ctx.closePath(); ctx.fill();
        ctx.fillStyle = light; ctx.fillRect(-0.36, 0.0, 0.72, 0.07);
        ctx.fillStyle = dark; ctx.fillRect(-0.36, -0.02, 0.72, 0.025);
      } else if (a.kind === 'chest') {
        // segmented plates (abs) like the reference armor upgrade
        ctx.fillStyle = flash ? '#fff' : '#D2D2D2';
        G.rrect(ctx, -0.27, 0.06, 0.54, 0.26, 0.12); ctx.fill();
        for (let r = 0; r < 3; r++) for (const sx of [-0.12, 0.12]) { G.rrect(ctx, sx - 0.11, -0.04 - r * 0.12, 0.22, 0.1, 0.05); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.015;
        for (let r = 0; r < 3; r++) for (const sx of [-0.12, 0.12]) { G.rrect(ctx, sx - 0.11, -0.04 - r * 0.12, 0.22, 0.1, 0.05); ctx.stroke(); }
      }
    });
  };

  // thick orange recurve; string pulled to the draw hand
  Game.drawBow = function (ctx, rig) {
    if (!rig.alive || !rig.b.lArmL) return;
    const s = rig.shoulder(), h = rig.hand('bow'), dh = rig.hand('draw');
    const ang = Math.atan2(h.y - s.y, h.x - s.x);
    const pull = rig.aim ? rig.aim.pull : 0;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
    const dx = dh.x - h.x, dy = dh.y - h.y, c = Math.cos(-ang), sn = Math.sin(-ang);
    let nx = dx * c - dy * sn, ny = dx * sn + dy * c;
    nx = clamp(nx, -0.9, 0); ny = clamp(ny, -0.35, 0.35);
    const L = 0.95, bend = 0.16 * pull, tip = -0.02 - bend;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,214,150,0.95)'; ctx.lineWidth = 0.03;
    const sx = rig.aim && pull > 0.02 ? nx : tip - 0.02, sy = rig.aim && pull > 0.02 ? ny : 0;
    ctx.beginPath(); ctx.moveTo(tip, L); ctx.lineTo(sx, sy); ctx.lineTo(tip, -L); ctx.stroke();
    ctx.strokeStyle = rig.bowColor; ctx.lineWidth = 0.11;
    ctx.beginPath(); ctx.moveTo(tip, L); ctx.bezierCurveTo(0.12, L * 0.85, 0.42 - bend, 0.45, 0.18, 0);
    ctx.bezierCurveTo(0.42 - bend, -0.45, 0.12, -L * 0.85, tip, -L); ctx.stroke();
    ctx.lineWidth = 0.17; ctx.beginPath(); ctx.moveTo(0.15, 0.2); ctx.lineTo(0.15, -0.2); ctx.stroke();   // grip
    ctx.fillStyle = rig.bowColor; for (const k of [1, -1]) { ctx.beginPath(); ctx.arc(tip, L * k, 0.07, 0, 6.3); ctx.fill(); }
    if (rig.aim && pull > 0.02) {
      const tipx = 0.32, ex = tipx - nx, ey = -ny, len = Math.hypot(ex, ey);
      ctx.save(); ctx.translate(tipx, 0); ctx.rotate(Math.atan2(ey, ex));
      G.drawArrowShape(ctx, rig.isPlayer ? rig.arrowType : 'default', Math.max(0.3, len));
      ctx.restore();
    }
    ctx.restore();
  };

  Game.drawStuck = function (ctx, s) {
    const w = s.body.getWorldPoint(planck.Vec2(s.lx, s.ly));
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(s.body.getAngle() + s.la);
    G.drawArrowShape(ctx, s.type, s.len);
    ctx.restore();
  };

  Game.drawBalloon = function (ctx, rig, bl) {
    const b = rig.b[bl.part]; if (!b) return;
    const p = b.getPosition(), t = this.time;
    const r = 0.34 * bl.infl, cx = p.x + Math.sin(t * 2 + p.x) * 0.15, cy = p.y + 0.9 + 0.4 * bl.infl;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 0.1, (p.y + cy) / 2, cx, cy - r); ctx.stroke();
    ctx.fillStyle = bl.t < 1.2 && Math.floor(t * 12) % 2 ? '#fff' : '#E67E22';
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.88, r, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy + r * 0.3, r * 0.2, r * 0.3, 0.4, 0, 6.3); ctx.fill();
  };

  Game.drawDebris = function (ctx) {
    for (const d of this.debris) {
      const p = d.body.getPosition();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(d.body.getAngle());
      if (d.kind === 'bow') {
        ctx.strokeStyle = d.color; ctx.lineWidth = 0.11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0.95); ctx.bezierCurveTo(0.14, 0.8, 0.42, 0.45, 0.18, 0); ctx.bezierCurveTo(0.42, -0.45, 0.14, -0.8, 0, -0.95); ctx.stroke();
      } else {
        ctx.scale(d.dir, 1);
        const flash = false; ctx.fillStyle = '#9A9A9A';
        ctx.fillStyle = '#8C8C8C';
        if (d.piece === 'helmetHeavy') { G.rrect(ctx, -0.3, -0.3, 0.6, 0.6, 0.2); ctx.fill(); ctx.fillStyle = '#3A3A3A'; ctx.fillRect(-0.04, -0.03, 0.33, 0.1); }
        else if (d.piece === 'helmetLight') { ctx.beginPath(); ctx.moveTo(-0.33, -0.2); ctx.quadraticCurveTo(-0.24, 0.2, 0.02, 0.27); ctx.quadraticCurveTo(0.26, 0.2, 0.33, -0.2); ctx.closePath(); ctx.fill(); }
        else { ctx.fillStyle = '#D2D2D2'; G.rrect(ctx, -0.27, -0.3, 0.54, 0.6, 0.12); ctx.fill(); }
      }
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------ projectiles, particles, apples, auras */
  Game.drawArrows = function (ctx) {
    for (const a of this.arrows) {
      if (a.trail.length > 3) {
        ctx.lineCap = 'round';
        for (let i = 2; i < a.trail.length; i += 2) {
          const k = i / a.trail.length;
          ctx.strokeStyle = 'rgba(255,255,255,' + 0.22 * k + ')'; ctx.lineWidth = 0.06 * k + 0.01;
          ctx.beginPath(); ctx.moveTo(a.trail[i - 2], a.trail[i - 1]); ctx.lineTo(a.trail[i], a.trail[i + 1]); ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.vy, a.vx));
      if (a.team === 'e') { ctx.globalAlpha = 1; }
      G.drawArrowShape(ctx, a.type, a.len);
      ctx.restore();
    }
    for (const s of this.stuckT) this.drawStuck(ctx, s);
  };

  function star(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.25, Math.sin(a + Math.PI / 4) * r * 0.25);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  Game.drawParts = function (ctx) {
    for (const p of this.parts) {
      const k = clamp(p.life / p.max, 0, 1);
      switch (p.kind) {
        case 'blood':
          ctx.globalAlpha = clamp(p.life * 1.5, 0, 1); ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.fill(); break;
        case 'spark':
          ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.7; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
        case 'star':
          ctx.globalAlpha = k; ctx.fillStyle = p.color; star(ctx, p.x, p.y, p.size * (0.6 + k * 0.6), p.rot + p.life * 6); break;
        case 'ember': case 'dot': case 'dust':
          ctx.globalAlpha = k * (p.kind === 'dust' ? 0.5 : 0.95); ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'dust' ? 2 - k : 0.4 + k * 0.6), 0, 6.3); ctx.fill(); break;
      }
    }
    ctx.globalAlpha = 1;
  };

  Game.drawApples = function (ctx) {
    for (const a of this.apples) {
      const fade = clamp(a.life, 0, 1) * clamp(a.t * 2, 0, 1);
      const body = { red: '#E74C3C', green: '#58D68D', gold: '#F4D03F' }[a.type];
      ctx.globalAlpha = fade;
      const g = ctx.createRadialGradient(a.x, a.y, 0.2, a.x, a.y, 0.95);
      g.addColorStop(0, body + '55'); g.addColorStop(1, body + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y, 0.95, 0, 6.3); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(a.x - 0.12, a.y, 0.33, 0, 6.3); ctx.arc(a.x + 0.12, a.y, 0.33, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(a.x, a.y - 0.05, 0.38, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(a.x - 0.2, a.y + 0.14, 0.07, 0.12, 0.5, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#7b5a3a'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(a.x, a.y + 0.33); ctx.lineTo(a.x + 0.05, a.y + 0.5); ctx.stroke();
      ctx.fillStyle = '#58b368'; ctx.beginPath(); ctx.ellipse(a.x + 0.17, a.y + 0.47, 0.13, 0.06, 0.4, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  Game.drawAuras = function (ctx) {
    const px = this.player.pos().x;
    for (const au of this.auras) {
      const k = au.t / au.max, a = Math.sin(Math.PI * clamp(k, 0, 1));
      const cols = au.kind === 'red' ? ['#E74C3C'] : au.kind === 'blue' ? ['#3498DB'] : ['#E74C3C', '#3498DB'];
      for (let i = 0; i < 7; i++) {
        const c = cols[i % cols.length];
        const x = px - 0.7 + i * 0.23, h = 3.2 + (i % 3) * 0.8, y0 = C.TOWER_TOP + (k * 5 + i * 0.15) % 6 - 0.5;
        const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, c + '00'); g.addColorStop(0.5, c + 'cc'); g.addColorStop(1, c + '00');
        ctx.globalAlpha = a * 0.75; ctx.fillStyle = g; ctx.fillRect(x - 0.07, y0, 0.14, h);
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------ diegetic tower HUD (screen space) */
  // returns hit rects in screen px
  // returns hit rects in screen px. HUD sits in the middle column of the tower, slots hang on the sides.
  Game.towerUI = function () {
    const S = this.S, T = C.TOWER_TOP, cx = (C.TOWER_X0 + C.TOWER_X1) / 2, bw = 1.45;
    const R = (x, yTop, w, h) => ({ x: this.sx(x), y: this.sy(yTop), w: w * S, h: h * S });
    const lives = R(cx - bw / 2, T - 0.38, bw, 0.3);
    const hp = R(cx - bw / 2, T - 0.74, bw, 0.28);
    const sta = R(cx - bw / 2, T - 1.1, bw, 0.28);
    const jump = R(cx - 0.72, T - 1.6, 1.44, 0.72);
    const slots = (this.slots || []).map((id, i) => {
      const left = i < 3, row = i % 3, y = T - 0.95 - row * 0.68;
      // radio inside the outer tower column, icon hanging outside the wall
      const rx = left ? C.TOWER_X0 + 0.36 : C.TOWER_X1 - 0.36, ix = left ? C.TOWER_X0 - 0.75 : C.TOWER_X1 + 0.75;
      const x0 = Math.min(rx, ix) - 0.5, x1 = Math.max(rx, ix) + 0.5;
      return Object.assign(R(x0, y + 0.32, x1 - x0, 0.64), { id, rx: this.sx(rx), ix: this.sx(ix), cy: this.sy(y), left });
    });
    return { lives, jump, hp, sta, slots };
  };

  function wing(ctx, x, y, s, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k * s, s); ctx.beginPath();
    ctx.moveTo(0, 0.4); ctx.quadraticCurveTo(0.2, -0.5, 1, -0.55); ctx.quadraticCurveTo(0.8, -0.2, 0.9, -0.1);
    ctx.quadraticCurveTo(0.6, 0, 0.75, 0.15); ctx.quadraticCurveTo(0.4, 0.2, 0.55, 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  Game.drawTowerHud = function (ctx) {
    const u = this.towerUI(), S = this.S, p = this.player, F = G.HUD_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // lives (wings)
    const lc = u.lives.x + u.lives.w / 2, ly = u.lives.y + u.lives.h / 2;
    ctx.fillStyle = '#F2F2F2'; ctx.font = Math.round(S * 0.26) + 'px ' + F;
    ctx.fillText(String(p.lives), lc, ly + 1);
    wing(ctx, lc - S * 0.17, ly, S * 0.17, -1); wing(ctx, lc + S * 0.17, ly, S * 0.17, 1);
    const bar = (r, frac, color, back, text) => {
      ctx.fillStyle = back; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = color; ctx.fillRect(r.x, r.y, Math.max(0, r.w * clamp(frac, 0, 1)), r.h);
      ctx.fillStyle = '#fff'; ctx.font = Math.round(S * 0.23) + 'px ' + F;
      ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
    };
    bar(u.hp, p.hp / p.maxHp, '#E2323C', '#7d2025', String(Math.ceil(p.hp)));
    bar(u.sta, p.sta / this.stats.maxSta, '#3C8CF0', '#24467a', String(Math.ceil(p.sta)));
    // jump button
    const j = u.jump, canJump = p.sta >= 5 && p.jumpCd <= 0 && p.alive;
    ctx.fillStyle = this.jumpDown ? '#BDBDBD' : canJump ? '#D4D4D4' : '#9a9a9a';
    G.rrect(ctx, j.x, j.y, j.w, j.h, S * 0.05); ctx.fill();
    ctx.fillStyle = '#7A7A7A'; ctx.font = Math.round(S * 0.25) + 'px ' + F;
    ctx.fillText('JUMP', j.x + j.w / 2, j.y + j.h * 0.36);
    ctx.fillStyle = '#3C8CF0'; ctx.font = Math.round(S * 0.2) + 'px ' + F;
    ctx.fillText('5 STAMINA', j.x + j.w / 2, j.y + j.h * 0.72);
    // arrow slot selectors
    u.slots.forEach((s, i) => {
      const on = i === this.slot, r = S * 0.17;
      ctx.strokeStyle = 'rgba(200,200,200,0.55)'; ctx.lineWidth = Math.max(1.5, S * 0.03);
      ctx.beginPath(); ctx.moveTo(s.ix, s.cy); ctx.lineTo(s.rx, s.cy); ctx.stroke();
      ctx.save(); ctx.translate(s.ix, s.cy); ctx.rotate(-Math.PI / 4); ctx.scale(S * 0.5, S * 0.5);
      G.drawArrowShape(ctx, s.id, s.id === 'minigun' ? 0.6 : 0.9); ctx.restore();
      ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.arc(s.rx, s.cy, r * 1.25, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#E6E6E6'; ctx.lineWidth = Math.max(2, S * 0.045); ctx.beginPath(); ctx.arc(s.rx, s.cy, r, 0, 6.3); ctx.stroke();
      if (on) { ctx.fillStyle = '#CFCFCF'; ctx.beginPath(); ctx.arc(s.rx, s.cy, r * 0.62, 0, 6.3); ctx.fill(); }
    });
  };

  /* ------------------------------------------------------------ aiming overlay, hints, messages */
  Game.trajectory = function () {
    const p = this.player, a = p.aimState;
    if (!a.active || !p.aim) return null;
    const h = p.hand('bow'), phi = p.aim.phi;
    const speed = this.arrowSpeed(Math.max(a.charge, 0.25));
    let x = h.x + Math.cos(phi) * 0.25, y = h.y + Math.sin(phi) * 0.25, vx = Math.cos(phi) * speed, vy = Math.sin(phi) * speed;
    const pts = [];
    for (let t = 0; t < 1.5; t += 0.045) {
      pts.push([x, y]);
      for (let k = 0; k < 5; k++) { vy -= C.ARROW_G * 0.009; x += vx * 0.009; y += vy * 0.009; }
    }
    return pts;
  };

  Game.drawOverlay = function (ctx) {
    const W = this.W, H = this.H, a = this.player.aimState;
    if (this.state === 'menu' && !a.active) {
      // CONTROL AREA hint panel
      const cw = W * C.CONTROL_FRAC;
      ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(0, 0, cw, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.strokeRect(this.padL + 6, 6, cw - this.padL - 12, H - 12); ctx.setLineDash([]);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = this.padL + (cw - this.padL) / 2, f = Math.max(11, H * 0.032);
      ctx.fillStyle = '#fff'; ctx.font = '900 ' + f + 'px system-ui, sans-serif';
      ctx.fillText('CONTROL AREA', cx, H * 0.075);
      ctx.font = '800 ' + f * 0.9 + 'px system-ui, sans-serif';
      ctx.fillText('HOLD AND RELEASE', cx, H * 0.135);
      // animated finger + dotted aim line
      const t = (this.time % 2.6) / 2.6, ax = cx + f * 1.5, ay = H * 0.2;
      const drag = t < 0.25 ? 0 : t < 0.75 ? (t - 0.25) / 0.5 : 1;
      const fx = ax - drag * f * 3, fy = ay + drag * f * 1.8;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 1; i <= 7; i++) { const k = i / 7; ctx.beginPath(); ctx.arc(ax + (ax - fx) * k * 1.6, ay + (ay - fy) * k * 1.6 + k * k * f, 2, 0, 6.3); if (drag > 0) ctx.fill(); }
      ctx.fillStyle = t > 0.8 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(fx, fy, f * (t < 0.25 ? 0.5 + t * 2 : 0.8), 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, f * 0.9, 0, 6.3); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + f * 0.75 + 'px system-ui, sans-serif';
      ctx.fillText('SHOOTING REQUIRES STAMINA', cx, H * 0.275);
    }
    // floating text
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of this.popups) {
      const k = clamp(q.t / q.max, 0, 1), sx = this.sx(q.x), sy = this.sy(q.y), f = Math.max(11, this.S * (q.skull ? 0.75 : 0.5));
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = '900 ' + f + 'px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(q.text, sx, sy);
      ctx.fillStyle = q.skull ? '#F5B041' : q.text === 'HEADSHOT' ? '#E74C3C' : '#fff'; ctx.fillText(q.text, sx, sy);
      if (q.skull) G.drawSkull(ctx, sx + f * 1.1, sy, f * 0.9, '#F5B041');
    }
    ctx.globalAlpha = 1;
    // banners
    for (const m of this.msgs) {
      const k = m.t / m.max, e = k > 0.85 ? (1 - k) / 0.15 : k < 0.25 ? k / 0.25 : 1;
      ctx.globalAlpha = clamp(e, 0, 1);
      const f = Math.max(22, H * 0.11);
      ctx.font = '900 ' + f * (1.1 - 0.1 * clamp(e, 0, 1)) + 'px system-ui, sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.strokeText(m.text, W / 2, H * 0.3);
      ctx.fillStyle = '#fff'; ctx.fillText(m.text, W / 2, H * 0.3);
    }
    ctx.globalAlpha = 1;
    // damage vignette
    if (this.hitFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(231,76,60,0)'); g.addColorStop(1, 'rgba(231,76,60,' + this.hitFlash * 0.55 + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const p = this.player;
    if (p.alive && p.hp / p.maxHp < 0.3 && this.state !== 'menu') {
      const pulse = 0.12 + 0.08 * Math.sin(this.time * 6);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H);
      g.addColorStop(0, 'rgba(231,76,60,0)'); g.addColorStop(1, 'rgba(231,76,60,' + pulse + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  };

  /* ------------------------------------------------------------ frame */
  Game.render = function () {
    const ctx = this.ctx, dpr = this.dpr, S = this.S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawBackground(ctx);
    const shx = (Math.random() - 0.5) * this.shake * 14, shy = (Math.random() - 0.5) * this.shake * 14;
    ctx.setTransform(dpr * S, 0, 0, -dpr * S, dpr * (this.padL + shx), dpr * (this.H + C.Y_MIN * S + shy));
    this.drawTower(ctx);
    this.drawPlatforms(ctx);
    this.drawDebris(ctx);
    for (const c of this.corpses) this.drawRig(ctx, c.rig);
    for (const e of this.enemies) this.drawRig(ctx, e.rig);
    this.drawRig(ctx, this.player);
    this.drawApples(ctx);
    this.drawArrows(ctx);
    this.drawAuras(ctx);
    this.drawParts(ctx);
    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, dpr * shx, dpr * shy);
    this.drawTowerHud(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOverlay(ctx);
  };
})(window.G);
