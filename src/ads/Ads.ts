/**
 * Ad layer: rewarded + interstitial placements behind one small interface.
 *
 * Providers
 *  - H5GamesAdsProvider: Google "Ad Placement API" for H5 games (AdSense for Games / AdMob H5).
 *    Used automatically when the page defines `window.adBreak` (see README → Ads).
 *  - MockAdProvider: a full-screen demo ad with a countdown, so every placement can be tried
 *    without an ad account. Used when no real SDK is present.
 *
 * Placements and frequency rules live in ADS (config below) — tune there.
 */

export type RewardPlacement = 'continue' | 'double_coins' | 'free_coins' | 'head_start';
export type InterPlacement = 'between_runs';

export const ADS = {
  enabled: true,
  /** interstitial at most once every N finished runs … */
  interstitialEveryRuns: 1, // v2: an ad after each race that ends (Remove Ads turns it off)
  /** … and never more often than this many seconds */
  interstitialMinGapSec: 45,
  /** players' first runs are ad-free */
  noInterstitialBeforeRun: 2,
  /** no interstitial right after the player chose to watch a rewarded ad */
  rewardedGraceSec: 30,
  freeCoinsPerDay: 5,
  /** v2.2 end-screen ad: +this share of the race's coins (not ×2) */
  endBonus: 0.2,
  freeCoinsAmount: 100,
  /** v1 only — v2 revives are by rewarded ad only (docs/GAME-DESIGN.md §6) */
  continueCoinCost: 300,
  /** max revives per race (v2: rewarded ad each); the 3rd crash ends the race */
  maxContinues: 2,
  continueSeconds: 7,
};

export interface AdProvider {
  readonly name: string;
  rewarded(placement: RewardPlacement): Promise<boolean>;
  interstitial(placement: InterPlacement): Promise<void>;
}

type AdBreakFn = (o: Record<string, unknown>) => void;

/** v3 native: the platform's own ad provider (HSGame.showAd) — set before the Game is created */
let platformProvider: AdProvider | null = null;
export function setAdProvider(p: AdProvider) {
  platformProvider = p;
}

/** Google Ad Placement API (H5 Games Ads). */
class H5GamesAdsProvider implements AdProvider {
  readonly name = 'h5-games-ads';
  constructor(private adBreak: AdBreakFn) {}

  rewarded(placement: RewardPlacement) {
    return new Promise<boolean>((resolve) => {
      let viewed = false;
      let offered = false;
      this.adBreak({
        type: 'reward',
        name: placement,
        beforeReward: (showAdFn: () => void) => {
          offered = true;
          showAdFn();
        },
        adViewed: () => (viewed = true),
        adDismissed: () => (viewed = false),
        adBreakDone: () => resolve(offered && viewed),
      });
    });
  }

  interstitial(placement: InterPlacement) {
    return new Promise<void>((resolve) => {
      this.adBreak({ type: 'next', name: placement, adBreakDone: () => resolve() });
    });
  }
}

/** Demo ad overlay: shows exactly where and how long an ad interrupts the game. */
class MockAdProvider implements AdProvider {
  readonly name = 'mock';
  constructor(private parent: HTMLElement) {}

  private show(kind: 'rewarded' | 'interstitial', placement: string, seconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'admock';
      el.innerHTML = `
        <div class="admock-box">
          <div class="admock-tag">AD · DEMO</div>
          <div class="admock-title">${kind === 'rewarded' ? 'Rewarded video' : 'Interstitial'}</div>
          <div class="admock-sub">Placement: <b>${placement}</b><br/>A real ad network plays here (see README → Ads).</div>
          <div class="admock-bar"><i></i></div>
          <div class="admock-count">${seconds}</div>
          <div class="admock-actions">
            <button class="btn ghost sm" data-x="skip">${kind === 'rewarded' ? 'Close · no reward' : 'Close'}</button>
            <button class="btn sm" data-x="done" hidden>${kind === 'rewarded' ? 'Claim reward ✓' : 'Continue'}</button>
          </div>
        </div>`;
      this.parent.appendChild(el);
      const bar = el.querySelector<HTMLElement>('.admock-bar i')!;
      const count = el.querySelector<HTMLElement>('.admock-count')!;
      const done = el.querySelector<HTMLButtonElement>('[data-x="done"]')!;
      const skip = el.querySelector<HTMLButtonElement>('[data-x="skip"]')!;
      if (kind === 'interstitial') skip.hidden = true;
      const t0 = performance.now();
      const timer = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        bar.style.width = `${k * 100}%`;
        count.textContent = String(Math.ceil(seconds * (1 - k)));
        if (k >= 1) {
          window.clearInterval(timer);
          count.textContent = '✓';
          done.hidden = false;
          skip.hidden = true;
        }
      }, 100);
      const finish = (ok: boolean) => {
        window.clearInterval(timer);
        el.remove();
        resolve(ok);
      };
      done.addEventListener('click', () => finish(true));
      skip.addEventListener('click', () => finish(false));
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });
  }

  rewarded(placement: RewardPlacement) {
    return this.show('rewarded', placement, 5);
  }
  async interstitial(placement: InterPlacement) {
    await this.show('interstitial', placement, 3);
  }
}

/**
 * v3.0.11: never wait forever on a platform ad. If the platform's promise is lost (an ad that
 * fails to load / close event never delivered), `showing` used to stay true and every later ad
 * button — Revive included — silently did nothing, and a lost interstitial froze the game-over
 * buttons. A generous cap settles it instead.
 */
function capped<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn('[ads] no answer from the ad provider — continuing');
      resolve(fallback);
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

export interface AdHooks {
  /** mute + freeze the game while an ad is on screen */
  pause(): void;
  resume(): void;
}

export class Ads {
  private provider: AdProvider;
  private lastInterstitial = 0;
  private lastRewarded = -1e9;
  private runsSinceInterstitial = 0;
  showing = false;
  /** simple counters for tuning (shown with ?debug) */
  stats = { rewardedShown: 0, rewardedCompleted: 0, interstitials: 0 };

  constructor(parent: HTMLElement, private hooks: AdHooks) {
    const w = window as unknown as { adBreak?: AdBreakFn };
    this.provider = platformProvider ?? (typeof w.adBreak === 'function' ? new H5GamesAdsProvider(w.adBreak) : new MockAdProvider(parent));
    this.lastInterstitial = performance.now();
  }

  get providerName() {
    return this.provider.name;
  }

  /** Rewarded ad: resolves true only if the player watched it to the end. */
  async rewarded(placement: RewardPlacement): Promise<boolean> {
    if (!ADS.enabled || this.showing) return false;
    this.showing = true;
    this.stats.rewardedShown++;
    this.hooks.pause();
    try {
      const ok = await capped(this.provider.rewarded(placement), 90000, false); // called synchronously: still inside the tap
      if (ok) {
        this.stats.rewardedCompleted++;
        this.lastRewarded = performance.now();
      }
      return ok;
    } finally {
      this.showing = false;
      this.hooks.resume();
    }
  }

  /** Call once per finished run. */
  runEnded() {
    this.runsSinceInterstitial++;
  }

  /**
   * Interstitial at a natural break (leaving the results screen). Respects the
   * frequency caps; resolves immediately when no ad is due.
   */
  async maybeInterstitial(placement: InterPlacement, totalRuns: number) {
    const now = performance.now();
    if (
      !ADS.enabled ||
      this.showing ||
      totalRuns < ADS.noInterstitialBeforeRun ||
      this.runsSinceInterstitial < ADS.interstitialEveryRuns ||
      now - this.lastInterstitial < ADS.interstitialMinGapSec * 1000 ||
      now - this.lastRewarded < ADS.rewardedGraceSec * 1000
    )
      return;
    this.showing = true;
    this.hooks.pause();
    try {
      await capped(this.provider.interstitial(placement), 45000, undefined);
      this.stats.interstitials++;
      this.runsSinceInterstitial = 0;
      this.lastInterstitial = performance.now();
    } finally {
      this.showing = false;
      this.hooks.resume();
    }
  }
}
