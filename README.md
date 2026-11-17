# Ashenvale Arena: sweep the shrine's ember-beam through 15 waves, 2 bosses, relics and upgrades

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Mansyur0523/makefun-best-game-r3/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Mansyur0523/makefun-best-game-r3/reward.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A complete, original top-down arena survival shooter that plays offline in a desktop browser from static files — no library, no network, no build step. You are the last Warden of the Shrine of Embers in Ashenvale. Hold the arena for **15 waves** and fell the **Cinder Tyrant** (waves 5, 10 and 15, 3 phases each), then keep going in endless mode.

## Light is the weapon

- **Ember-beam (hold click, aim with mouse):** a sweeping cone of shrine-light. It is the only thing that hurts **Void Dashers** — shades that are immune outside the light.
- **Lantern light is a resource:** your light radius shrinks as the night deepens every wave. Spend blessings on it, or the dark swallows you.
- **Torches:** four torches ring the shrine. **Ember Imps** break off to snuff them. Sweep the beam over a snuffed torch to relight it; a bomb relights them all.
- **Mirror shards** reflect your beam to the nearest foe; **prisms** split it in three.

## The game

- **6 enemy kinds with distinct AI:** Ash Wraith (chase), Ember Imp (fast, splits into cinderlings, snuffs torches), Ash Spitter (ranged, keeps distance), Void Dasher (telegraphed charge, shade), Stone Golem (slow brute, ground slam), plus elites (gold, 3× HP) and the 3-phase Cinder Tyrant boss.
- **3 switchable weapons (1/2/3):** Ember-Beam, Ember Spread, Piercing Lance — plus orbiting blades, dash (Shift, i-frames), and limited bombs (E).
- **16 blessings:** pick 1 of 3 cards between waves — damage, fire rate, multishot, pierce, lantern radius, beam focus, move speed, magnet, max HP, dash, bombs, blades, crit, regen, shard greed, thorns.
- **Depth systems:** combo multiplier (up to ×5), shards & pickups with magnet, kill feed, radio callouts, minimap with gate labels, night meter, boss HP bar, wave banners.
- **Feel:** particles, screen shake, hit flash, floating damage numbers, knockback, damage vignette, synthesized WebAudio SFX and a procedural ember-groove music loop (M to mute). Best score in localStorage.
- **Complete loop:** title (goal + controls + best) → play → upgrade cards → victory at wave 15 (+ endless) or game over with stats → restart (button or R). Pause with P/Esc.

## Play

Serve `game/` with any static server and open `game/index.html`, or:

```sh
node serve.ts   # http://localhost:8080
```

Controls: **WASD** move · **mouse** aim · **hold click** ember-beam / fire · **1/2/3** weapons · **Shift** dash · **E** bomb · **P** pause · **M** mute · **R** restart.

## Deterministic screenshots

The game renders fixed scenes from a seed (no wall clock):

```
?shot=title&seed=7     ?shot=play&seed=7
?shot=victory&seed=7   ?shot=over&seed=7
```

Screenshots in `screenshots/` are real renders of the game's own code (1280×720 JPEG). `1-play.jpg` is the cover: live combat with the beam sweeping, HUD, minimap, kill feed and radio.

## Structure

```
game/
  index.html            page shell + canvas
  style.css             page shell styling
  src/
    main.js             bootstrap + fixed-step loop + state machine
    input.js            keyboard + mouse (canvas space)
    audio.js            WebAudio SFX + procedural music, no audio files
    player.js           Warden, 3 weapons, ember-beam, dash, bomb, light
    enemies.js          6 enemy kinds + elites + 3-phase boss AI
    waves.js            15-wave composition, gates, night deepening
    upgrades.js         16 blessings, pick-1-of-3 cards
    particles.js        bursts, embers, rings, floating damage numbers
    render.js           bright dusk arena, shrine, torches, night overlay
    hud.js              HP/wave/score/shards/combo/minimap/killfeed/radio
    ui.js               title / pause / game over / victory / upgrade cards
    shots.js            deterministic ?shot= scenes (seeded, fixed time)
    storage.js          best score + settings + seeded RNG
```

## Handing in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
