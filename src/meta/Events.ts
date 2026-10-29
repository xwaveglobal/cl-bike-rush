/**
 * CUPS — two sessions every day at 12:00 (noon) and 22:00 US Eastern time.
 * Each session runs one cup per rank class (D, C, B, A, AA, AAA) for 3 hours. A pilot
 * may only enter the cup of their own class: start in D, climb with ⚡ bolts to open the
 * higher cups (bigger fields of faster rivals, bigger prizes).
 * The best score on the cup's track while it is live counts; the final rank pays ⚡ bolts
 * (cup points), coins, HYPER JUMPs and trophies.
 */
import { rankBoard, sampleBoard, type Board } from './Leaderboard.ts';
import { BASE_CLASSES as CLASSES, type BaseClass as RankClass } from './Rank.ts';

export const SESSION_HOURS_ET = [12, 22] as const;
export const LIVE_HOURS = 3;
const HOUR = 3600_000;

export interface Cup {
  id: string;
  name: string;
  tag: string;
  /** 'endless' or a course id */
  track: string;
  color: string;
  /** score of #1 at the end (sample field) */
  top: number;
  field: number;
}

export interface EventInst {
  cup: Cup;
  division: RankClass;
  /** session number (2 per day) */
  index: number;
  key: string;
  start: number;
  end: number;
}

const TRACKS: { id: string; name: string; km: string; color: string; scale: number }[] = [
  { id: 'future-city', name: 'Future City', km: '3.2 km', color: '#2fd36b', scale: 1 },
  { id: 'cloud-city', name: 'Cloud City', km: '2.8 km', color: '#4fc3ff', scale: 0.92 },
  { id: 'neon-tunnel', name: 'Neon Tunnel', km: '2.4 km', color: '#ff4fd8', scale: 0.85 },
  { id: 'space-zone', name: 'Space Zone', km: '3.0 km', color: '#9b6bff', scale: 1.02 },
  { id: 'mega-city', name: 'XWAVE Megacity', km: '3.6 km', color: '#ffc21a', scale: 1.15 },
  { id: 'endless', name: 'Endless', km: 'all worlds', color: '#ff7a3a', scale: 1.7 },
];

/** winning score and field size per division */
const DIV_TOP: Record<RankClass, number> = { D: 6500, C: 10500, B: 16000, A: 22500, AA: 30000, AAA: 39000 };
const DIV_FIELD: Record<RankClass, number> = { D: 4200, C: 3100, B: 2200, A: 1400, AA: 800, AAA: 380 };
export const DIV_MULT: Record<RankClass, number> = { D: 1, C: 1.2, B: 1.4, A: 1.7, AA: 2, AAA: 2.5 };

export interface Prize {
  from: number;
  to: number;
  label: string;
  bolts: number;
  coins: number;
  hyper: number;
  superJ?: number;
  trophy?: 'gold' | 'silver' | 'bronze';
}

const BASE_PRIZES: Prize[] = [
  { from: 1, to: 1, label: '#1', bolts: 120, coins: 3000, hyper: 3, trophy: 'gold' },
  { from: 2, to: 3, label: '#2–3', bolts: 80, coins: 1500, hyper: 2, trophy: 'silver' },
  { from: 4, to: 10, label: '#4–10', bolts: 50, coins: 800, hyper: 1, trophy: 'bronze' },
  { from: 11, to: 100, label: 'Top 100', bolts: 25, coins: 300, hyper: 0 },
  { from: 101, to: Infinity, label: 'Everyone who races', bolts: 10, coins: 100, hyper: 0, superJ: 1 },
];

export function prizesFor(div: RankClass): Prize[] {
  const m = DIV_MULT[div];
  return BASE_PRIZES.map((p) => ({ ...p, bolts: Math.round(p.bolts * m), coins: Math.round((p.coins * m) / 10) * 10 }));
}
export const prizeFor = (rank: number, div: RankClass) => prizesFor(div).find((p) => rank >= p.from && rank <= p.to)!;

// ------------------------------------------------------------------ US Eastern time
const etFmt = (() => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {
    return null;
  }
})();

function etParts(ms: number) {
  if (!etFmt) {
    // fallback: fixed UTC−5
    const d = new Date(ms - 5 * HOUR);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() };
  }
  const p: Record<string, number> = {};
  for (const x of etFmt.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute };
}

/** UTC ms of an Eastern wall-clock time (handles daylight saving) */
function etToUtc(y: number, m: number, d: number, h: number) {
  let guess = Date.UTC(y, m - 1, d, h) + 5 * HOUR;
  for (let i = 0; i < 2; i++) {
    const p = etParts(guess);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    guess += Date.UTC(y, m - 1, d, h) - shown;
  }
  return guess;
}

interface Session {
  index: number;
  start: number;
  end: number;
}

function sessionsAround(now: number): Session[] {
  const out: Session[] = [];
  for (let dd = -3; dd <= 1; dd++) {
    const p = etParts(now + dd * 24 * HOUR);
    const dayNo = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / (24 * HOUR));
    SESSION_HOURS_ET.forEach((h, k) => {
      const start = etToUtc(p.y, p.m, p.d, h);
      out.push({ index: dayNo * 2 + k, start, end: start + LIVE_HOURS * HOUR });
    });
  }
  const seen = new Set<number>();
  return out.filter((s) => (seen.has(s.index) ? false : (seen.add(s.index), true))).sort((a, b) => a.start - b.start);
}

export function cupFor(session: Session, division: RankClass): EventInst {
  const di = CLASSES.indexOf(division);
  const t = TRACKS[(session.index + di) % TRACKS.length];
  const cup: Cup = {
    id: `${t.id}-${division}`,
    name: `${t.name} Cup`,
    tag: `${t.name} · ${t.km}`,
    track: t.id,
    color: t.color,
    top: Math.round(DIV_TOP[division] * t.scale),
    field: DIV_FIELD[division],
  };
  return { cup, division, index: session.index, key: `s${session.index}-${division}`, start: session.start, end: session.end };
}

/** live session (if any), the next one, and recent past sessions for results */
export function schedule(now = Date.now()) {
  const all = sessionsAround(now);
  const live = all.find((s) => now >= s.start && now < s.end) ?? null;
  const next = all.find((s) => s.start > now)!;
  const past = all.filter((s) => s.end <= now).slice(-4);
  return { live, next, past, upcoming: all.filter((s) => s.start > now).slice(0, 2) };
}

/** local clock text of a session start, e.g. "23:00" */
export const localTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function eventBoard(e: EventInst, you: { name: string; score: number; color: string; pass?: boolean; av?: number; flag?: string }, now = Date.now()): Board {
  const f = Math.min(1, Math.max(0, (now - e.start) / (e.end - e.start)));
  const g = 0.3 + 0.7 * Math.min(1, f * 1.3);
  const curve = { top: e.cup.top * g, k: 0.38, total: Math.round(e.cup.field * (0.25 + 0.75 * g)) };
  return rankBoard(sampleBoard(`xwave-cup-${e.key}`, curve, 100), curve, you);
}

export function fmtLeft(ms: number) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / HOUR);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % HOUR) / 60000);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
