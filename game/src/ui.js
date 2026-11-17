// ui.js — the screens around the fight: title (goal + controls + best),
// pause, wave upgrade cards (pick 1 of 3 with mouse or keys 1-3),
// game over (stats + restart) and victory (stats + endless mode).
// All drawn on the canvas so screenshots capture them whole; buttons are
// canvas hit-areas checked against the mouse in main.js.

import { clamp } from './storage.js';
import { TOTAL_WAVES } from './waves.js';
import { rollUpgrades, applyUpgrade } from './upgrades.js';
import { loadBest } from './storage.js';

function panel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill || 'rgba(24,12,6,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
}

function titleText(ctx, text, x, y, size, color, outline) {
  ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  if (outline) { ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(50,20,5,0.9)'; ctx.strokeText(text, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawTitle(ctx, G) {
  // Warm dusk backdrop is already drawn (world behind, dimmed).
  ctx.fillStyle = 'rgba(20,8,4,0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  titleText(ctx, '✦ ASHENVALE ARENA ✦', 640, 130, 64, '#ffd76a', true);
  titleText(ctx, 'Sweep the shrine’s ember-beam through 15 waves', 640, 172, 24, '#ffe9a8', false);
  titleText(ctx, '3 boss fights · relics · upgrades · the night grows darker', 640, 202, 18, '#d8f5e8', false);

  panel(ctx, 330, 232, 620, 236, 'rgba(24,12,6,0.78)');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  ctx.fillText('THE WARDEN’S DUTY', 360, 264);
  ctx.fillStyle = '#f5e6c8'; ctx.font = '16px "Trebuchet MS", sans-serif';
  const lines = [
    'You are the last Warden of the Shrine of Embers. Hold the arena',
    'against the ash horde for 15 waves and fell the Cinder Tyrant.',
    '',
    '☀  Your lantern is a weapon: VOID DASHERS can only be hurt inside',
    '    the light — sweep the ember-beam (hold click) over them.',
    '🔥  Ember imps snuff torches. Sweep the beam over a snuffed torch',
    '    to relight it. Bombs (E) relight every torch at once.',
    '◆  Mirror shards reflect your beam; prisms split it in three.',
    '🌙  Each wave the night deepens and your light shrinks — spend',
    '    blessings on lantern radius or the dark will swallow you.',
  ];
  let y = 290;
  for (const l of lines) { ctx.fillText(l, 360, y); y += 19; }

  // Controls row.
  panel(ctx, 330, 482, 620, 74, 'rgba(24,12,6,0.78)');
  ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move  ·  Mouse aim  ·  Hold CLICK: ember-beam  ·  1/2/3 weapons', 640, 510);
  ctx.fillText('SHIFT dash  ·  E bomb  ·  P pause  ·  M mute  ·  R restart', 640, 538);

  // Best score.
  const best = loadBest();
  ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
  ctx.fillText(best.score > 0
    ? `BEST: ${best.score} pts  ·  Wave ${best.wave}  ·  ${best.kills} kills  ·  ${best.wins} victories`
    : 'No Warden has held the shrine yet — be the first.', 640, 588);

  // Start button.
  drawButton(ctx, G, 520, 600, 240, 56, '▶  ENTER THE ARENA', 'start');
  ctx.fillStyle = '#cbb98f'; ctx.font = '14px "Trebuchet MS", sans-serif';
  ctx.fillText('or press ENTER / click anywhere', 640, 682);
}

export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(15,8,4,0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 440, 220, 400, 280);
  titleText(ctx, '⏸ PAUSED', 640, 280, 40, '#ffd76a', true);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6c8'; ctx.font = '17px "Trebuchet MS", sans-serif';
  ctx.fillText(`Wave ${G.wave}  ·  Score ${G.score}  ·  ${G.kills} kills`, 640, 322);
  ctx.fillText('The ash waits. The shrine burns on.', 640, 350);
  drawButton(ctx, G, 520, 380, 240, 50, '▶  RESUME  (P)', 'resume');
  drawButton(ctx, G, 520, 442, 240, 50, '↺  RESTART  (R)', 'restart');
}

export function drawGameOver(ctx, G) {
  ctx.fillStyle = 'rgba(20,5,5,0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 380, 150, 520, 440);
  titleText(ctx, 'THE LIGHT FADES', 640, 214, 44, '#ff8a6a', true);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6c8'; ctx.font = '18px "Trebuchet MS", sans-serif';
  ctx.fillText('The ash horde overruns the shrine… this time.', 640, 252);
  const best = loadBest();
  const stats = [
    ['FINAL SCORE', String(G.score)],
    ['BEST SCORE', String(Math.max(best.score, G.score))],
    ['WAVE REACHED', `${G.wave} / ${TOTAL_WAVES}`],
    ['FOES SLAIN', String(G.kills)],
    ['SHARDS GATHERED', String(G.shards)],
    ['TIME HELD', fmtTime(G.time)],
    ['BEST COMBO', `x${G.bestCombo || 1}`],
  ];
  let y = 292;
  ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  for (const [k, v] of stats) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#cbb98f'; ctx.fillText(k, 440, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9a8'; ctx.fillText(v, 820, y);
    y += 28;
  }
  ctx.textAlign = 'center';
  drawButton(ctx, G, 470, 500, 340, 52, '↺  TRY AGAIN  (R)', 'restart');
  ctx.fillStyle = '#cbb98f'; ctx.font = '14px "Trebuchet MS", sans-serif';
  ctx.fillText('The shrine remembers every Warden. The ember never dies.', 640, 574);
}

export function drawVictory(ctx, G) {
  ctx.fillStyle = 'rgba(20,14,4,0.5)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 330, 110, 620, 480);
  titleText(ctx, '☀ VICTORY ☀', 640, 178, 52, '#ffd76a', true);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6c8'; ctx.font = '19px "Trebuchet MS", sans-serif';
  ctx.fillText('The Cinder Tyrant Prime falls. Dawn breaks over Ashenvale,', 640, 216);
  ctx.fillText('and the Shrine of Embers burns bright once more.', 640, 242);
  const best = loadBest();
  const stats = [
    ['FINAL SCORE', String(G.score)],
    ['BEST SCORE', String(Math.max(best.score, G.score))],
    ['WAVES CLEARED', `${TOTAL_WAVES} / ${TOTAL_WAVES}`],
    ['FOES SLAIN', String(G.kills)],
    ['SHARDS GATHERED', String(G.shards)],
    ['TIME TO DAWN', fmtTime(G.time)],
    ['BEST COMBO', `x${G.bestCombo || 1}`],
  ];
  let y = 284;
  ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  for (const [k, v] of stats) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#cbb98f'; ctx.fillText(k, 400, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9a8'; ctx.fillText(v, 880, y);
    y += 28;
  }
  ctx.textAlign = 'center';
  drawButton(ctx, G, 420, 496, 220, 52, '∞  ENDLESS  (E)', 'endless');
  drawButton(ctx, G, 660, 496, 220, 52, '↺  PLAY AGAIN  (R)', 'restart');
  ctx.fillStyle = '#cbb98f'; ctx.font = '14px "Trebuchet MS", sans-serif';
  ctx.fillText('Endless: waves keep coming, the night keeps deepening.', 640, 572);
}

export function drawUpgradeChoice(ctx, G) {
  if (!G.upgradeChoices) G.upgradeChoices = rollUpgrades(G);
  ctx.fillStyle = 'rgba(15,8,4,0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  titleText(ctx, `WAVE ${G.wave} CLEAR — CHOOSE A BLESSING`, 640, 120, 36, '#ffd76a', true);
  ctx.fillStyle = '#f5e6c8'; ctx.font = '17px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('The shrine offers three blessings. Pick one — the horde returns.', 640, 156);
  const cw = 300, ch = 300, gap = 36;
  const x0 = 640 - (cw * 3 + gap * 2) / 2;
  const y0 = 200;
  G.upgradeRects = [];
  G.upgradeChoices.forEach((u, i) => {
    const x = x0 + i * (cw + gap);
    const hover = G.input.mouse.x >= x && G.input.mouse.x <= x + cw &&
      G.input.mouse.y >= y0 && G.input.mouse.y <= y0 + ch;
    ctx.fillStyle = hover ? 'rgba(80,45,10,0.92)' : 'rgba(24,12,6,0.88)';
    ctx.beginPath(); ctx.roundRect(x, y0, cw, ch, 16); ctx.fill();
    ctx.strokeStyle = hover ? '#ffd76a' : '#b96a1e'; ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath(); ctx.roundRect(x, y0, cw, ch, 16); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '52px sans-serif';
    ctx.fillText(u.icon, x + cw / 2, y0 + 78);
    ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText(u.name, x + cw / 2, y0 + 122);
    ctx.fillStyle = '#7df9e0'; ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.fillText(`LEVEL ${u.level} / ${u.max === 99 ? '∞' : u.max}`, x + cw / 2, y0 + 148);
    ctx.fillStyle = '#f5e6c8'; ctx.font = '16px "Trebuchet MS", sans-serif';
    wrapText(ctx, u.desc, x + cw / 2, y0 + 182, cw - 44, 22);
    ctx.fillStyle = '#cbb98f'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText(`press ${i + 1}  ·  or click`, x + cw / 2, y0 + ch - 22);
    G.upgradeRects.push({ x, y: y0, w: cw, h: ch, index: i });
  });
  ctx.fillStyle = '#cbb98f'; ctx.font = '15px "Trebuchet MS", sans-serif';
  ctx.fillText(`Score ${G.score}  ·  HP ${Math.ceil(G.player.hp)}/${G.player.maxHp}  ·  Lantern ${Math.round(270 + G.player.lightBonus)}m`, 640, 560);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawButton(ctx, G, x, y, w, h, label, id) {
  const hover = G.input.mouse.x >= x && G.input.mouse.x <= x + w &&
    G.input.mouse.y >= y && G.input.mouse.y <= y + h;
  ctx.fillStyle = hover ? '#ffb347' : '#e07b1f';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = hover ? '#2a1503' : '#fff3d6';
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  G.buttons = G.buttons || {};
  G.buttons[id] = { x, y, w, h };
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Click handling for canvas buttons (called from main.js on mousedown).
export function buttonAt(G, x, y) {
  if (!G.buttons) return null;
  for (const [id, r] of Object.entries(G.buttons)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
  }
  return null;
}
export function upgradeCardAt(G, x, y) {
  if (!G.upgradeRects) return -1;
  for (const r of G.upgradeRects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
  }
  return -1;
}
export { applyUpgrade };
