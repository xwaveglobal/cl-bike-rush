/** Mission definitions. Progress is per-run unless `cumulative`. */
export type MissionStat =
  | 'coins'
  | 'dodges'
  | 'ups'
  | 'downs'
  | 'distance'
  | 'nearMiss'
  | 'score'
  | 'rings'
  | 'powerups'
  | 'lanes';

export interface MissionDef {
  id: string;
  stat: MissionStat;
  target: number;
  text: string;
  reward: number;
  cumulative?: boolean;
}

export const MISSIONS: MissionDef[] = [
  { id: 'coins30', stat: 'coins', target: 30, text: 'Collect 30 coins', reward: 100 },
  { id: 'dodge15', stat: 'dodges', target: 15, text: 'Dodge 15 obstacles', reward: 100 },
  { id: 'up10', stat: 'ups', target: 10, text: 'Fly up 10 times', reward: 120 },
  { id: 'down10', stat: 'downs', target: 10, text: 'Fly down 10 times', reward: 120 },
  { id: 'dist1000', stat: 'distance', target: 1000, text: 'Travel 1,000 m', reward: 150 },
  { id: 'near5', stat: 'nearMiss', target: 5, text: 'Perform 5 near misses', reward: 150 },
  { id: 'score10k', stat: 'score', target: 10000, text: 'Reach 10,000 points', reward: 200 },
  { id: 'rings5', stat: 'rings', target: 5, text: 'Fly through 5 energy rings', reward: 150 },
  { id: 'coins100c', stat: 'coins', target: 100, text: 'Collect 100 coins (total)', reward: 200, cumulative: true },
  { id: 'power3', stat: 'powerups', target: 3, text: 'Grab 3 power-ups in one run', reward: 160 },
  { id: 'dist2500', stat: 'distance', target: 2500, text: 'Travel 2,500 m', reward: 300 },
  { id: 'near15c', stat: 'nearMiss', target: 15, text: '15 near misses (total)', reward: 250, cumulative: true },
  { id: 'score30k', stat: 'score', target: 30000, text: 'Reach 30,000 points', reward: 400 },
  { id: 'lanes60', stat: 'lanes', target: 60, text: 'Switch lanes 60 times', reward: 120 },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);

export interface ActiveMission {
  id: string;
  progress: number;
}

/**
 * Keeps three active missions; completed missions pay out and are replaced.
 * progress = runStat + offset, where offset is captured when the mission becomes
 * active: per-run missions start from the current run stat, cumulative missions
 * also carry over their saved progress.
 */
export class MissionTracker {
  onComplete: (m: MissionDef) => void = () => {};
  private offsets = new Map<string, number>();
  private lastStats: Record<MissionStat, number> | null = null;

  constructor(public active: ActiveMission[], public completed: number) {
    this.active = this.active.filter((a) => missionById(a.id));
    this.fill();
  }

  private fill() {
    const used = new Set(this.active.map((a) => a.id));
    let i = this.completed;
    let guard = 0;
    while (this.active.length < 3 && guard++ < MISSIONS.length * 3) {
      const def = MISSIONS[i % MISSIONS.length];
      i++;
      if (used.has(def.id)) continue;
      used.add(def.id);
      this.active.push({ id: def.id, progress: 0 });
      this.activate(this.active[this.active.length - 1]);
    }
  }

  private activate(a: ActiveMission) {
    const def = missionById(a.id)!;
    const cur = this.lastStats ? this.lastStats[def.stat] : 0;
    this.offsets.set(a.id, (def.cumulative ? a.progress : 0) - cur);
  }

  beginRun() {
    this.lastStats = null;
    this.offsets.clear();
    for (const a of this.active) {
      const def = missionById(a.id)!;
      if (!def.cumulative) a.progress = 0;
      this.activate(a);
    }
  }

  /** Feed per-run stat totals. */
  update(stats: Record<MissionStat, number>) {
    this.lastStats = stats;
    const done: MissionDef[] = [];
    for (const a of this.active) {
      const def = missionById(a.id)!;
      a.progress = Math.max(0, Math.min(def.target, stats[def.stat] + (this.offsets.get(a.id) ?? 0)));
      if (a.progress >= def.target) done.push(def);
    }
    if (!done.length) return;
    this.active = this.active.filter((a) => !done.some((d) => d.id === a.id));
    for (const def of done) {
      this.completed++;
      this.onComplete(def);
    }
    this.fill();
  }

  endRun() {
    this.lastStats = null;
  }
}
