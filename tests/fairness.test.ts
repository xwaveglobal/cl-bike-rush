/**
 * Headless fairness + movement test. Run: npm run test:fairness
 *
 * 1. Static check: replays every generated row through the reachability model
 *    and asserts no row is unavoidable.
 * 2. Dynamic check: an autopilot with human-like inputs drives the real Player
 *    physics against the real hitboxes for many km and many seeds. Any crash is
 *    reported with full context (it means either the spawner or the movement
 *    timings let an impossible pattern through).
 * 3. Movement transition checks for the vertical state machine.
 */
declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

import { World } from '../src/gameplay/World.ts';
import { Autopilot } from '../src/gameplay/Autopilot.ts';
import { Spawner } from '../src/gameplay/Spawner.ts';
import { START_STATE, step } from '../src/gameplay/Fairness.ts';
import { Rng } from '../src/core/Rng.ts';
import { Player } from '../src/gameplay/Player.ts';
import { HEIGHT } from '../src/config.ts';
import { COURSES } from '../src/gameplay/Courses.ts';

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error('  ✗ ' + msg);
};

// ---------------------------------------------------------------- 1. static
{
  let rows = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sp = new Spawner(new Rng(seed));
    sp.reset(0);
    sp.generateUntil(12000);
    let reach = START_STATE;
    for (const r of sp.rows) {
      reach = step(reach, r.masks, r.dt);
      rows++;
      if (!reach) {
        fail(`seed ${seed}: unavoidable row at ${r.dist.toFixed(1)}m ${JSON.stringify(r.obstacles)}`);
        break;
      }
    }
  }
  console.log(`static: ${rows} rows checked`);
}

// ---------------------------------------------------------------- 2. dynamic
{
  const SEEDS = Number(process.env.SEEDS ?? 24);
  const DIST = Number(process.env.DIST ?? 6000);
  let total = 0;
  let crashes = 0;
  const typeCount: Record<string, number> = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const w = new World(seed);
    w.reset(seed);
    const bot = new Autopilot();
    const dt = 1 / 60;
    const opt = { invulnerable: false, smash: false, magnet: false, magnetRadius: 6, speedMul: 1 };
    let crashed = false;
    let coins = 0;
    while (w.dist < DIST) {
      bot.update(w, dt, (a) => w.player.input(a));
      const ev = w.step(dt, opt);
      for (const e of ev) {
        if (e.type === 'pickup') coins++;
        if (e.type === 'pass') typeCount[e.o.spec.type] = (typeCount[e.o.spec.type] ?? 0) + 1;
        if (e.type === 'hit') {
          crashed = true;
          const r = e.o.row;
          const idx = w.upcoming.indexOf(r);
          const prev = idx > 0 ? w.upcoming[idx - 1] : undefined;
          fail(
            `seed ${seed} crash @${w.dist.toFixed(1)}m speed ${w.speed.toFixed(1)} into ${e.o.spec.type} ` +
              `lane=${w.player.lane} x=${w.player.x.toFixed(2)} y=${w.player.y.toFixed(2)} ${w.player.vmode}/${w.player.vphase} ` +
              `row masks=${r.masks} dt=${r.dt.toFixed(2)} obs=${JSON.stringify(r.obstacles)} prev=${prev ? JSON.stringify(prev.obstacles) + ' masks=' + prev.masks : '-'}`,
          );
        }
      }
      if (crashed) break;
    }
    total += w.dist;
    if (crashed) crashes++;
    if (seed <= 3) console.log(`  seed ${seed}: ${w.dist.toFixed(0)}m coins=${coins} ups=${w.player.stats.ups} downs=${w.player.stats.downs} lanes=${w.player.stats.lanes}`);
  }
  console.log(`dynamic: ${SEEDS} runs, ${(total / 1000).toFixed(1)} km driven, ${crashes} crashes`);
  console.log('  obstacles passed by type:', typeCount);
}

// ---------------------------------------------------------------- 2b. track mode
{
  for (const c of COURSES) {
    let finished = 0;
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 8; seed++) {
      const w = new World(seed);
      w.reset(seed, c);
      const bot = new Autopilot();
      const opt = { invulnerable: false, smash: false, magnet: false, magnetRadius: 6, speedMul: 1 };
      let crashed = false;
      while (w.dist < c.length + 30 && !crashed) {
        bot.update(w, 1 / 60, (a) => w.player.input(a));
        for (const e of w.step(1 / 60, opt)) {
          if (e.type === 'pass') counts[e.o.spec.type] = (counts[e.o.spec.type] ?? 0) + 1;
          if (e.type === 'world') fail(`${c.id}: world changed mid-track`);
          if (e.type === 'hit') {
            crashed = true;
            fail(`${c.id} seed ${seed}: crash @${w.dist.toFixed(0)}m into ${e.o.spec.type} masks=${e.o.row.masks}`);
          }
        }
        if (w.dist > c.length - 30 && w.obstacles.some((o) => o.row.dist > c.length - 20)) fail(`${c.id}: obstacle placed in finish run-out`);
      }
      if (!crashed) finished++;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`track ${c.name.padEnd(15)} ${c.length}m  finished ${finished}/8  top: ${top}`);
  }
}

// ---------------------------------------------------------------- 2c. speed levels
{
  for (const level of ['easy', 'normal', 'hard'] as const) {
    let crashes = 0;
    let km = 0;
    const runs: [string, (typeof COURSES)[number] | null][] = [['endless', null], ...COURSES.map((c) => [c.id, c] as [string, (typeof COURSES)[number]])];
    for (const [id, c] of runs) {
      for (let seed = 101; seed <= 104; seed++) {
        const w = new World(seed);
        w.reset(seed, c, level);
        const bot = new Autopilot();
        const opt = { invulnerable: false, smash: false, magnet: false, magnetRadius: 6, speedMul: 1 };
        const goal = c ? c.length + 20 : 6000;
        let hit = false;
        while (w.dist < goal && !hit) {
          bot.update(w, 1 / 60, (a) => w.player.input(a));
          for (const e of w.step(1 / 60, opt))
            if (e.type === 'hit') {
              hit = true;
              crashes++;
              fail(`${level}/${id} seed ${seed}: crash @${w.dist.toFixed(0)}m into ${e.o.spec.type} speed ${w.speed.toFixed(1)}`);
            }
        }
        km += w.dist / 1000;
      }
    }
    console.log(`level ${level.padEnd(6)} ${km.toFixed(1)} km, ${crashes} crashes`);
  }
}

// ---------------------------------------------------------------- 3. transitions
{
  const p = new Player();
  const run = (s: number) => {
    for (let t = 0; t < s; t += 1 / 120) p.update(1 / 120);
  };
  p.reset(1);
  p.input('up');
  run(0.3);
  if (p.heightState !== 'HIGH') fail(`fly up: expected HIGH after 0.3s, got ${p.heightState} y=${p.y}`);
  p.input('up'); // mid-air: must be ignored (one beat per jump)
  run(0.3);
  if (p.heightState !== 'HIGH') fail('fly up: should still be in its single hop');
  p.input('down'); // interrupt into a dive
  run(0.22);
  if (p.heightState !== 'LOW') fail(`dive from HIGH: expected LOW, got ${p.heightState} y=${p.y.toFixed(2)}`);
  run(1.2);
  if (p.vphase !== 'idle' || Math.abs(p.y - HEIGHT.NORMAL) > 1e-6) fail('should return to NORMAL idle');
  p.input('left');
  p.input('left');
  run(0.4);
  if (p.lane !== 0 || Math.abs(p.x + 2.6) > 1e-6) fail('double left should reach lane 0');
  p.input('left');
  run(0.1);
  if (p.lane !== 0) fail('should clamp at lane 0');
  p.input('down');
  p.input('up'); // buffered during anticipation
  run(0.12);
  if (p.vmode !== 'up') fail(`buffered up after down-antic should take over, got ${p.vmode}`);
  // anti-spam: hammering UP for 6 s must never keep the car in the air
  p.reset(1);
  let air = 0;
  let maxAir = 0;
  for (let t = 0; t < 6; t += 1 / 120) {
    if (Math.floor(t * 30) !== Math.floor((t - 1 / 120) * 30)) p.input('up');
    p.update(1 / 120);
    air = p.y > HEIGHT.NORMAL + 0.2 ? air + 1 / 120 : 0;
    maxAir = Math.max(maxAir, air);
  }
  if (maxAir > 1.05) fail(`UP spam kept the car airborne for ${maxAir.toFixed(2)} s`);
  // one lane per swipe: two quick lefts from lane 2 end exactly on lane 0, never in between
  p.reset(2);
  p.input('left');
  run(0.05);
  p.input('left');
  run(0.12);
  if (p.lane !== 1) fail('second swipe must wait until the first lane change finishes');
  run(0.5);
  if (p.lane !== 0 || Math.abs(p.x + 2.6) > 1e-6) fail('queued swipe should finish exactly on lane 0');
  console.log(`transitions: checked (max air time under UP spam ${maxAir.toFixed(2)} s)`);
}

if (failures) {
  console.error(`\nFAILED (${failures})`);
  process.exit(1);
} else console.log('\nALL PASSED');
