/**
 * Live-ops rules on top of SaveData: rewards, check-in, daily quests, weekly
 * best, tournaments, XWAVE Pass. Pure logic (no DOM) — the Game persists after calls.
 */
import { flagOf } from './Country.ts';
import { dayKey, weekKey, type SaveData } from '../core/Save.ts';
import { CHECKIN, CHESTS, questsFor, type ItemKey, type QuestStat, type Reward } from './Daily.ts';
import { cupFor, eventBoard, prizeFor, schedule, type EventInst, type Prize } from './Events.ts';
import { BASE_CLASSES as CLASSES, playerRank, toBase, type RankClass } from './Rank.ts';
import { allTimeBoard, avatarColor, weeklyBoard } from './Leaderboard.ts';

export interface RunSummary {
  track: string;
  score: number;
  coins: number;
  distance: number;
  near: number;
  powerups: number;
  jumps: number;
  rings: number;
  finished: boolean;
  /** EXP of this run */
  exp: number;
  /** rank gates broken through this run · worlds reached · hearts picked up · on Hard · EXP before the first lost heart */
  gates?: number;
  worlds?: number;
  hearts?: number;
  hard?: boolean;
  clean?: number;
}

export interface EventResult {
  inst: EventInst;
  rank: number;
  score: number;
  prize: Prize;
}

export class Meta {
  constructor(private s: SaveData) {}

  get name() {
    return this.s.name || `Pilot${String(this.s.pid % 10000).padStart(4, '0')}`;
  }
  get color() {
    return avatarColor(this.s.pid);
  }
  /** rank from the best single-run EXP */
  get cls(): RankClass {
    return playerRank(this.s.expBest, this.s.exp2Best);
  }
  /** the cup of the player's class in the live session (null between sessions) */
  myCup(now = Date.now()): EventInst | null {
    const sc = schedule(now);
    return sc.live ? cupFor(sc.live, toBase(this.cls)) : null;
  }
  /** the player's cup in the next session */
  nextCup(now = Date.now()): EventInst {
    return cupFor(schedule(now).next, toBase(this.cls));
  }
  /** v1 rank stars: no longer awarded (v2 rank = best run EXP). Kept so old cup code compiles until it is removed. */
  addBolts(_n: number) {}

  get passActive() {
    return this.s.passUntil > Date.now();
  }
  private me(score: number) {
    return { name: this.name, score, color: this.color, pass: this.passActive, av: this.s.avatar, flag: flagOf(this.s.country) };
  }

  grant(r: Reward) {
    if (r.coins) this.s.wallet += r.coins;
    for (const [k, n] of Object.entries(r.items ?? {})) this.s.items[k as ItemKey] += n ?? 0;
  }

  // ------------------------------------------------------------- rollovers
  rollover() {
    const day = dayKey();
    if (this.s.dailyDay !== day) {
      this.s.dailyDay = day;
      this.s.dailyProg = {};
      this.s.dailyClaimed = [];
      this.s.dailyPts = 0;
      this.s.dailyChests = [];
    }
    const wk = weekKey();
    if (this.s.weekKey !== wk) {
      this.s.weekKey = wk;
      this.s.weekBest = 0;
      this.s.expWeek = 0;
    }
  }

  // ------------------------------------------------------------- check-in
  /** index (0..6) of today's check-in slot, and whether it can be claimed */
  checkinState() {
    const today = dayKey();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const claimedToday = this.s.checkDay === today;
    const continues = this.s.checkDay === dayKey(y);
    // a missed day restarts the streak at day 1; after day 7 the calendar loops
    const streak = claimedToday ? this.s.checkStreak : continues ? this.s.checkStreak % 7 : 0;
    return { slot: claimedToday ? this.s.checkStreak - 1 : streak, claimedToday, streak: claimedToday ? this.s.checkStreak : streak };
  }

  checkIn(): Reward | null {
    const st = this.checkinState();
    if (st.claimedToday) return null;
    const r = CHECKIN[st.slot];
    this.s.checkDay = dayKey();
    this.s.checkStreak = st.slot + 1;
    this.grant(r);
    return r;
  }

  // ------------------------------------------------------------- daily quests
  quests() {
    this.rollover();
    return questsFor(this.s.dailyDay).map((q) => ({
      ...q,
      progress: Math.min(q.target, this.s.dailyProg[q.id] ?? 0),
      done: (this.s.dailyProg[q.id] ?? 0) >= q.target,
      claimed: this.s.dailyClaimed.includes(q.id),
    }));
  }

  /** count of things ready to claim (home badge) */
  dailyBadge() {
    const q = this.quests().filter((x) => x.done && !x.claimed).length;
    const ch = 0; // v2: no chests
    const ci = this.checkinState().claimedToday ? 0 : 1;
    const pass = this.passActive && this.s.passDay !== dayKey() ? 1 : 0;
    return q + ch + ci + pass;
  }

  claimQuest(id: string): Reward | null {
    const q = this.quests().find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return null;
    this.s.dailyClaimed.push(id);
    this.s.dailyPts += q.pts;
    const r = { coins: q.coins * (this.passActive ? 2 : 1) };
    this.grant(r);
    return r;
  }

  claimChest(i: number): Reward | null {
    const c = CHESTS[i];
    if (!c || this.s.dailyPts < c.pts || this.s.dailyChests.includes(i)) return null;
    this.s.dailyChests.push(i);
    this.grant(c.reward);
    return c.reward;
  }

  claimPass(): Reward | null {
    if (!this.passActive || this.s.passDay === dayKey()) return null;
    this.s.passDay = dayKey();
    const r: Reward = { coins: 300, items: { super: 1 } };
    this.grant(r);
    return r;
  }

  // ------------------------------------------------------------- runs
  /** Feed a finished run into dailies, weekly best and the live cup. Returns newly completed quest texts. */
  recordRun(r: RunSummary): string[] {
    this.rollover();
    const before = this.quests().filter((q) => q.done).map((q) => q.id);
    const add: Record<QuestStat, number> = {
      runs: 1,
      coins: r.coins,
      distance: Math.floor(r.distance),
      near: r.near,
      powerups: r.powerups,
      jumps: r.jumps,
      score: Math.floor(r.score),
      finish: r.finished ? 1 : 0,
      rings: r.rings,
      exp: Math.floor(r.exp),
      gates: r.gates ?? 0,
      worlds: r.worlds ?? 0,
      hearts: r.hearts ?? 0,
      hard: r.hard ? 1 : 0,
      clean: Math.floor(r.clean ?? 0),
      far: Math.floor(r.distance),
    };
    for (const q of questsFor(this.s.dailyDay)) {
      const v = add[q.stat];
      const cur = this.s.dailyProg[q.id] ?? 0;
      this.s.dailyProg[q.id] = q.mode === 'max' ? Math.max(cur, v) : cur + v;
    }
    this.s.weekBest = Math.max(this.s.weekBest, Math.floor(r.score));
    this.s.expBest = Math.max(this.s.expBest, Math.floor(r.exp));
    this.s.expWeek = Math.max(this.s.expWeek, Math.floor(r.exp));
    if (r.track === 'track2') this.s.exp2Best = Math.max(this.s.exp2Best, Math.floor(r.exp));
    const cup = this.myCup();
    if (cup && cup.cup.track === r.track) {
      const e = (this.s.events[cup.key] ??= { best: 0 });
      e.best = Math.max(e.best, Math.floor(r.score));
    }
    const done = this.quests()
      .filter((q) => q.done && !before.includes(q.id))
      .map((q) => q.text);
    // auto-claim (default): quest rewards and opened chests go straight to the wallet
    if (this.s.settings.autoClaim !== false) {
      for (const q of this.quests()) if (q.done && !q.claimed) this.claimQuest(q.id);
      CHESTS.forEach((_, i) => this.claimChest(i));
    }
    return done;
  }

  // ------------------------------------------------------------- boards
  allTime() {
    return allTimeBoard(this.me(this.s.expBest));
  }
  weekly() {
    this.rollover();
    return weeklyBoard(this.s.weekKey, this.me(this.s.expWeek));
  }
  cupBoard(e: EventInst) {
    return eventBoard(e, this.me(this.s.events[e.key]?.best ?? 0));
  }
  cupBest(e: EventInst) {
    return this.s.events[e.key]?.best ?? 0;
  }

  /** Ended cups the player raced in and hasn't collected yet. */
  pendingResults(): EventResult[] {
    const out: EventResult[] = [];
    for (const session of schedule().past) {
      for (const div of CLASSES) {
        const inst = cupFor(session, div);
        const e = this.s.events[inst.key];
        if (!e || e.claimed || e.best <= 0) continue;
        const board = eventBoard(inst, this.me(e.best), inst.end);
        out.push({ inst, rank: board.you.rank, score: e.best, prize: prizeFor(board.you.rank, div) });
      }
    }
    return out;
  }

  claimResult(res: EventResult) {
    const e = this.s.events[res.inst.key];
    if (!e || e.claimed) return;
    e.claimed = true;
    e.rank = res.rank;
    this.grant({ coins: res.prize.coins, items: { hyper: res.prize.hyper, super: res.prize.superJ ?? 0 } });
    this.addBolts(res.prize.bolts);
    if (res.prize.trophy) this.s.trophies[res.prize.trophy]++;
  }
}
