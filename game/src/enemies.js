// enemies.js — the ash horde. Six kinds with distinct AI, plus elites and
// the boss. Light rules: VOID DASHERS are shades — immune to every weapon
// while they stand outside the light (lantern, shrine, torch or beam).
// EMBER IMPS are snuffers: when no torch is near they hunt the Warden, but
// when a lit torch is close they break off to snuff it out, shrinking the
// safe light and darkening the arena.
//
// Kinds:
//   wraith  — slow chase, drifts through the ash, steady damage
//   imp     — fast, weak, splits into two cinderlings on death; snuffs torches
//   spitter — keeps its distance, lobs burning globs in arcs
//   dasher  — shade: telegraphs, then charges in a line; immune outside light
//   golem   — slow brute, huge HP, heavy hit, resists knockback
//   boss    — Cinder Tyrant, every 5th wave, 3 phases

import { clamp, dist, angleTo, pick } from './storage.js';
import { spawnBurst, spawnEmbers, spawnRing, spawnFloat, spawnSmoke } from './particles.js';
import { damageEnemy, hurtPlayer, pushRadio, pushKillfeed } from './player.js';

export const ENEMY_TYPES = {
  wraith:  { name: 'Ash Wraith',  hp: 34,  speed: 92,  dmg: 10, r: 19, shards: 3,  score: 50,  color: '#9aa7c7' },
  imp:     { name: 'Ember Imp',   hp: 18,  speed: 175, dmg: 7,  r: 13, shards: 2,  score: 40,  color: '#ff8c2e' },
  spitter: { name: 'Ash Spitter', hp: 26,  speed: 78,  dmg: 9,  r: 16, shards: 4,  score: 70,  color: '#7ddc8a' },
  dasher:  { name: 'Void Dasher', hp: 30,  speed: 120, dmg: 14, r: 16, shards: 5,  score: 90,  color: '#8f7bff', shade: true },
  golem:   { name: 'Stone Golem', hp: 150, speed: 46,  dmg: 22, r: 27, shards: 9,  score: 150, color: '#a89a86' },
  cinder:  { name: 'Cinderling',  hp: 9,   speed: 200, dmg: 5,  r: 9,  shards: 1,  score: 20,  color: '#ffb347' },
};

let nextId = 1;

export function spawnEnemy(G, type, x, y, elite) {
  const t = ENEMY_TYPES[type];
  if (!t) return null;
  const hpScale = 1 + (G.wave - 1) * 0.09 + (elite ? 2.1 : 0);
  const e = {
    id: nextId++, type, name: t.name, shade: !!t.shade,
    x, y, r: t.r * (elite ? 1.45 : 1),
    hp: Math.round(t.hp * hpScale), maxHp: Math.round(t.hp * hpScale),
    speed: t.speed * (0.9 + G.rng() * 0.2) * (elite ? 0.9 : 1),
    dmg: t.dmg + Math.floor((G.wave - 1) / 4),
    shards: t.shards * (elite ? 4 : 1), score: t.score * (elite ? 3 : 1),
    color: t.color, elite: !!elite,
    angle: G.rng() * Math.PI * 2, flash: 0, bladeCd: 0,
    state: 'chase', stateT: 0, tx: 0, ty: 0, // dasher telegraph / charge
    shootCd: 1 + G.rng() * 1.5, knockResist: type === 'golem' ? 0.15 : 1,
    wobble: G.rng() * Math.PI * 2, hitCd: 0,
  };
  G.enemies.push(e);
  return e;
}

export function spawnBoss(G, wave) {
  const tier = Math.round(wave / 5); // 1, 2, 3
  const hp = 1150 + (tier - 1) * 750 + (G.wave - 5) * 40;
  const boss = {
    id: nextId++, type: 'boss', name: tier >= 3 ? 'CINDER TYRANT PRIME' : 'Cinder Tyrant',
    x: 640, y: 120, r: 52, hp, maxHp: hp,
    speed: 58 + tier * 4, dmg: 26, shards: 60, score: 1500 * tier,
    color: '#ff5a1a', elite: false, boss: true, tier,
    angle: Math.PI / 2, flash: 0, bladeCd: 0,
    state: 'chase', stateT: 2, tx: 0, ty: 0, shootCd: 2,
    phase: 1, knockResist: 0.05, wobble: 0, hitCd: 0,
    attackCd: 3.2,
  };
  G.enemies.push(boss);
  G.boss = boss;
  G.audio.bossRoar();
  G.shake = Math.max(G.shake, 12);
  pushRadio(G, `The ${boss.name} rises — keep it in the light!`);
  pushKillfeed(G, `⚠ BOSS: ${boss.name} — Wave ${wave}`);
  return boss;
}

function moveToward(e, tx, ty, speed, dt) {
  const a = angleTo(e.x, e.y, tx, ty);
  e.x += Math.cos(a) * speed * dt;
  e.y += Math.sin(a) * speed * dt;
  e.angle = a;
}

function keepInArena(e) {
  const dx = e.x - 640, dy = e.y - 330;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 330) { e.x = 640 + dx / d * 330; e.y = 330 + dy / d * 330; }
  e.x = clamp(e.x, 20, 1260); e.y = clamp(e.y, 20, 700);
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.bladeCd > 0) e.bladeCd -= dt;
    if (e.hitCd > 0) e.hitCd -= dt;
    e.wobble += dt * 3;
    if (e.boss) { updateBoss(G, e, dt); keepInArena(e); continue; }

    const dPlayer = dist(e.x, e.y, p.x, p.y);
    switch (e.type) {
      case 'wraith': {
        // Drifts at the Warden with a slow sine wobble, like ash on wind.
        const wob = Math.sin(e.wobble) * 0.6;
        moveToward(e, p.x + Math.cos(e.wobble) * 20, p.y + wob * 20, e.speed, dt);
        break;
      }
      case 'imp':
      case 'cinder': {
        // Snuffers: if a lit torch is within 170px, break off and snuff it.
        let target = null;
        if (e.type === 'imp') {
          for (const t of G.torches) {
            if (t.lit && dist(e.x, e.y, t.x, t.y) < 190) { target = t; break; }
          }
        }
        if (target) {
          moveToward(e, target.x, target.y, e.speed, dt);
          if (dist(e.x, e.y, target.x, target.y) < target.r + 10) {
            target.lit = false; target.radius = 0;
            G.audio.torchSnuff();
            spawnSmoke(G, target.x, target.y, 8);
            spawnFloat(G, target.x, target.y - 24, 'TORCH SNUFFED!', '#b9c7ff', 14);
            pushRadio(G, 'An imp snuffed a torch — sweep the beam over it!');
            e.hp = 0; // the imp burns itself out snuffing the flame
            killEnemy(G, e, false);
          }
        } else {
          moveToward(e, p.x, p.y, e.speed, dt);
        }
        break;
      }
      case 'spitter': {
        // Keeps ~260px distance, strafes, lobs burning globs.
        if (dPlayer > 300) moveToward(e, p.x, p.y, e.speed, dt);
        else if (dPlayer < 210) moveToward(e, p.x + (e.x - p.x), p.y + (e.y - p.y), e.speed, dt);
        else { e.x += Math.cos(e.wobble * 0.7) * e.speed * 0.4 * dt; e.y += Math.sin(e.wobble * 0.7) * e.speed * 0.4 * dt; }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dPlayer < 520) {
          e.shootCd = 2.4 + G.rng() * 0.8;
          const a = angleTo(e.x, e.y, p.x, p.y) + (G.rng() - 0.5) * 0.16;
          G.ebullets.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
            dmg: e.dmg, r: 8, color: '#a8ff7a', life: 3, arc: true,
          });
          spawnBurst(G, e.x, e.y, '#a8ff7a', 4, 80, 0.25, 3);
        }
        break;
      }
      case 'dasher': {
        // Shade: telegraph (0.55s, flashing line) then a fast charge.
        e.stateT -= dt;
        if (e.state === 'chase') {
          moveToward(e, p.x, p.y, e.speed, dt);
          if (dPlayer < 260 && e.stateT <= 0) {
            e.state = 'aim'; e.stateT = 0.55;
            e.tx = p.x; e.ty = p.y;
            G.audio.blip(880, 880, 0.1, 'sine', 0.08);
          }
        } else if (e.state === 'aim') {
          e.tx = p.x; e.ty = p.y; // tracks slowly while aiming
          if (e.stateT <= 0) { e.state = 'charge'; e.stateT = 0.42; e.angle = angleTo(e.x, e.y, e.tx, e.ty); }
        } else if (e.state === 'charge') {
          e.x += Math.cos(e.angle) * 640 * dt;
          e.y += Math.sin(e.angle) * 640 * dt;
          spawnBurst(G, e.x, e.y, '#8f7bff', 1, 40, 0.2, 3);
          if (e.stateT <= 0) { e.state = 'chase'; e.stateT = 1.1 + G.rng() * 0.8; }
        }
        break;
      }
      case 'golem': {
        moveToward(e, p.x, p.y, e.speed, dt);
        // Every few seconds it slams the ground: a small shockwave ring.
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dPlayer < 200) {
          e.shootCd = 3.5;
          spawnRing(G, e.x, e.y, '#cbb98f', 70, 0.4);
          if (dPlayer < 110) hurtPlayer(G, Math.round(e.dmg * 0.6), e.x, e.y);
        }
        break;
      }
    }
    keepInArena(e);
    // Contact damage with a short per-enemy cooldown.
    if (dPlayer < e.r + p.r - 2 && e.hitCd <= 0) {
      e.hitCd = 0.9;
      hurtPlayer(G, e.dmg, e.x, e.y);
      if (p.thorns > 0) damageEnemy(G, e, p.thorns, p.x, p.y, false);
    }
  }
  // Remove the dead, pay out, split imps, drop shards.
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.hp > 0) continue;
    G.enemies.splice(i, 1);
    killEnemy(G, e, true);
  }
}

export function killEnemy(G, e, award) {
  const p = G.player;
  if (e.boss) {
    G.boss = null;
    G.shake = Math.max(G.shake, 18);
    G.audio.bossRoar();
    spawnBurst(G, e.x, e.y, '#ff5a1a', 60, 380, 1.0, 6);
    spawnBurst(G, e.x, e.y, '#ffd76a', 40, 300, 0.9, 5);
    spawnRing(G, e.x, e.y, '#ffb347', 320, 0.8);
    spawnEmbers(G, e.x, e.y, 30);
    if (award) {
      awardKill(G, e);
      pushKillfeed(G, `☀ ${e.name} FELLED — Wave ${G.wave} clear!`);
      pushRadio(G, `${e.name} is down. The shrine burns brighter.`);
    }
    return;
  }
  // Death burst keyed to the enemy's colour.
  spawnBurst(G, e.x, e.y, e.color, e.elite ? 26 : 14, e.elite ? 280 : 200, 0.5, 4);
  spawnSmoke(G, e.x, e.y, e.elite ? 6 : 3);
  if (e.elite) spawnRing(G, e.x, e.y, '#ffd76a', 70, 0.4);
  G.audio.enemyDie();
  if (award) {
    awardKill(G, e);
    // Imps split into two cinderlings when slain (not when snuffing).
    if (e.type === 'imp') {
      for (let k = 0; k < 2; k++) {
        const c = spawnEnemy(G, 'cinder', e.x + (G.rng() - 0.5) * 30, e.y + (G.rng() - 0.5) * 30, false);
        if (c) { c.hp = c.maxHp; }
      }
      pushKillfeed(G, 'Ember Imp split into cinderlings!');
    }
  }
}

function awardKill(G, e) {
  // Combo: kills chained within 3s raise the multiplier, up to x5.
  if (G.time - G.lastKillT < 3) G.combo = Math.min(5, G.combo + 1);
  else G.combo = 1;
  G.comboT = 3;
  G.lastKillT = G.time;
  const gained = e.score * G.combo;
  G.score += gained;
  G.kills++;
  G.shards += Math.round(e.shards * G.player.shardMul);
  spawnFloat(G, e.x, e.y - e.r - 8, `+${gained}`, '#ffd76a', 15);
  // Shard pickups scatter (magnet pulls them in later).
  const n = Math.min(6, 1 + Math.floor(e.shards / 3));
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    G.pickups.push({
      kind: 'shard', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      value: Math.max(1, Math.round(e.shards / n)), life: 14, r: 7,
    });
  }
  // Drops: elites always drop something; bosses drop a feast.
  const roll = G.rng();
  if (e.elite || e.boss) {
    const kind = pick(G.rng, ['heart', 'bomb', 'mirror', 'prism']);
    G.pickups.push({ kind, x: e.x, y: e.y, vx: 0, vy: 0, value: 1, life: 18, r: 12 });
    pushKillfeed(G, `Elite ${e.name} dropped a ${kind}!`);
  } else if (roll < 0.045) {
    G.pickups.push({ kind: 'heart', x: e.x, y: e.y, vx: 0, vy: 0, value: 25, life: 12, r: 11 });
  } else if (roll < 0.075) {
    G.pickups.push({ kind: 'mirror', x: e.x, y: e.y, vx: 0, vy: 0, value: 1, life: 12, r: 11 });
  }
  pushKillfeed(G, `${e.name} slain  ·  +${gained}  (x${G.combo})`);
}

// ---- Boss: Cinder Tyrant, 3 phases ----
// Phase 1 (>66% HP): chases, radial ember bursts.
// Phase 2 (33–66%): adds summoning imp packs and a sweeping charge.
// Phase 3 (<33%): enraged — faster, double bursts, charges more often.
function updateBoss(G, b, dt) {
  const p = G.player;
  const frac = b.hp / b.maxHp;
  const newPhase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (newPhase !== b.phase) {
    b.phase = newPhase;
    G.audio.bossRoar();
    G.shake = Math.max(G.shake, 14);
    spawnRing(G, b.x, b.y, '#ff5a1a', 260, 0.7);
    spawnEmbers(G, b.x, b.y, 24);
    pushRadio(G, newPhase === 2
      ? 'The Tyrant cracks — it calls the ash to it!'
      : 'The Tyrant is enraged! Keep it in the beam!');
    pushKillfeed(G, `⚠ ${b.name} — PHASE ${newPhase}`);
  }
  b.attackCd -= dt;
  b.stateT -= dt;
  const dPlayer = dist(b.x, b.y, p.x, p.y);

  if (b.state === 'charge') {
    b.x += Math.cos(b.angle) * (520 + b.phase * 60) * dt;
    b.y += Math.sin(b.angle) * (520 + b.phase * 60) * dt;
    spawnBurst(G, b.x, b.y, '#ff5a1a', 2, 60, 0.3, 4);
    if (b.stateT <= 0) { b.state = 'chase'; b.stateT = 1.2; }
  } else {
    const sp = b.speed * (b.phase === 3 ? 1.5 : 1);
    moveToward(b, p.x, p.y, sp, dt);
    // Phase 2+: telegraph a charge when the Warden is mid-range.
    if (b.phase >= 2 && dPlayer < 340 && dPlayer > 120 && b.stateT <= 0) {
      b.state = 'aim'; b.stateT = 0.6;
      pushRadio(G, 'It rears back — dodge the charge!');
    } else if (b.state === 'aim') {
      b.angle = angleTo(b.x, b.y, p.x, p.y);
      if (b.stateT <= 0) { b.state = 'charge'; b.stateT = 0.5; G.audio.bossRoar(); }
    }
  }
  // Radial ember burst.
  if (b.attackCd <= 0) {
    b.attackCd = b.phase === 3 ? 2.2 : 3.4;
    const n = 8 + b.phase * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + b.wobble;
      G.ebullets.push({
        x: b.x, y: b.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
        dmg: 12 + b.tier * 2, r: 9, color: '#ff6b1a', life: 3.2, arc: false,
      });
    }
    G.audio.bossHit();
    spawnRing(G, b.x, b.y, '#ff6b1a', 120, 0.4);
  }
  // Phase 2+: summon imps every ~7s.
  if (b.phase >= 2) {
    b.shootCd -= dt;
    if (b.shootCd <= 0) {
      b.shootCd = 7;
      for (let i = 0; i < 3; i++) {
        const a = G.rng() * Math.PI * 2;
        spawnEnemy(G, 'imp', b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70, false);
      }
      pushRadio(G, 'The Tyrant summons imps!');
    }
  }
  // Contact damage.
  if (dPlayer < b.r + p.r - 4 && b.hitCd <= 0) {
    b.hitCd = 1.0;
    hurtPlayer(G, b.dmg, b.x, b.y);
  }
}
