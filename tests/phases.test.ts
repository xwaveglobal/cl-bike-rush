/**
 * v2 Endless rank phases (docs/GAME-DESIGN.md §1): difficulty climbs phase by phase, rank gates are
 * the hardest stretch of each phase, and everything stays fair (reachable + an autopilot can drive it).
 */
declare const process: { exit(code: number): never; env: Record<string, string | undefined> };
import { Spawner, LADDER_AAA_WORLD } from '../src/gameplay/Spawner.ts';
import { World } from '../src/gameplay/World.ts';
import { Autopilot } from '../src/gameplay/Autopilot.ts';
import { START_STATE, step } from '../src/gameplay/Fairness.ts';
import { Rng } from '../src/core/Rng.ts';
import { PATTERNS, PHASES, PHASE_UNLOCK, RANK_ORDER, VARIANTS, rankDist, expRate, type Variant } from '../src/gameplay/Difficulty.ts';
import { LEVELS, type SpeedLevel } from '../src/config.ts';

let fails = 0;
const fail = (m: string) => {
  fails++;
  if (fails < 30) console.error('  ✗ ' + m);
};
const ok = (m: string) => console.log('  ✓ ' + m);
const byId = new Map(Object.values(PATTERNS).map((p) => [p.id, p.key]));
const LEVEL_IDS: SpeedLevel[] = ['easy', 'normal', 'hard'];
const ENDLESS = RANK_ORDER.slice(0, VARIANTS.endless.top + 1);

// ---------------------------------------------------------------- 1. static: whole ladder D → AAA (+5 km)
const hard: Record<string, [number, number]> = {}; // zone key → [hard rows, rows]
for (const level of LEVEL_IDS) {
  const end = rankDist(VARIANTS.endless.top, level) + 5000;
  for (let seed = 1; seed <= 6; seed++) {
    const sp = new Spawner(new Rng(seed * 131 + level.length));
    sp.level = level;
    sp.speedMul = LEVELS[level].speed;
    sp.gapMul = LEVELS[level].gap;
    sp.reset(0);
    sp.generateUntil(end);
    let reach = START_STATE;
    for (const r of sp.rows) {
      reach = step(reach, r.masks, r.dt);
      if (!reach) {
        fail(`${level} seed ${seed}: unavoidable row at ${r.dist.toFixed(0)} m`);
        break;
      }
      const z = sp.zoneAt(r.dist);
      const ph = z.kind === 'gate' ? Math.min(PHASES.length - 1, z.phase + 1) : z.phase;
      const key = byId.get(r.pid ?? '');
      if (key && r.obstacles.length && PHASE_UNLOCK[key] > ph) fail(`${level}: ${key} before its phase (${RANK_ORDER[z.phase]} ${z.kind})`);
      if (!r.obstacles.length) continue;
      const k = `${level}:${z.kind === 'gate' ? 'gate→' + z.next : RANK_ORDER[z.phase] + (z.kind === 'breather' ? ' breather' : '')}`;
      const h = (hard[k] ??= [0, 0]);
      if ((r.tier ?? 0) >= 3) h[0]++;
      h[1]++;
    }
  }
}
for (const level of LEVEL_IDS) {
  const share = (k: string) => {
    const h = hard[`${level}:${k}`];
    return h && h[1] ? h[0] / h[1] : 0;
  };
  const line = ENDLESS.map((r) => `${r} ${(share(r) * 100).toFixed(0)}%`).join(' · ');
  const gates = ENDLESS.slice(1).map((r) => `→${r} ${(share('gate→' + r) * 100).toFixed(0)}%`).join(' · ');
  console.log(`  ${level} hard-row share  phases: ${line}\n  ${' '.repeat(level.length)}                 gates:  ${gates}`);
  let mono = true;
  for (let i = 2; i < ENDLESS.length; i++) if (share(ENDLESS[i]) + 0.02 < share(ENDLESS[i - 1])) mono = false;
  mono ? ok(`${level}: each phase is at least as hard as the one before`) : fail(`${level}: difficulty not increasing across phases`);
  let gatesHard = true;
  for (let i = 2; i < ENDLESS.length; i++) if (share('gate→' + ENDLESS[i]) + 0.02 < share(ENDLESS[i - 1])) gatesHard = false;
  gatesHard ? ok(`${level}: every rank gate is harder than the phase before it`) : fail(`${level}: a rank gate is easier than its phase`);
}

// ---------------------------------------------------------------- 1b. static: Track 2 to SSS
for (const level of LEVEL_IDS) {
  const sp = new Spawner(new Rng(4242 + level.length));
  sp.level = level;
  sp.speedMul = LEVELS[level].speed;
  sp.gapMul = LEVELS[level].gap;
  sp.variant = 'track2';
  sp.reset(0);
  sp.generateUntil(rankDist(VARIANTS.track2.top, level, 'track2') + 3000);
  let reach = START_STATE;
  let bad = false;
  for (const r of sp.rows) {
    reach = step(reach, r.masks, r.dt);
    if (!reach) {
      fail(`track2 ${level}: unavoidable row at ${r.dist.toFixed(0)} m`);
      bad = true;
      break;
    }
  }
  if (!bad) ok(`track2 ${level}: ${sp.rows.length} rows to SSS, all reachable`);
}

// ---------------------------------------------------------------- 1c. world ladder: 12 places, no repeat before AAA
for (const level of LEVEL_IDS) {
  const sp = new Spawner();
  sp.level = level;
  sp.speedMul = LEVELS[level].speed;
  const seen: string[] = [];
  // the AAA phase has two worlds of LADDER_AAA_WORLD EXP each; then the ladder loops
  const end = rankDist(VARIANTS.endless.top, level) + (2 * LADDER_AAA_WORLD) / expRate(level) - 50;
  for (let d = 0; d < end; d += 50) {
    const w = sp.worldAt(d);
    if (seen[seen.length - 1] !== w) seen.push(w);
  }
  const unique = new Set(seen);
  unique.size === 12 && seen.length === 12 ? ok(`${level}: 12 worlds in order, none repeated (${seen.join(' → ')})`) : fail(`${level}: world ladder ${seen.join(' → ')}`);
}

// ---------------------------------------------------------------- 2. dynamic: autopilot through every gate
{
  const SEEDS = Number(process.env.SEEDS ?? 4);
  let km = 0;
  let crashes = 0;
  for (const road of ['endless', 'track2'] as Variant[])
  for (const level of LEVEL_IDS) {
    for (let i = 1; i <= VARIANTS[road].top; i++) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const at = rankDist(i, level, road);
        const w = new World(seed);
        const start = at - 2400; // before the gate → gate → new rank → breather → phase
        w.reset(seed * 7 + i, null, level, start, road);
        const bot = new Autopilot();
        const opt = { invulnerable: false, smash: false, magnet: false, magnetRadius: 6, speedMul: 1 };
        const dt = 1 / 60;
        let hit = false;
        while (w.dist < at + 1600 && !hit) {
          bot.update(w, dt, (a) => w.player.input(a));
          for (const e of w.step(dt, opt))
            if (e.type === 'hit') {
              hit = true;
              crashes++;
              fail(`${road} ${level} gate→${RANK_ORDER[i]} seed ${seed}: crash @${w.dist.toFixed(0)} m into ${e.o.spec.type} (${w.spawner.zoneAt(w.dist).kind})`);
            }
        }
        km += (w.dist - start) / 1000;
      }
    }
  }
  console.log(`  autopilot: ${km.toFixed(0)} km through the rank gates, ${crashes} crashes`);
}

if (fails) {
  console.error(`${fails} FAILED`);
  process.exit(1);
}
console.log('ALL PASSED');
