// player.js — the Warden: movement, dash, the three switchable weapons,
// the ember-beam (the game's light core), bombs, and damage handling.
//
// LIGHT CORE: the Warden carries a lantern. Its light radius is a resource:
// it shrinks as the night deepens each wave, grows with upgrades, and is
// what makes shade enemies (void dashers) vulnerable. The ember-beam is
// weapon 1: a sweeping cone of shrine-light aimed with the mouse. Enemies
// caught in the beam take damage every tick; the beam also re-lights
// snuffed torches it sweeps across and reflects off mirror shards.

import { clamp, dist, angleTo } from './storage.js';
import { spawnBurst, spawnEmbers, spawnRing, spawnFloat } from './particles.js';

export const WEAPONS = [
  {
    id: 'beam', slot: 1, name: 'EMBER-BEAM', key: '1',
    desc: 'Hold click: sweep a cone of shrine-light. Hurts shades, relights torches.',
    color: '#ffb347', damage: 26, range: 430, arc: 0.42,
  },
  {
    id: 'spread', slot: 2, name: 'EMBER SPREAD', key: '2',
    desc: 'Fan of burning shot. Fast, close, forgiving.',
    color: '#ff7a2e', damage: 13, rate: 0.16, speed: 720, pellets: 5, spread: 0.5,
  },
  {
    id: 'lance', slot: 3, name: 'PIERCING LANCE', key: '3',
    desc: 'A long lance of light that pierces a line of foes.',
    color: '#7df9e0', damage: 38, rate: 0.5, speed: 950, pellets: 1, spread: 0, pierce: 4,
  },
];

export function createPlayer(x, y) {
  return {
    x, y, r: 20, angle: -Math.PI / 2,
    hp: 100, maxHp: 100,
    speed: 265, baseSpeed: 265,
    weapon: 0,                       // index into WEAPONS
    fireCd: 0, fireRateMul: 1, damageMul: 1,
    multishot: 0, pierceBonus: 0, critChance: 0.05,
    dashCd: 0, dashCdMax: 2.2, dashTime: 0, dashDirX: 0, dashDirY: 1,
    invuln: 0,                       // i-frames after a hit / during dash
    bombs: 2, maxBombs: 4,
    blades: 0, bladeAngle: 0, bladeDmg: 22, bladeRadius: 92, // orbiting blades
    magnet: 90, magnetMul: 1,
    shardMul: 1, regen: 0, thorns: 0,
    lightRadius: 270, lightBonus: 0,   // lantern light
    beamKills: 0,
    moving: false,
  };
}

// The lantern's effective radius right now: base + upgrades, shrinking as
// the night deepens (G.darkness 0..1), never below a playable floor.
export function lightRadius(G) {
  const p = G.player;
  const night = 1 - G.darkness * 0.55;
  return Math.max(150, (p.lightRadius + p.lightBonus) * night);
}

// Is a point inside any light? Lantern, shrine glow, or a lit torch.
export function pointInLight(G, x, y) {
  const p = G.player;
  if (dist(x, y, p.x, p.y) <= lightRadius(G)) return true;
  if (dist(x, y, 640, 330) <= 190) return true; // shrine glow
  for (const t of G.torches) {
    if (t.lit && dist(x, y, t.x, t.y) <= t.radius) return true;
  }
  return false;
}

export function switchWeapon(G, slot) {
  const p = G.player;
  if (slot >= 1 && slot <= WEAPONS.length) {
    p.weapon = slot - 1;
    G.audio.click();
    pushRadio(G, `Warden: ${WEAPONS[p.weapon].name} ready.`);
  }
}

export function tryDash(G, mx, my) {
  const p = G.player;
  if (p.dashCd > 0) return false;
  const a = angleTo(p.x, p.y, mx, my);
  p.dashDirX = Math.cos(a); p.dashDirY = Math.sin(a);
  p.dashTime = 0.16; p.dashCd = p.dashCdMax; p.invuln = Math.max(p.invuln, 0.25);
  G.audio.dash();
  spawnBurst(G, p.x, p.y, '#7df9e0', 10, 160, 0.35, 3);
  return true;
}

export function tryBomb(G) {
  const p = G.player;
  if (p.bombs <= 0 || G.state !== 'play') return false;
  p.bombs--;
  G.audio.bomb();
  G.shake = Math.max(G.shake, 16);
  spawnRing(G, p.x, p.y, '#ffb347', 420, 0.6);
  spawnEmbers(G, p.x, p.y, 26);
  // A bomb is a burst of shrine-light: it hurts everything on screen,
  // relights every snuffed torch, and briefly floods the arena with light.
  for (const e of G.enemies) {
    if (e.hp > 0) damageEnemy(G, e, 90 * p.damageMul, e.x, e.y, true);
  }
  for (const t of G.torches) if (!t.lit) { t.lit = true; t.radius = 150; }
  G.flash = 0.5;
  pushRadio(G, 'Warden: Shrine-flare! The dark recoils!');
  return true;
}

// Shared damage path for enemies (also used by bombs, blades, thorns).
export function damageEnemy(G, e, dmg, hx, hy, isCrit) {
  if (e.hp <= 0) return 0;
  // Shades (void dashers) are immune outside the light — the beam, the
  // lantern, the shrine or a torch must be touching them.
  if (e.shade && !pointInLight(G, e.x, e.y)) {
    if (G.rng() < 0.12) spawnFloat(G, e.x, e.y - 20, 'IMMUNE — NEEDS LIGHT', '#b9c7ff', 12);
    return 0;
  }
  const crit = isCrit || G.rng() < G.player.critChance;
  const dealt = Math.round(dmg * (crit ? 2 : 1));
  e.hp -= dealt;
  e.flash = 0.12;
  spawnFloat(G, e.x + (G.rng() - 0.5) * 14, e.y - e.r - 4, String(dealt),
    crit ? '#ffd76a' : '#ffffff', crit ? 19 : 14);
  if (hx !== undefined) { // knockback away from the hit
    const a = angleTo(hx, hy, e.x, e.y);
    const kb = (e.knockResist || 1) * 26;
    e.x += Math.cos(a) * kb * 0.12; e.y += Math.sin(a) * kb * 0.12;
  }
  return dealt;
}

export function hurtPlayer(G, dmg, sx, sy) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'play') return;
  p.hp -= dmg;
  p.invuln = 0.7;
  G.shake = Math.max(G.shake, 9);
  G.vignette = 1;
  G.audio.playerHurt();
  spawnBurst(G, p.x, p.y, '#ff4d4d', 12, 200, 0.4, 4);
  spawnFloat(G, p.x, p.y - 30, `-${dmg}`, '#ff6b6b', 17);
  if (p.hp <= 0) { p.hp = 0; die(G); }
}

export function healPlayer(G, amt) {
  const p = G.player;
  const healed = Math.min(amt, p.maxHp - p.hp);
  if (healed <= 0) return 0;
  p.hp += healed;
  spawnFloat(G, p.x, p.y - 30, `+${Math.round(healed)}`, '#7dffb0', 16);
  return healed;
}

export function die(G) {
  G.state = 'over';
  G.timeOver = G.time;
  G.audio.defeat();
  G.audio.stopMusic();
  spawnBurst(G, G.player.x, G.player.y, '#ffb347', 40, 320, 0.9, 5);
  spawnRing(G, G.player.x, G.player.y, '#ff6b1a', 180, 0.7);
}

// Radio callouts: short contextual lines the HUD shows (and screenshots
// capture) — the Warden talking to the shrine, like a squad radio.
export function pushRadio(G, text) {
  G.radio.push({ text, t: G.time });
  if (G.radio.length > 3) G.radio.shift();
}
export function pushKillfeed(G, text) {
  G.killfeed.unshift({ text, t: G.time });
  if (G.killfeed.length > 5) G.killfeed.pop();
}

export function updatePlayer(G, dt, mv, mx, my) {
  const p = G.player;
  const input = G.input;
  p.angle = angleTo(p.x, p.y, mx, my);
  p.moving = mv.x !== 0 || mv.y !== 0;

  // Dash: fast burst in the dash direction, then normal movement.
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashDirX * 780 * dt;
    p.y += p.dashDirY * 780 * dt;
  } else {
    p.x += mv.x * p.speed * dt;
    p.y += mv.y * p.speed * dt;
  }
  // Stay inside the arena ring (radius 300 around the shrine at 640,330,
  // plus a soft margin) and inside the canvas.
  const dx = p.x - 640, dy = p.y - 330;
  const d = Math.sqrt(dx * dx + dy * dy);
  const maxR = 318;
  if (d > maxR) { p.x = 640 + dx / d * maxR; p.y = 330 + dy / d * maxR; }
  p.x = clamp(p.x, 30, 1250); p.y = clamp(p.y, 30, 690);

  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // Orbiting blades spin and damage on contact.
  if (p.blades > 0) {
    p.bladeAngle += dt * 3.4;
    for (let i = 0; i < p.blades; i++) {
      const a = p.bladeAngle + (i / p.blades) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * p.bladeRadius;
      const by = p.y + Math.sin(a) * p.bladeRadius;
      for (const e of G.enemies) {
        if (e.hp <= 0 || e.bladeCd > 0) continue;
        if (dist(bx, by, e.x, e.y) < e.r + 16) {
          e.bladeCd = 0.45;
          damageEnemy(G, e, p.bladeDmg * p.damageMul, p.x, p.y, false);
          spawnBurst(G, e.x, e.y, '#7df9e0', 6, 140, 0.3, 3);
        }
      }
    }
  }

  // Weapon fire: mouse held (or Space) fires the selected weapon.
  const firing = input.mouse.down || input.keys.has(' ');
  if (firing && p.fireCd <= 0) fireWeapon(G, mx, my);

  // The ember-beam is continuous while held: damage ticks + torch relight.
  if (p.weapon === 0 && firing) updateBeam(G, mx, my, dt);
}

function fireWeapon(G, mx, my) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 0) { p.fireCd = 0.08; return; } // beam ticks in updateBeam
  const rate = (w.rate || 0.2) * p.fireRateMul;
  p.fireCd = rate;
  const pellets = (w.pellets || 1) + p.multishot;
  const base = angleTo(p.x, p.y, mx, my);
  for (let i = 0; i < pellets; i++) {
    const off = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * (w.spread / Math.max(1, pellets - 1)) * 2;
    const a = base + off + (G.rng() - 0.5) * 0.02;
    G.bullets.push({
      x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg: w.damage * p.damageMul, pierce: (w.pierce || 0) + p.pierceBonus,
      r: p.weapon === 2 ? 7 : 5, color: w.color, life: 1.1, hitSet: new Set(),
    });
  }
  G.audio.shoot();
  // Muzzle flash ember.
  spawnEmbers(G, p.x + Math.cos(base) * 30, p.y + Math.sin(base) * 30, 2);
  p.recoil = 0.06;
}

// Beam: enemies inside the cone (range + half-angle) take damage per tick;
// the cone also relights torches it sweeps and reflects off mirror shards.
function updateBeam(G, mx, my, dt) {
  const p = G.player;
  const w = WEAPONS[0];
  const base = angleTo(p.x, p.y, mx, my);
  p.beamAngle = base;
  p.beamOn = true;
  const tickDmg = w.damage * p.damageMul * dt * 3.2;
  const range = w.range + (G.beamRangeBonus || 0);
  let hitAny = false;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > range + e.r) continue;
    const a = angleTo(p.x, p.y, e.x, e.y);
    let diff = Math.abs(a - base);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < w.arc + Math.atan2(e.r, Math.max(40, d))) {
      damageEnemy(G, e, tickDmg, p.x, p.y, false);
      hitAny = true;
      if (G.rng() < dt * 14) spawnBurst(G, e.x, e.y, '#ffd76a', 2, 90, 0.25, 3);
    }
  }
  // Relight torches the beam sweeps across.
  for (const t of G.torches) {
    if (t.lit) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > range) continue;
    const a = angleTo(p.x, p.y, t.x, t.y);
    let diff = Math.abs(a - base);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < w.arc + 0.1) {
      t.lit = true; t.radius = 150;
      G.audio.torchRelight();
      spawnEmbers(G, t.x, t.y, 8);
      pushRadio(G, 'Torch relit — the light holds.');
    }
  }
  // Mirror shards: a picked-up mirror reflects the beam to the nearest foe.
  if (G.mirrorTime > 0 && G.enemies.length) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      damageEnemy(G, best, tickDmg * 1.5, p.x, p.y, false);
      G.mirrorTarget = best;
    }
  }
  if (hitAny && G.rng() < dt * 8) G.audio.beamTick();
  G.beamLen = w.range;
}
