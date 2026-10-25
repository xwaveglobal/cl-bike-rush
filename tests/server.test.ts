/** v2.3 server rules: EXP constants match the game, runs are verified, saves can't raise EXP. */
declare const process: { exit(code: number): never };
import { EXP } from '../src/config.ts';
import { VARIANTS } from '../src/gameplay/Difficulty.ts';
// @ts-expect-error plain JS module (no types)
import { EXP_RATE, RATE_MUL, RANKS, verifyRun, clampSave, rankOf } from '../server/core.mjs';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error('  ✗ ' + msg);
  } else console.log('  ✓ ' + msg);
};
check(JSON.stringify(EXP_RATE) === JSON.stringify(EXP.rate), `server EXP rates = config (${JSON.stringify(EXP.rate)})`);
check(RATE_MUL.endless === VARIANTS.endless.rateMul && RATE_MUL.track2 === VARIANTS.track2.rateMul, 'server road multipliers = Difficulty VARIANTS');
check(JSON.stringify(RANKS) === JSON.stringify(EXP.rank), 'server rank thresholds = config');
const ok = verifyRun({ variant: 'endless', level: 'hard', distance: 10000, seconds: 240, exp: 3180 });
check(ok.ok && ok.exp === 3180, 'a normal run is accepted at its EXP');
const inflated = verifyRun({ variant: 'endless', level: 'hard', distance: 10000, seconds: 240, exp: 99999 });
check(inflated.ok && inflated.exp <= Math.floor(10000 * EXP.rate.hard * 1.35), 'inflated EXP is capped at distance × rate (+ Double EXP slack)');
check(!verifyRun({ variant: 'endless', level: 'hard', distance: 100000, seconds: 60, exp: 1 }).ok, 'impossible speed is rejected');
check(!verifyRun({ variant: 'x', level: 'hard', distance: 1, seconds: 1, exp: 1 }).ok, 'unknown road is rejected');
const s = clampSave({ expBest: 50000, exp2Best: 9, wallet: 7 }, { expBest: 3000, exp2Best: 0, expWeek: 0 });
check(s.expBest === 3000 && s.exp2Best === 0 && s.wallet === 7, 'a save never raises EXP above the verified best');
check(rankOf(40000) === 'AAA' && rankOf(40000, 65000) === 'S' && rankOf(2999) === 'D', 'rank from verified EXP');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
if (fails) process.exit(1);
