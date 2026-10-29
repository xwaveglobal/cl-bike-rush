/**
 * v3 — the HS SDK kit (hs-sdk/, kit 3.2.3 · SDK 1.1.2) wired into Sky Roadster.
 *
 * Owner's answers (2026-10-22): SAVE local · no Game ID / SDK key yet (offline until registered) ·
 * shop + ads at revive / end bonus / free coins / head start (+ race end interstitial) · no sign-in button.
 *
 * Rules kept here (INTEGRATE-WITH-AI.md):
 *  - ALL progress lives in ONE HSGame.profile (save: 'local'); the game's SaveData is stored in it
 *    (numbers rewards can add to are top-level fields: coins, super, hyper, escape, no_ads).
 *  - keys / places are written as literals in the calls below (hs-check reads them from game.js).
 *  - TikTok-only buttons are drawn only while HSGame.has('<feature>') is true.
 *  - never tt.login / ads / share / pay directly — only through HSGame.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { perkVisible, type PerkKind, type PerkState } from '../meta/Perks.ts';

declare const require: (p: string) => any;

declare const GameGlobal: any;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hsModule = require('./hs-game.js');
/** the kit also sets GameGlobal.HSGame (used when a loader hands back an empty module object) */
const HSGame = hsModule && typeof hsModule.profile === 'function' ? hsModule : (typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis as any).HSGame;

/** HS credentials: Game ID = the TikTok App ID; SDK key from the HS dashboard (never the TikTok Client Secret). */
const GAME_ID = '7698594517263403028';
// The real key is NOT committed (public repo): scripts/build-tiktok.mjs swaps this placeholder for
// HS_SDK_KEY (env) or hs.local.json { "sdkKey": "sk_live_…" } (git-ignored) when it writes tiktok/game.js.
const SDK_KEY = '__HS_SDK_KEY__';

/**
 * What each moment gives (offline defaults; the HS dashboard overrides them, no new build).
 * Items are number fields of the profile below.
 */
export const DEFAULTS = {
  rewards: {
    share: { coins: 300, $limit: 'daily' },
    tiktok_profile: { coins: 300 },
    tiktok_shortcut: { coins: 300 },
  } as Record<string, Record<string, number | string>>,
  items: {
    coins: { category: 'currency', name: 'Coins' },
    super: { category: 'consumable', name: 'Roadster Jump' },
    hyper: { category: 'consumable', name: 'HYPER Jump' },
    escape: { category: 'consumable', name: 'SOS Escape' },
    no_ads: { category: 'unlock', name: 'No Ads' },
  } as Record<string, { category: string; name: string }>,
};

/** the ONE profile: numbers rewards can add to + the rest of the save in `game` */
export const profile = HSGame.profile(
  {
    coins: 0,
    super: 0,
    hyper: 0,
    escape: 0,
    no_ads: 0,
    exp_best: 0,
    exp2_best: 0,
    game: null as unknown,
    /** small non-progress data (local boards, flags) — src/core/kv.ts */
    kv: {} as Record<string, string>,
  },
  {
    save: 'local',
    merge: { exp_best: 'max', exp2_best: 'max', no_ads: 'max' },
    summary: 'exp_best',
  },
);

let started = false;
/** v3.0.11: start() finished either way (offline too) — reward buttons wait for this, never flash */
let settled = false;
export const hsReady: Promise<void> = HSGame.start({ gameId: GAME_ID, sdkKey: SDK_KEY, defaults: DEFAULTS })
  .then(() => {
    started = true;
  })
  .catch((e: unknown) => {
    console.warn('[hs] offline:', e);
  })
  .finally(() => {
    settled = true;
  });

export const hs = {
  get started() {
    return started;
  },
  /** is a platform feature on here, now? — ask every time a button is drawn */
  hasShare: () => !!HSGame.has('share'),
  hasShop: () => !!HSGame.has('shop'),
  hasAds: () => !!HSGame.has('ads'),
  hasMissions: () => !!HSGame.has('tiktok_missions'),

  // ---- ad places (no reward entry: watching lets the game go on / pays the game's own amount)
  canShowAd(place: string): boolean {
    switch (place) {
      case 'continue':
        return !!HSGame.canShowAd('rw_revive');
      case 'double_coins':
        return !!HSGame.canShowAd('rw_end_bonus');
      case 'free_coins':
        return !!HSGame.canShowAd('rw_free_coins');
      case 'head_start':
        return !!HSGame.canShowAd('rw_head_start');
      default:
        return !!HSGame.canShowAd('int_race_end');
    }
  },
  /** resolves true when the ad was watched to the end */
  async rewarded(place: string): Promise<boolean> {
    let r: unknown = null;
    switch (place) {
      case 'continue':
        r = await HSGame.showAd('rw_revive');
        break;
      case 'double_coins':
        r = await HSGame.showAd('rw_end_bonus');
        break;
      case 'free_coins':
        r = await HSGame.showAd('rw_free_coins');
        break;
      case 'head_start':
        r = await HSGame.showAd('rw_head_start');
        break;
      default:
        r = null;
    }
    return r !== null && r !== undefined;
  },
  async interstitial(): Promise<void> {
    await HSGame.showAd('int_race_end');
  },

  // ---- share (reward of key "share", once a day, added to the profile by HSGame)
  async share(title: string, subtitle: string, imageUrl?: string): Promise<'shared' | 'none'> {
    const r = await HSGame.share({ title, subtitle, ...(imageUrl ? { imageUrl } : {}) });
    return r ? 'shared' : 'none';
  },
  shareReward(): Record<string, number> | null {
    return HSGame.rewards('share');
  },

  // ---- TikTok review missions (Entry Reward / Launch Reward)
  entryStart() {
    HSGame.tiktokMission.start('profile');
  },
  launchStart() {
    HSGame.tiktokMission.start('shortcut');
  },
  entryDone: () => !!HSGame.tiktokMission.done('profile'),
  launchDone: () => !!HSGame.tiktokMission.done('shortcut'),
  entryReward: (): Record<string, number> | null => HSGame.rewards('tiktok_profile'),
  /**
   * v3.0.11: is this reward button worth showing now? Decided by HSGame from the reward
   * configuration ($limit once / daily / every time) and the claim state — never "claimed once =
   * gone". Hidden until HSGame has started, so an exhausted reward never flashes while loading.
   *  - Entry / Launch: feature on here and the TikTok mission not done (done() honours $limit).
   *  - Share: feature on here and a share reward can still be earned (available('share')); a
   *    Share with no reward configured stays (TikTok review button).
   */
  perkState(): PerkState {
    const st: PerkState = { started: settled, hasShare: false, hasMissions: false, shareRewarded: false, shareAvailable: false, entryDone: true, launchDone: true };
    if (!settled) return st;
    try {
      st.hasShare = !!HSGame.has('share');
      st.hasMissions = !!HSGame.has('tiktok_missions');
      st.shareRewarded = !!HSGame.rewards('share');
      st.shareAvailable = !!HSGame.available('share');
      st.entryDone = !!HSGame.tiktokMission.done('profile');
      st.launchDone = !!HSGame.tiktokMission.done('shortcut');
    } catch {
      /* keep the safe defaults (hidden) */
    }
    return st;
  },
  perkVisible(kind: PerkKind): boolean {
    return perkVisible(kind, this.perkState());
  },
  launchReward: (): Record<string, number> | null => HSGame.rewards('tiktok_shortcut'),

  // ---- shop (TikTok Beans / Google Play) — hidden until products exist in the dashboard
  async shop(): Promise<{ product_id: string | number; name: string; description?: string; beans_cost?: number; price?: string; items?: Record<string, number>; badge?: string }[]> {
    try {
      return (await HSGame.shop()) ?? [];
    } catch {
      return [];
    }
  },
  async buy(productId: string | number): Promise<{ ok: boolean; error?: string; delivered?: boolean }> {
    return HSGame.buy(productId);
  },

  /** an ad, a purchase or the app went away / came back */
  onPause(cb: () => void) {
    HSGame.on('pause', cb);
  },
  onResume(cb: () => void) {
    HSGame.on('resume', cb);
  },
  /** after ANY reward (share, missions, purchases) */
  onGiven(cb: (items: Record<string, number>, from: string) => void) {
    HSGame.on('given', cb);
  },
  itemName(id: string): string {
    return HSGame.item(id)?.name ?? DEFAULTS.items[id]?.name ?? id;
  },
};
