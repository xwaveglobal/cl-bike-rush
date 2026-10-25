/**
 * Cloud account + cloud save (talks to server/index.mjs).
 *
 * - The server address comes from `?api=https://…`, `window.XWAVE_API` or CLOUD.api in config.ts.
 *   Without one, cloud save is off and the game stays local-only (the UI says so).
 * - Every install gets a guest account on first contact; signing in with email / Google / Apple attaches
 *   that identity, so the same progress loads after a reinstall or on another phone.
 * - The session token lives under its own localStorage key (never inside the save itself).
 * - EXP can only grow through verified runs (POST /runs); finished runs are queued while offline.
 */
import { kv } from '../core/kv.ts';
import { CLOUD } from '../config.ts';

export interface CloudAccount {
  accountId: string;
  email: string | null;
  providers: string[];
  rank?: string;
}
export interface CloudSave {
  save: Record<string, unknown> | null;
  rev: number;
  at: number;
  summary: { rank: string; exp: number; coins: number; races: number; name: string } | null;
}
export interface RunReport {
  variant: string;
  level: string;
  distance: number;
  seconds: number;
  exp: number;
  playerId?: string;
}

const AUTH_KEY = 'xwave-cloud-auth';
const QUEUE_KEY = 'xwave-cloud-runs';

interface AuthState {
  token: string;
  account: CloudAccount;
  /** server revision of the save this device last synced with */
  rev: number;
  /** local changes not pushed yet */
  dirty: boolean;
  lastSync: number;
}

function apiBase() {
  try {
    const q = new URLSearchParams(location.search).get('api');
    const w = (window as unknown as { XWAVE_API?: string }).XWAVE_API;
    return (q ?? w ?? CLOUD.api ?? '').replace(/\/$/, '');
  } catch {
    return CLOUD.api.replace(/\/$/, '');
  }
}

function load<T>(k: string, d: T): T {
  try {
    const r = kv.get(k);
    return r ? (JSON.parse(r) as T) : d;
  } catch {
    return d;
  }
}
function store(k: string, v: unknown) {
  try {
    if (v === null) kv.del(k);
    else kv.set(k, JSON.stringify(v));
  } catch {
    /* storage blocked */
  }
}

export class Cloud {
  readonly api = apiBase();
  private st: AuthState | null = load<AuthState | null>(AUTH_KEY, null);
  /** called when a sign-in finished (popup / redirect / email) */
  onSignedIn: (switched: boolean) => void = () => {};

  get enabled() {
    return !!this.api;
  }
  /** signed in with a real identity (not just the guest account) */
  get signedIn() {
    return !!this.st && this.st.account.providers.length > 0;
  }
  get account() {
    return this.st?.account ?? null;
  }
  get lastSync() {
    return this.st?.lastSync ?? 0;
  }
  get rev() {
    return this.st?.rev ?? 0;
  }

  private save() {
    store(AUTH_KEY, this.st);
  }

  private async call<T>(method: string, path: string, body?: unknown, auth = true): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth && this.st?.token) headers.authorization = `Bearer ${this.st.token}`;
    const r = await fetch(`${this.api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive: method !== 'GET' });
    let data: T;
    try {
      data = (await r.json()) as T;
    } catch {
      data = null as T;
    }
    return { status: r.status, data };
  }

  /** first contact: a guest account so progress can already be stored on the server */
  async ensureGuest() {
    if (!this.enabled || this.st) return;
    const r = await this.call<{ token: string; account: CloudAccount }>('POST', '/auth/guest', {}, false);
    if (r.status === 200 && r.data?.token) {
      this.st = { token: r.data.token, account: r.data.account, rev: 0, dirty: true, lastSync: 0 };
      this.save();
    }
  }

  private adopt(token: string, account: CloudAccount, switched: boolean) {
    const keepRev = !switched && this.st ? this.st.rev : 0;
    this.st = { token, account, rev: keepRev, dirty: !switched, lastSync: 0 };
    this.save();
    this.onSignedIn(switched);
  }

  // ---------------- email code
  async emailStart(email: string): Promise<{ ok: boolean; error?: string; devCode?: string }> {
    await this.ensureGuest();
    const r = await this.call<{ ok?: boolean; error?: string; devCode?: string }>('POST', '/auth/email/start', { email });
    return r.status === 200 ? { ok: true, devCode: r.data?.devCode } : { ok: false, error: r.data?.error ?? 'Could not send the code' };
  }
  async emailVerify(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
    const r = await this.call<{ token?: string; account?: CloudAccount; switched?: boolean; error?: string }>('POST', '/auth/email/verify', { email, code });
    if (r.status !== 200 || !r.data?.token || !r.data.account) return { ok: false, error: r.data?.error ?? 'Sign-in failed' };
    this.adopt(r.data.token, r.data.account, !!r.data.switched);
    return { ok: true };
  }

  // ---------------- Google / Apple (server-side OAuth in a popup; falls back to a full redirect)
  async oauth(provider: 'google' | 'apple') {
    await this.ensureGuest();
    const ret = location.href.split('#')[0];
    const u = `${this.api}/auth/${provider}/start?return=${encodeURIComponent(ret)}&guest=${encodeURIComponent(this.st?.token ?? '')}`;
    const w = window.open(u, 'xw-signin', 'width=480,height=640');
    if (!w) location.href = u;
  }
  /** token handed back by the OAuth page: postMessage from the popup, or #xw_auth=… after a redirect */
  listen() {
    window.addEventListener('message', (e) => {
      const d = e.data as { xw_auth?: string | null; error?: string | null } | null;
      if (d && typeof d === 'object' && 'xw_auth' in d && d.xw_auth) void this.finishToken(d.xw_auth);
    });
    try {
      const m = /[#&]xw_auth=([^&]+)/.exec(location.hash);
      if (m) {
        history.replaceState(null, '', location.href.split('#')[0]);
        void this.finishToken(decodeURIComponent(m[1]));
      }
    } catch {
      /* no history */
    }
  }
  private async finishToken(token: string) {
    const prev = this.st?.account.accountId;
    const r = await fetch(`${this.api}/me`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const account = (await r.json()) as CloudAccount;
    this.adopt(token, account, !!prev && prev !== account.accountId);
  }

  async signOut() {
    if (this.st) await this.call('POST', '/auth/logout', {}).catch(() => null);
    this.st = null;
    this.save();
  }

  // ---------------- save
  markDirty() {
    if (this.st && !this.st.dirty) {
      this.st.dirty = true;
      this.save();
    }
  }
  get dirty() {
    return !!this.st?.dirty;
  }
  async getSave(): Promise<CloudSave | null> {
    if (!this.st) return null;
    const r = await this.call<CloudSave | null>('GET', '/save');
    return r.status === 200 ? r.data : null;
  }
  /** push this device's save; 'conflict' = another device saved since our last sync (caller decides) */
  async putSave(save: unknown, force = false): Promise<{ ok: true } | { ok: false; conflict?: CloudSave }> {
    if (!this.st) return { ok: false };
    let rev = this.st.rev;
    if (force) {
      const cur = await this.getSave();
      rev = cur?.rev ?? 0;
    }
    const r = await this.call<{ rev?: number } & CloudSave>('PUT', '/save', { save, rev });
    if (r.status === 200 && typeof r.data?.rev === 'number') {
      this.st.rev = r.data.rev;
      this.st.dirty = false;
      this.st.lastSync = Date.now();
      this.save();
      return { ok: true };
    }
    if (r.status === 409) return { ok: false, conflict: r.data };
    return { ok: false };
  }
  /** this device now holds the server's copy */
  acceptServer(rev: number) {
    if (!this.st) return;
    this.st.rev = rev;
    this.st.dirty = false;
    this.st.lastSync = Date.now();
    this.save();
  }

  // ---------------- verified runs
  async reportRun(run: RunReport) {
    if (!this.enabled) return;
    const q = load<RunReport[]>(QUEUE_KEY, []);
    q.push(run);
    store(QUEUE_KEY, q.slice(-30));
    await this.flushRuns();
  }
  async flushRuns() {
    if (!this.st) return;
    const q = load<RunReport[]>(QUEUE_KEY, []);
    while (q.length) {
      try {
        const r = await this.call('POST', '/runs', q[0]);
        if (r.status >= 500 || r.status === 401) break; // retry later
      } catch {
        break; // offline
      }
      q.shift();
      store(QUEUE_KEY, q);
    }
  }
}
