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
  function block(ctx, w, h, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = STONE; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(-w / 2, h / 2 - 0.09, w, 0.09); // top (y up)
    ctx.fillRect(-w / 2, -h / 2, 0.07, h);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-w / 2, -h / 2, w, 0.09);
    ctx.fillRect(w / 2 - 0.07, -h / 2, 0.07, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.025; ctx.strokeRect(-w / 2 + 0.01, -h / 2 + 0.01, w - 0.02, h - 0.02);
    ctx.globalAlpha = 1;
  }

  Game.drawTower = function (ctx) {
    const x0 = C.TOWER_X0, x1 = C.TOWER_X1, top = C.TOWER_TOP, y0 = C.Y_MIN - 1;
    ctx.fillStyle = '#5f5f5f'; ctx.fillRect(x0, y0, x1 - x0, top - y0);
    // brick courses
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.03;
    ctx.beginPath();
    let row = 0;
    for (let y = top; y > y0; y -= 1) {
      ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      for (let x = x0 + (row % 2 ? 0.75 : 0.25); x < x1; x += 1.5) { ctx.moveTo(x, y); ctx.lineTo(x, y - 1); }
      row++;
    }
    ctx.stroke();
    // bevel
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x0, top - 0.12, x1 - x0, 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x1 - 0.1, y0, 0.1, top - y0);
    // battlements
    ctx.fillStyle = STONE;
    for (const [bx, bw] of [[x1 - 0.9, 0.9], [0.2, 0.8], [1.5, 0.8]]) { ctx.fillRect(bx, top, bw, 0.5); }
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; for (const [bx, bw] of [[x1 - 0.9, 0.9], [0.2, 0.8], [1.5, 0.8]]) ctx.fillRect(bx, top + 0.4, bw, 0.1);
  };

  Game.drawPlatforms = function (ctx) {
    for (const p of this.platforms) {
      for (const b of p.blocks) {
        const q = b.getPosition();
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(b.getAngle());
        block(ctx, 1, 1, p.alpha);
        ctx.restore();
      }
    }
  };

  /* ------------------------------------------------------------ ragdolls */
  function bodyFrame(ctx, b, fn) {
    const p = b.getPosition();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); fn(); ctx.restore();
  }

  Game.drawRig = function (ctx, rig, isMenuDummy) {
    if (!rig.b.head) return;
    const D = G.RIG.DIM, b = rig.b, dir = rig.dir;
    ctx.globalAlpha = rig.alpha;
    const col = (n, back) => mix(back ? '#D6D6D6' : '#FFFFFF', RED, rig.tint[n]);
    const capsule = (n, back) => bodyFrame(ctx, b[n], () => {
      const d = D[n]; ctx.fillStyle = col(n, back); G.rrect(ctx, -d.hw, -d.hh, d.hw * 2, d.hh * 2, d.hw); ctx.fill();
    });
    // back limbs, core, front limbs
    capsule('uArmR', true); capsule('lArmR', true); capsule('uLegR', true); capsule('lLegR', true);
    capsule('pelvis'); capsule('uTorso');
    capsule('uLegL'); capsule('lLegL');
    bodyFrame(ctx, b.head, () => { ctx.fillStyle = col('head'); ctx.beginPath(); ctx.arc(0, 0, D.head.r, 0, 6.3); ctx.fill(); });
    this.drawBow(ctx, rig);
    capsule('uArmL'); capsule('lArmL');
    // draw hand over the string
    // armor
    for (const a of rig.armor) if (a.worn) this.drawArmor(ctx, rig, a);
    // stuck arrows
    for (const s of rig.stuck) this.drawStuck(ctx, s);
    // balloons
    for (const bl of rig.balloons) this.drawBalloon(ctx, rig, bl);
    ctx.globalAlpha = 1;
    // floating health bar tracks the head's position and tilt
    if (rig.alive && !rig.isPlayer) {
      bodyFrame(ctx, b.head, () => {
        const w = 0.9, h = 0.1, y = 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-w / 2 - 0.03, y - 0.03, w + 0.06, h + 0.06);
        ctx.fillStyle = RED; ctx.fillRect(-w / 2, y, w * clamp(rig.hp / rig.maxHp, 0, 1), h);
        if (rig.poison) { ctx.fillStyle = '#58D68D'; ctx.fillRect(-w / 2, y - 0.05, w * clamp(rig.poison.t / 5, 0, 1), 0.03); }
        if (rig.burn) { ctx.fillStyle = '#E67E22'; ctx.fillRect(-w / 2, y - 0.05, w * clamp(rig.burn.t / 3.2, 0, 1), 0.03); }
      });
    }
    if (rig.stun > 0 && rig.alive) {
      const p = rig.head.getPosition();
      ctx.strokeStyle = '#F4D03F'; ctx.lineWidth = 0.04; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = this.time * 8 + i * 2.1; ctx.moveTo(p.x + Math.cos(a) * 0.3, p.y + 0.3 + Math.sin(a) * 0.12); ctx.lineTo(p.x + Math.cos(a + 0.5) * 0.4, p.y + 0.3 + Math.sin(a + 0.5) * 0.18); }
      ctx.stroke();
    }
  };

  Game.drawArmor = function (ctx, rig, a) {
    const flash = a.flash > 0;
    const body = rig.b[a.part], fill = flash ? '#FFFFFF' : '#9A9A9A', dark = '#6e6e6e';
    bodyFrame(ctx, body, () => {
      ctx.scale(rig.dir, 1);
      if (a.kind === 'helmetHeavy') {
        ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0.02, 0.255, 0, 6.3); ctx.fill();
        ctx.fillStyle = flash ? '#ddd' : dark; ctx.fillRect(-0.26, -0.03, 0.52, 0.04);          // brim
        ctx.fillStyle = '#2d2d2d'; ctx.fillRect(0.0, 0.0, 0.25, 0.05);                         // visor slit (front)
        ctx.fillStyle = flash ? '#fff' : '#b5b5b5'; ctx.fillRect(-0.03, 0.2, 0.06, 0.1);       // crest stub
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-0.07, 0.1, 0.1, 0, 3.14); ctx.fill();
      } else if (a.kind === 'helmetLight') {
        ctx.fillStyle = flash ? '#fff' : '#A8A8A8';
        ctx.beginPath(); ctx.moveTo(-0.23, 0.02); ctx.lineTo(0.23, 0.02); ctx.lineTo(0.02, 0.44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = dark; ctx.fillRect(-0.26, 0.0, 0.52, 0.05);
      } else if (a.kind === 'chest') {
        ctx.fillStyle = fill; G.rrect(ctx, -0.19, -0.2, 0.38, 0.5, 0.07); ctx.fill();
        ctx.fillStyle = flash ? '#ddd' : dark; ctx.fillRect(-0.19, -0.2, 0.38, 0.05);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-0.12, -0.05, 0.05, 0.28);
      }
    });
  };

  Game.drawBow = function (ctx, rig) {
    if (!rig.alive || !rig.b.lArmL) return;
    const s = rig.shoulder(), h = rig.hand('bow'), dh = rig.hand('draw');
    const ang = Math.atan2(h.y - s.y, h.x - s.x);
    const pull = rig.aim ? rig.aim.pull : 0;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
    // draw-hand position in the bow's local frame (string nock)
    const dx = dh.x - h.x, dy = dh.y - h.y, c = Math.cos(-ang), sn = Math.sin(-ang);
    let nx = dx * c - dy * sn, ny = dx * sn + dy * c;
    nx = clamp(nx, -0.75, 0); ny = clamp(ny, -0.3, 0.3);
    const bend = 0.12 * (rig.aim ? rig.aim.pull : 0);
    ctx.strokeStyle = rig.bowColor; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-bend, 0.78); ctx.quadraticCurveTo(0.45 - bend * 1.6, 0, -bend, -0.78); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,235,235,0.9)'; ctx.lineWidth = 0.018;
    const sx = rig.aim ? nx : -0.04, sy = rig.aim ? ny : 0;
    ctx.beginPath(); ctx.moveTo(-bend, 0.78); ctx.lineTo(sx, sy); ctx.lineTo(-bend, -0.78); ctx.stroke();
    if (rig.aim && pull > 0.02) {
      // nocked arrow: tail on the string, tip just past the bow hand
      const tipx = 0.14, ex = tipx - nx, ey = -ny, L = Math.hypot(ex, ey);
      ctx.save(); ctx.translate(tipx, 0); ctx.rotate(Math.atan2(ey, ex));
      G.drawArrowShape(ctx, rig.isPlayer ? rig.arrowType : 'default', Math.max(0.3, L));
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
        ctx.strokeStyle = d.color; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0.78); ctx.quadraticCurveTo(0.45, 0, 0, -0.78); ctx.stroke();
        ctx.translate(-0.0, 0); ctx.rotate(0);
      } else {
        ctx.scale(d.dir, 1);
        const flash = false; ctx.fillStyle = '#9A9A9A';
        if (d.piece === 'helmetHeavy') { ctx.beginPath(); ctx.arc(0, 0, 0.25, 0, 6.3); ctx.fill(); ctx.fillStyle = '#2d2d2d'; ctx.fillRect(0, -0.02, 0.25, 0.05); }
        else if (d.piece === 'helmetLight') { ctx.beginPath(); ctx.moveTo(-0.23, -0.2); ctx.lineTo(0.23, -0.2); ctx.lineTo(0.02, 0.22); ctx.closePath(); ctx.fill(); }
        else { G.rrect(ctx, -0.19, -0.25, 0.38, 0.5, 0.07); ctx.fill(); }
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
  Game.towerUI = function () {
    const S = this.S;
    const T = C.TOWER_TOP;
    const hp = { x: this.sx(2.0), y: this.sy(T - 0.2), w: 3.1 * S, h: 0.5 * S };
    const sta = { x: this.sx(2.0), y: this.sy(T - 0.88), w: 3.1 * S, h: 0.5 * S };
    const jump = { x: this.sx(2.0), y: this.sy(T - 1.6), w: 3.1 * S, h: 0.95 * S };
    const slots = (this.slots || []).map((id, i) => ({ id, x: this.sx(0.15), y: this.sy(T - 0.15 - i * 0.84), w: 1.7 * S, h: 0.78 * S }));
    return { jump, hp, sta, slots };
  };

  Game.drawTowerHud = function (ctx) {
    const u = this.towerUI(), S = this.S, p = this.player;
    const px = Math.max(9, Math.round(S * 0.42));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bar = (r, frac, color, text) => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; G.rrect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 4); ctx.fill();
      ctx.fillStyle = color; G.rrect(ctx, r.x, r.y, Math.max(0, r.w * clamp(frac, 0, 1)), r.h, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + px + 'px system-ui, sans-serif';
      ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
    };
    bar(u.hp, p.hp / p.maxHp, '#E74C3C', String(Math.ceil(p.hp)));
    bar(u.sta, p.sta / this.stats.maxSta, '#3498DB', String(Math.ceil(p.sta)));
    // jump button
    const j = u.jump, canJump = p.sta >= 5 && p.jumpCd <= 0;
    ctx.fillStyle = this.jumpDown ? '#f2f2f2' : canJump ? '#FFFFFF' : '#8a8a8a';
    G.rrect(ctx, j.x, j.y, j.w, j.h, 6); ctx.fill();
    ctx.fillStyle = '#2b2b2b'; ctx.font = '900 ' + Math.round(px * 1.25) + 'px system-ui, sans-serif';
    ctx.fillText('JUMP', j.x + j.w / 2, j.y + j.h * 0.38);
    ctx.fillStyle = '#E74C3C'; ctx.font = '800 ' + Math.round(px * 0.75) + 'px system-ui, sans-serif';
    ctx.fillText('5 STAMINA', j.x + j.w / 2, j.y + j.h * 0.76);
    // arrow slot selectors on the left wall
    u.slots.forEach((s, i) => {
      const on = i === this.slot;
      ctx.fillStyle = on ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.0)'; G.rrect(ctx, s.x, s.y, s.w, s.h, 5); ctx.fill();
      ctx.save(); ctx.translate(s.x + s.w * 0.38, s.y + s.h / 2); ctx.rotate(-Math.PI / 5); ctx.scale(S * 0.62, S * 0.62);
      G.drawArrowShape(ctx, s.id, s.id === 'minigun' ? 0.55 : 1); ctx.restore();
      const cx = s.x + s.w * 0.84, cy = s.y + s.h / 2, r = S * 0.24;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.stroke();
      if (on) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, 6.3); ctx.fill(); }
    });
    // lives pips
    if (p.lives > 0) {
      ctx.fillStyle = '#E74C3C';
      for (let i = 0; i < p.lives; i++) { ctx.beginPath(); ctx.arc(u.hp.x + 6 + i * (S * 0.4), u.hp.y - S * 0.35, S * 0.13, 0, 6.3); ctx.fill(); }
    }
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
    if (a.active && a.moved !== undefined) {
      // slingshot anchor + charge ring
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a.ax, a.ay, 16, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.ax, a.ay); ctx.lineTo(a.x, a.y); ctx.stroke();
      ctx.strokeStyle = this.player.sta > 6 ? '#F5B041' : '#E74C3C'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(a.ax, a.ay, 22, -Math.PI / 2, -Math.PI / 2 + a.charge * 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(a.x, a.y, 9, 0, 6.3); ctx.fill();
    }
    // dotted trajectory (onboarding in menu / optional assist)
    if (a.active && (this.state === 'menu' || G.Save.d.settings.guide)) {
      const pts = this.trajectory();
      if (pts) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; pts.forEach((q, i) => { ctx.globalAlpha = 1 - i / pts.length; ctx.beginPath(); ctx.arc(this.sx(q[0]), this.sy(q[1]), 2.4, 0, 6.3); ctx.fill(); }); ctx.globalAlpha = 1; }
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
