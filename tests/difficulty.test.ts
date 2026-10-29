/**
 * Procedural-generation audit across all 5 maps × 3 speed levels.
 * Run: node --experimental-transform-types --no-warnings tests/difficulty.test.ts
 *
 * Verifies, for every generated row:
 *  - a reachable safe path exists (time-aware model, real move durations)
 *  - the pattern tier is allowed on that map, and no tier-4 appears in the warm-up
 *  - minimum time gap per map / level is respected
 *  - after a wall / gate / laser (occluder) the next row is tier ≤ 2 with recovery spacing
 *  - no more consecutive hard rows than the map allows
 * Prints the observed tier mix vs the map's target and why candidates were rejected.
 */
declare const process: { exit(code: number): never };

import { Spawner } from '../src/gameplay/Spawner.ts';
import { START_STATE, step } from '../src/gameplay/Fairness.ts';
import { Rng } from '../src/core/Rng.ts';
import { MAPS, LEVEL_RULES, PATTERNS } from '../src/gameplay/Difficulty.ts';
import { LEVELS, type SpeedLevel } from '../src/config.ts';
import type { Course } from '../src/gameplay/Courses.ts';
import type { WorldId } from '../src/gameplay/Spawner.ts';

let failures = 0;
const fails: string[] = [];
const fail = (m: string) => {
  failures++;
  if (fails.length < 25) fails.push(m);
};

const WORLDS_ORDER: WorldId[] = ['city', 'cloud', 'tunnel', 'space', 'mega'];
const LEVEL_IDS: SpeedLevel[] = ['easy', 'normal', 'hard'];
const SEEDS = 24;
const LENGTH = 3600;

let totalRows = 0;
let sequences = 0;
const allRejects: Record<string, number> = {};
const byKey = new Map<string, string>(Object.values(PATTERNS).map((p) => [p.id, p.key]));

for (const world of WORLDS_ORDER) {
  const cfg = MAPS[world];
  const tierCount = [0, 0, 0, 0, 0];
  for (const level of LEVEL_IDS) {
    const lv = LEVEL_RULES[level];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const course: Course = {
        id: `test-${world}`, name: world, world, length: LENGTH, diffOffset: WORLDS_ORDER.indexOf(world) * 600,
        difficulty: 1, coinTarget: 0, reward: 0, sections: [{ name: 'all', from: 0, to: LENGTH }],
      };
      const sp = new Spawner(new Rng(seed * 977 + WORLDS_ORDER.indexOf(world)));
      sp.course = course;
      sp.speedMul = LEVELS[level].speed;
      sp.gapMul = LEVELS[level].gap;
      sp.level = level;
      sp.reset(0);
      sp.generateUntil(LENGTH - 60);
      sequences++;
      let reach = START_STATE;
      let prev: (typeof sp.rows)[number] | null = null;
      let streak = 0;
      const minGap = cfg.minGap * lv.gap * LEVELS[level].gap;
      let sincePrev = 0;
      for (const r of sp.rows) {
        totalRows++;
        sincePrev += r.dt;
        reach = step(reach, r.masks, r.dt);
        const where = `${world}/${level}/seed ${seed} @${r.dist.toFixed(0)}m ${r.pid}`;
        if (!reach) {
          fail(`${where}: no reachable safe path`);
          break;
        }
        const tier = r.tier ?? 0;
        tierCount[tier]++;
        if (tier > 0 && cfg.tiers[tier - 1] === 0) fail(`${where}: tier ${tier} not allowed on ${world}`);
        if (tier === 4 && r.dist < cfg.warmup) fail(`${where}: expert pattern in warm-up`);
        const key = byKey.get(r.pid ?? '');
        if (key && tier > 0 && !PATTERNS[key as keyof typeof PATTERNS].worlds.includes(world)) fail(`${where}: pattern not allowed on ${world}`);
        if (prev && r.dt < minGap * 0.85) fail(`${where}: gap ${r.dt.toFixed(2)}s < min ${minGap.toFixed(2)}s`);
        if (prev?.occludes && r.obstacles.length) {
          if (tier > 2) fail(`${where}: tier ${tier} right behind an occluding wall (blind trap)`);
          const pdef = PATTERNS[byKey.get(prev.pid ?? '') as keyof typeof PATTERNS];
          const rec = pdef.recovery + (pdef.tier >= 3 ? cfg.recovery * (pdef.tier === 4 ? 1.6 : 1) : 0);
          if (r.dt < (minGap + rec) * 0.85) fail(`${where}: no recovery after ${prev.pid} (${r.dt.toFixed(2)}s)`);
        }
        // never a row where every lane forces a duck (wall of neon you must swipe DOWN under)
        if (r.obstacles.length && r.masks.every((m) => m !== 0 && !(m & 2) && !(m & 4))) fail(`${where}: every lane forces a duck`);
        // after a jump/duck row: time to land and read the next obstacle
        if (prev && r.obstacles.length && prev.masks.filter((m) => !(m & 2)).length >= 2 && sincePrev < (minGap + 0.7 * lv.gap) * 0.8)
          fail(`${where}: only ${sincePrev.toFixed(2)}s after a jump/duck row`);
        streak = tier >= 3 ? streak + 1 : 0;
        if (streak > Math.max(1, cfg.maxConsecutiveHard)) fail(`${where}: ${streak} hard rows in a row`);
        if (r.obstacles.length) {
          prev = r;
          sincePrev = 0;
        }
      }
      for (const [k, v] of Object.entries(sp.rejectStats)) allRejects[k] = (allRejects[k] ?? 0) + v;
    }
  }
  const n = tierCount.slice(1).reduce((a, b) => a + b, 0) || 1;
  const pct = tierCount.slice(1).map((c) => `${Math.round((c / n) * 100)}%`.padStart(4));
  const tgt = cfg.tiers.map((t) => `${Math.round(t * 100)}%`.padStart(4));
  console.log(`${world.padEnd(7)} target ${cfg.target}/10  tiers T1-T4 observed [${pct.join(' ')}]  target [${tgt.join(' ')}]  empty rows ${tierCount[0]}`);
}

console.log(`\n${totalRows} rows in ${sequences} generated sequences (5 maps × 3 speed levels × ${SEEDS} seeds)`);
console.log('rejected candidate patterns:', JSON.stringify(allRejects));
if (failures) {
  console.error(`\n${failures} FAILURES`);
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('\nALL PASSED');
