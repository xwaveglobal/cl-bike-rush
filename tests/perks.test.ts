/** v3.0.11 reward buttons: visibility from config + claim state, and the balanced rail layout. */
declare const process: { exit(code: number): never };
import { perkLayout, perkVisible, PERK_ORDER, type PerkKind, type PerkState } from '../src/meta/Perks.ts';

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error('  ✗ ' + msg);
  } else console.log('  ✓ ' + msg);
};

const base: PerkState = { started: true, hasShare: true, hasMissions: true, shareRewarded: true, shareAvailable: true, entryDone: false, launchDone: false };
const vis = (s: PerkState) => PERK_ORDER.filter((k) => perkVisible(k, s));

// ---- the 8 combinations of the spec (Entry · Launch · Share)
const TOP = 100,
  SLOT = 60,
  TILE = 50;
const mid = TOP + (2 * SLOT + TILE) / 2; // centre of the 3-slot block
const centre = (y: number | null) => (y === null ? NaN : y + TILE / 2);
const combos: [boolean, boolean, boolean][] = [
  [true, true, true],
  [false, true, true],
  [true, false, true],
  [false, false, true],
  [true, true, false],
  [true, false, false],
  [false, true, false],
  [false, false, false],
];
for (const [e, l, sh] of combos) {
  const s: PerkState = { ...base, entryDone: !e, launchDone: !l, shareAvailable: sh };
  const v = vis(s);
  const want = (['share', 'entry', 'launch'] as PerkKind[]).filter((k) => (k === 'entry' ? e : k === 'launch' ? l : sh));
  const lay = perkLayout(v, TOP, SLOT, TILE);
  const ys = PERK_ORDER.map((k) => lay[k]).filter((y): y is number => y !== null);
  const tag = `Entry ${e ? 'on ' : 'off'} · Launch ${l ? 'on ' : 'off'} · Share ${sh ? 'on ' : 'off'}`;
  check(JSON.stringify(v) === JSON.stringify(want), `${tag}: visible = [${v.join(', ') || 'none'}]`);
  // hidden buttons leave no slot, no gaps between the rest, group centred on the block
  const gapsOk = ys.every((y, i) => i === 0 || Math.abs(y - ys[i - 1] - SLOT) < 1e-9);
  const groupMid = ys.length ? (centre(ys[0]) + centre(ys[ys.length - 1])) / 2 : mid;
  check(gapsOk && Math.abs(groupMid - mid) < 1e-9, `${tag}: ${ys.length === 3 ? '3 balanced' : ys.length === 2 ? '2 balanced' : ys.length === 1 ? 'centred' : 'container empty'} (${ys.map((y) => y.toFixed(0)).join(', ') || '—'})`);
  for (const k of PERK_ORDER) if (!want.includes(k)) check(lay[k] === null, `${tag}: ${k} has no position`);
}

// ---- eligibility rules
check(vis({ ...base, started: false }).length === 0, 'nothing shows before HSGame has started (no flash while loading)');
check(vis({ ...base, hasMissions: false }).join() === 'share', 'platform without TikTok missions (Android app): only Share');
check(vis({ ...base, hasShare: false, hasMissions: false }).length === 0, 'web preview (no features): container empty');
check(perkVisible('share', { ...base, shareRewarded: false, shareAvailable: false }), 'Share with no reward configured stays (TikTok review button)');
check(!perkVisible('share', { ...base, shareAvailable: false }), 'Share hides once today’s reward is claimed ($limit daily)…');
check(perkVisible('share', { ...base, shareAvailable: true }), '…and comes back when it can be earned again (next day)');
check(perkVisible('entry', { ...base, entryDone: false }), 'Entry shows again when its claim state allows (done() honours $limit)');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
if (fails) process.exit(1);
