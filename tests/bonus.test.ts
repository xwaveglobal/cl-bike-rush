/** v2.2 Bonus roads: 5-minute road, set pieces reserved after rare specials, tunnels, fair rows, sorted pickups. */
declare const process: { exit(code: number): never };
import { BONUS_SET, LEVELS, type SpeedLevel } from '../src/config.ts';
import { Spawner } from '../src/gameplay/Spawner.ts';
import { Rng } from '../src/core/Rng.ts';
import { BONUS, BONUS_NAME, bonusState } from '../src/meta/Bonus.ts';
import { START_STATE, step } from '../src/gameplay/Fairness.ts';
import { FAIRNESS } from '../src/config.ts';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error('  ✗ ' + msg);
  } else console.log('  ✓ ' + msg);
};

const SPECIALS = new Set(['super', 'hyper', 'escape', 'wall', 'rail', 'ghost', 'tunnel']);
for (const theme of Object.keys(BONUS_NAME) as (keyof typeof BONUS_NAME)[])
  for (const lv of ['hard', 'normal', 'easy'] as SpeedLevel[]) {
    let specials = 0;
    let tunnelRiders = 0;
    let sorted = true;
    let gapsEmpty = true;
    let unreachable = 0;
    let length = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const sp = new Spawner(new Rng(seed * 977 + theme.length));
      sp.level = lv;
      sp.speedMul = LEVELS[lv].speed;
      sp.course = { id: 'probe', name: '', world: theme, length: 1, diffOffset: 900, difficulty: 2, coinTarget: 0, reward: 0, sections: [] };
      let d = 0;
      for (let t = 0; t < BONUS.raceMinutes * 60; t += 0.1) d += sp.speed(d) * 0.1;
      length = Math.round(d / 100) * 100;
      sp.course = { ...sp.course, length, bonus: true, sections: [{ name: 'a', from: 0, to: length }] };
      sp.reset(0);
      sp.generateUntil(length);
      for (let i = 1; i < sp.pickups.length; i++) if (sp.pickups[i].dist < sp.pickups[i - 1].dist - 0.01) sorted = false;
      specials += sp.pickups.filter((p) => SPECIALS.has(p.kind)).length;
      tunnelRiders += sp.pickups.filter((p) => p.kind === 'tunnel').length;
      for (const s of sp.setPieces) if (sp.rows.some((r) => r.obstacles.length && r.dist >= s.from - 1 && r.dist <= s.to + 1)) gapsEmpty = false;
      // every generated row stays passable from the reach the spawner tracked (re-check with the fairness model)
      let reach = START_STATE;
      let prev = 0;
      for (const r of sp.rows) {
        const n = step(reach, r.masks, Math.max(r.dt, FAIRNESS.minRowTime), 0.2);
        if (!n && r.dist - prev < 60) unreachable++;
        reach = n || START_STATE;
        prev = r.dist;
      }
    }
    const per = specials / 6;
    check(per >= 1 && per <= 7, `${theme} ${lv}: ${length} m road, ${per.toFixed(1)} specials per road (rare), ${tunnelRiders} Tunnel Riders / 6 roads`);
    check(sorted, `${theme} ${lv}: pickups in road order`);
    check(gapsEmpty, `${theme} ${lv}: set-piece stretches stay empty until the pickup is collected`);
    check(unreachable === 0, `${theme} ${lv}: every row passable`);
  }
check(BONUS.raceMinutes === 5, 'Bonus road lasts 5 minutes');
// v3.0.6 schedule: every hour, open 30 minutes, a random place each time (never twice in a row)
check(BONUS.everyHours === 1 && BONUS.openMinutes === 30, 'Bonus opens every hour for 30 minutes');
{
  const base = new Date(2026, 9, 22, 0, 10).getTime();
  let same = 0;
  const seen = new Set<string>();
  let prev = '';
  for (let h = 0; h < 24 * 14; h++) {
    const st = bonusState(base + h * 3600000);
    if (!st.live) same += 1000;
    const th = st.live!.theme;
    if (th === prev) same++;
    seen.add(th);
    prev = th;
    if (bonusState(base + h * 3600000 + 35 * 60000).live) same += 1000;
  }
  check(same === 0, 'open at :10, closed at :45, never the same place two hours in a row');
  check(seen.size === BONUS.themes.length, 'every place shows up');
}
check(BONUS_SET.tunnels.length >= 2, 'Bonus roads have tunnel sections');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
if (fails) process.exit(1);
