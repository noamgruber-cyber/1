/* Active-ragdoll stickman: 11 rigid bodies + revolute joints with PD "muscles". */
(function (G) {
  const pl = planck, V = pl.Vec2;
  const { clamp, wrapAngle } = G;
  const CAT = { TERRAIN: 1, CHAR: 2, DEBRIS: 4 };
  G.CAT = CAT;

  const DIM = {
    head: { r: 0.2 },
    uTorso: { hw: 0.15, hh: 0.28 },
    pelvis: { hw: 0.14, hh: 0.13 },
    uArmL: { hw: 0.06, hh: 0.2 }, lArmL: { hw: 0.055, hh: 0.2 },
    uArmR: { hw: 0.06, hh: 0.2 }, lArmR: { hw: 0.055, hh: 0.2 },
    uLegL: { hw: 0.08, hh: 0.26 }, lLegL: { hw: 0.07, hh: 0.26 },
    uLegR: { hw: 0.08, hh: 0.26 }, lLegR: { hw: 0.07, hh: 0.26 },
  };
  const PARTS = Object.keys(DIM);
  // L = front arm (holds bow) / front leg ; R = draw arm / back leg
  // pa/ca = anchors in parent/child local space (facing-right frame); lo/hi = limits; key = pose key
  const JOINTS = [
    { n: 'spine', p: 'pelvis', c: 'uTorso', pa: [0, 0.13], ca: [0, -0.28], lo: -0.6, hi: 0.5, k: 'spine', sub: ['uTorso', 'head', 'uArmL', 'lArmL', 'uArmR', 'lArmR'], str: 1.2 },
    { n: 'neck', p: 'uTorso', c: 'head', pa: [0, 0.28], ca: [0, -0.2], lo: -0.7, hi: 0.7, k: 'neck', sub: ['head'], str: 0.7 },
    { n: 'shL', p: 'uTorso', c: 'uArmL', pa: [0.02, 0.2], ca: [0, 0.2], lo: -1.8, hi: 3.4, k: 'shL', sub: ['uArmL', 'lArmL'], str: 1 },
    { n: 'elL', p: 'uArmL', c: 'lArmL', pa: [0, -0.2], ca: [0, 0.2], lo: -2.7, hi: 2.7, k: 'elL', sub: ['lArmL'], str: 1 },
    { n: 'shR', p: 'uTorso', c: 'uArmR', pa: [-0.02, 0.2], ca: [0, 0.2], lo: -1.8, hi: 3.4, k: 'shR', sub: ['uArmR', 'lArmR'], str: 1 },
    { n: 'elR', p: 'uArmR', c: 'lArmR', pa: [0, -0.2], ca: [0, 0.2], lo: -2.7, hi: 2.7, k: 'elR', sub: ['lArmR'], str: 1 },
    { n: 'hipL', p: 'pelvis', c: 'uLegL', pa: [0.04, -0.13], ca: [0, 0.26], lo: -1.7, hi: 1.7, k: 'hipL', sub: ['uLegL', 'lLegL'], str: 1.3 },
    { n: 'knL', p: 'uLegL', c: 'lLegL', pa: [0, -0.26], ca: [0, 0.26], lo: -2.7, hi: 0.05, k: 'knL', sub: ['lLegL'], str: 1.3 },
    { n: 'hipR', p: 'pelvis', c: 'uLegR', pa: [-0.04, -0.13], ca: [0, 0.26], lo: -1.7, hi: 1.7, k: 'hipR', sub: ['uLegR', 'lLegR'], str: 1.3 },
    { n: 'knR', p: 'uLegR', c: 'lLegR', pa: [0, -0.26], ca: [0, 0.26], lo: -2.7, hi: 0.05, k: 'knR', sub: ['lLegR'], str: 1.3 },
  ];
  const POSES = {
    stand: { spine: 0, neck: 0, shL: 0.45, elL: 0.55, shR: 0.12, elR: 0.3, hipL: 0.06, knL: 0, hipR: -0.06, knR: 0 },
    kneel: { spine: -0.08, neck: 0, shL: 0.45, elL: 0.55, shR: 0.12, elR: 0.3, hipL: 1.45, knL: -1.5, hipR: 0.0, knR: -1.55 },
    split: { spine: -0.05, neck: 0, shL: 0.45, elL: 0.55, shR: 0.12, elR: 0.3, hipL: 1.45, knL: 0, hipR: -1.45, knR: 0 },
  };
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const J_BY_N = Object.fromEntries(JOINTS.map((j) => [j.n, j]));

  // forward kinematics in the facing-right frame, pelvis centre at origin
  function fk(pose) {
    const A = {}, P = {};
    A.pelvis = 0; P.pelvis = [0, 0];
    A.uTorso = pose.spine; A.head = A.uTorso + pose.neck;
    A.uArmL = A.uTorso + pose.shL; A.lArmL = A.uArmL + pose.elL;
    A.uArmR = A.uTorso + pose.shR; A.lArmR = A.uArmR + pose.elR;
    A.uLegL = pose.hipL; A.lLegL = A.uLegL + pose.knL;
    A.uLegR = pose.hipR; A.lLegR = A.uLegR + pose.knR;
    for (const j of JOINTS) {
      const pc = P[j.p], pr = rot(j.pa[0], j.pa[1], A[j.p]);
      const cr = rot(j.ca[0], j.ca[1], A[j.c]);
      P[j.c] = [pc[0] + pr[0] - cr[0], pc[1] + pr[1] - cr[1]];
    }
    // lowest point of the legs -> pelvis height above the standing surface
    let minY = 0;
    for (const n of ['uLegL', 'lLegL', 'uLegR', 'lLegR']) {
      const d = DIM[n], a = A[n];
      const ext = Math.abs(Math.cos(a)) * d.hh + Math.abs(Math.sin(a)) * d.hw;
      minY = Math.min(minY, P[n][1] - ext);
    }
    return { A, P, pelvisH: -minY };
  }
  const FK = {};
  for (const k in POSES) FK[k] = fk(POSES[k]);

  let groupId = 1;
  const BOW_COLOR = '#F5B041';

  class Rig {
    constructor(game, o) {
      this.game = game; this.world = game.world;
      this.team = o.team; this.isPlayer = !!o.isPlayer;
      this.dir = o.dir; this.poseName = o.pose || 'stand';
      this.pose = Object.assign({}, POSES[this.poseName]);
      this.homeX = o.x; this.surfaceY = o.surfaceY;
      this.maxHp = this.hp = o.hp; this.alive = true;
      this.group = -(groupId++);
      this.b = {}; this.joints = {};
      this.tint = {}; PARTS.forEach((p) => (this.tint[p] = 0));
      this.stuck = []; this.armor = [];
      this.aim = null;        // {phi, pull, nock:bool}
      this.aimErr = 0;        // flinch offset (radians)
      this.flinch = 0;
      this.stun = 0; this.poison = null; this.burn = null; this.balloons = [];
      this.convT = 0; this.conv = {};
      this.muscle = 1;
      this.time = 0; this.alpha = o.alpha === undefined ? 1 : o.alpha;
      this.bowColor = o.bowColor || BOW_COLOR;
      this.arrowType = 'default';
      this.invuln = 0;
      this.lostFooting = false;
      this.build(o);
      for (const a of o.armor || []) this.armor.push(Object.assign({ worn: true, maxDur: a.dur, flash: 0 }, a));
      // the root is given extra rotational inertia so the balance assist stays stable
      this.b.pelvis.setMassData({ mass: this.b.pelvis.getMass(), center: V(0, 0), I: 0.03 });
      let m = 0; for (const p of PARTS) m += this.b[p].getMass();
      this.mass = m;
    }

    build(o) {
      const f = FK[this.poseName], dir = this.dir;
      const py = this.surfaceY + f.pelvisH;
      this.pelvisTargetY = py;
      for (const n of PARTS) {
        const d = DIM[n];
        const b = this.world.createBody({
          type: 'dynamic',
          position: V(this.homeX + dir * f.P[n][0], py + f.P[n][1]),
          angle: dir * f.A[n],
          linearDamping: 0.05, angularDamping: 0.3,
        });
        const shape = n === 'head' ? new pl.Circle(d.r) : new pl.Box(d.hw, d.hh);
        b.createFixture({
          shape, density: 1, friction: 0.9, restitution: 0.05,
          filterGroupIndex: this.group, filterCategoryBits: CAT.CHAR, filterMaskBits: CAT.TERRAIN,
          userData: { kind: 'part', rig: this, part: n },
        });
        b.setUserData({ rig: this, part: n });
        this.b[n] = b;
      }
      for (const j of JOINTS) {
        const bp = this.b[j.p], bc = this.b[j.c];
        const anchor = bp.getWorldPoint(V(j.pa[0] * dir, j.pa[1]));
        const lo = dir === 1 ? j.lo : -j.hi, hi = dir === 1 ? j.hi : -j.lo;
        const jt = pl.RevoluteJoint({ enableLimit: true, lowerAngle: lo, upperAngle: hi, collideConnected: false }, bp, bc, anchor);
        this.world.createJoint(jt);
        this.joints[j.n] = jt;
      }
    }

    get head() { return this.b.head; }
    get torso() { return this.b.uTorso; }
    armorOn(part) { for (const a of this.armor) if (a.worn && a.part === part) return a; return null; }

    setAim(phi, pull) { this.aim = { phi, pull }; }
    clearAim() { this.aim = null; }

    // world position of bow hand (front arm tip) / draw hand
    hand(side) {
      const b = this.b[side === 'bow' ? 'lArmL' : 'lArmR'];
      return b.getWorldPoint(V(0, -0.2));
    }
    shoulder() { return this.b.uTorso.getWorldPoint(V(0.02 * this.dir, 0.2)); }
    // aiming direction of the bow arm as it really is
    actualAim() {
      const s = this.shoulder(), h = this.hand('bow');
      return Math.atan2(h.y - s.y, h.x - s.x);
    }

    // PD controller on every joint; torque scaled by inertia of the controlled sub-tree
    update(dt) {
      this.time += dt;
      if (!this.alive) return;
      const dir = this.dir;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.flinch > 0) { this.flinch -= dt; this.aimErr *= Math.pow(0.15, dt); }
      for (const a of this.armor) if (a.flash > 0) a.flash -= dt;
      let strength = this.muscle;
      if (this.stun > 0) {
        this.stun -= dt; strength *= 0.18;
        this.convT -= dt;
        if (this.convT <= 0) {
          this.convT = 0.05;
          for (const k in this.pose) this.conv[k] = (Math.random() - 0.5) * 2.4;
        }
      } else this.conv = {};
      if (this.balloons.length) strength *= 0.45;

      // targets: base pose, arm IK when aiming
      const tgt = Object.assign({}, this.pose);
      if (this.aim) this.solveAim(tgt);
      for (const k in this.conv) tgt[k] += this.conv[k];

      const torsoA = this.b.uTorso.getAngle();
      for (const j of JOINTS) {
        const bp = this.b[j.p], bc = this.b[j.c];
        const rel = bc.getAngle() - bp.getAngle();
        const w = bc.getAngularVelocity() - bp.getAngularVelocity();
        const target = dir * tgt[j.k];
        const err = wrapAngle(target - rel);
        const anchor = bp.getWorldPoint(V(j.pa[0] * dir, j.pa[1]));
        // gravity feed-forward: torque needed to hold the whole sub-tree against gravity
        let ff = 0;
        for (const s of j.sub) {
          const b = this.b[s], c = b.getWorldCenter();
          ff += b.getMass() * (c.x - anchor.x);
        }
        ff *= -G.C.GRAV * Math.min(1, strength * 1.5);
        const Ic = bc.getInertia();
        const kp = 600 * j.str * strength, kd = 28 * Math.sqrt(j.str * Math.max(strength, 0.25));
        const tq = Ic * (kp * err - kd * w);
        bc.applyTorque(tq + ff, true);
        // gravity hold is an exact internal couple; the PD reaction on the (usually lighter) parent is damped
        bp.applyTorque(-ff - tq * Math.min(1, 0.5 * bp.getInertia() / Ic), true);
      }

      // balance assistance on the pelvis (the "root" of the active ragdoll)
      const pel = this.b.pelvis, pp = pel.getPosition(), pv = pel.getLinearVelocity();
      const near = Math.abs(pp.x - this.homeX) < 1.3 && Math.abs(pp.y - this.pelvisTargetY) < 1.4;
      this.lostFooting = !near || this.balloons.length > 0;
      if (!this.lostFooting && this.stun <= 0) {
        const W = this.mass * -G.C.GRAV;
        const fy = clamp(W * 22 * (this.pelvisTargetY - pp.y) - W * 2.2 * pv.y, 0, W * 2.4);
        const fx = clamp(W * 7 * (this.homeX - pp.x) - W * 1.8 * pv.x, -W * 1.6, W * 1.6);
        pel.applyForceToCenter(V(fx, fy), true);
        const pa = pel.getAngle(), pw = pel.getAngularVelocity();
        pel.applyTorque(40 * (0 - pa) - 2.4 * pw, true);
      } else if (this.stun > 0) {
        const W = this.mass * -G.C.GRAV;
        if (!this.lostFooting) pel.applyForceToCenter(V(0, clamp(W * 10 * (this.pelvisTargetY - pp.y), 0, W * 1.1)), true);
      }
      // balloons pull their limb upward
      for (let i = this.balloons.length - 1; i >= 0; i--) {
        const bl = this.balloons[i];
        bl.t -= dt; bl.infl = Math.min(1, bl.infl + dt * 3);
        if (bl.t <= 0) { this.game.popBalloon(this, bl); this.balloons.splice(i, 1); continue; }
        const b = this.b[bl.part];
        if (b.getLinearVelocity().y > 3) continue;   // terminal rise speed
        const lift = this.mass * -G.C.GRAV * (1.25 + 0.3 * bl.infl) / Math.max(1, this.balloons.length) * 0.9 * bl.infl;
        b.applyForceToCenter(V(0, lift), true);
      }
    }

    solveAim(tgt) {
      const dir = this.dir, a = this.aim;
      const phiF = dir === 1 ? a.phi : Math.PI - a.phi;
      const torsoF = this.b.uTorso.getAngle() * dir;
      // bow arm: straight along the aim vector
      const th = phiF + Math.PI / 2;
      tgt.shL = th - torsoF; tgt.elL = 0;
      // draw arm: 2-bone IK so the hand sits at the nock
      const d = 0.8 - (0.14 + 0.4 * a.pull);
      const u = [Math.cos(phiF), Math.sin(phiF)], n = [-u[1], u[0]];
      const L = 0.4, h = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
      const E = [u[0] * d / 2 + n[0] * h, u[1] * d / 2 + n[1] * h];
      const T = [u[0] * d, u[1] * d];
      const p1 = Math.atan2(E[1], E[0]), p2 = Math.atan2(T[1] - E[1], T[0] - E[0]);
      tgt.shR = p1 + Math.PI / 2 - torsoF;
      tgt.elR = wrapAngle(p2 - p1);
      tgt.spine = this.pose.spine - 0.1 * a.pull - 0.12 * Math.max(0, phiF);
      tgt.neck = clamp(phiF * 0.45 - tgt.spine - torsoF * 0 , -0.65, 0.65);
    }

    // apply a status effect
    addStun(t) { this.stun = Math.max(this.stun, t); this.convT = 0; }

    die() {
      if (!this.alive) return;
      this.alive = false; this.aim = null;
      for (const p of PARTS) { this.b[p].setAngularDamping(1.2); this.b[p].setLinearDamping(0.1); }
      // the bow is a separate body that tumbles on its own
      const h = this.hand('bow'), s = this.shoulder();
      const bow = this.world.createBody({ type: 'dynamic', position: h, angle: Math.atan2(h.y - s.y, h.x - s.x) + Math.PI / 2, angularDamping: 0.1 });
      bow.createFixture({
        shape: new pl.Box(0.04, 0.7), density: 0.6, friction: 0.5, restitution: 0.2,
        filterGroupIndex: this.group, filterCategoryBits: CAT.DEBRIS, filterMaskBits: CAT.TERRAIN,
      });
      const lv = this.b.lArmL.getLinearVelocity();
      bow.setLinearVelocity(V(lv.x + G.rand(-2, 2), lv.y + 3));
      bow.setAngularVelocity(G.rand(-8, 8));
      this.game.debris.push({ kind: 'bow', body: bow, color: this.bowColor, life: 12 });
    }

    destroy() {
      for (const p of PARTS) this.world.destroyBody(this.b[p]);
      this.b = {}; this.stuck.length = 0;
    }
    pos() { return this.b.pelvis.getPosition(); }
  }

  G.Rig = Rig;
  G.RIG = { DIM, PARTS, JOINTS, POSES, FK };
})(window.G);
