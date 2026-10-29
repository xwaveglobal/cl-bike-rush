/** v2 EXP calibration: non-stop runs reach each rank close to the design minutes (docs/GAME-DESIGN.md §1). */
declare const process: { exit(code: number): never };
import { EXP, LEVELS, type SpeedLevel } from '../src/config.ts';
import { Spawner } from '../src/gameplay/Spawner.ts';
import { CLASS_MIN, rankMinutes, type RankClass } from '../src/meta/Rank.ts';
import { expAtDist, type Variant } from '../src/gameplay/Difficulty.ts';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error('  ✗ ' + msg);
  } else console.log('  ✓ ' + msg);
};

const ROADS: [Variant, RankClass[]][] = [
  ['endless', ['C', 'B', 'A', 'AA', 'AAA']],
  ['track2', ['S', 'SS', 'SSS']],
];
for (const [road, ranks] of ROADS)
  for (const lv of ['hard', 'normal', 'easy'] as SpeedLevel[]) {
    // drive without turbo; record the minute each rank is reached
    const sp = new Spawner();
    sp.level = lv;
    sp.speedMul = LEVELS[lv].speed;
    sp.variant = road;
    let d = 0;
    let t = 0;
    const reached: Record<string, number> = {};
    const dt = 0.05;
    while (t < 60 * 60 * 4 && Object.keys(reached).length < ranks.length) {
      d += sp.speed(d) * dt; // includes the v2 phase speed-ups
      t += dt;
      const e = expAtDist(d, lv, road);
      for (const c of ranks) if (!(c in reached) && e >= CLASS_MIN[c]) reached[c] = t / 60;
    }
    for (const c of ranks) {
      const want = rankMinutes(c, lv);
      const got = reached[c];
      check(got !== undefined && Math.abs(got - want) <= Math.max(0.6, want * 0.1), `${road} ${lv} → ${c} at ${got?.toFixed(1)} min (target ${want})`);
    }
  }
check(EXP.rate.easy < EXP.rate.normal && EXP.rate.normal < EXP.rate.hard, 'harder speed pays more EXP per metre');

if (fails) {
  console.error(`${fails} FAILED`);
  process.exit(1);
}
console.log('ALL PASSED');
