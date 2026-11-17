// upgrades.js — between-wave blessings: pick 1 of 3 cards. Twelve
// upgrades, several stackable, several light-themed (the night deepens
// every wave, so light radius and beam power are survival, not luxury).
// Cards are rolled from the game's rng; a maxed upgrade leaves the pool.
// Each card shows its icon, name, effect and current level.

import { shuffle, clamp } from './storage.js';
import { pushRadio } from './player.js';
import { spawnHeal, spawnEmbers } from './particles.js';

export const UPGRADES = [
  {
    id: 'damage', icon: '⚔', name: 'Ember Might', max: 5,
    desc: '+25% damage to all weapons.',
    apply(G) { G.player.damageMul *= 1.25; },
  },
  {
    id: 'firerate', icon: '≫', name: 'Rapid Embers', max: 5,
    desc: '+20% fire rate. The beam ticks faster too.',
    apply(G) { G.player.fireRateMul *= 0.83; },
  },
  {
    id: 'multishot', icon: '✦', name: 'Split Shot', max: 3,
    desc: '+1 projectile per shot (Spread & Lance).',
    apply(G) { G.player.multishot += 1; },
  },
  {
    id: 'pierce', icon: '➶', name: 'Piercing Light', max: 3,
    desc: 'Shots pierce +1 extra foe.',
    apply(G) { G.player.pierceBonus += 1; },
  },
  {
    id: 'light', icon: '☀', name: 'Lantern Bright', max: 5,
    desc: '+45 lantern light radius. Shades fear it.',
    apply(G) { G.player.lightBonus += 45; },
  },
  {
    id: 'beam', icon: '🔆', name: 'Beam Focus', max: 4,
    desc: 'Ember-beam +18% damage and +40 range.',
    apply(G) { G.player.damageMul *= 1.1; G.beamRangeBonus = (G.beamRangeBonus || 0) + 40; },
  },
  {
    id: 'speed', icon: '➤', name: 'Ash Stride', max: 4,
    desc: '+12% move speed.',
    apply(G) { G.player.speed *= 1.12; },
  },
  {
    id: 'magnet', icon: '🧲', name: 'Shard Magnet', max: 4,
    desc: '+70% pickup magnet radius.',
    apply(G) { G.player.magnetMul *= 1.7; },
  },
  {
    id: 'vitality', icon: '♥', name: 'Warden Vitality', max: 5,
    desc: '+25 max HP and heal 25 now.',
    apply(G) { G.player.maxHp += 25; G.player.hp = Math.min(G.player.maxHp, G.player.hp + 25); },
  },
  {
    id: 'dash', icon: '💨', name: 'Swift Dash', max: 3,
    desc: 'Dash recharges 30% faster.',
    apply(G) { G.player.dashCdMax *= 0.7; },
  },
  {
    id: 'bomb', icon: '💣', name: 'Shrine Flare', max: 3,
    desc: '+1 bomb (max 4). Bombs relight every torch.',
    apply(G) { G.player.bombs = Math.min(G.player.maxBombs, G.player.bombs + 1); },
  },
  {
    id: 'blades', icon: '🌀', name: 'Orbiting Blades', max: 3,
    desc: '+1 orbiting blade of light around you.',
    apply(G) { G.player.blades += 1; },
  },
  {
    id: 'crit', icon: '🎯', name: 'Deadly Spark', max: 4,
    desc: '+10% critical chance (crits deal double).',
    apply(G) { G.player.critChance = clamp(G.player.critChance + 0.1, 0, 0.6); },
  },
  {
    id: 'regen', icon: '✚', name: 'Ember Heart', max: 3,
    desc: 'Regenerate +1.2 HP per second.',
    apply(G) { G.player.regen += 1.2; },
  },
  {
    id: 'greed', icon: '◆', name: 'Shard Greed', max: 3,
    desc: '+25% shards from every kill.',
    apply(G) { G.player.shardMul *= 1.25; },
  },
  {
    id: 'thorns', icon: '🌹', name: 'Thorned Light', max: 3,
    desc: 'Attackers take 12 damage when they touch you.',
    apply(G) { G.player.thorns += 12; },
  },
];

export function rollUpgrades(G) {
  const taken = G.upgradeLevels || {};
  const pool = UPGRADES.filter(u => (taken[u.id] || 0) < u.max);
  shuffle(G.rng, pool);
  const picks = pool.slice(0, 3).map(u => ({
    ...u, level: (taken[u.id] || 0) + 1,
  }));
  // Fallback (everything maxed): a heal card.
  while (picks.length < 3) {
    picks.push({
      id: 'heal' + picks.length, icon: '♥', name: 'Ember Mend', max: 99, level: 1,
      desc: 'Heal 40 HP now.',
      apply(G2) { G2.player.hp = Math.min(G2.player.maxHp, G2.player.hp + 40); },
    });
  }
  return picks;
}

export function applyUpgrade(G, choice) {
  const taken = G.upgradeLevels || (G.upgradeLevels = {});
  const base = UPGRADES.find(u => u.id === choice.id);
  if (base) taken[base.id] = (taken[base.id] || 0) + 1;
  choice.apply(G);
  G.audio.upgrade();
  spawnHeal(G, G.player.x, G.player.y, 10);
  spawnEmbers(G, G.player.x, G.player.y, 12);
  pushRadio(G, `Blessing taken: ${choice.name} (Lv ${choice.level}).`);
  // Back to the fight: next wave starts.
  G.state = 'play';
  G.upgradeChoices = null;
}
