/* Touch / mouse / keyboard input. One pointer aims in the CONTROL AREA; others tap JUMP / arrow slots. */
(function (G) {
  const Input = (G.Input = {});
  const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  Input.init = function (game) {
    const cv = game.canvas;
    cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    cv.addEventListener('pointerdown', (e) => {
      G.Audio.init();
      if (game.modal || game.paused) return;
      const [x, y] = pos(e);
      const u = game.towerUI();
      if (inRect(u.jump, x, y) && game.player.alive) { game.jumpDown = true; game.jump(); game.jumpPid = e.pointerId; cv.setPointerCapture(e.pointerId); return; }
      for (let i = 0; i < u.slots.length; i++) if (inRect(u.slots[i], x, y)) { game.selectSlot(i); return; }
      const a = game.player.aimState;
      if (x < game.W * G.C.CONTROL_FRAC && !a.active && game.state !== 'over' && game.state !== 'dying') {
        game.beginAim(e.pointerId, x, y);
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const a = game.player.aimState;
      if (a.active && e.pointerId === a.pid) { const [x, y] = pos(e); game.moveAim(x, y); }
    });
    const up = (e) => {
      const a = game.player.aimState;
      if (e.pointerId === game.jumpPid) { game.jumpDown = false; game.jumpPid = null; }
      if (a.active && e.pointerId === a.pid) game.releaseAim();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => {
      const a = game.player.aimState;
      if (a.active && e.pointerId === a.pid) { a.active = false; a.charge = 0; }
      up(e);
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!game.modal && !game.paused) game.jump(); }
      else if (/^Digit[1-6]$/.test(e.code)) { if (!game.modal && !game.paused) game.selectSlot(+e.code.slice(5) - 1); }
      else if (e.code === 'Escape' || e.code === 'KeyP') G.UI.togglePause();
    });
    window.addEventListener('blur', () => { const a = game.player && game.player.aimState; if (a && a.active) { a.active = false; a.charge = 0; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'run') G.UI.pause(); });
  };
})(window.G);
