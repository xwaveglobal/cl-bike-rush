/** In-air lane rule: one lane per hop; booster exception from an edge lane (2 lanes + flip). */
declare const process: { exit(code: number): never };
import { Player } from '../src/gameplay/Player.ts';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error('  ✗ ' + msg);
  } else console.log('  ✓ ' + msg);
};
const run = (p: Player, s: number) => {
  for (let t = 0; t < s; t += 1 / 120) p.update(1 / 120);
};

// 1) no booster: lane 0 → jump → right, right → only lane 1, then must land
{
  const p = new Player();
  p.reset(0);
  let blocked = 0;
  p.events = { airBlocked: () => blocked++ };
  p.input('up');
  run(p, 0.12);
  p.input('right');
  run(p, 0.3);
  p.input('right');
  run(p, 0.3);
  check(p.lane === 1 && blocked === 1, `no booster: one lane per hop (lane ${p.lane}, refused ${blocked})`);
  run(p, 1.5);
  p.input('right');
  run(p, 0.4);
  check(p.lane === 2, 'after landing the next lane change works again');
}
// 2) booster from an edge lane: two swipes → far edge with dash event (flip)
{
  const p = new Player();
  p.reset(0);
  let dashes = 0;
  p.canAirDash = () => true;
  p.events = { airDash: () => dashes++ };
  p.input('up');
  run(p, 0.12);
  p.input('right');
  run(p, 0.3);
  p.input('right');
  run(p, 0.35);
  check(p.lane === 2 && dashes === 1, `booster from edge: lane 0 → 2 with flip (lane ${p.lane}, dash ${dashes})`);
}
// 3) booster but took off from the middle lane: still one lane only
{
  const p = new Player();
  p.reset(1);
  let dashes = 0;
  p.canAirDash = () => true;
  p.events = { airDash: () => dashes++ };
  p.input('up');
  run(p, 0.12);
  p.input('left');
  run(p, 0.3);
  p.input('right');
  run(p, 0.3);
  check(p.lane === 0 && dashes === 0, `booster from middle: no double move (lane ${p.lane})`);
}
// 4) on the road: lane changes are unrestricted
{
  const p = new Player();
  p.reset(0);
  p.input('right');
  run(p, 0.3);
  p.input('right');
  run(p, 0.3);
  check(p.lane === 2, 'on the road: two lanes in a row');
}
if (fails) process.exit(1);
console.log('ALL PASSED');
