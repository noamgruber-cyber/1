/* Persistent save (localStorage with in-memory fallback) */
(function (G) {
  const KEY = 'ragdoll-archery-defense-v1';
  const DEFAULT = () => ({
    skulls: 0,
    levels: {},            // upgrade id -> level
    owned: ['default'],    // unlocked arrow ids
    equipped: ['default', null, null, null, null, null], // per slot
    season: 5,
    score: 0,              // seasonal score
    bestWave: 0,
    leaders: [],           // {kills, wave, t}
    skin: 'gold',
    skins: ['gold'],
    settings: { sfx: 0.8, haptics: true, guide: true, magnet: true, sens: 1.0 },
  });
  let data = DEFAULT();
  let mem = null;
  const store = {
    get() { try { return window.localStorage.getItem(KEY); } catch (e) { return mem; } },
    set(v) { try { window.localStorage.setItem(KEY, v); } catch (e) { mem = v; } },
  };
  G.Save = {
    get d() { return data; },
    load() {
      try {
        const raw = store.get();
        if (raw) {
          const parsed = JSON.parse(raw);
          const def = DEFAULT();
          data = Object.assign(def, parsed);
          data.settings = Object.assign(def.settings, parsed.settings || {});
          while (data.equipped.length < 6) data.equipped.push(null);
        }
      } catch (e) { data = DEFAULT(); }
    },
    save() { try { store.set(JSON.stringify(data)); } catch (e) { /* ignore */ } },
    reset() { data = DEFAULT(); this.save(); },
    level(id) { return data.levels[id] || 0; },
    value(id) { return G.upValue(G.UP_BY_ID[id], this.level(id)); },
    cost(id) { return G.upCost(G.UP_BY_ID[id], this.level(id)); },
    slotCount() { return Math.min(6, this.value('slots')); },
    // arrows currently available on the tower HUD (never empty; slot 0 is always DEFAULT)
    activeSlots() {
      const n = this.slotCount();
      const out = [];
      for (let i = 0; i < n; i++) {
        const id = i === 0 ? 'default' : data.equipped[i];
        if (id && data.owned.includes(id)) out.push(id);
      }
      return out;
    },
  };
})(window.G);
