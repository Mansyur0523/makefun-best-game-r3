// waves.js — wave composition and spawning. 15 waves to victory; a boss
// (Cinder Tyrant) on waves 5, 10 and 15. The night deepens every wave:
// G.darkness rises, the lantern's effective light shrinks, and more shades
// (void dashers) appear — so the player must keep investing in light.
//
// Composition grows with the wave: wraiths are the backbone, imps arrive
// from wave 2, spitters from wave 3, dashers (shades) from wave 4, golems
// from wave 6. Elites (gold-tinted, 3x HP) start appearing from wave 4.
// Spawns come from the arena edge gates (Ash Gate, Cinder Road, Teal Grove,
// Ember Shrine's far side) in a trickle so the fight ramps instead of
// dumping everything at once.

import { spawnEnemy, spawnBoss } from './enemies.js';
import { pushRadio } from './player.js';
import { recordRun } from './storage.js';

export const TOTAL_WAVES = 15;
export const BOSS_WAVES = [5, 10, 15];

// The four edge gates enemies pour in through (also minimap labels).
export const GATES = [
  { name: 'ASH GATE', x: 640, y: 36 },
  { name: 'CINDER ROAD', x: 950, y: 330 },
  { name: 'TEAL GROVE', x: 330, y: 330 },
  { name: 'EMBER PASS', x: 640, y: 624 },
];

// How many of each kind a wave fields. Tuned so wave 1 is gentle (8 foes)
// and wave 14 is a siege (~46 foes + elites), with the boss waves lighter
// on trash so the Tyrant is the star.
export function waveComposition(n) {
  const c = {
    wraith: 4 + Math.floor(n * 1.4),
    imp: n >= 2 ? 2 + Math.floor(n * 0.9) : 0,
    spitter: n >= 3 ? 1 + Math.floor(n * 0.55) : 0,
    dasher: n >= 4 ? 1 + Math.floor(n * 0.6) : 0,
    golem: n >= 6 ? Math.floor((n - 4) * 0.5) : 0,
  };
  if (BOSS_WAVES.includes(n)) {
    // Boss waves: fewer trash, the Tyrant carries the threat.
    c.wraith = Math.floor(c.wraith * 0.45);
    c.imp = Math.floor(c.imp * 0.5);
    c.spitter = Math.floor(c.spitter * 0.5);
    c.dasher = Math.floor(c.dasher * 0.5);
    c.golem = 0;
  }
  const total = c.wraith + c.imp + c.spitter + c.dasher + c.golem;
  return { ...c, total };
}

// Night deepening: 0 at wave 1, ~0.55 by wave 15. The lantern's effective
// radius is multiplied by (1 - darkness*0.55) in player.js.
export function darknessForWave(n) {
  return Math.min(0.62, (n - 1) * 0.045);
}

export function startWave(G, n) {
  G.wave = n;
  G.darkness = darknessForWave(n);
  G.waveState = 'fighting';
  G.waveT = 0;
  G.enemiesLeft = 0;
  const comp = waveComposition(n);
  // Build a shuffled spawn queue: types interleaved, elites sprinkled in.
  const queue = [];
  for (const [type, count] of Object.entries(comp)) {
    if (type === 'total') continue;
    for (let i = 0; i < count; i++) queue.push({ type, elite: false });
  }
  // Elites from wave 4: ~1 per 12 foes, at least 1 on wave 4+.
  const elites = n >= 4 ? Math.max(1, Math.floor(comp.total / 12)) : 0;
  for (let i = 0; i < elites && queue.length; i++) {
    const idx = Math.floor(G.rng() * queue.length);
    queue[idx].elite = true;
  }
  // Shuffle with the game's rng (deterministic per seed).
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(G.rng() * (i + 1));
    const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
  }
  G.spawnQueue = queue;
  G.spawnT = 0.4;
  G.spawnInterval = Math.max(0.35, 1.05 - n * 0.045);
  if (BOSS_WAVES.includes(n)) {
    // The Tyrant strides in first; its minions trickle after.
    spawnBoss(G, n);
    G.spawnT = 2.5;
  }
  G.audio.waveStart();
  const compText = Object.entries(comp).filter(([k, v]) => k !== 'total' && v > 0)
    .map(([k, v]) => `${v} ${k}`).join(', ');
  pushRadio(G, BOSS_WAVES.includes(n)
    ? `Wave ${n} — the Cinder Tyrant comes. Hold the light!`
    : `Wave ${n} — ${comp.total} foes: ${compText}.`);
  G.banner = { text: BOSS_WAVES.includes(n) ? `WAVE ${n} — CINDER TYRANT` : `WAVE ${n}`, t: 2.4 };
}

export function updateSpawning(G, dt) {
  if (G.state !== 'play' || G.waveState !== 'fighting') return;
  G.waveT += dt;
  if (G.spawnQueue.length > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.spawnT = G.spawnInterval;
      // Spawn in small groups so the pressure ramps within the wave.
      const group = G.wave >= 8 ? 2 : 1;
      for (let i = 0; i < group && G.spawnQueue.length; i++) {
        const s = G.spawnQueue.shift();
        const gate = GATES[Math.floor(G.rng() * GATES.length)];
        const x = gate.x + (G.rng() - 0.5) * 60;
        const y = gate.y + (G.rng() - 0.5) * 40;
        spawnEnemy(G, s.type, x, y, s.elite);
      }
    }
  }
  // Wave cleared: no queue, no live enemies, no boss.
  if (G.spawnQueue.length === 0 && G.enemies.length === 0 && !G.boss) {
    waveCleared(G);
  }
}

function waveCleared(G) {
  G.waveState = 'cleared';
  const bonus = 100 + G.wave * 50;
  G.score += bonus;
  G.audio.waveClear();
  // A cleared wave rekindles one snuffed torch — the shrine rewards holding.
  const snuffed = G.torches.find(t => !t.lit);
  if (snuffed) { snuffed.lit = true; snuffed.radius = 150; }
  if (G.wave >= TOTAL_WAVES && !G.endless) {
    victory(G);
    return;
  }
  G.banner = { text: `WAVE ${G.wave} CLEAR  ·  +${bonus}`, t: 2.0 };
  pushRadio(G, `Wave ${G.wave} clear! Choose a blessing, Warden.`);
  // Between waves: offer 1 of 3 upgrades, then the next wave.
  G.state = 'upgrade';
  G.upgradeChoices = null; // rolled by ui.js on first draw
  G.upgradeT = G.time;
}

function victory(G) {
  G.state = 'victory';
  G.timeVictory = G.time;
  G.audio.victory();
  G.audio.stopMusic();
  recordRun(G.score, G.wave, G.kills, true);
}

export function enemiesRemaining(G) {
  return G.spawnQueue.length + G.enemies.length;
}
