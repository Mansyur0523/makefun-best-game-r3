// shots.js — deterministic screenshot scenes for ?shot=<scene>&seed=<n>.
// Every scene is built from a seeded rng and a FIXED simulated time: no
// wall clock, no Math.random, no Date. The renderer draws the scene once
// and main.js sets window.__shotReady = true, so a headless browser can
// screenshot the exact same frame every run.
//
// Scenes: title | play (the cover: busy combat) | victory | over.
// Unknown scene names fall back to title.

import { spawnEnemy } from './enemies.js';
import { spawnBurst, spawnEmbers, spawnRing, spawnFloat } from './particles.js';
import { pushRadio, pushKillfeed } from './player.js';

// Place a foe at a seeded arena position (inside the ring, off the shrine).
function place(G, type, elite) {
  const a = G.rng() * Math.PI * 2;
  const r = 120 + G.rng() * 170;
  const x = 640 + Math.cos(a) * r;
  const y = 330 + Math.sin(a) * r * 0.8;
  return spawnEnemy(G, type, x, y, elite);
}

export function applyShot(G, scene) {
  const rng = G.rng;
  G.time = 0; // fixed base; each scene sets its own fixed time below
  if (scene === 'play') return applyPlay(G, rng);
  if (scene === 'victory') return applyVictory(G, rng);
  if (scene === 'over') return applyOver(G, rng);
  return applyTitle(G, rng);
}

function applyTitle(G, rng) {
  G.state = 'title';
  G.time = 14.5;
  G.wave = 1; G.darkness = 0;
  G.player.x = 640; G.player.y = 470;
  G.player.angle = -Math.PI / 2;
  // A quiet arena behind the title: a few wraiths drifting at the edges.
  place(G, 'wraith', false); place(G, 'wraith', false);
  place(G, 'imp', false); place(G, 'spitter', false);
  spawnEmbers(G, 640, 336, 10);
  G.score = 0; G.shards = 0; G.kills = 0;
}

function applyPlay(G, rng) {
  // The COVER: mid-fight on wave 7, night 27%, beam sweeping, the works.
  G.state = 'play';
  G.time = 83.4;
  G.wave = 7;
  G.darkness = 0.27;
  G.score = 2450; G.shards = 87; G.kills = 96;
  G.combo = 3; G.comboT = 2.1; G.bestCombo = 4;
  G.player.x = 520; G.player.y = 380;
  G.player.hp = 76; G.player.maxHp = 125;
  G.player.weapon = 0; // ember-beam out
  G.player.angle = 0.35;
  G.player.beamAngle = 0.35; G.player.beamOn = true;
  G.player.blades = 2; G.player.bladeAngle = 0.8;
  G.player.bombs = 2; G.player.lightBonus = 45;
  G.player.damageMul = 1.25; G.player.multishot = 1;
  G.upgradeLevels = { damage: 1, light: 1, blades: 2, multishot: 1 };
  G.beamRangeBonus = 0; G.mirrorTime = 6;
  // A busy field: every kind present, one elite, one dasher mid-telegraph.
  place(G, 'wraith', false); place(G, 'wraith', false); place(G, 'wraith', true);
  place(G, 'imp', false); place(G, 'imp', false); place(G, 'cinder', false);
  place(G, 'spitter', false); place(G, 'spitter', false);
  place(G, 'golem', false);
  const dasher = place(G, 'dasher', false);
  if (dasher) { dasher.state = 'aim'; dasher.stateT = 0.4; dasher.angle = 2.6; }
  const wraith = place(G, 'wraith', false);
  // Mirror target: the nearest foe to the player gets the reflected beam.
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
    if (d < bd) { bd = d; best = e; }
  }
  G.mirrorTarget = best;
  // Bullets in flight (spread + lance).
  for (let i = 0; i < 7; i++) {
    const a = 0.2 + (rng() - 0.5) * 0.5;
    G.bullets.push({
      x: 560 + i * 42, y: 360 + (rng() - 0.5) * 90,
      vx: Math.cos(a) * 720, vy: Math.sin(a) * 720,
      dmg: 13, pierce: 0, r: 5, color: i % 3 === 0 ? '#7df9e0' : '#ff7a2e',
      life: 0.8, hitSet: new Set(),
    });
  }
  // Enemy globs arcing in.
  for (let i = 0; i < 3; i++) {
    G.ebullets.push({
      x: 700 + rng() * 200, y: 250 + rng() * 120,
      vx: -120, vy: 90, dmg: 9, r: 8, color: '#a8ff7a', life: 2, arc: true,
    });
  }
  // Pickups on the ground: shards, a heart, a mirror.
  G.pickups.push(
    { kind: 'shard', x: 600, y: 470, vx: 0, vy: 0, value: 3, life: 10, r: 7 },
    { kind: 'shard', x: 640, y: 500, vx: 0, vy: 0, value: 3, life: 10, r: 7 },
    { kind: 'heart', x: 470, y: 500, vx: 0, vy: 0, value: 25, life: 10, r: 11 },
    { kind: 'mirror', x: 760, y: 480, vx: 0, vy: 0, value: 1, life: 10, r: 11 },
  );
  // One torch snuffed (the beam is about to relight it), the rest burning.
  if (G.torches[2]) { G.torches[2].lit = false; G.torches[2].radius = 0; }
  // Combat feedback everywhere: bursts, embers, rings, damage numbers.
  spawnBurst(G, 700, 330, '#ff9d2e', 16, 220, 0.5, 4);
  spawnBurst(G, 820, 300, '#8f7bff', 12, 180, 0.45, 4);
  spawnEmbers(G, 640, 336, 14);
  spawnRing(G, 700, 330, '#ffd76a', 80, 0.4);
  spawnFloat(G, 700, 300, '26', '#ffffff', 15);
  spawnFloat(G, 760, 320, '52', '#ffd76a', 19);
  spawnFloat(G, 640, 280, '+150', '#ffd76a', 15);
  if (wraith) { wraith.hp = Math.floor(wraith.maxHp * 0.55); }
  // Kill feed + radio, as if the fight has been running a while.
  pushKillfeed(G, 'Ember Imp slain  ·  +120  (x3)');
  pushKillfeed(G, 'Ash Wraith slain  ·  +150  (x2)');
  pushKillfeed(G, 'Elite Ash Wraith dropped a mirror!');
  pushKillfeed(G, 'Void Dasher slain  ·  +270  (x3)');
  pushRadio(G, 'Warden: Dasher in the dark — keep it in the light!');
  pushRadio(G, 'An imp snuffed a torch — sweep the beam over it!');
  G.banner = { text: 'WAVE 7', t: 0.9 };
}

function applyVictory(G, rng) {
  G.state = 'victory';
  G.time = 742.0;
  G.wave = 15; G.darkness = 0;
  G.score = 12480; G.shards = 412; G.kills = 312;
  G.bestCombo = 5; G.combo = 1;
  G.player.x = 640; G.player.y = 470;
  G.player.hp = 58; G.player.maxHp = 175;
  G.player.weapon = 0; G.player.blades = 3;
  G.upgradeLevels = { damage: 3, light: 4, blades: 3, vitality: 3, beam: 2 };
  // Dawn breaks: all torches lit, embers rising, the Tyrant's remains.
  for (const t of G.torches) { t.lit = true; t.radius = 150; }
  spawnEmbers(G, 640, 336, 26);
  spawnBurst(G, 640, 300, '#ffd76a', 24, 260, 0.8, 5);
  spawnRing(G, 640, 330, '#ffb347', 200, 0.7);
  place(G, 'wraith', false); // one last wisp fading at the edge
  pushKillfeed(G, '☀ CINDER TYRANT PRIME FELLED — Wave 15 clear!');
  pushRadio(G, 'The Tyrant is down. The shrine burns brighter.');
}

function applyOver(G, rng) {
  G.state = 'over';
  G.time = 386.5;
  G.wave = 9; G.darkness = 0.36;
  G.score = 5120; G.shards = 164; G.kills = 178;
  G.bestCombo = 4; G.combo = 1;
  G.player.x = 640; G.player.y = 430;
  G.player.hp = 0; G.player.maxHp = 125;
  G.player.weapon = 1;
  // The horde closes in on the fallen Warden.
  place(G, 'wraith', false); place(G, 'wraith', false);
  place(G, 'imp', false); place(G, 'golem', false);
  const d = place(G, 'dasher', false);
  if (d) { d.state = 'charge'; d.angle = 2.4; }
  place(G, 'spitter', false);
  if (G.torches[1]) { G.torches[1].lit = false; G.torches[1].radius = 0; }
  if (G.torches[3]) { G.torches[3].lit = false; G.torches[3].radius = 0; }
  spawnBurst(G, 640, 430, '#ffb347', 36, 300, 0.9, 5);
  spawnRing(G, 640, 430, '#ff6b1a', 170, 0.7);
  spawnFloat(G, 640, 380, '-22', '#ff6b6b', 17);
  pushKillfeed(G, 'Stone Golem slain  ·  +450  (x4)');
  pushKillfeed(G, 'Ash Wraith slain  ·  +150  (x3)');
  pushRadio(G, 'Warden: the dark is closing in… hold on—');
}
