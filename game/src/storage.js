// storage.js — localStorage persistence (best score, settings) plus the
// seeded random generator and small math helpers shared by every module.
// Nothing here touches the network; everything is local to the browser.

export const BEST_KEY = 'ashenvale-arena-best-v1';
export const SETTINGS_KEY = 'ashenvale-arena-settings-v1';

// mulberry32: small, fast, deterministic PRNG. Same seed -> same stream,
// which is what the deterministic ?shot= scenes rely on.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// Pick one element from an array with the game's rng.
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
// Fisher-Yates shuffle that consumes the passed rng (deterministic per seed).
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return { score: 0, wave: 0, kills: 0, wins: 0 };
    const o = JSON.parse(raw);
    return {
      score: o.score | 0, wave: o.wave | 0, kills: o.kills | 0, wins: o.wins | 0,
    };
  } catch { return { score: 0, wave: 0, kills: 0, wins: 0 }; }
}

export function saveBest(best) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* private mode */ }
}

export function recordRun(score, wave, kills, won) {
  const best = loadBest();
  let changed = false;
  if (score > best.score) { best.score = score; changed = true; }
  if (wave > best.wave) { best.wave = wave; changed = true; }
  if (kills > best.kills) { best.kills = kills; changed = true; }
  if (won) { best.wins = (best.wins | 0) + 1; changed = true; }
  if (changed) saveBest(best);
  return best;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { muted: false };
    const o = JSON.parse(raw);
    return { muted: !!o.muted };
  } catch { return { muted: false }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
