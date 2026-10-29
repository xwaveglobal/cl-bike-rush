/**
 * PLAYER DATABASE LAYER — bots + real players, ready for a server.
 *
 * The game talks only to the `PlayerStore` interface. Today it uses `LocalPlayerStore`
 * (tables kept in localStorage). When the backend exists, switch to `RemotePlayerStore`
 * (same methods, HTTP JSON to the reference server in /server) — nothing else changes.
 *
 * Tables (see server/schema.sql):
 *   players  — one row per pilot; `is_bot` marks generated rivals
 *   scores   — best score per (player, board); board = 'all' | 'week:YYYY-Www' | 'cup:<session>-<class>'
 */
import { kv } from '../core/kv.ts';
import type { RankClass } from '../meta/Rank.ts';

export interface PlayerRecord {
  id: string;
  name: string;
  avatar: number;
  flag: string;
  isBot: boolean;
  cls: RankClass;
  /** rank points (X-Points) */
  xp: number;
  best: number;
  runs: number;
  car: string;
  trophies: { gold: number; silver: number; bronze: number };
  createdAt: number;
  lastSeen: number;
}

export interface ScoreRecord {
  playerId: string;
  board: string;
  score: number;
  at: number;
}

export interface RankedRow extends ScoreRecord {
  rank: number;
  player: PlayerRecord;
}

export interface PlayerStore {
  upsertPlayer(p: PlayerRecord): Promise<void>;
  getPlayer(id: string): Promise<PlayerRecord | null>;
  /** keeps the best score per (player, board) */
  submitScore(s: ScoreRecord): Promise<void>;
  top(board: string, limit: number): Promise<RankedRow[]>;
  rankOf(board: string, playerId: string): Promise<{ rank: number; total: number } | null>;
}

// ------------------------------------------------------------------ local implementation
const DB_KEY = 'xwave-db-v1';
interface Tables {
  v: 1;
  players: Record<string, PlayerRecord>;
  scores: Record<string, ScoreRecord>; // key = board|playerId
}

export class LocalPlayerStore implements PlayerStore {
  private t: Tables;
  constructor() {
    this.t = { v: 1, players: {}, scores: {} };
    try {
      const raw = kv.get(DB_KEY);
      if (raw) this.t = { ...this.t, ...(JSON.parse(raw) as Tables) };
    } catch {
      /* private mode: in-memory only */
    }
  }
  private save() {
    try {
      kv.set(DB_KEY, JSON.stringify(this.t));
    } catch {
      /* quota / private mode */
    }
  }
  async upsertPlayer(p: PlayerRecord) {
    this.t.players[p.id] = { ...(this.t.players[p.id] ?? {}), ...p };
    this.save();
  }
  async getPlayer(id: string) {
    return this.t.players[id] ?? null;
  }
  async submitScore(s: ScoreRecord) {
    const k = `${s.board}|${s.playerId}`;
    const cur = this.t.scores[k];
    if (!cur || s.score > cur.score) this.t.scores[k] = s;
    this.save();
  }
  private boardRows(board: string) {
    return Object.values(this.t.scores)
      .filter((s) => s.board === board && this.t.players[s.playerId])
      .sort((a, b) => b.score - a.score || a.at - b.at);
  }
  async top(board: string, limit: number) {
    return this.boardRows(board)
      .slice(0, limit)
      .map((s, i) => ({ ...s, rank: i + 1, player: this.t.players[s.playerId] }));
  }
  async rankOf(board: string, playerId: string) {
    const rows = this.boardRows(board);
    const i = rows.findIndex((r) => r.playerId === playerId);
    return i < 0 ? null : { rank: i + 1, total: rows.length };
  }
  /** number of stored players (bots + real) */
  get size() {
    return Object.keys(this.t.players).length;
  }
}

// ------------------------------------------------------------------ remote implementation (for later)
/** Same API over HTTP JSON — matches server/index.mjs. */
export class RemotePlayerStore implements PlayerStore {
  constructor(private base: string, private token = '') {}
  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  }
  upsertPlayer(p: PlayerRecord) {
    return this.req<void>(`/players/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify(p) });
  }
  getPlayer(id: string) {
    return this.req<PlayerRecord | null>(`/players/${encodeURIComponent(id)}`);
  }
  submitScore(s: ScoreRecord) {
    return this.req<void>('/scores', { method: 'POST', body: JSON.stringify(s) });
  }
  top(board: string, limit: number) {
    return this.req<RankedRow[]>(`/boards/${encodeURIComponent(board)}?limit=${limit}`);
  }
  rankOf(board: string, playerId: string) {
    return this.req<{ rank: number; total: number } | null>(`/boards/${encodeURIComponent(board)}/rank/${encodeURIComponent(playerId)}`);
  }
}

/** pick the store: `?api=https://…` (or window.XWAVE_API) switches to the server */
export function createStore(): PlayerStore {
  let api = '';
  try {
    api = new URLSearchParams(location.search).get('api') ?? (window as unknown as { XWAVE_API?: string }).XWAVE_API ?? '';
  } catch {
    /* no location */
  }
  return api ? new RemotePlayerStore(api.replace(/\/$/, '')) : new LocalPlayerStore();
}

/** ISO week key, e.g. "2026-W43" (weekly board name) */
export function weekBoard(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `week:${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
