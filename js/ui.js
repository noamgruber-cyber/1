/* DOM UI: HUD, interactive upgrade hub, arrow list, shop / settings / leaders / pause / game-over / rewarded ad */
(function (G) {
  const UI = (G.UI = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const SKULL = '<svg class="sk" viewBox="-1 -1 2 2"><circle cx="0" cy="-.15" r=".72" fill="currentColor"/><rect x="-.4" y=".3" width=".8" height=".58" rx=".14" fill="currentColor"/><circle cx="-.28" cy="-.1" r=".2" fill="#222"/><circle cx=".28" cy="-.1" r=".2" fill="#222"/><path d="M0 .1 L-.1 .32 L.1 .32Z" fill="#222"/></svg>';
  const FILM = '<svg class="sk" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="3" fill="currentColor"/><path d="M10 8.5v7l6-3.5z" fill="#222"/></svg>';
  let upBtns = {}, arrRows = {};

  UI.init = function () {
    this.menu = $('#menu'); this.hud = $('#hud'); this.modalEl = $('#modal');
    // ---- center column: 8 upgrades + nav row
    const center = $('#col-center'); center.innerHTML = '';
    const list = el('div', 'uplist');
    for (const u of G.UPGRADES) {
      const b = el('button', 'up ' + u.color);
      b.innerHTML = '<span class="nm"></span><span class="vl"></span><span class="cost"></span>';
      b.addEventListener('click', () => this.buy(u.id));
      list.appendChild(b); upBtns[u.id] = b;
    }
    center.appendChild(list);
    const nav = el('div', 'nav');
    const mk = (cls, html, fn, label) => { const b = el('button', 'nbtn ' + cls, html); b.setAttribute('aria-label', label); b.addEventListener('click', () => { G.Audio.init(); G.Audio.click(); fn(); }); nav.appendChild(b); };
    mk('shop', 'SHOP', () => this.openShop(), 'Shop');
    mk('gear', '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.4 5.2l1.7 1.3-2 3.5-2-.8a7.6 7.6 0 01-1.7 1l-.3 2.1h-4l-.3-2.1a7.6 7.6 0 01-1.7-1l-2 .8-2-3.5 1.7-1.3a7.800 7.800 0 010-2l-1.700-1.300 2-3.500 2 .8c.5-.4 1.100-.7 1.700-1l.3-2.100h4l.3 2.100c.6.300 1.200.6 1.700 1l2-.8 2 3.500-1.700 1.300c.1.700.1 1.300 0 2z"/></svg>', () => this.openSettings(), 'Settings');
    mk('lead', '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 21v-8h5v8zm6.500 0V6h5v15zM16 21v-11h5v11z"/></svg>', () => this.openLeaders(), 'Leaders');
    center.appendChild(nav);
    // ---- right column: arrows
    const right = $('#col-right'); right.innerHTML = '';
    for (const a of G.ARROWS) {
      const r = el('div', 'arr');
      r.innerHTML = '<canvas width="150" height="44"></canvas><div class="meta"><b>' + a.name + '</b><small>' + a.desc + '</small></div><div class="state"></div>';
      G.arrowPreview(r.querySelector('canvas'), a.id);
      r.addEventListener('click', () => this.arrowClick(a.id));
      right.appendChild(r); arrRows[a.id] = r;
    }
    // ---- top bar / ad / pause
    $('#ad-btn').innerHTML = FILM + '<span>+' + G.C.AD_REWARD + '</span>';
    $('#ad-btn').addEventListener('click', () => { G.Audio.init(); this.openAd(); });
    $('#pause-btn').addEventListener('click', () => { G.Audio.init(); this.pause(); });
    $('#skull-ico').innerHTML = SKULL;
    this.refresh();
  };

  /* ---------------------------------------------------------- state callbacks */
  UI.onMenu = function () {
    document.body.dataset.state = 'menu';
    this.closeModal();
    G.Game.paused = false;
    this.refresh();
  };
  UI.onScene = function () { /* new scene built */ };
  UI.onRunStart = function () { document.body.dataset.state = 'run'; this.refresh(); };
  UI.onGameOver = function (run) {
    const S = G.Save.d;
    this.openModal(`
      <h2>YOU FELL</h2>
      <div class="stats">
        <div><span>WAVE</span><b>${run.wave}</b></div>
        <div><span>KILLS</span><b>${run.kills}</b></div>
        <div><span>SKULLS</span><b>+${run.skulls}</b></div>
        <div><span>BEST WAVE</span><b>${S.bestWave}</b></div>
      </div>
      <p class="sub">SEASON ${S.season} · SCORE ${S.score}/${G.C.SEASON_GOAL}</p>
      <div class="row"><button class="big red" id="go-ok">CONTINUE</button></div>`, 'over');
    $('#go-ok').addEventListener('click', () => { G.Audio.click(); G.Game.toMenu(); });
  };

  UI.updateHud = function () {
    const S = G.Save.d;
    $('#skull-n').textContent = S.skulls;
    $('#season').textContent = 'SEASON ' + S.season;
    $('#score').textContent = 'SCORE ' + S.score + '/' + G.C.SEASON_GOAL;
    $('#wave').textContent = 'WAVE ' + G.Game.wave;
  };

  /* ---------------------------------------------------------- menu refresh */
  UI.refresh = function () {
    this.updateHud();
    const S = G.Save.d;
    for (const u of G.UPGRADES) {
      const b = upBtns[u.id], lvl = G.Save.level(u.id), cur = G.upValue(u, lvl), maxed = lvl >= u.max;
      b.querySelector('.nm').textContent = u.name;
      b.querySelector('.vl').innerHTML = u.fmt(cur) + (maxed ? '' : ' <i>+' + (u.id === 'refresh' ? u.inc.toFixed(1) : u.inc) + '</i>');
      const cost = G.Save.cost(u.id);
      b.querySelector('.cost').innerHTML = maxed ? 'MAX' : cost + SKULL;
      b.classList.toggle('poor', !maxed && S.skulls < cost);
      b.classList.toggle('maxed', maxed);
    }
    G.Game.syncSlots && G.Game.player && G.Game.syncSlots();
    const slotN = G.Save.slotCount();
    for (const a of G.ARROWS) {
      const r = arrRows[a.id], owned = S.owned.includes(a.id), idx = a.id === 'default' ? 0 : S.equipped.indexOf(a.id);
      const on = owned && idx >= 0 && idx < slotN;
      r.classList.toggle('locked', !owned); r.classList.toggle('on', on);
      r.querySelector('.state').innerHTML = !owned
        ? '<span class="price' + (S.skulls < a.cost ? ' poor' : '') + '">' + a.cost + SKULL + '</span>'
        : '<span class="radio' + (on ? ' on' : '') + '"></span>' + (on ? '<small>SLOT ' + (idx + 1) + '</small>' : '');
    }
    $('#col-right').dataset.slots = slotN;
  };

  UI.buy = function (id) {
    const u = G.UP_BY_ID[id], S = G.Save.d, lvl = G.Save.level(id), cost = G.Save.cost(id);
    G.Audio.init();
    if (lvl >= u.max || S.skulls < cost) { G.Audio.deny(); this.shake(upBtns[id]); return; }
    S.skulls -= cost; S.levels[id] = lvl + 1; G.Save.save();
    G.Audio.buy();
    if (G.Game.state === 'menu') G.Game.rebuildPlayer();
    this.refresh();
    upBtns[id].classList.remove('flash'); void upBtns[id].offsetWidth; upBtns[id].classList.add('flash');
  };

  UI.arrowClick = function (id) {
    const a = G.ARROW_BY_ID[id], S = G.Save.d;
    G.Audio.init();
    if (!S.owned.includes(id)) {
      if (S.skulls < a.cost) { G.Audio.deny(); this.shake(arrRows[id]); return; }
      S.skulls -= a.cost; S.owned.push(id); G.Audio.buy();
      this.equip(id);
    } else if (id !== 'default') {
      const idx = S.equipped.indexOf(id);
      if (idx > 0 && idx < G.Save.slotCount()) { S.equipped[idx] = null; G.Audio.click(); }
      else this.equip(id);
    } else G.Audio.click();
    G.Save.save(); this.refresh();
  };
  UI.equip = function (id) {
    const S = G.Save.d, n = G.Save.slotCount();
    S.equipped = S.equipped.map((x, i) => (x === id ? null : x));
    let slot = -1;
    for (let i = 1; i < n; i++) if (!S.equipped[i]) { slot = i; break; }
    if (slot < 0) slot = n - 1;
    S.equipped[slot] = id;
  };
  UI.shake = function (e) { e.classList.remove('nope'); void e.offsetWidth; e.classList.add('nope'); };

  /* ---------------------------------------------------------- modals */
  UI.openModal = function (html, kind) {
    this.modalEl.innerHTML = '<div class="card ' + (kind || '') + '">' + html + '</div>';
    this.modalEl.classList.add('show'); G.Game.modal = true; this.modalKind = kind;
  };
  UI.closeModal = function () { this.modalEl.classList.remove('show'); this.modalEl.innerHTML = ''; G.Game.modal = false; this.modalKind = null; };
  const closeBtn = () => '<button class="x" id="m-x" aria-label="Close">×</button>';
  const wireClose = () => $('#m-x').addEventListener('click', () => { G.Audio.click(); UI.closeModal(); UI.refresh(); });

  UI.openShop = function () {
    const S = G.Save.d;
    const rows = G.SKINS.map((s) => {
      const owned = S.skins.includes(s.id), eq = S.skin === s.id;
      return `<div class="srow"><i class="swatch" style="background:${s.color}"></i><b>${s.name}</b>
        <button data-skin="${s.id}" class="${eq ? 'on' : owned ? '' : S.skulls < s.cost ? 'poor' : ''}">${eq ? 'EQUIPPED' : owned ? 'EQUIP' : s.cost + SKULL}</button></div>`;
    }).join('');
    this.openModal(`${closeBtn()}<h2>SHOP</h2>
      <h3>BOW SKINS</h3><div class="slist">${rows}</div>
      <h3>SKULL BUNDLE</h3>
      <div class="srow"><i class="swatch" style="background:#fff">${SKULL}</i><b>+500 SKULLS</b><button data-iap="1">DEMO · FREE</button></div>
      <p class="sub">Arrow packs are unlocked from the arrow list on the right. Bundles are a mock purchase in this prototype — no real payment is made.</p>`, 'shop');
    wireClose();
    this.modalEl.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.skin, s = G.SKINS.find((x) => x.id === id);
      if (!S.skins.includes(id)) { if (S.skulls < s.cost) { G.Audio.deny(); return; } S.skulls -= s.cost; S.skins.push(id); G.Audio.buy(); }
      S.skin = id; G.Save.save(); G.Game.rebuildPlayer(); this.refresh(); this.openShop();
    }));
    $('[data-iap]', this.modalEl).addEventListener('click', () => { S.skulls += 500; G.Audio.pickup(); G.Save.save(); this.refresh(); this.openShop(); });
  };

  UI.openSettings = function () {
    const st = G.Save.d.settings;
    this.openModal(`${closeBtn()}<h2>SETTINGS</h2>
      <label class="set">SOUND <input id="s-sfx" type="range" min="0" max="1" step="0.05" value="${st.sfx}"></label>
      <label class="set">AIM SENSITIVITY <input id="s-sens" type="range" min="0.5" max="2" step="0.1" value="${st.sens}"></label>
      <label class="set">HAPTICS <button class="tog ${st.haptics ? 'on' : ''}" id="s-hap">${st.haptics ? 'ON' : 'OFF'}</button></label>
      <label class="set">AIM ASSIST LINE <button class="tog ${st.assist ? 'on' : ''}" id="s-asi">${st.assist ? 'ON' : 'OFF'}</button></label>
      <div class="row"><button class="small" id="s-reset">RESET PROGRESS</button></div>`, 'settings');
    wireClose();
    $('#s-sfx').addEventListener('input', (e) => { st.sfx = +e.target.value; G.Save.save(); });
    $('#s-sfx').addEventListener('change', () => G.Audio.pickup());
    $('#s-sens').addEventListener('input', (e) => { st.sens = +e.target.value; G.Save.save(); });
    const tog = (id, key) => $(id).addEventListener('click', (e) => { st[key] = !st[key]; e.target.classList.toggle('on', st[key]); e.target.textContent = st[key] ? 'ON' : 'OFF'; G.Save.save(); G.Audio.click(); });
    tog('#s-hap', 'haptics'); tog('#s-asi', 'assist');
    $('#s-reset').addEventListener('click', (e) => {
      if (e.target.dataset.sure) { G.Save.reset(); G.Game.toMenu(); return; }
      e.target.dataset.sure = 1; e.target.textContent = 'TAP AGAIN TO CONFIRM';
    });
  };

  UI.openLeaders = function () {
    const S = G.Save.d;
    const rows = S.leaders.length ? S.leaders.map((l, i) => `<tr><td>${i + 1}</td><td>${l.kills} KILLS</td><td>WAVE ${l.wave}</td><td>${new Date(l.t).toLocaleDateString()}</td></tr>`).join('')
      : '<tr><td colspan="4">NO RUNS YET — GO SHOOT SOMETHING</td></tr>';
    this.openModal(`${closeBtn()}<h2>LEADERS</h2>
      <p class="sub">SEASON ${S.season} · SCORE ${S.score}/${G.C.SEASON_GOAL} · BEST WAVE ${S.bestWave}</p>
      <div class="bar"><i style="width:${Math.min(100, (S.score / G.C.SEASON_GOAL) * 100)}%"></i></div>
      <table>${rows}</table>
      <p class="sub">Local leaderboard. A global board plugs in here via the platform SDK.</p>`, 'leaders');
    wireClose();
  };

  UI.openAd = function () {
    let t = 3;
    this.openModal(`<h2>REWARDED AD</h2><p class="sub">Simulated rewarded video. Watch to the end to earn <b>+${G.C.AD_REWARD}</b> skulls.</p>
      <div class="adbox"><div class="adbar"><i id="ad-fill"></i></div><span id="ad-t">${t}</span></div>`, 'ad');
    const iv = setInterval(() => {
      t--; const f = $('#ad-fill'); if (!f) { clearInterval(iv); return; }
      f.style.width = ((3 - t) / 3) * 100 + '%'; $('#ad-t').textContent = Math.max(t, 0);
      if (t <= 0) {
        clearInterval(iv); G.Save.d.skulls += G.C.AD_REWARD; G.Save.save(); G.Audio.pickup();
        this.openModal(`<h2>+${G.C.AD_REWARD} SKULLS</h2><div class="row"><button class="big red" id="ad-ok">COLLECT</button></div>`, 'ad');
        $('#ad-ok').addEventListener('click', () => { this.closeModal(); this.refresh(); });
      }
    }, 1000);
    requestAnimationFrame(() => { const f = $('#ad-fill'); if (f) f.style.width = '0%'; });
  };

  /* ---------------------------------------------------------- pause */
  UI.pause = function () {
    const g = G.Game;
    if (g.state === 'menu' || g.state === 'over' || g.state === 'dying' || g.paused) return;
    g.paused = true;
    this.openModal(`<h2>PAUSED</h2><div class="row col">
      <button class="big red" id="p-res">RESUME</button>
      <button class="big" id="p-quit">QUIT RUN</button></div>`, 'pause');
    $('#p-res').addEventListener('click', () => UI.resume());
    $('#p-quit').addEventListener('click', () => { g.paused = false; g.closeModal; g.player.alive && (g.state = 'over'); g.timeScale = 1; UI.closeModal(); g.endRun(); });
  };
  UI.resume = function () { G.Game.paused = false; this.closeModal(); };
  UI.togglePause = function () {
    if (G.Game.paused && this.modalKind === 'pause') this.resume();
    else if (!G.Game.modal) this.pause();
    else if (this.modalKind && this.modalKind !== 'over') { this.closeModal(); this.refresh(); }
  };
})(window.G);
