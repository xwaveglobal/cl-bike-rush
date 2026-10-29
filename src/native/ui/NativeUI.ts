/**
 * v3 native UI — the same API as src/ui/UI.ts (the DOM UI), drawn on a 2D canvas that the renderer
 * shows over the 3D view (Renderer.uiPass). The native build swaps `src/ui/UI.ts` for this module
 * (scripts/build-tiktok.mjs), so Game.ts is unchanged.
 *
 * Immediate mode: every redraw rebuilds the hit regions. Screens and popups live in screens.ts /
 * popups.ts; the race HUD and notices in hud.ts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SaveData } from '../../core/Save.ts';
import type { UIHandlers, RunRewards } from '../../ui/UI.ts';
import type { Run } from '../../gameplay/Run.ts';
import type { Board } from '../../meta/Leaderboard.ts';
import type { ItemKey, Quest, Reward, SpecialKey } from '../../meta/Daily.ts';
import type { EventInst, Prize } from '../../meta/Events.ts';
import type { EventResult } from '../../meta/Meta.ts';
import type { CrashTip } from '../../gameplay/CrashTip.ts';
import type { RankClass } from '../../meta/Rank.ts';
import { SKINS } from '../../render/Vehicle.ts';
import { LANGS, setLangCode, type Lang } from '../../ui/i18n.ts';
import { Gfx } from './gfx.ts';
import { drawScreens } from './screens.ts';
import { drawHud, drawNotices } from './hud.ts';
import { hs } from '../hs.ts';

export { carImage, carRear, logoImg, UPGRADE_MAX, upgradeCost, SAMPLE_BOARD_NOTE, MEGA_ICON } from '../../ui/shared.ts';
export type { UIHandlers, RunRewards, UpgradeKey } from '../../ui/UI.ts';

export interface GameOverData { score: number; best: number; isBest: boolean; dist: number; length?: number; coins: number; near: number; missions: { text: string; reward: number }[]; rewards: RunRewards | null; speedBonus: number; level: string; tip: CrashTip | null; runRank?: RankClass | null; pos?: string; car?: string; bonus?: boolean }
export interface FinishData { track: string; stars: number; score: number; isBest: boolean; time: number; coins: number; coinTarget: number; lost: number; reward: number; hasNext: boolean; rewards: RunRewards | null; speedBonus: number; level: string; leftover?: { pts: number; items: string } | null; bonusItems?: string[]; bonus?: boolean }
export type Notice = { kind: 'toast'; html: string; color: string } | { kind: 'banner'; w: string; n: string };
export interface HudState {
  run: Run | null;
  speed: number;
  maxSpeed: number;
  mission: { text: string; progress: number; target: number } | null;
  gate: { next: RankClass; k: number } | null;
  track: { section: string; dist: number; length: number; marks: number[] } | null;
  danger: string | null;
  dangerOkT: number;
  rocketWaitT: number;
}

const BASE = ['loading', 'start', 'tracks', 'garage', 'missions', 'ranks', 'daily', 'events', 'shop', 'hud', 'countdown', 'tutprompt'];
/** overlay draw order (bottom → top) */
export const OVERLAYS = ['finish', 'gameover', 'continue', 'pause', 'tutdone', 'tutintro', 'settings', 'guide', 'eventres', 'profile', 'bonus', 'specialpick', 'bag', 'bagbuy', 'boostinfo', 'spconfirm', 'rankguide', 'needrocket', 'account', 'cloudpick', 'sharepv', 'popup', 'logs'];

export class UI {
  /** Game uses root.getBoundingClientRect() to map 3D → screen */
  root: any;
  g!: Gfx;
  shown = new Set<string>(['loading']);
  /** something changed → redraw */
  dirty = true;
  /** the next redraw is a HUD-only change (throttled) */
  hudDirty = false;

  // ---------------------------------------------------------------- state from the game
  save: SaveData | null = null;
  lastSave: SaveData | null = null;
  liveQuality: 'high' | 'low' | null = null;
  loading = 0;
  loadText = 'Loading…';
  home: Parameters<UI['homeSync']>[0] | null = null;
  bonus: Parameters<UI['bonusSync']>[0] | null = null;
  prof: Parameters<UI['profileSync']>[0] | null = null;
  player: number | null = null;
  board: { board: Board; tab: 'week' | 'all'; extra: string } | null = null;
  daily: Parameters<UI['dailySync']>[0] | null = null;
  events: Parameters<UI['eventsSync']>[0] | null = null;
  over: GameOverData | null = null;
  fin: FinishData | null = null;
  tut: { index: number; total: number; need: string; title: string; sub: string } | null = null;
  tutWrongT = -1e9;
  tutDoneP: SpecialKey | null | undefined = undefined;
  cont: { left: number; k: number; sec: number } = { left: 2, k: 1, sec: 7 };
  count = '';
  countT = 0;
  tutHint = false;
  pick: { track: string } | null = null;
  bagPick = false;
  spc: SpecialKey | null = null;
  boost: { k: ItemKey; owned: number; equipped: boolean; wallet: number } | null = null;
  popData: { kind: string; d: Record<string, unknown> } | null = null;
  popView: 'popup' | 'country' | 'lang' = 'popup';
  acct: Parameters<UI['accountSync']>[0] | null = null;
  acctText = 'This device';
  cloudPick: { device: any; cloud: any } | null = null;
  eventRes: EventResult[] = [];
  nr: { owned: number; wallet: number; price: number } | null = null;
  adState: Record<string, { used: boolean; text: string }> = {};
  hidden: Record<string, boolean> = {};
  freeLeft = 5;
  freeAmount = 100;
  perks: Record<'entry' | 'launch' | 'share', 'todo' | 'ready' | 'done'> = { entry: 'todo', launch: 'todo', share: 'ready' };
  garageIndex = 0;
  guideOpen = -1;
  version = '';
  debugText: string | null = null;
  comfort = true;
  /** HS shop products (TikTok Beans), loaded when the shop opens */
  products: { product_id: string | number; name: string; description?: string; beans_cost?: number; price?: string; items?: Record<string, number>; badge?: string }[] = [];

  // ---------------------------------------------------------------- HUD
  bonusHud = false;
  trainHud = false;
  hudBest = 0;
  hudLevel = '';
  hudTop: RankClass = 'AAA';
  hudMe: RankClass = 'D';
  myClass: RankClass = 'D';
  hud: HudState = { run: null, speed: 0, maxSpeed: 1, mission: null, gate: null, track: null, danger: null, dangerOkT: -1e9, rocketWaitT: -1e9 };
  rocketReady = false;
  /** colour calibration control (src/native/color.ts), set by main */
  colorCtl: { mode: () => string; line: () => string; cycle: () => void } | null = null;
  verTaps = 0;
  showDiag = false;

  // ---------------------------------------------------------------- effects
  notices: Notice[] = [];
  /** v3.0.11 home reward rail: per-tile glide state, and until when a glide is running */
  railAnim: Record<string, { from: number; to: number; t0: number }> = {};
  railMovingUntil = 0;
  notice: (Notice & { t0: number; ms: number }) | null = null;
  pops: { text: string; color: string; sub: string; t0: number } | null = null;
  big: { label: string; color: string; icon: string; sub: string; t0: number } | null = null;
  flyers: { x: number; y: number; icon: string; target: string; t0: number; dur: number }[] = [];
  bumps: Record<string, number> = {};
  private flyLast: Record<string, number> = {};
  fastTapT = -1e9;

  constructor(_parent: unknown, public h: UIHandlers) {
    this.root = { getBoundingClientRect: () => ({ left: 0, top: 0, width: this.g?.W ?? 390, height: this.g?.H ?? 844, right: this.g?.W ?? 390, bottom: this.g?.H ?? 844 }) };
  }

  /** set up by src/native/main.ts once the canvas exists */
  attach(g: Gfx) {
    this.g = g;
    g.onError = (_w, msg) => setTimeout(() => this.toastNow(`⚠ ${msg.replace(/[<>&]/g, '')}`, 'var(--red)'), 0);
    g.onImageLoad = () => (this.dirty = true);
  }

  now() {
    return this.g ? this.g.time : 0;
  }
  private t() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  // ---------------------------------------------------------------- frame
  private lastDraw = 0;
  /** is anything animating (pops, notices, flyers, countdown, home pulse)? */
  animating(t: number) {
    if (this.notice || this.notices.length || this.pops || this.big || this.flyers.length) return true;
    if (this.shown.has('countdown') && t - this.countT < 1200) return true;
    if (this.shown.has('loading') || this.shown.has('start') || this.shown.has('continue') || this.shown.has('tutprompt') || this.tutHint) return true;
    if (this.shown.has('hud') && (this.hud.danger || this.rocketReady || t - this.hud.rocketWaitT < 800)) return true;
    for (const k in this.bumps) if (t - this.bumps[k] < 260) return true;
    return false;
  }

  /** draw when needed; returns true when the canvas changed */
  frame(t: number): boolean {
    const since = t - this.lastDraw;
    const run = this.shown.has('hud') && !OVERLAYS.some((o) => this.shown.has(o));
    let need = this.dirty;
    if (!need && this.hudDirty && since > (run ? 66 : 33)) need = true;
    // v3.0.9: the home screen only pulses — redraw (and re-upload the full-screen UI texture) at ~11 fps
    // there instead of 25 fps; the 3D city keeps its full frame rate (smoother on Android)
    const homeIdle = this.shown.has('start') && !OVERLAYS.some((o) => this.shown.has(o)) && !this.notice && !this.notices.length && !this.pops && !this.flyers.length && t > this.railMovingUntil;
    if (!need && this.animating(t) && since > (run ? 33 : homeIdle ? 90 : 40)) need = true;
    if (!need) return false;
    this.dirty = false;
    this.hudDirty = false;
    this.lastDraw = t;
    const g = this.g;
    g.begin(t);
    this.pumpNotice(t);
    drawScreens(this, g, BASE, 'base');
    if (this.shown.has('hud')) g.guard('hud', () => drawHud(this, g));
    drawScreens(this, g, OVERLAYS, 'overlay');
    g.guard('notices', () => drawNotices(this, g));
    if (this.debugText) g.para(this.debugText, 8, g.H - 120, g.W - 16, { size: 10, font: 'b', color: '#9fffa0' });
    return true;
  }

  // ---------------------------------------------------------------- touch
  private press: { key: string; fn: () => void; x: number; y: number } | null = null;
  private drag: { key: string; horiz: boolean; start: number; x: number; y: number; moved: boolean } | null = null;
  private passthrough = false;
  private errShown = new Set<string>();

  /** returns true when the UI took the touch (else it steers the car) */
  touchStart(x: number, y: number): boolean {
    const g = this.g;
    this.passthrough = false;
    let hit = null;
    for (let i = g.hits.length - 1; i >= 0; i--) {
      const h = g.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        hit = h;
        break;
      }
    }
    // scroll area under the finger (topmost)
    for (let i = g.scrolls.length - 1; i >= 0; i--) {
      const s = g.scrolls[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
        this.drag = { key: s.key, horiz: !!s.horiz, start: g.off[s.key] ?? 0, x, y, moved: false };
        break;
      }
    }
    if (hit) {
      if (hit.down) {
        this.fastTapT = this.t();
        g.pressed = hit.key;
        this.dirty = true;
        setTimeout(() => {
          if (g.pressed === hit!.key) g.pressed = '';
          this.dirty = true;
        }, 140);
        hit.fn();
        return true;
      }
      if (hit.key !== '#block') {
        this.press = { key: hit.key, fn: hit.fn, x, y };
        g.pressed = hit.key;
        this.dirty = true;
      } else this.press = { key: '#block', fn: hit.fn, x, y };
      return true;
    }
    if (this.drag) return true;
    // nothing hit: during a race the touch steers the car
    if (this.shown.has('hud') || this.shown.has('tutprompt')) {
      const modal = OVERLAYS.some((o) => this.shown.has(o));
      if (!modal) {
        this.passthrough = true;
        return false;
      }
    }
    return true;
  }
  touchMove(x: number, y: number): boolean {
    if (this.passthrough) return false;
    const d = this.drag;
    if (d) {
      const dx = x - d.x,
        dy = y - d.y;
      if (!d.moved && Math.abs(d.horiz ? dx : dy) > 8) {
        d.moved = true;
        if (this.press) {
          this.press = null;
          this.g.pressed = '';
        }
      }
      if (d.moved) {
        this.g.off[d.key] = d.start - (d.horiz ? dx : dy);
        this.dirty = true;
      }
    } else if (this.press && Math.hypot(x - this.press.x, y - this.press.y) > 14) {
      this.press = null;
      this.g.pressed = '';
      this.dirty = true;
    }
    return true;
  }
  touchEnd(): boolean {
    if (this.passthrough) {
      this.passthrough = false;
      return false;
    }
    const p = this.press;
    this.press = null;
    this.drag = null;
    if (this.g.pressed) {
      this.g.pressed = '';
      this.dirty = true;
    }
    if (p) {
      try {
        p.fn();
      } catch (e) {
        console.error(e);
        // surface it once on the device (no console there) — a broken button must never be silent
        const msg = String((e as Error)?.message ?? e).slice(0, 80);
        if (!this.errShown.has(msg)) {
          this.errShown.add(msg);
          this.toastNow(`⚠ ${p.key}: ${msg.replace(/[<>&]/g, '')}`, 'var(--red)');
        }
      }
      this.dirty = true;
    }
    return true;
  }

  // ================================================================ API (same as the DOM UI)
  show(...ids: string[]) {
    this.shown = new Set(ids);
    if (!ids.includes('popup')) this.popView = 'popup';
    this.dirty = true;
  }
  isShown(id: string) {
    return this.shown.has(id);
  }
  showOverlay(id: string) {
    this.shown.add(id);
    if (id === 'shop' || id === 'start') this.dirty = true;
    this.dirty = true;
  }
  hideOverlay(id: string) {
    this.shown.delete(id);
    this.dirty = true;
  }
  closePopup() {
    this.shown.delete('popup');
    this.popView = 'popup';
    this.dirty = true;
  }
  setLoading(k: number) {
    this.loading = k;
    this.dirty = true;
  }
  setLoadingText(t: string) {
    this.loadText = t;
    this.dirty = true;
  }
  refreshProfile(s: SaveData, liveQuality?: 'high' | 'low') {
    if (liveQuality) this.liveQuality = liveQuality;
    this.save = s;
    this.dirty = true;
  }
  gateHud(g: { next: RankClass; k: number } | null) {
    this.hud.gate = g;
    this.hudDirty = true;
  }
  resetHud() {
    this.hudDirty = true;
  }
  updateHud(run: Run, speed: number, maxSpeed: number, mission: { text: string; progress: number; target: number } | null) {
    this.hud.run = run;
    this.hud.speed = speed;
    this.hud.maxSpeed = maxSpeed;
    this.hud.mission = mission;
    this.hudDirty = true;
  }
  trackHud(o: { section: string; dist: number; length: number; marks: number[] } | null) {
    this.hud.track = o;
    this.hudDirty = true;
  }
  pop(text: string, color = '#ffffff', sub = '', _offsetY = 0) {
    this.pops = { text, color, sub, t0: this.t() };
    this.big = null;
    this.dirty = true;
  }
  flyTo(x: number, y: number, icon: string, target: 'coins' | 'bolts' | 'powers' | 'rocket' | 'sos' | 'hearts', gapMs = 0) {
    const now = this.t();
    if (gapMs && now - (this.flyLast[target] ?? 0) < gapMs) return;
    if (this.flyers.length > 14) return;
    this.flyLast[target] = now;
    this.flyers.push({ x, y, icon, target, t0: now, dur: target === 'coins' ? 520 : 760 });
  }
  bigPickup(label: string, color: string, icon: string, sub = '') {
    this.pops = null;
    this.big = { label, color, icon, sub, t0: this.t() };
  }
  // ---- one notice at a time (toasts and banners take turns under the HUD)
  private noticeKey(n: Notice) {
    return n.kind === 'banner' ? `b:${n.w}|${n.n}` : `t:${n.html}`;
  }
  private pushNotice(n: Notice) {
    const key = this.noticeKey(n);
    if ((this.notice && this.noticeKey(this.notice) === key) || this.notices.some((q) => this.noticeKey(q) === key)) return;
    this.notices.push(n);
    while (this.notices.length > 2) this.notices.shift();
    this.dirty = true;
  }
  pumpNotice(t: number) {
    if (this.notice && t - this.notice.t0 > this.notice.ms) this.notice = null;
    if (this.notice || !this.notices.length) return;
    const n = this.notices.shift()!;
    let ms = 1900;
    if (n.kind === 'toast') {
      const len = n.html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').length;
      ms = Math.min(3800, 2200 + Math.max(0, len - 40) * 25);
      if (this.notices.length) ms = Math.min(ms, 1800);
    }
    this.notice = { ...n, t0: t, ms };
  }
  toast(html: string, color = 'var(--cyan)') {
    this.pushNotice({ kind: 'toast', html, color });
  }
  /** v3.0.11: "Reward Claimed!" after an Entry / Launch / Share reward (shown even if its button is gone) */
  rewardClaimed(title: string, what: string) {
    this.toastNow(`<b>Reward Claimed!</b><br/>${title} · ${what}`, 'var(--gold)');
    this.dirty = true;
  }
  toastNow(html: string, color = 'var(--cyan)') {
    this.notices.length = 0;
    this.notice = null;
    this.pushNotice({ kind: 'toast', html, color });
  }
  banner(world: string, name: string) {
    this.pushNotice({ kind: 'banner', w: world, n: name });
  }
  setComfort(on: boolean) {
    this.comfort = on;
  }
  flash(_red = false) {
    return;
  }
  countdown(v: string) {
    this.count = v;
    this.countT = this.t();
    this.dirty = true;
  }
  tutorial(on: boolean) {
    this.tutHint = on;
    this.dirty = true;
  }
  gameOver(o: GameOverData) {
    this.over = o;
    this.adState.ad2x = { used: false, text: '' };
    this.dirty = true;
  }
  finish(o: FinishData) {
    this.fin = o;
    this.adState.ad2xf = { used: false, text: '' };
    this.dirty = true;
  }
  garageSync(s: SaveData, previewId?: string) {
    this.save = s;
    if (previewId) this.garageIndex = SKINS.findIndex((x) => x.id === previewId);
    if (this.garageIndex < 0) this.garageIndex = 0;
    this.dirty = true;
  }
  missionsSync(s: SaveData) {
    this.save = s;
    this.dirty = true;
  }
  tracksSync(s: SaveData, _liveTrack?: string) {
    this.save = s;
    this.lastSave = s;
    this.dirty = true;
  }
  tutPrompt(step: { index: number; total: number; need: string; title: string; sub: string } | null) {
    this.tut = step;
    if (step) this.shown.add('tutprompt');
    else this.shown.delete('tutprompt');
    this.dirty = true;
  }
  tutWrong() {
    this.tutWrongT = this.t();
    this.dirty = true;
  }
  tutDone(practice: SpecialKey | null) {
    this.tutDoneP = practice;
    this.show('tutdone');
  }
  continueOffer(o: { left: number; tip?: CrashTip | null }) {
    this.cont = { left: o.left, k: 1, sec: 7 };
    // HS rule 12: the revive button only exists while an ad can be shown here
    if (!hs.canShowAd('continue')) {
      setTimeout(() => this.h.continueNo(), 0);
      return;
    }
    this.show('hud', 'continue');
  }
  continueTick(k: number, secLeft: number) {
    this.cont.k = k;
    this.cont.sec = secLeft;
    this.dirty = true;
  }
  hideEl(key: string, hide: boolean) {
    this.hidden[key] = hide;
    this.dirty = true;
  }
  adButton(key: 'ad2x' | 'ad2xf' | 'adboost', state: 'ready' | 'used', usedText = '') {
    this.adState[key] = { used: state === 'used', text: usedText };
    this.dirty = true;
  }
  freeCoins(left: number, amount: number) {
    this.freeLeft = left;
    this.freeAmount = amount;
    this.dirty = true;
  }
  debug(text: string | null) {
    this.debugText = text;
    this.dirty = true;
  }
  homeSync(o: { name: string; color: string; best: number; avatar: number; bolts: number; weekRank: number | null; allRank?: number | null; dailyBadge: number; bonus: { live: boolean; name: string; theme: string; text: string }; sale: boolean; pass: boolean }) {
    this.home = o;
    this.dirty = true;
  }
  bonusSync(o: { live: boolean; theme: string; name: string; left: string; opens: string; opensAt: string; next: string; finish: number; minutes: number; played: boolean }) {
    this.bonus = o;
    this.shown.add('bonus');
    this.dirty = true;
  }
  profileSync(o: { self: true; name: string; avatar: number; cls: RankClass; bolts: number; next: RankClass | null; k: number; need: number; best: number; weekRank: number | null; runs: number; trophies: SaveData['trophies']; car: string; country: string }) {
    this.myClass = o.cls;
    this.prof = o;
    this.player = null;
    this.dirty = true;
  }
  /** rows of the last board drawn (tap → rival card) */
  rowCache: { r: any; cls: RankClass }[] = [];
  showPlayer(i: number) {
    const e = this.rowCache[i];
    if (!e) return;
    if (e.r.you) return this.h.profile();
    this.player = i;
    this.shown.add('profile');
    this.dirty = true;
  }
  specialPick(s: SaveData, track: string) {
    this.save = s;
    this.pick = { track };
    this.shown.add('specialpick');
    this.dirty = true;
  }
  bagSync(s: SaveData, pick = false) {
    this.save = s;
    this.lastSave = s;
    this.bagPick = pick;
    this.dirty = true;
  }
  buySync(s: SaveData) {
    this.save = s;
    this.dirty = true;
  }
  sharePreview(_blob: unknown, _text: string) {
    // native: the platform share sheet is used instead
  }
  acctLine(t: string) {
    this.acctText = t;
    this.dirty = true;
  }
  accountSync(o: { enabled: boolean; signedIn: boolean; email: string | null; providers: string[]; lastSync: number; codeFor?: string; busy?: boolean; msg?: string }) {
    this.acct = o;
    this.shown.add('account');
    this.dirty = true;
  }
  cloudChoice(device: { rank: RankClass; exp: number; coins: number; races: number }, cloud: { rank: RankClass; exp: number; coins: number; races: number }) {
    this.cloudPick = { device, cloud };
    this.shown.add('cloudpick');
    this.dirty = true;
  }
  spConfirm(k: SpecialKey) {
    this.spc = k;
    this.shown.add('spconfirm');
    this.dirty = true;
  }
  boostSync(k: ItemKey, owned: number, equipped: boolean, wallet = 0) {
    this.boost = { k, owned, equipped, wallet };
    this.dirty = true;
  }
  settingsSync(s: SaveData, _name: string, version: string) {
    this.save = s;
    this.version = version;
    this.dirty = true;
  }
  ranksSync(board: Board, tab: 'week' | 'all', extra: string) {
    this.board = { board, tab, extra };
    this.dirty = true;
  }
  dailySync(o: { slot: number; claimedToday: boolean; streak: number; quests: (Quest & { progress: number; done: boolean; claimed: boolean })[]; pts: number; chests: number[]; resetIn: string; pass: { active: boolean; claimed: boolean; days: number } }) {
    this.daily = o;
    this.dirty = true;
  }
  eventsSync(o: {
    cls: RankClass; bolts: number; live: boolean; mine: EventInst; now: number; best: number; rank: number | null; total: number;
    divisions: { div: RankClass; cup: EventInst; open: boolean; need: number }[]; prizes: Prize[];
    upcoming: { start: number; cup: EventInst }[]; trophies: SaveData['trophies']; boardOpen: boolean; board?: Board;
  }) {
    this.myClass = o.cls;
    this.events = o;
    this.dirty = true;
  }
  shopSync(s: SaveData) {
    this.save = s;
    this.dirty = true;
    // TikTok Beans products from the HS dashboard (hidden until there are some)
    if (hs.hasShop())
      void hs.shop().then((p) => {
        this.products = p;
        this.dirty = true;
      });
    else this.products = [];
  }
  eventResults(list: EventResult[]) {
    this.eventRes = list;
    this.dirty = true;
  }
  rankGuide() {
    this.shown.add('rankguide');
    this.dirty = true;
  }
  speedTip(_k: 'easy' | 'normal' | 'hard') {
    this.dirty = true;
  }
  popup(kind: 'daily' | 'ad' | 'gift' | 'entry' | 'launch' | 'share' | 'invite' | 'rate' | 'addscreen' | 'offline', d: Record<string, unknown>) {
    this.popData = { kind, d };
    this.popView = 'popup';
    this.shown.add('popup');
    this.dirty = true;
  }
  perkBadges(o: Record<'entry' | 'launch' | 'share', 'todo' | 'ready' | 'done'>) {
    this.perks = o;
    this.dirty = true;
  }
  countryPicker() {
    this.popView = 'country';
    this.shown.add('popup');
    this.dirty = true;
  }
  langPicker() {
    this.popView = 'lang';
    this.shown.add('popup');
    this.dirty = true;
  }
  lang: string = 'en';
  applyLang(code: string) {
    const l = LANGS.find((x) => x.code === code) ?? LANGS[0];
    this.lang = l.code;
    setLangCode(l.code as Lang);
    this.dirty = true;
  }
  needRocket(o: { owned: number; wallet: number; price: number }) {
    this.nr = o;
    this.dirty = true;
  }
  dangerOk() {
    this.hud.dangerOkT = this.t();
    setTimeout(() => {
      this.hud.danger = null;
      this.dirty = true;
    }, 260);
  }
  rocketWait() {
    this.hud.rocketWaitT = this.t();
    this.toast(`<b>Save it!</b> Tap ROADSTER when the button lights up`, '#9b6bff');
  }
  danger(hint: string | null) {
    this.rocketReady = hint === 'rocket';
    this.hud.danger = hint;
    this.hud.dangerOkT = -1e9;
    this.hudDirty = true;
  }
  rewardToast(title: string, r: Reward) {
    this.toast(`${title} ${rewardText(r)}`, 'var(--gold)');
  }
}

export function rewardText(r: Reward) {
  const out: string[] = [];
  if (r.coins) out.push(`<span class="price">+${r.coins.toLocaleString('en-US')} coins</span>`);
  for (const [k, n] of Object.entries(r.items ?? {})) if (n) out.push(`<b>${k} ×${n}</b>`);
  return out.join(' ');
}
