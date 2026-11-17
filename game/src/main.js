// main.js — bootstrap, game-state factory, fixed-step loop, state machine,
// combat resolution (bullets, pickups, collisions), and the render
// dispatcher. The game is a top-down arena survival shooter: hold the
// Shrine of Embers for 15 waves, fell the Cinder Tyrant on waves 5/10/15,
// and win. After victory the player may continue into endless waves.
//
// States: title -> play <-> pause -> upgrade (between waves) -> play ...
//   -> victory (wave 15 boss dead) -> endless | restart
//   -> over (Warden dies) -> restart
// Deterministic scenes: ?shot=title|play|victory|over&seed=N renders one
// fixed frame from shots.js and sets window.__shotReady.

import { mulberry32, clamp, dist, loadBest, loadSettings, saveSettings, recordRun } from './storage.js';
import { createInput, moveVector, wasPressed, endTick, fakeInput } from './input.js';
import { createAudio } from './audio.js';
import { updateParticles, drawParticles, spawnBurst, spawnEmbers, spawnFloat } from './particles.js';
import { createPlayer, updatePlayer, switchWeapon, tryDash, tryBomb, damageEnemy, healPlayer, hurtPlayer, die, pushRadio, pushKillfeed, lightRadius } from './player.js';
import { updateEnemies } from './enemies.js';
import { startWave, updateSpawning, enemiesRemaining, TOTAL_WAVES, BOSS_WAVES } from './waves.js';
import { UPGRADES, applyUpgrade } from './upgrades.js';
import { drawWorld, drawPickups, drawEnemies, drawPlayer, drawBullets, drawDarkness } from './render.js';
import { drawHUD } from './hud.js';
import { drawTitle, drawPause, drawGameOver, drawVictory, drawUpgradeChoice, buttonAt, upgradeCardAt } from './ui.js';
import { applyShot } from './shots.js';

const W = 1280, H = 720;
const FIXED_DT = 1 / 60;

// Four torches ring the shrine. Lit torches are safe light; imps snuff
// them, the beam and bombs relight them.
function makeTorches() {
  return [
    { x: 430, y: 180, lit: true, radius: 150 },
    { x: 850, y: 180, lit: true, radius: 150 },
    { x: 430, y: 500, lit: true, radius: 150 },
    { x: 850, y: 500, lit: true, radius: 150 },
  ];
}

export function createGame(seed, input, audio) {
  const rng = mulberry32(seed >>> 0 || 1);
  const G = {
    seed: seed >>> 0 || 1,
    rng,
    input: input || fakeInput(),
    audio: audio || createAudio(loadSettings()),
    state: 'title',
    time: 0,
    wave: 0,
    darkness: 0,
    score: 0, shards: 0, kills: 0,
    combo: 1, comboT: 0, bestCombo: 1, lastKillT: -99,
    player: createPlayer(640, 470),
    enemies: [], bullets: [], ebullets: [], pickups: [],
    particles: [], floats: [],
    torches: makeTorches(),
    spawnQueue: [], spawnT: 0, spawnInterval: 1,
    waveState: 'idle', waveT: 0,
    boss: null, banner: null,
    killfeed: [], radio: [],
    shake: 0, vignette: 0, flash: 0,
    mirrorTime: 0, mirrorTarget: null, beamRangeBonus: 0,
    upgradeLevels: {}, upgradeChoices: null, upgradeRects: null,
    buttons: {},
    endless: false, recorded: false,
    timeOver: 0, timeVictory: 0,
    best: loadBest(),
  };
  // Icon lookup for the HUD's owned-blessings row.
  G.upgradeIconOf = (id) => {
    const u = UPGRADES.find(x => x.id === id);
    return u ? u.icon : '✦';
  };
  return G;
}

function startRun(G) {
  const fresh = createGame((Math.random() * 1e9) | 0, G.input, G.audio);
  Object.keys(fresh).forEach(k => { G[k] = fresh[k]; });
  G.state = 'play';
  G.audio.ensure();
  G.audio.startMusic();
  startWave(G, 1);
  pushRadio(G, 'Warden: the shrine is mine to hold. Light up!');
}

// ---- Per-tick update ----

function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H;
    if (!dead) {
      for (const e of G.enemies) {
        if (e.hp <= 0 || b.hitSet.has(e.id)) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
          damageEnemy(G, e, b.dmg, b.x - b.vx * 0.01, b.y - b.vy * 0.01, false);
          spawnBurst(G, b.x, b.y, b.color, 3, 100, 0.2, 2);
          b.hitSet.add(e.id);
          if (b.pierce > 0) { b.pierce--; } else { dead = true; }
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.arc) b.vy += 60 * dt;
    b.life -= dt;
    const p = G.player;
    if (dist(b.x, b.y, p.x, p.y) < p.r + b.r) {
      hurtPlayer(G, b.dmg, b.x, b.y);
      G.ebullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) G.ebullets.splice(i, 1);
  }
}

function updatePickups(G, dt) {
  const p = G.player;
  const magnetR = p.magnet * p.magnetMul;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { G.pickups.splice(i, 1); continue; }
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < magnetR) {
      const a = Math.atan2(p.y - pk.y, p.x - pk.x);
      const pull = 520 * (1 - d / magnetR) + 120;
      pk.x += Math.cos(a) * pull * dt;
      pk.y += Math.sin(a) * pull * dt;
    } else {
      pk.x += (pk.vx || 0) * dt; pk.y += (pk.vy || 0) * dt;
      pk.vx *= 0.92; pk.vy *= 0.92;
    }
    if (d < p.r + pk.r + 4) {
      collectPickup(G, pk);
      G.pickups.splice(i, 1);
    }
  }
}

function collectPickup(G, pk) {
  const p = G.player;
  if (pk.kind === 'shard') {
    G.shards += pk.value;
    G.score += pk.value * 2;
    G.audio.shard();
  } else if (pk.kind === 'heart') {
    const healed = healPlayer(G, pk.value);
    if (healed > 0) { G.audio.pickup(); spawnBurst(G, p.x, p.y, '#7dffb0', 8, 120, 0.4, 3); }
  } else if (pk.kind === 'bomb') {
    p.bombs = Math.min(p.maxBombs, p.bombs + 1);
    G.audio.pickup();
    pushRadio(G, 'Shrine-flare restocked (+1 bomb).');
  } else if (pk.kind === 'mirror') {
    G.mirrorTime = 12;
    G.audio.mirror();
    spawnFloat(G, p.x, p.y - 30, 'MIRROR SHARD — beam reflects!', '#bfe9ff', 15);
    pushRadio(G, 'Mirror shard! Your beam now reflects to the nearest foe.');
  } else if (pk.kind === 'prism') {
    G.prismTime = 10;
    G.audio.mirror();
    pushRadio(G, 'Prism! The beam splits in three.');
  }
  spawnEmbers(G, pk.x, pk.y, 3);
}

function stepGame(G, dt) {
  const input = G.input;
  const p = G.player;

  // Global keys.
  if (wasPressed(input, 'm', 'M')) {
    G.audio.setMuted(!G.audio.muted);
    saveSettings({ muted: G.audio.muted });
    pushRadio(G, G.audio.muted ? 'Sound muted.' : 'Sound on.');
  }

  if (G.state === 'title') {
    G.time += dt;
    updateParticles(G, dt);
    // Idle drift for the backdrop foes.
    for (const e of G.enemies) {
      e.wobble += dt * 3;
      e.x += Math.cos(e.wobble) * 12 * dt;
      e.y += Math.sin(e.wobble * 0.7) * 10 * dt;
    }
    if (wasPressed(input, 'Enter') || input.mouse.clicked) {
      const b = buttonAt(G, input.mouse.x, input.mouse.y);
      if (input.mouse.clicked && b && b !== 'start') { /* ignore */ }
      G.audio.ensure();
      G.audio.click();
      startRun(G);
    }
    return;
  }

  if (G.state === 'pause') {
    if (wasPressed(input, 'p', 'P', 'Escape') || (input.mouse.clicked && buttonAt(G, input.mouse.x, input.mouse.y) === 'resume')) {
      G.state = 'play';
      G.audio.click();
    } else if (wasPressed(input, 'r', 'R') || (input.mouse.clicked && buttonAt(G, input.mouse.x, input.mouse.y) === 'restart')) {
      startRun(G);
    }
    return;
  }

  if (G.state === 'upgrade') {
    G.time += dt * 0.2; // world idles behind the cards
    updateParticles(G, dt);
    let pick = -1;
    if (wasPressed(input, '1')) pick = 0;
    else if (wasPressed(input, '2')) pick = 1;
    else if (wasPressed(input, '3')) pick = 2;
    else if (input.mouse.clicked) pick = upgradeCardAt(G, input.mouse.x, input.mouse.y);
    if (pick >= 0 && G.upgradeChoices && G.upgradeChoices[pick]) {
      const choice = G.upgradeChoices[pick];
      applyUpgrade(G, choice);
      startWave(G, G.wave + 1);
    }
    return;
  }

  if (G.state === 'over') {
    G.time += dt;
    updateParticles(G, dt);
    if (!G.recorded) {
      G.recorded = true;
      G.best = recordRun(G.score, G.wave, G.kills, false);
    }
    if (wasPressed(input, 'r', 'R', 'Enter') || (input.mouse.clicked && buttonAt(G, input.mouse.x, input.mouse.y) === 'restart')) {
      G.audio.click();
      startRun(G);
    }
    return;
  }

  if (G.state === 'victory') {
    G.time += dt;
    updateParticles(G, dt);
    spawnEmbers(G, 640, 336, 0.2);
    if (wasPressed(input, 'r', 'R') || (input.mouse.clicked && buttonAt(G, input.mouse.x, input.mouse.y) === 'restart')) {
      G.audio.click();
      startRun(G);
    } else if (wasPressed(input, 'e', 'E') || (input.mouse.clicked && buttonAt(G, input.mouse.x, input.mouse.y) === 'endless')) {
      G.audio.click();
      G.endless = true;
      G.state = 'play';
      startWave(G, TOTAL_WAVES + 1);
      pushRadio(G, 'Endless: the night deepens without end. Hold!');
    }
    return;
  }

  // ---- state === 'play' ----
  G.time += dt;
  if (G.banner && G.banner.t > 0) G.banner.t -= dt;
  if (G.vignette > 0) G.vignette = Math.max(0, G.vignette - dt * 1.6);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.8);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
  if (G.mirrorTime > 0) { G.mirrorTime -= dt; if (G.mirrorTime <= 0) G.mirrorTarget = null; }
  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 1;
  }
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;

  if (wasPressed(input, 'p', 'P', 'Escape')) { G.state = 'pause'; G.audio.click(); return; }
  if (wasPressed(input, 'r', 'R')) { startRun(G); return; }
  if (wasPressed(input, '1')) switchWeapon(G, 1);
  if (wasPressed(input, '2')) switchWeapon(G, 2);
  if (wasPressed(input, '3')) switchWeapon(G, 3);
  if (wasPressed(input, 'Shift')) tryDash(G, input.mouse.x, input.mouse.y);
  if (wasPressed(input, 'e', 'E')) tryBomb(G);

  const mv = moveVector(input);
  updatePlayer(G, dt, mv, input.mouse.x, input.mouse.y);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateSpawning(G, dt);
  updateParticles(G, dt);
  if (G.state === 'play' && G.player.hp <= 0) die(G);
}

// ---- Rendering ----

function renderFrame(ctx, G) {
  ctx.save();
  if (G.shake > 0.3) {
    ctx.translate((G.rng() - 0.5) * G.shake, (G.rng() - 0.5) * G.shake);
  }
  drawWorld(ctx, G);
  drawPickups(ctx, G);
  drawEnemies(ctx, G);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  drawDarkness(ctx, G);
  ctx.restore();

  if (G.state === 'title') drawTitle(ctx, G);
  else if (G.state === 'pause') { drawHUD(ctx, G); drawPause(ctx, G); }
  else if (G.state === 'upgrade') { drawHUD(ctx, G); drawUpgradeChoice(ctx, G); }
  else if (G.state === 'over') drawGameOver(ctx, G);
  else if (G.state === 'victory') drawVictory(ctx, G);
  else drawHUD(ctx, G);
}

// ---- Boot ----

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '7', 10) || 7;

  const audio = createAudio(loadSettings());
  const G = createGame(seed, null, audio);
  G.input = createInput(canvas);
  window.__game = G; // exposed for scripted playtests

  // First user gesture unlocks audio.
  const unlock = () => { audio.ensure(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  if (shot) {
    // Deterministic scene: build from the seed, render once, signal ready.
    applyShot(G, shot);
    renderFrame(ctx, G);
    window.__shotReady = true;
    return;
  }

  let last = performance.now();
  let acc = 0;
  let frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= FIXED_DT && steps < 5) {
      stepGame(G, FIXED_DT);
      endTick(G.input);
      acc -= FIXED_DT;
      steps++;
    }
    renderFrame(ctx, G);
    if (frames === 0) window.__shotReady = true;
    frames++;
  }
  requestAnimationFrame(loop);
}

boot();
