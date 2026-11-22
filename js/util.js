/* Shared namespace + math helpers */
window.G = window.G || {};
(function (G) {
  G.TAU = Math.PI * 2;
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.wrapAngle = (a) => {
    while (a > Math.PI) a -= G.TAU;
    while (a < -Math.PI) a += G.TAU;
    return a;
  };
  G.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(G.TAU * v);
  };
  G.hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  G.mix = (c1, c2, t) => {
    const a = G.hex(c1), b = G.hex(c2);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  };
  // squared distance between two segments (2D)
  G.segSegDist2 = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const rx = ax - cx, ry = ay - cy;
    const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
    let s, t;
    if (a < 1e-9 && e < 1e-9) return rx * rx + ry * ry;
    if (a < 1e-9) { s = 0; t = G.clamp(f / e, 0, 1); }
    else {
      const c = d1x * rx + d1y * ry;
      if (e < 1e-9) { t = 0; s = G.clamp(-c / a, 0, 1); }
      else {
        const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
        s = den > 1e-9 ? G.clamp((b * f - c * e) / den, 0, 1) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = G.clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = G.clamp((b - c) / a, 0, 1); }
      }
    }
    const px = ax + d1x * s - (cx + d2x * t), py = ay + d1y * s - (cy + d2y * t);
    return px * px + py * py;
  };
  G.ptSegDist2 = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l < 1e-9 ? 0 : G.clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
    const x = ax + dx * t - px, y = ay + dy * t - py;
    return x * x + y * y;
  };
  // rounded rect path helper (works everywhere)
  G.rrect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
})(window.G);
