/* Tiny WebAudio synth for all SFX (no asset files) */
(function (G) {
  let ac = null, master = null, noiseBuf = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  const vol = () => (G.Save ? G.Save.d.settings.sfx : 0.8);
  function tone(f0, dur, type, v, f1, delay) {
    if (!ac || vol() <= 0) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(v * vol(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, v, freq, q, f1, type, delay) {
    if (!ac || vol() <= 0) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    f.Q.value = q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(v * vol(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  let lastHit = 0;
  const S = {
    init,
    draw() { noise(0.35, 0.12, 300, 6, 900, 'bandpass'); },                 // bowstring creak
    release(kind) {
      tone(260, 0.18, 'triangle', 0.35, 90);                                // twang
      noise(0.08, 0.2, 2500, 1, 800, 'highpass');
      if (kind === 'fire') noise(0.4, 0.18, 900, 0.7, 300, 'bandpass');
      if (kind === 'electro') tone(900, 0.2, 'sawtooth', 0.12, 200);
      if (kind === 'minigun') for (let i = 0; i < 4; i++) tone(500 + i * 40, 0.06, 'square', 0.1, 250, i * 0.035);
      if (kind === 'shot') tone(110, 0.25, 'sawtooth', 0.3, 50);
    },
    enemyRelease() { tone(200, 0.15, 'triangle', 0.18, 80); },
    hit(heavy) {
      const n = performance.now(); if (n - lastHit < 25) return; lastHit = n;
      tone(130, 0.14, 'sine', 0.45, 55); noise(0.1, heavy ? 0.4 : 0.25, 700, 0.8, 200, 'lowpass');
    },
    headshot() { tone(900, 0.1, 'square', 0.12, 300); tone(100, 0.2, 'sine', 0.5, 40); },
    clang() { tone(1250, 0.35, 'square', 0.16, 1180); tone(1870, 0.3, 'triangle', 0.14, 1800); noise(0.05, 0.25, 4000, 1, 2000, 'highpass'); },
    stone() { noise(0.12, 0.25, 500, 0.6, 150, 'lowpass'); tone(90, 0.1, 'square', 0.12, 50); },
    pop() { noise(0.12, 0.3, 1500, 1, 400, 'bandpass'); tone(700, 0.1, 'sine', 0.3, 200); },
    pickup() { [520, 660, 880].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, f * 1.01, i * 0.07)); },
    rumble() { noise(0.9, 0.5, 160, 0.7, 60, 'lowpass'); tone(55, 0.8, 'sawtooth', 0.12, 35); },
    zap() { noise(0.3, 0.3, 3000, 4, 300, 'bandpass'); tone(1400, 0.25, 'sawtooth', 0.14, 120); },
    ignite() { noise(0.5, 0.25, 1200, 0.6, 300, 'bandpass'); },
    inflate() { noise(0.35, 0.2, 600, 2, 1800, 'bandpass'); tone(300, 0.3, 'sine', 0.12, 700); },
    jump() { tone(260, 0.16, 'sine', 0.22, 520); },
    skull() { tone(1200, 0.08, 'square', 0.1, 1600); tone(1600, 0.12, 'square', 0.1, 2000, 0.06); },
    kill() { tone(180, 0.3, 'sawtooth', 0.2, 60); },
    hurt() { tone(160, 0.25, 'sawtooth', 0.35, 60); noise(0.18, 0.3, 500, 1, 150, 'lowpass'); },
    revive() { [330, 440, 660, 880].forEach((f, i) => tone(f, 0.25, 'triangle', 0.25, f, i * 0.08)); },
    die() { tone(220, 0.9, 'sawtooth', 0.3, 40); noise(0.8, 0.3, 400, 1, 80, 'lowpass'); },
    click() { tone(700, 0.05, 'square', 0.08, 500); },
    buy() { tone(600, 0.08, 'square', 0.12, 800); tone(900, 0.12, 'square', 0.12, 1200, 0.06); },
    deny() { tone(150, 0.15, 'square', 0.15, 100); },
    wave() { [262, 330, 392].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, f, i * 0.12)); },
  };
  G.Audio = S;
})(window.G);
