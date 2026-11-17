// Ashenvale Arena — best-game-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library,
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The game: a top-down arena survival shooter. You are the last Warden of
// the Shrine of Embers in Ashenvale. Sweep the shrine's ember-beam (hold
// click, aim with the mouse) through 15 waves of ash wraiths, ember imps,
// spitters, void dashers and stone golems, plus the Cinder Tyrant on
// waves 5, 10 and 15. Light is the core mechanic: void dashers can only
// be hurt inside the light (lantern, shrine, torches, beam); ember imps
// snuff torches; the beam relights them; mirror shards reflect the beam;
// and every wave the night deepens, shrinking your lantern light. Between
// waves pick 1 of 3 blessings (16 upgrades), switch between 3 weapons,
// dash, and spend bombs that relight every torch.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a clear message if the entry is incomplete, instead of
// handing the grader a half-copied tree.
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the game was not built');
}
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter(f => !f.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}

mkdirSync(out, { recursive: true });
// Clear stale output first: cpSync alone would leave files from an older
// run behind, and the two grader runs must write the same bytes.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  const target = join(out, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Summary for the build log (stdout only — never part of the dossier).
const gameBytes = statSync(join(out, 'game')).isDirectory()
  ? readdirSync(join(out, 'game'), { recursive: true })
      .reduce((n, f) => n + (statSync(join(out, 'game', f)).isFile() ? statSync(join(out, 'game', f)).size : 0), 0)
  : 0;
console.log(`ashenvale-arena: game=${gameBytes} bytes, screenshots=${shots.length}, dossier=${dossier.length} bytes -> ${out}`);
