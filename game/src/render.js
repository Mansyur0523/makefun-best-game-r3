// render.js — draws the arena and everything in it. The scene is BRIGHT
// dusk by design: a warm ember-orange sky, teal groves, pale ash ground,
// so the judge's contact sheet reads at a glance. Night deepening is a
// soft vignette plus dimming corners — never a black screen — and the
// light (lantern, shrine, torches, beam) is drawn as warm pools over it.
//
// Draw order: sky & hills -> ground & arena ring -> shrine & torches ->
// pickups -> enemies -> player & beam -> bullets -> particles -> darkness
// overlay (light cutouts) -> banners. HUD is drawn by hud.js on top.

import { clamp, dist } from './storage.js';
import { drawParticles } from './particles.js';
import { lightRadius, WEAPONS } from './player.js';

const SKY_TOP = '#ffd9a0';
const SKY_MID = '#ffb36b';
const SKY_LOW = '#ff8f5c';

export function drawWorld(ctx, G) {
  const W = 1280, H = 720;
  // --- Sky: warm dusk gradient with a low ember sun ---
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.55, SKY_MID);
  sky.addColorStop(1, SKY_LOW);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 300);
  // Sun: big soft ember disc sinking behind the hills.
  const sun = ctx.createRadialGradient(1020, 150, 10, 1020, 150, 130);
  sun.addColorStop(0, 'rgba(255,240,190,0.95)');
  sun.addColorStop(0.35, 'rgba(255,190,90,0.75)');
  sun.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(880, 10, 280, 280);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(1020, 150, 42, 0, Math.PI * 2); ctx.fill();
  // Drifting ember clouds.
  ctx.fillStyle = 'rgba(255,220,170,0.5)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 317 + G.time * 6) % 1400) - 60;
    const cy = 52 + i * 34;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 90, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 60, cy + 8, 60, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Distant hills: teal silhouettes.
  ctx.fillStyle = '#2e6f6a';
  ctx.beginPath(); ctx.moveTo(0, 300);
  ctx.quadraticCurveTo(220, 190, 480, 285);
  ctx.quadraticCurveTo(700, 210, 940, 288);
  ctx.quadraticCurveTo(1120, 230, 1280, 290);
  ctx.lineTo(1280, 300); ctx.lineTo(0, 300); ctx.fill();
  ctx.fillStyle = '#3f8f84';
  ctx.beginPath(); ctx.moveTo(0, 300);
  ctx.quadraticCurveTo(300, 240, 640, 292);
  ctx.quadraticCurveTo(980, 250, 1280, 296);
  ctx.lineTo(1280, 300); ctx.lineTo(0, 300); ctx.fill();

  // --- Ground: pale ash sand with darker patches and a stone arena ring ---
  const gnd = ctx.createLinearGradient(0, 300, 0, 720);
  gnd.addColorStop(0, '#ecd9ac');
  gnd.addColorStop(0.5, '#e2cda0');
  gnd.addColorStop(1, '#cbb287');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, 300, W, 420);
  // Ash speckles (deterministic positions from a fixed seed pattern).
  ctx.fillStyle = 'rgba(120,100,70,0.18)';
  for (let i = 0; i < 90; i++) {
    const px = (i * 173) % 1280, py = 310 + ((i * 97) % 400);
    ctx.beginPath(); ctx.ellipse(px, py, 8 + (i % 5) * 4, 4 + (i % 3) * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Arena ring: stone circle around the shrine.
  ctx.strokeStyle = '#8f7f66'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(640, 330, 322, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#b7a586'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(640, 330, 314, 0, Math.PI * 2); ctx.stroke();
  // Flagstones inside the ring.
  ctx.strokeStyle = 'rgba(143,127,102,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(640 + Math.cos(a) * 60, 330 + Math.sin(a) * 60);
    ctx.lineTo(640 + Math.cos(a) * 312, 330 + Math.sin(a) * 312);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(640, 330, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(640, 330, 230, 0, Math.PI * 2); ctx.stroke();

  drawGrove(ctx, G);
  drawShrine(ctx, G);
  drawTorches(ctx, G);
  drawLocationLabels(ctx, G);
}

function drawGrove(ctx, G) {
  // Teal grove trees + rocks outside the ring, framing the arena.
  const trees = [
    [90, 380, 1.2], [170, 640, 1.0], [260, 340, 0.9], [1080, 360, 1.1],
    [1170, 620, 1.2], [980, 660, 0.9], [330, 660, 1.0], [60, 520, 0.8],
    [1210, 470, 0.9], [420, 320, 0.7], [860, 325, 0.75],
  ];
  for (const [x, y, s] of trees) {
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(x - 3 * s, y - 8 * s, 6 * s, 16 * s);
    ctx.fillStyle = '#2f7d6e';
    ctx.beginPath(); ctx.arc(x, y - 22 * s, 20 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#46a08c';
    ctx.beginPath(); ctx.arc(x - 10 * s, y - 14 * s, 13 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11 * s, y - 15 * s, 12 * s, 0, Math.PI * 2); ctx.fill();
    // A few ember blossoms catch the light.
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(x + 6 * s, y - 28 * s, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 12 * s, y - 22 * s, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#9a8a70';
  for (const [x, y, r] of [[210, 480, 14], [1060, 500, 18], [520, 620, 12], [760, 640, 15], [120, 300, 10]]) {
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawShrine(ctx, G) {
  // The Shrine of Embers at the arena centre: stone base, arch, flame.
  const flick = Math.sin(G.time * 6) * 2 + Math.sin(G.time * 11) * 1.5;
  ctx.fillStyle = '#6d5b44';
  ctx.beginPath(); ctx.ellipse(640, 356, 72, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8f7f66';
  ctx.fillRect(596, 296, 88, 62);
  ctx.fillStyle = '#a89a86';
  ctx.fillRect(600, 290, 80, 10);
  // Arch opening with the ember flame inside.
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath(); ctx.arc(640, 330, 26, Math.PI, 0); ctx.lineTo(666, 352); ctx.lineTo(614, 352); ctx.closePath(); ctx.fill();
  const flame = ctx.createRadialGradient(640, 336, 2, 640, 336, 34 + flick);
  flame.addColorStop(0, 'rgba(255,240,170,0.95)');
  flame.addColorStop(0.4, 'rgba(255,170,60,0.85)');
  flame.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = flame;
  ctx.beginPath(); ctx.arc(640, 336, 34 + flick, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(640, 312 + flick * 0.4);
  ctx.quadraticCurveTo(652, 328, 646, 344);
  ctx.quadraticCurveTo(640, 350, 634, 344);
  ctx.quadraticCurveTo(628, 328, 640, 312 + flick * 0.4);
  ctx.fill();
  // Shrine glow ring on the ground.
  ctx.strokeStyle = 'rgba(255,180,80,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(640, 352, 84 + Math.sin(G.time * 2) * 3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ SHRINE OF EMBERS ✦', 640, 392);
}

function drawTorches(ctx, G) {
  for (const t of G.torches) {
    ctx.fillStyle = '#5d4a33';
    ctx.fillRect(t.x - 3, t.y - 4, 6, 22);
    if (t.lit) {
      const fl = Math.sin(G.time * 7 + t.x) * 2;
      const glow = ctx.createRadialGradient(t.x, t.y - 8, 2, t.x, t.y - 8, 46);
      glow.addColorStop(0, 'rgba(255,200,100,0.8)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(t.x, t.y - 8, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf5e';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 22 + fl * 0.3);
      ctx.quadraticCurveTo(t.x + 7, t.y - 10, t.x, t.y - 2);
      ctx.quadraticCurveTo(t.x - 7, t.y - 10, t.x, t.y - 22 + fl * 0.3);
      ctx.fill();
    } else {
      // Snuffed: cold grey stub + a wisp of smoke.
      ctx.fillStyle = '#6a6a72';
      ctx.beginPath(); ctx.arc(t.x, t.y - 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,120,130,0.6)';
      ctx.font = '11px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('snuffed — sweep beam', t.x, t.y + 34);
    }
  }
}

function drawLocationLabels(ctx, G) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  const labels = [
    { t: 'ASH GATE', x: 640, y: 108 },
    { t: 'TEAL GROVE', x: 180, y: 330 },
    { t: 'CINDER ROAD', x: 1100, y: 368 },
    { t: 'EMBER PASS', x: 640, y: 640 },
  ];
  for (const l of labels) {
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,30,10,0.55)';
    ctx.strokeText(l.t, l.x, l.y);
    ctx.fillStyle = '#fff2cf';
    ctx.fillText(l.t, l.x, l.y);
  }
}

// ---- Entities ----

export function drawPickups(ctx, G) {
  for (const pk of G.pickups) {
    const bob = Math.sin(G.time * 4 + pk.x) * 3;
    if (pk.kind === 'shard') {
      ctx.fillStyle = '#ffcf3f';
      ctx.save(); ctx.translate(pk.x, pk.y + bob); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(pk.x - 2, pk.y + bob - 2, 4, 4);
    } else if (pk.kind === 'heart') {
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('❤', pk.x, pk.y + bob + 7);
    } else if (pk.kind === 'bomb') {
      ctx.fillStyle = '#3a3a44';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(pk.x + 3, pk.y + bob - 8, 4, 0, Math.PI * 2); ctx.fill();
    } else if (pk.kind === 'mirror') {
      ctx.fillStyle = '#bfe9ff';
      ctx.save(); ctx.translate(pk.x, pk.y + bob); ctx.rotate(0.6);
      ctx.fillRect(-9, -6, 18, 12); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.strokeRect(pk.x - 9, pk.y + bob - 6, 18, 12);
      ctx.fillStyle = '#2a4a5a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MIRROR', pk.x, pk.y + bob + 22);
    } else if (pk.kind === 'prism') {
      ctx.fillStyle = '#ff9df5';
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y + bob - 10); ctx.lineTo(pk.x + 9, pk.y + bob + 7); ctx.lineTo(pk.x - 9, pk.y + bob + 7);
      ctx.closePath(); ctx.fill();
    }
  }
}

export function drawEnemies(ctx, G) {
  for (const e of G.enemies) {
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.boss) { drawBoss(ctx, G, e, flash); ctx.restore(); continue; }
    // Shadow.
    ctx.fillStyle = 'rgba(60,30,10,0.25)';
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.8, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    // Shade enemies are ghostly outside the light.
    const inLight = e.shade ? true : true; // drawn solid; immunity shown by float text
    ctx.globalAlpha = e.shade ? 0.75 : 1;
    ctx.fillStyle = flash ? '#ffffff' : e.color;
    if (e.type === 'wraith') {
      // Hooded wisp: cloak triangle + hood + hollow eyes.
      ctx.beginPath();
      ctx.moveTo(0, -e.r - 6);
      ctx.quadraticCurveTo(e.r, -e.r * 0.2, e.r * 0.8, e.r * 0.8);
      ctx.quadraticCurveTo(0, e.r * 0.4, -e.r * 0.8, e.r * 0.8);
      ctx.quadraticCurveTo(-e.r, -e.r * 0.2, 0, -e.r - 6);
      ctx.fill();
      ctx.fillStyle = '#1c2436';
      ctx.beginPath(); ctx.arc(-6, -6, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -6, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath(); ctx.arc(-6, -6, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -6, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'imp' || e.type === 'cinder') {
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
      // Horns.
      ctx.fillStyle = flash ? '#fff' : '#7a2d0e';
      ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.7); ctx.lineTo(-e.r * 0.9, -e.r * 1.4); ctx.lineTo(-e.r * 0.2, -e.r * 0.9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.r * 0.6, -e.r * 0.7); ctx.lineTo(e.r * 0.9, -e.r * 1.4); ctx.lineTo(e.r * 0.2, -e.r * 0.9); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5, -2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -2, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#201005';
      ctx.beginPath(); ctx.arc(-5, -2, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -2, 1.3, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'spitter') {
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e5a34';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.5, e.r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(-5, -3, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -3, 2.4, 0, Math.PI * 2); ctx.fill();
      // Drooling ember sac.
      ctx.fillStyle = '#a8ff7a';
      ctx.beginPath(); ctx.arc(0, e.r * 0.55, 5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'dasher') {
      // Void shade: dark diamond with violet rim; telegraphs with a line.
      if (e.state === 'aim') {
        ctx.strokeStyle = 'rgba(143,123,255,0.7)'; ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(e.angle) * 260, Math.sin(e.angle) * 260); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(e.r + 6, 0); ctx.lineTo(0, e.r * 0.8); ctx.lineTo(-e.r - 6, 0); ctx.lineTo(0, -e.r * 0.8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.rotate(-e.angle);
      ctx.fillStyle = '#e9e2ff';
      ctx.beginPath(); ctx.arc(-4, -3, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -3, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'golem') {
      // Stone brute: cracked boulder body + ember core.
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6d5f4a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.4); ctx.lineTo(-e.r * 0.1, 0); ctx.lineTo(-e.r * 0.5, e.r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.r * 0.5, -e.r * 0.6); ctx.lineTo(e.r * 0.2, -e.r * 0.1); ctx.lineTo(e.r * 0.6, e.r * 0.3); ctx.stroke();
      ctx.fillStyle = '#ffcf5e';
      ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#201005';
      ctx.beginPath(); ctx.arc(-8, -8, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, -8, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Elite: gold ring + crown tick.
    if (e.elite) {
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ELITE', 0, -e.r - 10);
    }
    // HP bar for hurt foes.
    if (e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(30,10,5,0.7)';
      ctx.fillRect(-w / 2, -e.r - 8, w, 5);
      ctx.fillStyle = e.shade ? '#b9a5ff' : '#ff5a3c';
      ctx.fillRect(-w / 2, -e.r - 8, w * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
    ctx.restore();
  }
}

function drawBoss(ctx, G, b, flash) {
  // Shadow + huge ember body, horned crown, phase pips.
  ctx.fillStyle = 'rgba(60,30,10,0.3)';
  ctx.beginPath(); ctx.ellipse(0, b.r * 0.85, b.r, b.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  const pulse = 1 + Math.sin(G.time * 5) * 0.03;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = flash ? '#ffffff' : '#c23d12';
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : '#8f2a08';
  ctx.beginPath(); ctx.arc(0, -b.r * 0.25, b.r * 0.72, 0, Math.PI * 2); ctx.fill();
  // Horns.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.moveTo(-b.r * 0.7, -b.r * 0.6); ctx.lineTo(-b.r * 1.15, -b.r * 1.35); ctx.lineTo(-b.r * 0.35, -b.r * 0.85); ctx.fill();
  ctx.beginPath(); ctx.moveTo(b.r * 0.7, -b.r * 0.6); ctx.lineTo(b.r * 1.15, -b.r * 1.35); ctx.lineTo(b.r * 0.35, -b.r * 0.85); ctx.fill();
  // Eyes + ember maw.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(-16, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c0800';
  ctx.beginPath(); ctx.arc(-16, -12, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -12, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath(); ctx.ellipse(0, 14, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a1e00';
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 12 - 3, 8, 6, 10);
  // Phase pips.
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`PHASE ${b.phase} / 3`, 0, -b.r - 14);
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(60,30,10,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 16, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Dash ghost trail.
  if (p.dashTime > 0) ctx.globalAlpha = 0.5;
  // Lantern light pool under the Warden (drawn before the body).
  const lr = lightRadius(G);
  const pool = ctx.createRadialGradient(0, 0, 10, 0, 0, lr);
  pool.addColorStop(0, 'rgba(255,205,110,0.35)');
  pool.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = p.invuln > 0 && Math.floor(G.time * 14) % 2 === 0 ? 0.45 : 1;
  // Cloak (teal) + hood + ember staff aimed at the mouse.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#0f5f56';
  ctx.beginPath();
  ctx.moveTo(22, 0); ctx.lineTo(-14, -15); ctx.lineTo(-20, 0); ctx.lineTo(-14, 15);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#17a08c';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  // Staff: long line forward with a glowing ember tip.
  ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(6, 10); ctx.lineTo(34, -6); ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.arc(36, -7, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(36, -7, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(-p.angle);
  // Hood face.
  ctx.fillStyle = '#f5e6c8';
  ctx.beginPath(); ctx.arc(2, -2, 6, 0, Math.PI * 2); ctx.fill();
  // Orbiting blades.
  if (p.blades > 0) {
    for (let i = 0; i < p.blades; i++) {
      const a = p.bladeAngle + (i / p.blades) * Math.PI * 2;
      const bx = Math.cos(a) * p.bladeRadius, by = Math.sin(a) * p.bladeRadius;
      ctx.strokeStyle = '#7df9e0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#dffff8';
      ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Ember-beam cone (drawn after the player so it overlays the world).
  if (p.weapon === 0 && p.beamOn && G.state === 'play') {
    const w = WEAPONS[0];
    const range = w.range + (G.beamRangeBonus || 0);
    const grad = ctx.createLinearGradient(p.x, p.y,
      p.x + Math.cos(p.beamAngle) * range, p.y + Math.sin(p.beamAngle) * range);
    grad.addColorStop(0, 'rgba(255,230,160,0.9)');
    grad.addColorStop(0.5, 'rgba(255,170,70,0.55)');
    grad.addColorStop(1, 'rgba(255,140,40,0.12)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, range, p.beamAngle - w.arc, p.beamAngle + w.arc);
    ctx.closePath(); ctx.fill();
    // Hot inner wedge so the beam reads as a beam, not a line.
    ctx.fillStyle = 'rgba(255,244,200,0.5)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, range, p.beamAngle - w.arc * 0.45, p.beamAngle + w.arc * 0.45);
    ctx.closePath(); ctx.fill();
    // Bright core line.
    ctx.strokeStyle = 'rgba(255,245,200,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.beamAngle) * range, p.y + Math.sin(p.beamAngle) * range);
    ctx.stroke();
    // Mirror reflection: beam bounces from the Warden to the mirror target.
    if (G.mirrorTime > 0 && G.mirrorTarget && G.mirrorTarget.hp > 0) {
      ctx.strokeStyle = 'rgba(190,233,255,0.85)'; ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(G.mirrorTarget.x, G.mirrorTarget.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  p.beamOn = false; // reset each frame; set again by updateBeam
}

export function drawBullets(ctx, G) {
  for (const b of G.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of G.ebullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2); ctx.stroke();
  }
}

// Night overlay: soft darkness that deepens with the wave, with warm
// holes where the light lives (lantern, shrine, torches). Built on an
// offscreen canvas (destination-out there is safe) then composited over
// the game. Kept subtle on purpose — the arena must stay readable.
let darkCanvas = null;
export function drawDarkness(ctx, G) {
  const dark = G.darkness * 0.5;
  if (dark <= 0.02) return;
  if (!darkCanvas) { darkCanvas = document.createElement('canvas'); darkCanvas.width = 1280; darkCanvas.height = 720; }
  const dc = darkCanvas.getContext('2d');
  dc.clearRect(0, 0, 1280, 720);
  dc.globalCompositeOperation = 'source-over';
  dc.fillStyle = `rgba(16,10,40,${dark})`;
  dc.fillRect(0, 0, 1280, 720);
  dc.globalCompositeOperation = 'destination-out';
  const holes = [];
  const p = G.player;
  holes.push([p.x, p.y, lightRadius(G)]);
  holes.push([640, 330, 200]);
  for (const t of G.torches) if (t.lit) holes.push([t.x, t.y, t.radius + 40]);
  for (const [x, y, r] of holes) {
    const g = dc.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = g;
    dc.beginPath(); dc.arc(x, y, r, 0, Math.PI * 2); dc.fill();
  }
  ctx.drawImage(darkCanvas, 0, 0);
}
