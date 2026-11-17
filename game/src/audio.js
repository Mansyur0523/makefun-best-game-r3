// audio.js — all sound is synthesized with WebAudio: no audio files, no
// network. Short oscillator/noise blips for effects, plus a small
// procedural music loop (warm bass pulse + ember arpeggio) that runs while
// playing. AudioContext is created lazily on the first user gesture so
// autoplay policies never block the game; everything is guarded so a
// headless browser without audio still runs the game fine.

export function createAudio(settings) {
  const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    muted: !!settings.muted, musicTimer: null, musicStep: 0,
    started: false, nextNoteTime: 0,
  };

  A.ensure = function ensure() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.9;
      A.master.connect(A.ctx.destination);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = 0.5;
      A.sfxGain.connect(A.master);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.16;
      A.musicGain.connect(A.master);
      return true;
    } catch { return false; }
  };

  A.setMuted = function setMuted(m) {
    A.muted = m;
    if (A.master && A.ctx) A.master.gain.setTargetAtTime(m ? 0 : 0.9, A.ctx.currentTime, 0.02);
  };

  // One oscillator blip with pitch slide and exponential decay.
  A.blip = function blip(freq0, freq1, dur, type, vol, when = 0) {
    if (!A.ensure() || A.muted) return;
    try {
      const t = A.ctx.currentTime + when;
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(A.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  };

  // Filtered noise burst (hits, explosions, pickups shimmer).
  A.noise = function noise(dur, vol, freq, q, when = 0) {
    if (!A.ensure() || A.muted) return;
    try {
      const t = A.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource(); src.buffer = buf;
      const f = A.ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(A.sfxGain);
      src.start(t);
    } catch { /* ignore */ }
  };

  // ---- Named effects (called by gameplay code) ----
  A.shoot = () => { A.blip(720, 190, 0.09, 'square', 0.10); };
  A.beamTick = () => { A.blip(190, 320, 0.06, 'sawtooth', 0.05); };
  A.hit = () => { A.noise(0.06, 0.14, 2600, 1.2); };
  A.enemyDie = () => { A.blip(320, 60, 0.22, 'sawtooth', 0.16); A.noise(0.16, 0.14, 900, 0.7); };
  A.playerHurt = () => { A.blip(160, 55, 0.25, 'sawtooth', 0.22); A.noise(0.12, 0.12, 500, 0.7); };
  A.pickup = () => { A.blip(880, 1320, 0.09, 'sine', 0.16); A.blip(1320, 1760, 0.1, 'sine', 0.10, 0.06); };
  A.shard = () => { A.blip(1180, 1560, 0.06, 'triangle', 0.09); };
  A.dash = () => { A.noise(0.14, 0.16, 1800, 0.6); A.blip(300, 640, 0.12, 'sine', 0.08); };
  A.bomb = () => { A.noise(0.5, 0.35, 300, 0.5); A.blip(120, 30, 0.5, 'sine', 0.3); };
  A.upgrade = () => { [523, 659, 784, 1047].forEach((f, i) => A.blip(f, f, 0.16, 'triangle', 0.14, i * 0.07)); };
  A.waveStart = () => { A.blip(196, 392, 0.3, 'triangle', 0.16); A.blip(294, 588, 0.3, 'triangle', 0.1, 0.1); };
  A.waveClear = () => { [392, 523, 659].forEach((f, i) => A.blip(f, f * 1.01, 0.18, 'triangle', 0.13, i * 0.08)); };
  A.bossRoar = () => { A.blip(90, 45, 0.8, 'sawtooth', 0.3); A.noise(0.7, 0.2, 220, 0.5); };
  A.bossHit = () => { A.blip(70, 40, 0.2, 'square', 0.2); };
  A.torchSnuff = () => { A.blip(440, 110, 0.3, 'sine', 0.14); };
  A.torchRelight = () => { A.blip(330, 990, 0.2, 'sine', 0.13); };
  A.victory = () => { [523, 659, 784, 1047, 1319].forEach((f, i) => A.blip(f, f, 0.3, 'triangle', 0.15, i * 0.11)); };
  A.defeat = () => { [392, 330, 262, 196].forEach((f, i) => A.blip(f, f * 0.97, 0.35, 'triangle', 0.14, i * 0.16)); };
  A.click = () => { A.blip(660, 660, 0.05, 'sine', 0.12); };
  A.mirror = () => { A.blip(1568, 2093, 0.12, 'sine', 0.12); A.blip(2093, 2637, 0.12, 'sine', 0.08, 0.08); };

  // ---- Procedural music: A-minor ember groove ----
  // Bass roots walk Am - F - C - G; a pentatonic arpeggio sparkles above.
  // Scheduler runs on a 250 ms timer; notes are scheduled slightly ahead.
  const BASS = [110, 87.31, 130.81, 98];           // A2 F2 C3 G2
  const ARP = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 587.33];
  A.startMusic = function startMusic() {
    if (A.started || !A.ensure()) return;
    A.started = true;
    A.musicTimer = setInterval(() => {
      if (A.muted || !A.ctx) return;
      try {
        const step = A.musicStep++;
        const bar = Math.floor(step / 8) % 4;
        const t = A.ctx.currentTime + 0.05;
        if (step % 8 === 0) {
          const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
          o.type = 'triangle'; o.frequency.value = BASS[bar];
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
          o.connect(g); g.connect(A.musicGain); o.start(t); o.stop(t + 2);
        }
        if (step % 2 === 0) {
          const n = ARP[(step * 5 + bar * 3) % ARP.length] * (step % 16 === 14 ? 2 : 1);
          const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
          o.type = 'sine'; o.frequency.value = n;
          g.gain.setValueAtTime(0.22, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o.connect(g); g.connect(A.musicGain); o.start(t); o.stop(t + 0.55);
        }
      } catch { /* ignore */ }
    }, 250);
  };
  A.stopMusic = function stopMusic() {
    if (A.musicTimer) { clearInterval(A.musicTimer); A.musicTimer = null; A.started = false; }
  };
  return A;
}
