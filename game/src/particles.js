// particles.js — feedback on every action: ember bursts, sparks, smoke,
// shockwave rings, healing glints, and floating damage numbers. Particles
// are plain objects in game-state arrays (no allocation-free pool needed at
// this scale; arrays are capped so a busy fight stays cheap).

export function spawnBurst(G, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    if (G.particles.length > 420) return;
    const a = G.rng() * Math.PI * 2;
    const s = (0.3 + G.rng() * 0.7) * (speed || 220);
    G.particles.push({
      kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: (life || 0.55) * (0.6 + G.rng() * 0.7), maxLife: life || 0.55,
      size: (size || 4) * (0.6 + G.rng() * 0.8), color,
      grav: 60, drag: 0.92, glow: true,
    });
  }
}

export function spawnEmbers(G, x, y, count) {
  const colors = ['#ff9d2e', '#ffb347', '#ff6b1a', '#ffd76a', '#ff5722'];
  for (let i = 0; i < count; i++) {
    if (G.particles.length > 420) return;
    const a = -Math.PI / 2 + (G.rng() - 0.5) * 1.8;
    const s = 60 + G.rng() * 160;
    G.particles.push({
      kind: 'ember', x: x + (G.rng() - 0.5) * 14, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.7 + G.rng() * 0.7, maxLife: 1.2,
      size: 2 + G.rng() * 3.5, color: colors[(G.rng() * colors.length) | 0],
      grav: -40, drag: 0.985, glow: true, flicker: G.rng() * 10,
    });
  }
}

export function spawnRing(G, x, y, color, maxR, life) {
  if (G.particles.length > 420) return;
  G.particles.push({
    kind: 'ring', x, y, vx: 0, vy: 0, life: life || 0.4, maxLife: life || 0.4,
    size: 6, maxR: maxR || 90, color, grav: 0, drag: 1, glow: true,
  });
}

export function spawnSmoke(G, x, y, count) {
  for (let i = 0; i < count; i++) {
    if (G.particles.length > 420) return;
    G.particles.push({
      kind: 'smoke', x: x + (G.rng() - 0.5) * 20, y: y + (G.rng() - 0.5) * 12,
      vx: (G.rng() - 0.5) * 30, vy: -20 - G.rng() * 30,
      life: 0.8 + G.rng() * 0.6, maxLife: 1.3,
      size: 8 + G.rng() * 10, color: '#8a7f78', grav: -30, drag: 0.97, glow: false,
    });
  }
}

export function spawnHeal(G, x, y, count) {
  for (let i = 0; i < count; i++) {
    if (G.particles.length > 420) return;
    G.particles.push({
      kind: 'dot', x: x + (G.rng() - 0.5) * 30, y: y + (G.rng() - 0.5) * 20,
      vx: (G.rng() - 0.5) * 20, vy: -50 - G.rng() * 40,
      life: 0.7 + G.rng() * 0.4, maxLife: 1.0,
      size: 3 + G.rng() * 2, color: '#7dffb0', grav: -20, drag: 0.98, glow: true,
    });
  }
}

// Floating combat text: damage numbers, "IMMUNE" (shade outside light),
// shard gains, heal amounts. Cap the array so spam never piles up.
export function spawnFloat(G, x, y, text, color, size) {
  if (G.floats.length > 60) G.floats.shift();
  G.floats.push({ x: x + (G.rng() - 0.5) * 10, y, text, color: color || '#fff',
    size: size || 15, life: 0.85, maxLife: 0.85 });
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= p.drag; p.vy *= p.drag;
    if (p.kind === 'ember') { p.flicker += dt * 20; p.size *= (1 - dt * 0.2); }
  }
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i];
    f.life -= dt; f.y -= 42 * dt;
    if (f.life <= 0) G.floats.splice(i, 1);
  }
}

export function drawParticles(ctx, G) {
  for (const p of G.particles) {
    const t = p.life / p.maxLife;
    if (p.kind === 'ring') {
      const r = p.maxR * (1 - t);
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 + 3 * t;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    if (p.kind === 'smoke') {
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.6), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const flick = p.kind === 'ember' ? (0.7 + 0.3 * Math.sin(p.flicker)) : 1;
    ctx.globalAlpha = Math.min(1, t * 1.4) * flick;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.5 + t * 0.5)), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    const t = f.life / f.maxLife;
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `bold ${f.size}px "Trebuchet MS", sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,16,4,0.85)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
