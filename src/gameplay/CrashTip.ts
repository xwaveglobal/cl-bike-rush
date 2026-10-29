import { PASS_H, PASS_L, PASS_N } from './types.ts';
import type { LiveObstacle } from './World.ts';

const NAME: Record<string, string> = {
  crate: 'cargo crate',
  barrier: 'energy barrier',
  beam: 'overhead beam',
  drone: 'drone',
  laser: 'laser wall',
  traffic: 'oncoming car',
  ring: 'ring',
  platform: 'sliding platform',
  asteroid: 'asteroid',
  gate: 'mega gate',
};

export interface CrashTip {
  /** obstacle that ended the run */
  what: string;
  /** the move that would have saved it */
  move: 'up' | 'down' | 'left' | 'right' | 'sos';
  text: string;
}

/**
 * After a crash: which move would have passed the row that was hit, from the lane the car
 * was in. Prefers staying in lane (hop / duck), then the nearest open lane, else SOS.
 */
export function crashTip(o: LiveObstacle, lane: number, wasAirborne: boolean, wasLow: boolean): CrashTip {
  const what = NAME[o.spec.type] ?? 'obstacle';
  const m = o.row.masks;
  const here = m[lane] ?? 0;
  if (here & PASS_H && !wasAirborne) {
    return { what, move: 'up', text: `Swipe UP a moment earlier to hop over the ${what}.` };
  }
  if (here & PASS_H && wasAirborne) {
    return { what, move: 'up', text: `You touched down on the ${what} — hop a little later so you are still in the air.` };
  }
  if (here & PASS_L && !wasLow) {
    return { what, move: 'down', text: `Swipe DOWN to slide under the ${what}.` };
  }
  for (const d of [1, 2]) {
    for (const dir of [-1, 1] as const) {
      const l = lane + dir * d;
      if (l < 0 || l > 2) continue;
      if (m[l] & (PASS_N | PASS_L | PASS_H)) {
        const word = dir < 0 ? 'LEFT' : 'RIGHT';
        const move = dir < 0 ? 'left' : 'right';
        const extra = o.spec.type === 'traffic' ? ' Oncoming cars are too tall to hop.' : '';
        return { what, move, text: d === 1 ? `Swipe ${word} — that lane was open.${extra}` : `Move 2 lanes ${word} earlier — only the far lane was open.${extra}` };
      }
    }
  }
  return { what, move: 'sos', text: `Every lane was blocked — tap SOS or the ROADSTER button to fly over.` };
}
