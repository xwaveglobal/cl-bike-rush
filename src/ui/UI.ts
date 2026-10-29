import { COUNTRIES, countryName, flagOf } from '../meta/Country.ts';
import './ui.css';
import { ICON } from './icons.ts';
import { copyText } from './ShareCard.ts';
import { AVATAR_COUNT, avatarForName, avatarSvg, classCorner } from './avatars.ts';
import { CLASSES, CLASS_COLOR, CLASS_MIN, XPT, classBadge, classFor as classOfBolts, classForScore, playerRank, type RankClass } from '../meta/Rank.ts';
import logoUrl from '../assets/images/sky-roadster-logo.webp';
import appIcon from '../assets/images/app-icon.webp';
import { amount, calendarGift, coinFace, coinPile, friends, giftBox, megaphone, phonePlus, shareNodes, starBig, tapMarks, wifiRobot } from './art.ts';
import loadingUrl from '../assets/images/loading.jpg';
import thFuture from '../assets/images/tracks/future-city.jpg';
import thTunnel from '../assets/images/tracks/neon-tunnel.jpg';
import thCloud from '../assets/images/tracks/cloud-city.jpg';
import thSpace from '../assets/images/tracks/space-zone.jpg';
import thMega from '../assets/images/tracks/mega-city.jpg';
import thEndless from '../assets/images/tracks/endless.jpg';
import guide1 from '../assets/images/guide/guide-1.jpg';
import guide2 from '../assets/images/guide/guide-2.jpg';
import guide3 from '../assets/images/guide/guide-3.jpg';
import { CHAINS, activeChains, pilotLevel } from '../meta/Career.ts';
import type { SaveData } from '../core/Save.ts';
import { SKINS, carVisibility } from '../render/Vehicle.ts';
import { CAR_IMG, carImage, carRear, carShadow, logoImg } from './shared.ts';
export { carImage, carRear, logoImg };
const RARITY_COLOR: Record<string, string> = { Common: '#4fb3ff', Rare: '#a77bff', Epic: '#ffc24a', Legendary: '#ff4a3c', Mythic: '#d04dff' };
import { LEVELS } from '../config.ts';
import type { Run } from '../gameplay/Run.ts';
import type { PickupKind } from '../gameplay/types.ts';
import type { Board, LbRow } from '../meta/Leaderboard.ts';
import { CHECKIN, ITEM_PRICE, LOCKED_SPECIALS, SPECIALS, rewardValue, type ItemKey, type Quest, type Reward, type SpecialKey } from '../meta/Daily.ts';
import { fmtLeft, localTime, type EventInst, type Prize } from '../meta/Events.ts';
import { PRODUCTS, type Product } from '../meta/Shop.ts';
import type { EventResult } from '../meta/Meta.ts';
import type { CrashTip } from '../gameplay/CrashTip.ts';
import { LANGS, getLang, setLang, translateTree, type Lang } from './i18n.ts';

/** track thumbnail: remixes reuse their world's art */
const THUMBS: Record<string, string> = {
  endless: thEndless,
  'future-city': thFuture,
  'neon-tunnel': thTunnel,
  'cloud-city': thCloud,
  'space-zone': thSpace,
  'mega-city': thMega,
};

import { UPGRADE_MAX, upgradeCost, type UpgradeKey } from './shared.ts';
export { UPGRADE_MAX, upgradeCost, type UpgradeKey };

/** Show a small "demo rivals" note under sample leaderboards (set false once boards are online). */
import { SAMPLE_BOARD_NOTE } from './shared.ts';
export { SAMPLE_BOARD_NOTE };

export interface UIHandlers {
  play(): void;
  garage(): void;
  missions(): void;
  home(): void;
  pause(): void;
  resume(): void;
  retry(): void;
  selectSkin(id: string): void;
  buySkin(id: string): void;
  upgrade(k: UpgradeKey): void;
  toggleSound(): void;
  toggleMusic(): void;
  toggleQuality(): void;
  previewSkin(id: string): void;
  /** start a run on a track ('endless' or a course id) */
  startTrack(id: string): void;
  /** v2: tapped a track → choose the one special for this race */
  pickTrack(id: string): void;
  chooseSpecial(k: string): void;
  buySpecial(k: string): void;
  goRace(): void;
  /** open the Magic Bag to pick the special for the next race */
  bagPick(): void;
  /** v2 Bonus event: start today's road */
  bonusGo(): void;
  nextTrack(): void;
  setSpeed(level: 'easy' | 'normal' | 'hard'): void;
  /** open the training intro */
  help(): void;
  startTutorial(): void;
  advTrain(world: string): void;
  toggleAssist(): void;
  toggleComfort(): void;
  toggleVibrate(): void;
  skipTutorial(): void;
  // ---- ads
  continueAd(): void;
  continueCoins(): void;
  continueNo(): void;
  adDouble(): void;
  adFreeCoins(): void;
  adBoost(): void;
  // ---- live-ops / meta
  settings(): void;
  closeModal(): void;
  daily(): void;
  events(): void;
  ranks(): void;
  shop(): void;
  guide(): void;
  checkIn(): void;
  claimQuest(id: string): void;
  claimChest(i: number): void;
  claimPass(): void;
  raceCup(): void;
  cupBoard(): void;
  buy(sku: string): void;
  restore(): void;
  setName(name: string): void;
  equip(item: ItemKey): void;
  rankTab(tab: 'week' | 'all'): void;
  claimResults(): void;
  share(): void;
  sos(): void;
  setAvatar(i: number): void;
  setCountry(code: string): void;
  randomAvatar(): void;
  profile(): void;
  viewPlayer(i: number): void;
  boostInfo(k: string): void;
  bag(): void;
  boostTrain(k: string): void;
  trainAgain(): void;
  cloud(a: string, v?: string): void;
  toggleAutoClaim(): void;
  claimMission(i: number): void;
  rocket(): void;
  rocketFix(how: string): void;
  popAction(a: string): void;
  freePop(): void;
  perk(k: string): void;
  buyBoost(k: string): void;
  setLang(code: string): void;
  dailyPop(): void;
}

/** Magic Bag: drawstring pouch with a star */
const BAG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="bgp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98bff"/><stop offset="1" stop-color="#6a2ee0"/></linearGradient></defs><path d="M8.3 7.4C5 9.6 3.6 13 4.3 16.4c.7 3.2 3.6 4.8 7.7 4.8s7-1.6 7.7-4.8c.7-3.4-.7-6.8-4-9z" fill="url(#bgp)" stroke="#2a1060" stroke-width="1.1" stroke-linejoin="round"/><path d="M8.6 7.4c-.9-1.6-.3-3.4 1.3-3.4 1 0 1.3.7 2.1.7s1.1-.7 2.1-.7c1.6 0 2.2 1.8 1.3 3.4z" fill="#8a52f0" stroke="#2a1060" stroke-width="1.1" stroke-linejoin="round"/><rect x="7.6" y="6.8" width="8.8" height="1.9" rx=".9" fill="#ffd23d" stroke="#7a4a00" stroke-width=".6"/><path d="M12 11.2l1.05 2.15 2.35.33-1.7 1.66.4 2.34L12 16.6l-2.1 1.08.4-2.34-1.7-1.66 2.35-.33z" fill="#ffe680"/><circle cx="17.6" cy="11" r=".8" fill="#fff"/><circle cx="6.6" cy="13.4" r=".55" fill="#fff" opacity=".8"/></svg>`;

/** tutorial (book + ?) and launch (megaphone) icons */
const TUT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M10.2 8.3a2 2 0 1 1 2.6 1.9c-.5.2-.8.6-.8 1.1v.6"/><path d="M12 14.4h.01"/></g></svg>`;
import { MEGA_ICON } from './shared.ts';
export { MEGA_ICON };

/** what a finished / crashed run paid out (result screens) */
export interface RunRewards {
  /** EXP of this run */
  exp: number;
  /** best EXP before / after this run */
  from: number;
  to: number;
  clsBefore: RankClass;
  clsAfter: RankClass;
  weekRank: number;
  cup: { div: RankClass; name: string; rank: number } | null;
  quests: string[];
  missions: { text: string; reward: number }[];
  items: { super: number; near: number };
}

/** what each boost does (info card) */
const BOOST_INFO: Record<ItemKey, { what: string; how: string; when: string }> = {
  super: { what: 'A high-thrust Jump Booster hop that clears two rows of obstacles at once and rolls 360° at the apex.', how: 'Equip it, then tap the purple BOOSTER button on the road (or R / Shift).', when: 'Trucks blocking every lane, or a barrier right behind a barrier.' },
  hyper: { what: 'The mythic Hyper Flight: 7.4 m high, a double aerial roll and a golden slipstream trail — clears everything for a long stretch.', how: 'Equip it, then tap the gold HYPER button on the road. Fires before a Jump Booster if you hold both.', when: 'A full road block with no way through, or to grab a sky coin trail.' },
  escape: { what: 'Emergency Rescue thruster straight up: cruise safely above the sky highway, then land cleanly.', how: 'Tap the red RESCUE button (or press E / Enter) at any moment.', when: 'You are about to crash and there is no time to swipe.' },
  shield: { what: 'Start the run inside an Aegis Shield energy dome that absorbs one hit.', how: 'Equip it before a run — it stays active from the start until it absorbs an impact.', when: 'Hard tracks and cups: one free mistake.' },
  turbo: { what: 'Start the run with an Aero Nitro afterburner burst: blast forward and shatter obstacles for a few seconds.', how: 'Equip it before a run — it fires at the start line.', when: 'Score runs: a fast, safe opening.' },
  magnet: { what: 'Start with the Flux Magnet active: coins and crystals from every lane fly to your bike.', how: 'Equip it before a run — active from the start.', when: 'Coin missions and 3-star coin targets.' },
  double: { what: 'Double Coin & EXP overdrive: every metre counts twice while active.', how: 'Grab the ×2 on the road — it activates immediately.', when: 'Chasing your best score and EXP.' },
  life: { what: 'Start the run with one extra Armor Core heart (up to 4 hearts).', how: 'Equip it before a run.', when: 'Long tracks, Endless records and cups.' },
};

/** sample rival profile (deterministic from the name) */
function rivalProfile(name: string, score: number) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  const rnd = (k: number) => ((Math.imul(h ^ (k * 2654435761), 1597334677) >>> 0) % 10000) / 10000;
  const online = rnd(1) < 0.3;
  return {
    runs: Math.round(40 + rnd(2) * 900 + score / 40),
    car: SKINS[Math.floor(rnd(3) * SKINS.length)].name,
    /** average EXP of their races (best run × 45–70 %) */
    avg: Math.round(score * (0.45 + rnd(11) * 0.25)),
    gold: Math.floor(rnd(4) * (score / 9000)),
    silver: Math.floor(rnd(5) * (score / 6000)),
    bronze: Math.floor(rnd(6) * (score / 4000)),
    seen: online ? 'Online now' : rnd(7) < 0.5 ? `Last seen ${1 + Math.floor(rnd(8) * 50)}m ago` : `Last seen ${1 + Math.floor(rnd(9) * 20)}h ago`,
    online,
    streak: 1 + Math.floor(rnd(10) * 30),
  };
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** side-view sportbike silhouette for the garage cards */
function carSvg(_shape: string, body: number, glow: number) {
  const b = hex(body);
  const gl = hex(glow);
  const bikePath = `<path d="M18 35 L36 22 L58 20 L74 12 L96 18 L104 28 L86 35 L68 35 L54 27 L38 35 Z" fill="${b}"/><path d="M52 17 L68 10 L82 12 L72 21 Z" fill="#0b1020"/><path d="M22 25 L42 21 L48 26 L26 29 Z" fill="${gl}" opacity=".85"/>`;
  return `<svg class="csvg" viewBox="0 0 120 48">${bikePath}<rect x="14" y="42" width="92" height="2" rx="1" fill="${gl}" opacity=".9"/><circle cx="26" cy="35" r="8" fill="#151a26" stroke="${gl}" stroke-width="2.2"/><circle cx="92" cy="35" r="8" fill="#151a26" stroke="${gl}" stroke-width="2.2"/></svg>`;
}
/** avatar with the rank-class plate (D … AAA) in the corner */
const avaHtml = (av: number, rc: RankClass, cls = '', extra = '') => `<span class="ava img rk-${rc} ${cls}">${avatarSvg(av)}${classCorner(rc)}${extra}</span>`;
/** EXP logo (rank shield) */
/** Home icons: white rocket (Launch) and an outline sportbike (Garage) */
const ROCKET_W = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 3.2c2.9-.6 5.4-.4 6 .2.6.6.8 3.1.2 6-.6 3-2.6 5.8-5.3 7.7l.3 2.6-2.6 2-1.1-3.2-3.6-3.6-3.2-1.1 2-2.6 2.6.3C11 8.8 11.8 3.8 14.8 3.2z" fill="#fff"/><circle cx="16" cy="8" r="1.8" fill="#2c4a9a"/><path d="M6.5 14.8c-1.6.4-2.8 2.4-3 5.7 3.3-.2 5.3-1.4 5.7-3z" fill="#7fe6ff"/></svg>`;
const CAR_LINE = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><circle cx="5.5" cy="16.5" r="3.2"/><circle cx="18.5" cy="16.5" r="3.2"/><path d="M5.5 16.5 9.5 10h5l3 3.5-4.5 3H9.5l-2-4"/><path d="M13.5 7.5h3l2 2.5"/></g></svg>`;
const BOLT = XPT;
const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ITEM_ICON: Record<ItemKey, string> = { super: ICON.rocket, hyper: ICON.hyper, shield: ICON.shield, escape: ICON.sos, turbo: ICON.bolt, magnet: ICON.magnet, double: ICON.x2, life: ICON.heart };
const ITEM_NAME: Record<ItemKey, string> = { super: 'Jump Booster', hyper: 'HYPER FLIGHT', shield: 'Aegis Shield', escape: 'Emergency Rescue', turbo: 'Aero Nitro', magnet: 'Flux Magnet', double: 'Double Coin', life: 'Armor Core' };
/** what each v2 special does, in one line */
const SPECIAL_LINE: Record<SpecialKey, string> = { escape: 'Emergency lift before a crash', super: 'Boost jump over a whole block', hyper: 'Hyper flight over a long stretch' };
const SPECIAL_SHORT: Record<SpecialKey, string> = { escape: 'RESCUE', super: 'BOOSTER', hyper: 'HYPER' };
/** item card: one line, v2 rules */
const SPECIAL_HOW: Record<SpecialKey, string> = {
  escape: 'Tap RESCUE just before a crash: launch upward and glide down safely.',
  super: 'Tap BOOSTER: leap over a whole block of obstacles.',
  hyper: 'Tap HYPER: soar high over a long stretch.',
};
/** icons of the teaser specials (unlock at AAA, try them in Bonus) */
/** Bonus places: card colour + emoji */
const BONUS_COLOR: Record<string, string> = { desert: '#ff9a3c', forest: '#3dbf6a', country: '#e8c040', sea: '#2fb6ff' };
const BONUS_EMOJI: Record<string, string> = { desert: '🌵', forest: '🌲', country: '🌾', sea: '🌊' };
const LOCKED_ICON: Record<string, string> = {
  tunnel: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V12a9 9 0 0 1 18 0v8" fill="none" stroke="#7fe6ff" stroke-width="2"/><path d="M7 20v-7a5 5 0 0 1 10 0v7" fill="none" stroke="#7fe6ff" stroke-width="1.4" opacity=".6"/><rect x="8.5" y="1.6" width="7" height="3.4" rx="1.2" fill="#fff"/></svg>`,
  wall: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18M6 3v18" stroke="#9b6bff" stroke-width="2"/><path d="M9 16l6-4-6-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 16l6-4-6-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/></svg>`,
  ghost: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V11a7 7 0 0 1 14 0v10l-2.4-1.8L14.3 21 12 19.2 9.7 21l-2.3-1.8z" fill="#cfe0ff" fill-opacity=".85"/><circle cx="9.5" cy="11" r="1.3" fill="#1b1450"/><circle cx="14.5" cy="11" r="1.3" fill="#1b1450"/></svg>`,
  rail: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h20" stroke="#ffc21a" stroke-width="2.2" stroke-linecap="round"/><path d="M12 6v5" stroke="#fff" stroke-width="1.6"/><rect x="7" y="11" width="10" height="5" rx="2" fill="#fff"/><path d="M3 20l4-3M21 20l-4-3" stroke="#ffc21a" stroke-width="1.4" opacity=".6"/></svg>`,
};

/** 7-day check-in as a list (mock-up): Day label · reward art · amount · ✓ / 🔒; today glows */
function checkinList(slot: number, claimedToday: boolean) {
  const rows = CHECKIN.map((r, i) => {
    const got = i < slot || (claimedToday && i === slot);
    const today = i === slot && !claimedToday;
    const items = Object.entries(r.items ?? {}).filter(([, n]) => n) as [ItemKey, number][];
    // item days get a wide art strip (like the car tiles in the mock-up); coin days an icon + amount
    const body = items.length
      ? `<span class="ckart ${items[0][0]}">${items.map(([k, n]) => `<span class="ckit">${ITEM_ICON[k]}<span class="ckn">${ITEM_NAME[k]}${n > 1 ? ` ×${n}` : ''}</span></span>`).join('')}${r.coins ? `<span class="ckc">${coinFace(18)}<b>x${fmt(r.coins)}</b></span>` : ''}</span>`
      : `<span class="ckcoin">${coinFace(26)}<b>x${fmt(r.coins ?? 0)}</b></span>`;
    return `<div class="ckrow ${got ? 'got' : ''} ${today ? 'today' : ''} ${!got && !today ? 'lock' : ''}"><span class="ckday">Day ${i + 1}</span><span class="ckbody">${body}</span><i class="ckst">${got ? ICON.check : today ? '' : ICON.lock}</i></div>`;
  }).join('');
  return `<div class="cklist">${rows}</div>`;
}

/** Daily page: the 7 check-in days as a compact 4 + 3 grid (so the missions fit on screen) */
function checkinGrid(slot: number, claimedToday: boolean) {
  return `<div class="ckgrid">${CHECKIN.map((r, i) => {
    const got = i < slot || (claimedToday && i === slot);
    const today = i === slot && !claimedToday;
    const item = Object.entries(r.items ?? {}).find(([, n]) => n) as [ItemKey, number] | undefined;
    return `<div class="ckt ${got ? 'got' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}"><small>Day ${i + 1}</small>${item ? `<span class="cki">${ITEM_ICON[item[0]]}</span>` : coinFace(22)}<b>${fmt(r.coins ?? 0)}</b>${got ? `<i class="ok">${ICON.check}</i>` : ''}</div>`;
  }).join('')}</div>`;
}

function rewardChips(r: Reward) {
  const out: string[] = [];
  if (r.coins) out.push(`<span class="rchip">${ICON.coin}${fmt(r.coins)}</span>`);
  for (const [k, n] of Object.entries(r.items ?? {})) if (n) out.push(`<span class="rchip ${k}">${ITEM_ICON[k as ItemKey]}×${n}</span>`);
  return out.join('');
}

/**
 * DOM overlay UI. Pure presentation: it renders state handed to it and calls
 * back into the game through UIHandlers. HUD updates are throttled & diffed.
 */
export class UI {
  root: HTMLElement;
  private screens: Record<string, HTMLElement> = {};
  private hudCache: Record<string, string> = {};
  private pops: HTMLElement;
  private garageIndex = 0;
  private fastTapT = -1e9;

  constructor(parent: HTMLElement, private h: UIHandlers) {
    this.root = document.createElement('div');
    this.root.id = 'ui';
    parent.appendChild(this.root);
    this.root.innerHTML = this.template();
    for (const el of Array.from(this.root.querySelectorAll<HTMLElement>('.screen'))) this.screens[el.id] = el;
    this.pops = $(this.root, '#pops');
    // one notice lane under the HUD: section banners + toasts stack instead of covering each other
    this.notices = document.createElement('div');
    this.notices.id = 'notices';
    this.pops.appendChild(this.notices);
    const ban = $(this.root, '#banner');
    this.notices.appendChild(ban);
    this.bind();
    // translations: re-apply to anything newly rendered (HUD numbers are skipped)
    const tmo = new MutationObserver((recs) => {
      if (getLang() === 'en') return;
      for (const rec of recs) {
        const t = rec.target as HTMLElement;
        if (t.closest?.('#hud .row, #hud .row2, #pops')) continue;
        for (const n of Array.from(rec.addedNodes)) translateTree(n);
      }
      this.scheduleFit();
    });
    tmo.observe(this.root, { subtree: true, childList: true });
    // every overlay panel must fit the phone screen without scrolling: shrink-to-fit when needed
    const mo = new MutationObserver(() => this.scheduleFit());
    for (const ov of Array.from(this.root.querySelectorAll<HTMLElement>('.screen.overlay'))) mo.observe(ov, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', () => this.scheduleFit());
    // display font (falls back to the system stack offline)
    if (!document.querySelector('link[data-xw-font]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.dataset.xwFont = '1';
      l.href = 'https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,600;0,700;0,800;1,700;1,800;1,900&display=swap';
      document.head.appendChild(l);
    }
  }

  private head(title: string, extra = '') {
    return `<div class="head">
        <button class="icon-btn" data-a="home" aria-label="Back">${ICON.chevL}</button>
        <h2>${title}</h2>
        ${extra || `<button class="wallet" data-a="shop" aria-label="Coins · open shop">${ICON.coin}<b data-k="wallet">0</b><i class="plus" data-a="freepop" role="button" aria-label="Free coins · watch an ad">${ICON.plus}</i></button>`}
      </div>`;
  }

  private template() {
    const logo = `<div class="logo"><img class="xw" src="${logoUrl}" alt="Sky Roadster" draggable="false" /></div>`;
    const loadingBg = `<img class="loadbg" src="${loadingUrl}" alt="" draggable="false" />`;
    return `
    <section id="loading" class="screen show">
      ${loadingBg}
      <div class="load-foot"><div class="bar"><i></i></div><div class="label" data-k="loadtxt">Loading…</div></div>
    </section>

    <section id="tracks" class="screen">
      ${this.head('SELECT TRACK', `<button class="btn sm blue" data-a="help">${ICON.hand}<span>Training</span></button>`)}
      <div class="track-list" data-k="tracklist"></div>
      <div class="boost-row" data-k="boosts" hidden></div>
      <button class="btn gold adbtn" data-a="adboost" data-k="adboost" hidden>${ICON.play}</button>
    </section>

    <section id="finish" class="screen overlay">
      <div class="panel result">
        <div class="res-top"><button class="icon-btn sm" data-a="home" aria-label="Close">${ICON.close}</button><img class="res-logo" src="${logoUrl}" alt="" /><button class="icon-btn sm" data-a="share" aria-label="Share">${ICON.share}</button></div>
        <div class="finish-title">FINISH! <small class="label" data-k="ftrack">Future City</small></div>
        <div class="scoreline"><div class="stars big" data-k="fstars"></div><div class="final" data-k="ffinal">0</div><div class="newbest" data-k="fnewbest">${ICON.trophy} NEW BEST!</div></div>
        <div class="leftover bonus" data-k="fbonus" hidden>${BAG_ICON}<span>Track bonus</span><small data-k="fbonustxt"></small><b>BAG</b></div>
        <div class="leftover" data-k="fleft" hidden>${ICON.rocket}<span>Unused boosts</span><small data-k="flefttxt"></small><b data-k="fleftpts">+0</b></div>
        <div class="stats mini">
          <div class="stat"><span class="label">Time</span><span class="v">${ICON.flag}<span data-k="ftime">0</span></span></div>
          <div class="stat"><span class="label">Coins</span><span class="v">${ICON.coin}<span data-k="fcoins">0</span></span></div>
          <div class="stat"><span class="label">Lives lost</span><span class="v">${ICON.heart}<span data-k="flost">0</span></span></div>
          <div class="stat"><span class="label">Reward</span><span class="v">${ICON.coin}<span data-k="freward">0</span></span></div>
        </div>
        <div class="star-rules" data-k="frules"></div>
        <div class="rwd" data-k="frwd"></div>
        <button class="btn gold adbtn" data-a="ad2x" data-k="ad2xf">${ICON.play} Watch ad · +20% coins</button>
        <button class="btn big" data-a="nexttrack" data-k="fnext">${ICON.play} Next track</button>
        <div class="navrow">
          <button class="btn nav blue" data-a="retry">${ICON.retry}<span>Retry</span></button>
          <button class="btn nav purple" data-a="tracks">${ICON.flag}<span>Tracks</span></button>
          <button class="btn nav dark" data-a="home">${ICON.home}<span>Home</span></button>
        </div>
      </div>
    </section>

    <section id="start" class="screen">
      <div class="top-row">
        <button class="profile" data-a="profile" aria-label="Your profile">
          <span data-k="ava"></span>
          <span class="pmeta"><b><span data-k="pname">Pilot</span> <i class="pedit">✎</i></b><small data-k="pline"></small></span>
        </button>
        <div class="tr">
          <button class="wallet" data-a="shop" aria-label="Coins · open shop">${ICON.coin}<b data-k="wallet">0</b><i class="plus" data-a="freepop" role="button" aria-label="Free coins · watch an ad">${ICON.plus}</i></button>
          <button class="icon-btn sm2" data-a="help" aria-label="Tutorial">${TUT_ICON}</button>
          <button class="icon-btn" data-a="settings" aria-label="Settings">${ICON.gear}</button>
        </div>
      </div>
      <div class="brand">${logo}</div>
      <div class="mid">
      <div class="rail left">
        <button class="rbtn" data-a="daily"><span class="ri g-daily">${ICON.calendar}</span><span class="rl">Daily</span><em class="badge" data-k="dailybadge" hidden>1</em></button>
        <button class="rbtn" data-a="events"><span class="ri g-cups">${ICON.gift}</span><span class="rl">Bonus</span><em class="tag live">OPEN</em></button>
        <button class="rbtn" data-a="ranks"><span class="ri g-ranks">${ICON.podium}</span><span class="rl">Ranks</span></button>
      </div>
      <div class="rail right">
        <button class="rbtn" data-a="perk" data-v="share" data-k="pk-share"><span class="ri g-share">${ICON.share}</span><span class="rl">Share</span><em class="badge" hidden>!</em></button>
        <button class="rbtn" data-a="perk" data-v="entry" data-k="pk-entry"><span class="ri g-entry">${ICON.gift}</span><span class="rl">Entry</span><em class="badge" hidden>!</em></button>
        <button class="rbtn" data-a="perk" data-v="launch" data-k="pk-launch"><span class="ri g-launch">${ROCKET_W}</span><span class="rl">Launch</span><em class="badge" hidden>!</em></button>
      </div>
      </div>
      <div class="menu">
        <button class="cupstrip" data-a="events" data-k="cupstrip" hidden></button>
        <div class="speedsel" role="radiogroup" aria-label="Speed">
          ${(['easy', 'normal', 'hard'] as const).map((k, i) => `<button role="radio" data-a="speed" data-v="${k}" title="${LEVELS[k].label}: ${LEVELS[k].desc}"><i class="chev">${'★'.repeat(i + 1)}</i><b>${LEVELS[k].label}</b><small>EXP ×${['1.0', '1.05', '1.7'][i]}</small></button>`).join('')}
        </div>
        <div class="speedcap" data-k="speedtip" hidden></div>

        <div class="menu-btns">
          <button class="btn mbtn" data-a="play"><span class="ib">${ICON.play}</span><span class="lb">Play</span><span class="pchev"><i></i><i></i></span></button>
          <div class="minirow">
            <button class="mini garage" data-a="garage">${CAR_LINE}<span>Garage</span></button>
            <button class="mini shop" data-a="shop">${ICON.bag}<span>Shop</span><em class="msale" data-k="saletag">−80%</em></button>
            <button class="mini missions" data-a="missions">${ICON.target}<span>Missions</span></button>
          </div>
        </div>
      </div>
    </section>

    <section id="settings" class="screen overlay">
      <div class="panel modal">
        <div class="mhead"><h2>SETTINGS</h2><button class="icon-btn sm" data-a="closemodal" aria-label="Close">${ICON.close}</button></div>
        <div class="sgrid">
          <div class="stile"><span class="si">${ICON.sound}</span><span class="sl">Sound</span><button class="switch" data-a="sound" role="switch" aria-label="Sound effects"><i></i></button></div>
          <div class="stile"><span class="si">${ICON.music}</span><span class="sl">Music</span><button class="switch" data-a="music" role="switch" aria-label="Music"><i></i></button></div>
          <div class="stile"><span class="si">≋</span><span class="sl">Vibration</span><button class="switch" data-a="vibrate" role="switch" aria-label="Vibration"><i></i></button></div>
          <div class="stile"><span class="si">${ICON.info}</span><span class="sl">Hint arrows</span><button class="switch" data-a="assist" role="switch" aria-label="Danger arrows"><i></i></button></div>
          <div class="stile"><span class="si">◐</span><span class="sl">Eye comfort</span><button class="switch" data-a="comfort" role="switch" aria-label="Comfort visuals"><i></i></button></div>
          <div class="stile"><span class="si">${ICON.gear}</span><span class="sl">Graphics</span><div class="seg" data-k="qseg"><button data-a="quality" data-v="high">HI</button><button data-a="quality" data-v="low">LO</button></div></div>
        </div>
        <button class="srow lang acct" data-a="account"><span class="si">☁️</span><span class="sl">Account</span><b data-k="acctline">Guest</b>${ICON.chevR}</button>
        <button class="srow lang" data-a="lang"><span class="si">🌐</span><span class="sl">Language</span><b data-k="langname">English</b>${ICON.chevR}</button>
        <div class="sbtns compact">
          <button class="btn sm ghost" data-a="profile">${ICON.user} Profile</button>
          <button class="btn sm ghost" data-a="help">${ICON.info} How to play</button>
          <button class="btn sm ghost" data-a="restore">${ICON.bag} Restore</button>
        </div>
        <div class="label sfoot" data-k="sfoot">Sky Roadster</div>
      </div>
    </section>

    <section id="guide" class="screen overlay">
      <div class="panel modal guide">
        <div class="mhead"><h2>ROADSTER JUMP</h2><button class="icon-btn sm" data-a="closemodal" aria-label="Close">${ICON.close}</button></div>
        <p class="tut-lead">The rocket jump that clears <b>two rows</b> of obstacles and rolls 360° in the sky.</p>
        <div class="gsteps">
          <button class="gstep" data-a="gstep"><img src="${guide1}" alt="" /><b><i>1</i> Spot the purple rocket</b><small>Appears after 250 m, floating in a lane. Swipe into its lane to grab it.</small>
            <div class="gmore"><b>Details</b>The rocket pickup floats at driving height in one lane and turns up every few hundred metres after the first 250 m. Drive or hop into that lane to collect it — a purple flash ring confirms the pickup. You can carry up to 2. You can also start with one: equip <em>Roadster Jump</em> on the track screen (daily check-in day 5, cups and the shop give them).</div><em class="gtap">${ICON.info} tap for details</em></button>
          <button class="gstep" data-a="gstep"><img src="${guide2}" alt="" /><b><i>2</i> The ROADSTER button appears</b><small>A purple ROADSTER button shows bottom-right with how many you hold.</small>
            <div class="gmore"><b>Details</b>While you hold a charge, a round purple <em>ROADSTER</em> button sits above the red SOS button (it turns gold for a HYPER JUMP). A normal swipe UP is always just a small hop — only the button fires the rocket, so you never waste it by accident. Keyboard: <em>R</em> or <em>Shift</em>.</div><em class="gtap">${ICON.info} tap for details</em></button>
          <button class="gstep" data-a="gstep"><img src="${guide3}" alt="" /><b><i>3</i> Tap ROADSTER to launch</b><small>Flies 5.6 m over cars blocking every lane, barrel roll at the top.</small>
            <div class="gmore"><b>Details</b>When a car blockade (a semi truck + cars across all 3 lanes) appears, a toast warns you ~120 m ahead. Tap the button on the road: the car rockets 5.6 m up, clears both rows of cars, rolls 360° and lands safely — you are protected for the whole flight. Pressed in the air? It fires the moment your wheels touch the road. No rocket? Collect one, buy one, or use SOS.</div><em class="gtap">${ICON.info} tap for details</em></button>
        </div>
        <div class="gmyth">${ICON.hyper}<div><b>Mythic HYPER JUMP</b><small>Win it in Cups, Day-7 check-in or the Shop: 7.4 m high, double roll, golden trail. Fires from the same button (gold).</small></div></div>
        <button class="btn big" data-a="boosttrain" data-v="super">${ICON.play} Practice it</button>
      </div>
    </section>

    <section id="ranks" class="screen page">
      ${this.head('TOP PILOTS')}
      <div class="tabs" data-k="ranktabs"><button data-a="ranktab" data-v="week">This week</button><button data-a="ranktab" data-v="all">All time</button></div>
      <div class="podium" data-k="podium"></div>
      <div class="lbhead"><span>RANK</span><span>PILOT</span><span>EXP</span></div>
      <div class="lb-list" data-k="lblist"></div>
      <div class="lb-you" data-k="lbyou"></div>
    </section>

    <section id="daily" class="screen page">
      ${this.head('DAILY')}
      <div class="scroll dailyv2">
        <div class="panel block">
          <div class="bhead"><b>Check-in</b><span class="label" data-k="cistreak">Day 1</span></div>
          <div class="cigrid" data-k="cigrid"></div>
          <button class="btn" data-a="checkin" data-k="cibtn">Claim today</button>
        </div>
        <div class="panel block pass" data-k="passrow"></div>
        <div class="panel block">
          <div class="bhead"><b>Daily missions</b><span class="label">${ICON.clock}<span data-k="dreset">resets in 0h</span></span></div>
          <div class="qlist" data-k="qlist"></div>
        </div>
      </div>
    </section>

    <section id="events" class="screen page">
      ${this.head('CUPS')}
      <div class="scroll">
        <div class="cuphero" data-k="cuphero"></div>
        <div class="panel block cupboard" data-k="cupboard" hidden></div>
        <div class="panel block">
          <div class="bhead"><b>Prizes</b><span class="label">Final rank when the cup ends</span></div>
          <div class="prizes" data-k="prizes"></div>
        </div>
        <div class="bhead out"><b>Divisions</b><button class="linkbtn" data-a="rankguide">${ICON.info} How EXP works</button></div>
        <div class="divgrid" data-k="divisions"></div>
        <div class="bhead out"><b>Upcoming</b><span class="label">daily 12:00 &amp; 22:00 US Eastern · 3 h each</span></div>
        <div class="upcoming" data-k="upcoming"></div>
        <div class="trophies" data-k="trophies"></div>
      </div>
    </section>

    <section id="shop" class="screen page">
      ${this.head('SHOP')}
      <div class="scroll" data-k="shoplist"></div>
    </section>

    <section id="eventres" class="screen overlay">
      <div class="panel modal center">
        <div class="cupbig">${ICON.cup}</div>
        <h2>CUP RESULTS</h2>
        <div data-k="eventres"></div>
        <button class="btn big gold" data-a="claimresults">${ICON.gift} Collect</button>
      </div>
    </section>

    <section id="profile" class="screen overlay">
      <div class="panel modal prof">
        <div class="mhead"><h2 data-k="proftitle">PILOT PROFILE</h2><button class="icon-btn sm" data-a="closeov" data-v="profile" aria-label="Close">${ICON.close}</button></div>
        <div data-k="profbody"></div>
      </div>
    </section>

    <section id="bag" class="screen overlay">
      <div class="panel modal bagm">
        <div class="mhead"><h2>${BAG_ICON} MAGIC BAG</h2><button class="icon-btn sm" data-a="closeov" data-v="bag" aria-label="Close">${ICON.close}</button></div>
        <div data-k="bagbody"></div>
      </div>
    </section>

    <section id="bagbuy" class="screen overlay">
      <div class="panel modal bagm">
        <div class="mhead"><h2>${ICON.coin} BUY ITEMS</h2><button class="icon-btn sm" data-a="closeov" data-v="bagbuy" aria-label="Close">${ICON.close}</button></div>
        <div data-k="buybody"></div>
      </div>
    </section>

    <section id="account" class="screen overlay">
      <div class="panel modal acm">
        <div class="mhead"><h2>☁️ ACCOUNT</h2><button class="icon-btn sm" data-a="closeov" data-v="account" aria-label="Close">${ICON.close}</button></div>
        <div data-k="acbody"></div>
      </div>
    </section>

    <section id="cloudpick" class="screen overlay">
      <div class="panel modal acm" data-k="cpbody"></div>
    </section>

    <section id="sharepv" class="screen overlay">
      <div class="panel modal shpv">
        <div class="mhead"><h2>${ICON.share} SHARE</h2><button class="icon-btn sm" data-a="closeov" data-v="sharepv" aria-label="Close">${ICON.close}</button></div>
        <img class="shpv-img" data-k="shpvimg" alt="Your Sky Roadster card" />
        <p class="shpv-tip">Long-press the card to save or share it</p>
        <div class="td-row">
          <a class="btn gold" data-k="shpvdl" download="sky-roadster.png">${ICON.check} Save image</a>
          <button class="btn ghost" data-a="shpvcopy">🔗 Copy text</button>
        </div>
      </div>
    </section>

    <section id="spconfirm" class="screen overlay">
      <div class="panel modal spconf" data-k="spcbody"></div>
    </section>

    <section id="boostinfo" class="screen overlay">
      <div class="panel modal binfo" data-k="binfo"></div>
    </section>

    <section id="popup" class="screen overlay">
      <div class="panel modal pop3" data-k="popbody"></div>
    </section>

    <section id="specialpick" class="screen overlay">
      <div class="panel modal spick">
        <div class="mhead"><h2>${BAG_ICON} SPECIAL</h2><button class="icon-btn sm" data-a="closeov" data-v="specialpick" aria-label="Close">${ICON.close}</button></div>
        <div data-k="spbody"></div>
      </div>
    </section>

    <section id="bonus" class="screen overlay">
      <div class="panel modal bonusm">
        <div class="mhead"><h2>${ICON.gift} BONUS</h2><button class="icon-btn sm" data-a="closeov" data-v="bonus" aria-label="Close">${ICON.close}</button></div>
        <div data-k="bnbody"></div>
      </div>
    </section>

    <section id="rankguide" class="screen overlay">
      <div class="panel modal rguide">
        <div class="mhead"><h2>${XPT} &amp; RANK</h2><button class="icon-btn sm" data-a="closeov" data-v="rankguide" aria-label="Close">${ICON.close}</button></div>
        <div data-k="rgbody"></div>
      </div>
    </section>

    <section id="needrocket" class="screen overlay">
      <div class="panel modal center needr">
        <div class="nr-ic">${ICON.rocket}</div>
        <h2>ROADSTER JUMP NEEDED</h2>
        <p class="tut-lead">Cars block every lane — only a <b>Roadster Jump</b> gets you past. Collect the purple rocket on the road, or get one now.</p>
        <div data-k="nrbtns" class="nrbtns"></div>
      </div>
    </section>

    <section id="hud" class="screen passthrough">
      <div class="row">
        <button class="icon-btn hit" data-a="pause" aria-label="Pause">${ICON.pause}</button>
        <button class="trskip" data-a="tutskip" data-k="trskip" hidden>Skip ›</button>
        <div class="scorebox panel exp"><div class="label" data-h="scorelabel">${XPT}</div><div class="val"><span data-h="score">0</span><span class="rankp" data-h="rankp"></span></div><div class="hbest" data-h="hbest" hidden><span class="hme" data-h="hme"></span><small>BEST</small><b data-h="hbestv">0</b><i><em data-h="hbestbar"></em></i></div><div class="hnext" data-h="hnext" hidden></div></div>
        <div class="side">
          <span class="pill coins">${ICON.coin}<b data-h="coins">0</b></span>
          <span class="pill">${ICON.flag}<b data-h="dist">0 m</b></span>
        </div>
      </div>
      <div class="row2">
        <div class="speed"><div class="label">Speed <span data-h="kmh">0</span> km/h</div><div class="track"><i data-h="speedbar"></i></div></div>
        <div class="hearts" data-h="hearts"></div>
      </div>
      <div class="gatebar" data-h="gatebar" hidden><b>RANK GATE</b><span data-h="gatenext"></span><div class="track"><i data-h="gatefill"></i></div></div>
      <div class="trackbar panel" data-h="trackbar" hidden>
        <div class="t"><span data-h="tsection">START AREA</span><span data-h="tdist">0 / 3,200 m</span></div>
        <div class="track"><i data-h="tbar"></i><b data-h="tmarks"></b></div>
      </div>
      <div class="hudline">
        <div class="powers" data-h="powers"></div>
        <div class="danger" data-k="danger" hidden><div class="dg-arrow" data-k="dgarrow"></div><div class="dg-txt" data-k="dgtxt">SWIPE</div></div>
      </div>
      <button class="rocketbtn hit" data-a="rocket" data-k="rocketbtn" hidden aria-label="Roadster Jump">${ICON.rocket}<span data-k="rocketlbl" data-h="rocketlbl">ROADSTER</span><em data-k="rocketcnt" data-h="rocketcnt">1</em></button>
      <button class="sos hit" data-a="sos" data-k="sosbtn" hidden aria-label="Sky Escape">${ICON.sos}<span>SOS</span><em data-k="soscnt" data-h="soscnt">1</em></button>
      <div class="mission panel"><div class="t"><span data-h="mtext">—</span><span data-h="mprog"></span></div><div class="track"><i data-h="mbar"></i></div></div>
    </section>

    <div id="pops"></div>
    <div id="banner"><div class="w" data-k="bw">WORLD 1</div><div class="n" data-k="bn">FUTURE CITY</div></div>
    <div id="tutorial"><div class="hand">${ICON.hand}</div><div class="txt">SWIPE TO DODGE<small>← → change lane · ↑ fly up · ↓ fly down</small></div></div>
    <div id="flash"></div>

    <section id="tutintro" class="screen overlay">
      <div class="panel tut-panel">
        <div class="mhead"><h2>${TUT_ICON} TUTORIAL</h2><button class="icon-btn sm" data-a="closemodal" aria-label="Close">${ICON.close}</button></div>
        <p class="tut-lead">Learn the moves and practise each special. You can't crash in training.</p>
        <div class="tuthub">
          <div class="th-sec"><div class="th-h"><i>1</i><b>Basics · first flight</b></div>
            <div class="tut-grid">
              <div class="tut-tile"><span class="g g-lr"><i>←</i><i>→</i></span><b>Swipe left / right</b><small>Exactly one lane per swipe</small></div>
              <div class="tut-tile"><span class="g g-up"><i>↑</i></span><b>Swipe up</b><small>One hop over low obstacles</small></div>
              <div class="tut-tile"><span class="g g-down"><i>↓</i></span><b>Swipe down</b><small>Slide under beams</small></div>
              <div class="tut-tile"><span class="g g-coin">${ICON.rocket}</span><b>Your special</b><small>Tap its button to jump a block</small></div>
            </div>
            <div class="label tut-keys">Keyboard: arrow keys or W A S D</div>
            <button class="btn" data-a="tutstart">${ICON.play} Start training</button></div>
          <div class="th-sec"><div class="th-h"><i>2</i><b>Special items</b></div>
            <div class="th-items">${(['super', 'hyper', 'escape'] as ItemKey[]).map((k) => `<button class="th-it ${k}" data-a="boosttrain" data-v="${k}"><span>${ITEM_ICON[k]}</span><b>${ITEM_NAME[k]}</b><small>${ICON.target} Practise</small></button>`).join('')}</div></div>
        </div>
        <button class="btn ghost sm" data-a="tutskip">Skip · go racing</button>
      </div>
    </section>

    <section id="tutprompt" class="screen passthrough">
      <div class="tut-card" data-k="tutcard">
        <div class="tut-step" data-k="tutstep">STEP 1 / 4</div>
        <div class="tut-gesture" data-k="tutgesture"><span class="hand">${ICON.hand}</span></div>
        <div class="tut-title" data-k="tuttitle">SWIPE LEFT</div>
        <div class="tut-sub" data-k="tutsub">One swipe moves exactly one lane.</div>
        <div class="tut-key" data-k="tutkey">Keyboard: ←</div>
      </div>
    </section>

    <section id="tutdone" class="screen overlay">
      <div class="panel tut-panel td-panel">
        <div class="tut-check">${ICON.check}</div>
        <h2 data-k="tdtitle">TRAINING COMPLETE</h2>
        <p class="tut-lead" data-k="tdlead"></p>
        <div class="td-path" data-k="tdpath">${classBadge('D')}<i>→</i>${classBadge('C')}<small>≈ 3 min on Hard</small></div>
        <div class="td-acts">
          <button class="btn big" data-a="play">${ICON.play} <span data-k="tdrace">Race Endless</span></button>
          <div class="td-row">
            <button class="btn ghost" data-a="tdagain">${ICON.retry} <span data-k="tdagain">Replay</span></button>
            <button class="btn ghost" data-a="home">${ICON.home} Home</button>
          </div>
        </div>
      </div>
    </section>

    <section id="continue" class="screen overlay">
      <div class="panel cont-panel">
        <div class="title">REVIVE?</div>
        <div class="cont-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" data-k="contring" cx="60" cy="60" r="52"/></svg><b data-k="contsec">7</b></div>
        <p class="contleft" data-k="contleft"></p>
        <button class="btn big gold" data-a="contad">${ICON.play} Watch ad · Revive</button>
        <button class="btn ghost sm" data-a="contno">No thanks · end race</button>
      </div>
    </section>

    <section id="countdown" class="screen"><div class="n" data-k="count">3</div></section>

    <section id="pause" class="screen overlay">
      <div class="panel">
        <h2>Paused</h2>
        <div class="toggles">
          <button class="toggle" data-a="sound"><span data-ic="sound">${ICON.sound}</span> SFX</button>
          <button class="toggle" data-a="music"><span data-ic="music">${ICON.music}</span> MUSIC</button>
          <button class="toggle" data-a="quality">${ICON.gear} <span data-k="quality">HIGH</span></button>
        </div>
        <button class="btn big" data-a="resume">${ICON.play} Resume</button>
        <div class="navrow">
          <button class="btn nav blue" data-a="retry">${ICON.retry}<span>Retry</span></button>
          <button class="btn nav dark" data-a="home">${ICON.home}<span>Home</span></button>
        </div>
      </div>
    </section>

    <section id="gameover" class="screen overlay">
      <div class="panel result">
        <div class="res-top"><button class="icon-btn sm" data-a="home" aria-label="Close">${ICON.close}</button><img class="res-logo" src="${logoUrl}" alt="" /><button class="icon-btn sm" data-a="share" aria-label="Share">${ICON.share}</button></div>
        <div class="title" data-k="gotitle">FINISH</div>
        <div class="brag" data-k="brag" hidden></div>
        <div class="endexp"><span class="ex">${XPT}</span><div class="final exp" data-k="final">0</div></div>
        <div class="endrow"><span class="erank" data-k="erank"></span><span class="newbest" data-k="newbest">${ICON.trophy} NEW BEST</span><span class="epos" data-k="epos"></span></div>
        <div class="tipbox" data-k="gtip" hidden></div>
        <div class="stats mini two" data-k="gstats">
          <div class="stat"><span class="label">Distance</span><span class="v">${ICON.flag}<span data-k="gdist">0</span></span></div>
          <div class="stat"><span class="label">Best</span><span class="v"><span data-k="gbest">0</span></span></div>
        </div>
        <div class="rwd" data-k="grwd"></div>
        <button class="btn gold adbtn" data-a="ad2x" data-k="ad2x">${ICON.play} Watch ad · +20% coins</button>
        <button class="btn big retry" data-a="retry">${ICON.retry} Retry</button>
        <div class="navrow">
          <button class="btn nav blue" data-a="home">${ICON.home}<span>Home</span></button>
          <button class="btn nav purple" data-a="tracks">${ICON.flag}<span>Tracks</span></button>
          <button class="btn nav dark" data-a="garage">${ICON.car}<span>Garage</span></button>
        </div>
      </div>
    </section>

    <section id="garage" class="screen">
      ${this.head('GARAGE')}
      <div class="lockbadge" data-k="lockbadge" hidden>${ICON.lock}<span data-k="locktxt">LOCKED</span></div>
      <div class="carinfo panel" data-k="carinfo"></div>
      <div class="bottom">
        <div class="carstrip" data-k="carstrip"></div>
        <div class="carsel panel">
          <button class="icon-btn" data-a="prevcar" aria-label="Previous car">${ICON.chevL}</button>
          <div class="name"><b data-k="carname">XWAVE Pearl</b><small class="ccls" data-k="carcls">GT Coupe</small><div class="dots" data-k="cardots"></div></div>
          <button class="icon-btn" data-a="nextcar" aria-label="Next car">${ICON.chevR}</button>
        </div>
        <button class="btn" data-a="carbtn" data-k="carbtn">Selected</button>
        <div class="upgrades panel" data-k="upgrades"></div>
      </div>
    </section>

    <section id="missions" class="screen page">
      ${this.head('MISSIONS')}
      <div class="rank panel"><div class="badge" data-k="rank">1</div><div><div class="label">Pilot rank</div><div class="rt" data-k="ranktitle">Cadet</div><div class="label" data-k="rankprog"></div></div></div>
      <div class="autoclaim panel"><span><b>Auto-collect rewards</b><small data-k="acnote">Rewards go straight to your wallet</small></span><button class="switch" data-a="autoclaim" role="switch" aria-label="Auto-collect mission rewards"><i></i></button></div>
      <div data-k="mpending" class="mpending"></div>
      <div data-k="mlist" class="mlist"></div>
      <div class="label mfoot">Daily challenges are in ${ICON.calendar} Daily</div>
      <button class="btn big" data-a="play" style="margin-top:auto;align-self:center">${ICON.play} Play</button>
    </section>

    <div id="debug"></div>`;
  }

  private bind() {
    this.root.addEventListener('click', (e) => {
      // tap on the dimmed backdrop around a modal with a close button = close it
      const tgt = e.target as HTMLElement;
      if (tgt.classList.contains('overlay') && tgt.classList.contains('screen') && tgt.querySelector(':scope > .modal [data-a="closemodal"]')) {
        tgt.querySelectorAll('.gstep.open').forEach((g) => g.classList.remove('open'));
        return this.h.closeModal();
      }
      const el = tgt.closest<HTMLElement>('[data-a]');
      if (!el || el.hasAttribute('disabled')) return;
      const a = el.dataset.a!;
      switch (a) {
        case 'play': return this.h.play();
        case 'tracks': return this.h.play();
        case 'nexttrack': return this.h.nextTrack();
        case 'speed':
          this.speedTip(el.dataset.v as 'easy' | 'normal' | 'hard');
          return this.h.setSpeed(el.dataset.v as 'easy' | 'normal' | 'hard');
        case 'help': return this.h.help();
        case 'contad': return this.h.continueAd();
        case 'contcoins': return this.h.continueCoins();
        case 'contno': return this.h.continueNo();
        case 'contshop': return this.h.shop();
        case 'ad2x': return this.h.adDouble();
        case 'adfree': return this.h.adFreeCoins();
        case 'adboost': return this.h.adBoost();
        case 'tutstart': return this.h.startTutorial();
        case 'tdagain': return this.h.trainAgain();
        case 'advtrain': return this.h.advTrain(el.dataset.v!);
        case 'assist': return this.h.toggleAssist();
        case 'comfort': return this.h.toggleComfort();
        case 'vibrate': return this.h.toggleVibrate();
        case 'tutskip': return this.h.skipTutorial();
        case 'track': return this.h.pickTrack(el.dataset.id!);
        case 'spick': {
          const v = el.dataset.v ?? '';
          const sv = this.lastSave;
          if (v && this.bagPick && sv && sv.items[v as SpecialKey] > 0) return this.spConfirm(v as SpecialKey);
          return this.h.chooseSpecial(v);
        }
        case 'shpvcopy':
          copyText(this.shareText);
          return this.toast(`${ICON.share} Copied — paste it anywhere`);
        case 'morecars': return this.toast(`${ICON.car} More cars unlock at rank ${classBadge('S')} ${classBadge('SS')} ${classBadge('SSS')} on Mega Rush`, '#ff7a2e');
        case 'account': return this.h.cloud('open');
        case 'acgoogle': return this.h.cloud('google');
        case 'acapple': return this.h.cloud('apple');
        case 'acsend': return this.h.cloud('send', $<HTMLInputElement>(this.root, '[data-k="acemail"]').value);
        case 'acverify': return this.h.cloud('verify', $<HTMLInputElement>(this.root, '[data-k="accode"]').value);
        case 'acsync': return this.h.cloud('sync');
        case 'acout': return this.h.cloud('signout');
        case 'ckeep': return this.h.cloud('keep', el.dataset.v);
        case 'spok': this.hideOverlay('spconfirm'); return this.h.chooseSpecial(el.dataset.v ?? '');
        case 'bagbuy': if (this.lastSave) this.buySync(this.lastSave); return this.showOverlay('bagbuy');
        case 'sbuy': return this.h.buySpecial(el.dataset.v!);
        case 'bagpick': return this.h.bagPick();
        case 'sgo': return this.h.goRace();
        case 'bonusgo': return this.h.bonusGo();
        case 'slocked': return this.toast(`${ICON.lock} Opens at rank AAA · try it now in a Bonus event`, '#b7a6ff');
        case 'soon': return this.toast(`${ICON.lock} Reach rank ${el.dataset.v ?? 'S'} on Mega Rush to open this track`, '#b7a6ff');
        case 'rankgate': return this.rankGuide();
        case 'garage': return this.h.garage();
        case 'missions': return this.h.missions();
        case 'home': return this.h.home();
        case 'pause': return this.h.pause();
        case 'resume': return this.h.resume();
        case 'retry': return this.h.retry();
        case 'sound': return this.h.toggleSound();
        case 'music': return this.h.toggleMusic();
        case 'quality':
          if (el.dataset.v && el.classList.contains('on')) return;
          return this.h.toggleQuality();
        case 'settings': return this.h.settings();
        case 'closemodal':
          this.root.querySelectorAll('.gstep.open').forEach((g) => g.classList.remove('open'));
          return this.h.closeModal();
        case 'daily': return this.h.daily();
        case 'events': return this.h.events();
        case 'ranks': return this.h.ranks();
        case 'shop': return this.h.shop();
        case 'guide': return this.h.guide();
        case 'checkin': return this.h.checkIn();
        case 'claimq': return this.h.claimQuest(el.dataset.id!);
        case 'chest': return this.h.claimChest(Number(el.dataset.i));
        case 'claimpass': return this.h.claimPass();
        case 'racecup': return this.h.raceCup();
        case 'cupboard': return this.h.cupBoard();
        case 'buy': return this.h.buy(el.dataset.sku!);
        case 'restore': return this.h.restore();
        case 'savename': return this.h.setName($<HTMLInputElement>(this.root, '[data-k="nameinput"]').value);
        case 'equip': return this.h.equip(el.dataset.v as ItemKey);
        case 'ranktab': return this.h.rankTab(el.dataset.v as 'week' | 'all');
        case 'claimresults': return this.h.claimResults();
        case 'share': return this.h.share();
        case 'sos':
        case 'rocket':
          // already fired on touch-down (see pointerdown below); a click alone (mouse / keyboard) still works
          if (performance.now() - this.fastTapT < 600) return;
          return a === 'sos' ? this.h.sos() : this.h.rocket();
        case 'rocketfix': return this.h.rocketFix(el.dataset.v!);
        case 'avpick': return this.h.setAvatar(Number(el.dataset.i));
        case 'avrand': return this.h.randomAvatar();
        case 'profile': return this.h.profile();
        case 'viewp': return this.h.viewPlayer(Number(el.dataset.i));
        case 'boostinfo': return this.h.boostInfo(el.dataset.v!);
        case 'bag': return this.h.bag();
        case 'boosttrain': return this.h.boostTrain(el.dataset.v!);
        case 'autoclaim': return this.h.toggleAutoClaim();
        case 'claimm': return this.h.claimMission(Number(el.dataset.i));
        case 'mystery':
          this.toast(`${ICON.lock} Hidden world · reach class ${el.dataset.v} to reveal it`, 'var(--purple, #9b6bff)');
          return;
        case 'popa': return this.h.popAction(el.dataset.v!);
        case 'country': return this.countryPicker();
        case 'setcountry':
          this.closePopup();
          return this.h.setCountry(el.dataset.v!);
        case 'popgo': {
          // entry popup shortcuts (after the reward is claimed)
          this.closePopup();
          const v = el.dataset.v!;
          const go: Record<string, () => void> = { daily: () => this.h.daily(), shop: () => this.h.shop(), garage: () => this.h.garage(), help: () => this.h.help(), play: () => this.h.play(), events: () => this.h.events() };
          return go[v]?.();
        }
        case 'freepop': return this.h.freePop();
        case 'perk': return this.h.perk(el.dataset.v!);
        case 'buyboost': return this.h.buyBoost(el.dataset.v!);
        case 'lang': return this.langPicker();
        case 'setlang':
          this.closePopup();
          return this.h.setLang(el.dataset.v!);
        case 'dailypop': return this.h.dailyPop();
        case 'gstep': {
          // one detail open at a time: opening a step closes the others
          const open = !el.classList.contains('open');
          el.parentElement?.querySelectorAll('.gstep.open').forEach((g) => g.classList.remove('open'));
          el.classList.toggle('open', open);
          if (open) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        case 'rankguide':
          this.rankGuide();
          return;
        case 'closeov':
          this.screens[el.dataset.v!]?.classList.remove('show');
          return;
        case 'savepname': return this.h.setName($<HTMLInputElement>(this.root, '[data-k="pnameinput"]').value);
        case 'pickcar':
          this.garageIndex = SKINS.findIndex((x) => x.id === el.dataset.id);
          this.h.previewSkin(el.dataset.id!);
          return;
        case 'prevcar':
          this.garageIndex = (this.garageIndex + SKINS.length - 1) % SKINS.length;
          this.h.previewSkin(SKINS[this.garageIndex].id);
          return;
        case 'nextcar':
          this.garageIndex = (this.garageIndex + 1) % SKINS.length;
          this.h.previewSkin(SKINS[this.garageIndex].id);
          return;
        case 'carbtn': {
          const s = SKINS[this.garageIndex];
          if (el.dataset.mode === 'buy') this.h.buySkin(s.id);
          else if (el.dataset.mode === 'shop') this.h.shop();
          else if (el.dataset.mode === 'rank') this.rankGuide();
          else this.h.selectSkin(s.id);
          return;
        }
        default:
          if (a.startsWith('up-')) this.h.upgrade(a.slice(3) as UpgradeKey);
      }
    });
    // ROADSTER / SOS fire the instant the finger touches the button (no wait for touch-end / click)
    this.root.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a="rocket"], [data-a="sos"]');
      if (!b || b.hidden) return;
      e.preventDefault();
      this.fastTapT = performance.now();
      b.classList.add('pressed');
      window.setTimeout(() => b.classList.remove('pressed'), 140);
      if (b.dataset.a === 'sos') this.h.sos();
      else this.h.rocket();
    });
    // stop HUD/overlay touches from becoming swipes
    this.root.addEventListener('touchstart', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button,input,.scroll,.lb-list,.track-list,.avstrip,.modal')) e.stopPropagation();
    }, { passive: true });
    this.root.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        e.stopPropagation();
        if (e.key === 'Enter') this.h.setName((e.target as HTMLInputElement).value);
      }
    });
  }

  /** shrink short labels that would be clipped (long names, other languages) */
  private fitLabels() {
    const sel = '.head h2, #start .rbtn .rl, .stile .sl, #tracks .boost span b, #tracks .boost span small, .mini span, .speedsel b, .tcard .tinfo b, .ccard b, #start .profile [data-k="pname"]';
    for (const el of Array.from(this.root.querySelectorAll<HTMLElement>(sel))) {
      if (!el.offsetParent) continue;
      el.style.removeProperty('font-size');
      let size = parseFloat(getComputedStyle(el).fontSize);
      let n = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 7 && n++ < 20) {
        size -= 0.5;
        el.style.setProperty('font-size', `${size}px`, 'important');
      }
    }
  }

  // --------------------------------------------------------------- fit-to-screen
  private fitQueued = false;
  private scheduleFit() {
    if (this.fitQueued) return;
    this.fitQueued = true;
    requestAnimationFrame(() => {
      this.fitQueued = false;
      this.fitPanels();
    });
  }

  /** scale any open overlay panel down so it never needs scrolling on a phone */
  private fitPanels() {
    this.fitLabels();
    for (const scr of Array.from(this.root.querySelectorAll<HTMLElement>('.screen.overlay.show'))) {
      const panel = scr.querySelector<HTMLElement>(':scope > .panel');
      if (!panel || panel.classList.contains('scrolly')) continue; // long lists scroll instead of shrinking
      const prev = panel.style.getPropertyValue('--fit');
      panel.style.setProperty('--fit', '1');
      if (!panel.classList.contains('fitting')) panel.classList.add('fitting');
      const cs = getComputedStyle(scr);
      const availH = scr.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8;
      const h = panel.scrollHeight;
      const k = h > availH && availH > 0 ? Math.max(0.6, availH / h) : 1;
      panel.style.setProperty('--fit', k.toFixed(3));
      void prev;
    }
  }

  // --------------------------------------------------------------- screens
  show(...ids: string[]) {
    for (const [id, el] of Object.entries(this.screens)) el.classList.toggle('show', ids.includes(id));
    if (!ids.includes('hud')) this.fitLabels(); // menus: fit now (no frame of clipped text)
    this.scheduleFit();
  }
  isShown(id: string) {
    return this.screens[id]?.classList.contains('show');
  }

  setLoading(k: number) {
    $(this.root, '#loading .bar i').style.width = `${Math.round(k * 100)}%`;
  }

  private setAll(key: string, v: string) {
    this.root.querySelectorAll<HTMLElement>(`[data-k="${key}"]`).forEach((el) => (el.textContent = v));
  }

  /** quality actually in use (may be a session-only LOW fallback) */
  private liveQuality: 'high' | 'low' | null = null;

  refreshProfile(s: SaveData, liveQuality?: 'high' | 'low') {
    if (liveQuality) this.liveQuality = liveQuality;
    this.setAll('wallet', fmt(s.wallet));
    // home top bar: compact amount (11.2K) so the profile chip keeps its room
    this.root.querySelectorAll<HTMLElement>('#start [data-k="wallet"]').forEach((e) => (e.textContent = s.wallet >= 10000 ? `${(s.wallet / 1000).toFixed(s.wallet >= 100000 ? 0 : 1)}K` : fmt(s.wallet)));
    this.setAll('best', fmt(s.best));
    this.setAll('quality', (this.liveQuality ?? s.settings.quality).toUpperCase());
    this.speedTip(s.settings.speed);
    this.root.querySelectorAll<HTMLElement>('[data-a="speed"]').forEach((b) => {
      const on = b.dataset.v === s.settings.speed;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.root.querySelectorAll<HTMLElement>('[data-ic="sound"]').forEach((e) => (e.innerHTML = s.settings.sound ? ICON.sound : ICON.soundOff));
    this.root.querySelectorAll<HTMLElement>('[data-ic="music"]').forEach((e) => (e.innerHTML = s.settings.music ? ICON.music : ICON.musicOff));
    this.root.querySelectorAll<HTMLElement>('[data-a="sound"]').forEach((b) => b.classList.toggle('off', !s.settings.sound));
    this.root.querySelectorAll<HTMLElement>('[data-a="music"]').forEach((b) => b.classList.toggle('off', !s.settings.music));
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="sound"]').forEach((b) => b.setAttribute('aria-checked', String(s.settings.sound)));
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="music"]').forEach((b) => b.setAttribute('aria-checked', String(s.settings.music)));
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="comfort"]').forEach((b) => b.setAttribute('aria-checked', String(s.settings.comfort !== false)));
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="vibrate"]').forEach((b) => b.setAttribute('aria-checked', String(s.settings.vibrate !== false)));
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="assist"]').forEach((b) => b.setAttribute('aria-checked', String(s.settings.assist !== false)));
    const q = this.liveQuality ?? s.settings.quality;
    this.root.querySelectorAll<HTMLElement>('.seg [data-a="quality"]').forEach((b) => b.classList.toggle('on', b.dataset.v === q));
  }

  // --------------------------------------------------------------- HUD
  private hset(key: string, v: string, html = false) {
    if (this.hudCache[key] === v) return;
    this.hudCache[key] = v;
    const el = this.root.querySelector<HTMLElement>(`[data-h="${key}"]`);
    if (!el) return;
    if (html) el.innerHTML = v;
    else el.textContent = v;
  }

  /** v2: HUD shows Bonus coins instead of EXP */
  bonusHud = false;
  /** training / practice: nothing is earned, the score box just says TRAINING */
  trainHud = false;
  /** best EXP to chase this race (0 = none yet / not an EXP race) */
  hudBest = 0;
  /** speed level shown on the race HUD ('' = hide) */
  hudLevel = '';
  /** highest rank this road can give (Endless AAA, Mega Rush SSS) */
  hudTop: RankClass = 'AAA';
  /** the player's own rank (profile) shown on the race HUD */
  hudMe: RankClass = 'D';

  /** v2: rank-gate strip under the HUD (null = hidden) */
  gateHud(g: { next: RankClass; k: number } | null) {
    const el = this.root.querySelector<HTMLElement>('[data-h="gatebar"]');
    if (!el) return;
    el.hidden = !g;
    if (!g) return;
    this.hset('gatenext', classBadge(g.next), true);
    this.root.querySelector<HTMLElement>('[data-h="gatefill"]')!.style.width = `${Math.min(100, Math.max(0, g.k * 100)).toFixed(1)}%`;
  }

  resetHud() {
    this.hudCache = {};
  }

  updateHud(run: Run, speed: number, maxSpeed: number, mission: { text: string; progress: number; target: number } | null) {
    // v2: the big number is the run's EXP; the plate next to it is the rank that EXP has reached
    const sk = this.root.querySelector<HTMLElement>('[data-k="trskip"]');
    if (sk && sk.hidden === this.trainHud) sk.hidden = !this.trainHud;
    if (this.trainHud) {
      // training shows EXP and the rank it would reach, so players learn the race HUD (nothing is saved)
      this.hset('scorelabel', `${XPT}<small class="trtag">TRAINING</small>`, true);
      this.hset('score', fmt(run.exp));
      this.hset('rankp', classBadge(classOfBolts(run.exp)), true);
    } else if (this.bonusHud) {
      // v2 Bonus road: coins only — the big number is the coins collected
      this.hset('scorelabel', `${ICON.coin}BONUS COINS`, true);
      this.hset('score', fmt(run.coins));
      this.hset('rankp', '', true);
    } else {
      this.hset('scorelabel', `${XPT}${this.hudLevel ? `<small class="lvtag2 ${this.hudLevel.toLowerCase()}">${this.hudLevel}</small>` : ''}`, true);
      this.hset('score', fmt(run.exp));
      // the rank THIS race has reached (labelled), next to its EXP
      this.hset('rankp', run.expRate > 0 ? `<small class="rkl">RACE</small>${classBadge(classOfBolts(run.exp))}` : '', true);
    }
    // the best EXP to beat, with a thin bar — turns gold once beaten
    const hb = this.root.querySelector<HTMLElement>('[data-h="hbest"]');
    if (hb) {
      const show = this.hudBest > 0 && !this.trainHud && !this.bonusHud && run.expRate > 0;
      if (hb.hidden === show) hb.hidden = !show;
      if (show) {
        this.hset('hme', `<small>YOU</small>${classBadge(this.hudMe)}`, true);
        const beat = run.exp > this.hudBest;
        hb.classList.toggle('beat', beat);
        this.hset('hbestv', beat ? 'BEATEN!' : fmt(this.hudBest));
        const bar = this.root.querySelector<HTMLElement>('[data-h="hbestbar"]')!;
        const w = `${Math.min(100, (run.exp / this.hudBest) * 100).toFixed(0)}%`;
        if (bar.style.width !== w) bar.style.width = w;
      }
    }
    // next goal: the next rank and the EXP still needed for it
    const hn = this.root.querySelector<HTMLElement>('[data-h="hnext"]');
    if (hn) {
      const cur = classOfBolts(run.exp);
      const nx = CLASSES.indexOf(cur) < CLASSES.indexOf(this.hudTop) ? CLASSES[CLASSES.indexOf(cur) + 1] : null;
      const show = !!nx && !this.trainHud && !this.bonusHud && run.expRate > 0;
      if (hn.hidden === show) hn.hidden = !show;
      if (show && nx) this.hset('hnext', `<small>NEXT</small>${classBadge(nx)}<b>${fmt(CLASS_MIN[nx] - run.exp)}</b><small>EXP</small>`, true);
    }
    this.hset('coins', fmt(run.coins));
    this.hset('dist', `${fmt(run.distance)} m`);
    this.hset('kmh', fmt(speed * 3.6));
    const sb = this.root.querySelector<HTMLElement>('[data-h="speedbar"]')!;
    const w = `${Math.min(100, (speed / maxSpeed) * 100).toFixed(0)}%`;
    if (sb.style.width !== w) sb.style.width = w;
    let hearts = '';
    for (let i = 0; i < run.maxLives; i++) hearts += i < run.lives ? ICON.heart : ICON.heartEmpty;
    this.hset('hearts', hearts, true);

    const d = run.durations();
    const chips: { kind: PickupKind; left: number; total: number; n?: number }[] = [];
    if (run.shield) chips.push({ kind: 'shield', left: run.shieldT, total: d.shield, n: run.shieldHits });
    if (run.magnetT > 0) chips.push({ kind: 'magnet', left: run.magnetT, total: d.magnet });
    if (run.turboT > 0) chips.push({ kind: 'turbo', left: run.turboT, total: d.turbo });
    if (run.doubleT > 0) chips.push({ kind: 'double', left: run.doubleT, total: d.double });
    if (run.coin2T > 0) chips.push({ kind: 'coin2' as PickupKind, left: run.coin2T, total: 8 });
    // Roadster / HYPER charges show on their own button (bottom-right)
    if (run.dashes > 0) chips.push({ kind: 'dash', left: 1, total: 1 });
    const rb = $(this.root, '[data-k="rocketbtn"]');
    const rockets = run.hyperJumps + run.superJumps;
    if (rb.hidden !== rockets <= 0) rb.hidden = rockets <= 0;
    rb.classList.toggle('hyper', run.hyperJumps > 0);
    this.hset('rocketlbl', this.rocketReady || rb.classList.contains('call') ? 'TAP!' : run.hyperJumps > 0 ? 'HYPER' : 'ROADSTER');
    this.hset('rocketcnt', String(rockets));
    const sos = $(this.root, '[data-k="sosbtn"]');
    if (sos.hidden !== run.escapes <= 0) sos.hidden = run.escapes <= 0;
    this.hset('soscnt', String(run.escapes));
    const colors: Record<string, string> = { coin2: '#ffd24a', shield: '#3d9bff', magnet: '#ff3b4e', turbo: '#b6ff2e', double: '#ffc21a', super: '#9b6bff', hyper: '#ffc21a', dash: '#2ee6c8' };
    const icons: Record<string, string> = { coin2: ICON.coin, shield: ICON.shield, magnet: ICON.magnet, turbo: BOLT, double: ICON.x2, super: ICON.rocket, hyper: ICON.hyper, dash: ICON.dash };
    const html = chips
      .map((c) => {
        const k = Math.max(0, c.left / c.total);
        const circ = 2 * Math.PI * 20;
        const q = Math.round(k * 40) / 40; // quantise to limit DOM churn
        return `<div class="pchip ${c.left < 2 ? 'expiring' : ''}" style="box-shadow:0 0 8px ${colors[c.kind]}40">
          <svg class="ring" viewBox="0 0 46 46"><circle class="bg" cx="23" cy="23" r="20"/><circle cx="23" cy="23" r="20" stroke="${colors[c.kind]}" stroke-dasharray="${circ}" stroke-dashoffset="${(circ * (1 - q)).toFixed(1)}" stroke-linecap="round"/></svg>
          ${icons[c.kind].replace('<svg', '<svg class="icon"')}${c.kind === 'super' && run.superJumps > 1 ? `<em class="cnt">×${run.superJumps}</em>` : ''}${c.kind === 'dash' ? `<em class="cnt dash">×${run.dashes}</em>` : ''}${c.kind === 'shield' && c.n ? `<em class="cnt shieldn">×${c.n}</em>` : ''}${(c.kind as string) === 'coin2' ? '<em class="cnt">×2</em>' : ''}</div>`;
      })
      .join('');
    this.hset('powers', html, true);

    const mpanel = this.root.querySelector<HTMLElement>('#hud .mission');
    if (mpanel) mpanel.hidden = !mission;
    if (mission) {
      this.hset('mtext', mission.text);
      this.hset('mprog', `${fmt(mission.progress)}/${fmt(mission.target)}`);
      const mb = this.root.querySelector<HTMLElement>('[data-h="mbar"]')!;
      const mw = `${Math.min(100, (mission.progress / mission.target) * 100).toFixed(0)}%`;
      if (mb.style.width !== mw) mb.style.width = mw;
    }
  }

  /** in-run score pops share ONE spot: a new pop replaces the previous one (no stacked, overlapping text) */
  pop(text: string, color = '#ffffff', sub = '', offsetY = 0) {
    void offsetY;
    this.pops.querySelectorAll('.pop').forEach((p) => p.remove());
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.color = color;
    el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    this.pops.appendChild(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  /**
   * Collect effect: an icon flies smoothly on a curve from where it was picked up on the road
   * into its HUD counter (coins → coin pill, stars → star pill, items → their chip / button),
   * which then gives a small bump. Throttled so a coin trail never floods the DOM.
   */
  private flyLast: Record<string, number> = {};
  private flyLive = 0;
  flyTo(x: number, y: number, icon: string, target: 'coins' | 'bolts' | 'powers' | 'rocket' | 'sos' | 'hearts', gapMs = 0) {
    const now = performance.now();
    if (gapMs && now - (this.flyLast[target] ?? 0) < gapMs) return;
    if (this.flyLive > 14) return;
    this.flyLast[target] = now;
    const sel: Record<string, string> = { coins: '#hud .pill.coins', bolts: '#hud .pill.bolts', powers: '#hud [data-h="powers"]', rocket: '#hud [data-k="rocketbtn"]', sos: '#hud [data-k="sosbtn"]', hearts: '#hud [data-h="hearts"]' };
    let tEl = this.root.querySelector<HTMLElement>(sel[target]);
    if (!tEl || !tEl.offsetParent) tEl = this.root.querySelector<HTMLElement>(sel.powers);
    if (!tEl) return;
    const root = this.root.getBoundingClientRect();
    const tr = tEl.getBoundingClientRect();
    const tx = (target === 'powers' ? tr.left + 24 : tr.left + Math.min(22, tr.width / 2)) - root.left;
    const ty = tr.top + tr.height / 2 - root.top;
    const el = document.createElement('div');
    el.className = `flyer ${target}`;
    el.innerHTML = icon;
    el.style.left = '0px';
    el.style.top = '0px';
    this.pops.appendChild(el);
    this.flyLive++;
    // quadratic curve: lift up first, then sweep into the counter
    const cx = (x + tx) / 2 + (tx > x ? -40 : 40);
    const cy = Math.min(y, ty) - 70;
    const frames: Keyframe[] = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * tx;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ty;
      const sc = target === 'coins' ? 1.1 - 0.5 * t : 1.6 - 1.05 * t;
      frames.push({ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`, opacity: t > 0.92 ? 0.6 : 1 });
    }
    const dur = target === 'coins' ? 520 : 760;
    const anim = el.animate(frames, { duration: dur, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    anim.onfinish = () => {
      el.remove();
      this.flyLive--;
      tEl!.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    };
  }

  /** special item picked up: big title + icon zooms out toward the player and fades (≈1 s, no flash) */
  bigPickup(label: string, color: string, icon: string, sub = '') {
    this.pops.querySelectorAll('.pop, .bigpick').forEach((p) => p.remove()); // one big title at a time
    const el = document.createElement('div');
    el.className = 'bigpick';
    el.style.setProperty('--pc', color);
    el.innerHTML = `<span class="bp-ic">${icon}</span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}`;
    this.pops.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    window.setTimeout(() => el.remove(), 4000); // safety
  }

  /**
   * Toasts and section banners share one lane just below the HUD (score / track bar / power chips):
   * they stack top-down instead of covering each other, long text wraps, at most 2 toasts at once (the road stays visible).
   */
  private notices!: HTMLElement;
  private placeNotices() {
    // the slot sits right under the score row / track bar, above the road (never mid-screen)
    const root = this.root.getBoundingClientRect();
    let bottom = 0;
    for (const sel of ['#hud .row', '#hud .row2', '#hud [data-h="trackbar"]']) {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (!el || el.hidden || !el.offsetParent) continue;
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom - root.top);
    }
    this.notices.style.top = bottom > 0 ? `${Math.round(bottom + 6)}px` : '';
  }

  /**
   * ONE notice box at a time: section banners and toasts queue up and take turns in the same slot,
   * so the road is never covered by a stack of boxes. A full queue drops the oldest waiting notice.
   */
  private noticeQ: ({ kind: 'toast'; html: string; color: string } | { kind: 'banner'; w: string; n: string })[] = [];
  private noticeTimer = 0;
  private noticeCur = '';
  private pumpNotice() {
    if (this.noticeTimer || !this.noticeQ.length) return;
    const n = this.noticeQ.shift()!;
    this.placeNotices();
    this.notices.querySelectorAll('.toast').forEach((e) => e.remove());
    const ban = $(this.root, '#banner');
    ban.classList.remove('show');
    let ms: number;
    if (n.kind === 'banner') {
      this.noticeCur = `b:${n.w}|${n.n}`;
      this.setAll('bw', n.w);
      this.setAll('bn', n.n);
      void ban.offsetWidth;
      ban.classList.add('show');
      ms = 1900;
    } else {
      this.noticeCur = `t:${n.html}`;
      const el = document.createElement('div');
      el.className = 'toast panel';
      el.style.borderColor = n.color;
      el.innerHTML = n.html;
      ms = Math.min(3800, 2200 + Math.max(0, el.textContent!.length - 40) * 25);
      if (this.noticeQ.length) ms = Math.min(ms, 1800); // others are waiting: keep it moving
      el.style.animationDuration = `${ms}ms`;
      this.notices.appendChild(el);
    }
    this.noticeTimer = window.setTimeout(() => {
      this.noticeTimer = 0;
      this.noticeCur = '';
      this.notices.querySelectorAll('.toast').forEach((e) => e.remove());
      ban.classList.remove('show');
      this.pumpNotice();
    }, ms);
  }
  private pushNotice(n: (typeof this.noticeQ)[number]) {
    const key = n.kind === 'banner' ? `b:${n.w}|${n.n}` : `t:${n.html}`;
    if (key === this.noticeCur || this.noticeQ.some((q) => (q.kind === 'banner' ? `b:${q.w}|${q.n}` : `t:${q.html}`) === key)) return;
    this.noticeQ.push(n);
    while (this.noticeQ.length > 2) this.noticeQ.shift();
    this.pumpNotice();
  }

  toast(html: string, color = 'var(--cyan)') {
    this.pushNotice({ kind: 'toast', html, color });
  }

  /** urgent notice (rank up): jumps the queue and replaces whatever is showing */
  toastNow(html: string, color = 'var(--cyan)') {
    this.noticeQ.length = 0;
    if (this.noticeTimer) {
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = 0;
    }
    this.noticeCur = '';
    this.pushNotice({ kind: 'toast', html, color });
  }

  banner(world: string, name: string) {
    this.pushNotice({ kind: 'banner', w: world, n: name });
  }

  /** comfort: softer full-screen flashes */
  setComfort(on: boolean) {
    $(this.root, '#flash').classList.toggle('soft', on);
  }

  /** full-screen flashes are disabled (eye comfort): kept as a no-op for call sites */
  flash(_red = false) {
    return;
  }


  countdown(v: string) {
    const n = $(this.root, '#countdown .n');
    n.textContent = v;
    n.classList.toggle('go', v === 'GO!');
    n.style.animation = 'none';
    void n.offsetWidth;
    n.style.animation = '';
  }

  tutorial(on: boolean) {
    $(this.root, '#tutorial').classList.toggle('show', on);
  }

  /** END screen (v2): this race's EXP, the rank it reached, the leaderboard position — little text */
  gameOver(o: { score: number; best: number; isBest: boolean; dist: number; length?: number; coins: number; near: number; missions: { text: string; reward: number }[]; rewards: RunRewards | null; speedBonus: number; level: string; tip: CrashTip | null; runRank?: RankClass | null; pos?: string; car?: string; bonus?: boolean }) {
    void o.tip;
    // Endless/Mega Rush: "FINISH"; from rank C up a special brag card made to be shown off
    const brag = !!o.runRank && CLASSES.indexOf(o.runRank) >= CLASSES.indexOf('C');
    this.setAll('gotitle', o.bonus ? 'BONUS END' : 'FINISH');
    const panel = this.screens.gameover.querySelector<HTMLElement>('.result')!;
    panel.classList.toggle('braggy', brag);
    if (brag) panel.style.setProperty('--cc', CLASS_COLOR[o.runRank!]);
    const bg = $(this.root, '[data-k="brag"]');
    bg.hidden = !brag;
    this.hideEl('gstats', brag);
    bg.innerHTML = brag
      ? `<div class="bg-rays"></div>
         <div class="bg-shield"><span>${o.runRank}</span></div>
         <div class="bg-rank">RANK ${o.runRank}${o.isBest ? ` · <b>${ICON.trophy} NEW BEST</b>` : ''}</div>
         <div class="bg-exp"><b>${fmt(o.score)}</b>${XPT}</div>
         <div class="bg-meta">${ICON.flag}${fmt(o.dist)} m${o.pos ? ` · ${ICON.podium}${o.pos}` : ''}</div>
         <img class="bg-car" src="${carRear(o.car ?? 'zenith')}" alt="" />
         <button class="btn gold bg-share" data-a="share">${ICON.share} Share my rank</button>`
      : '';
    this.setAll('final', fmt(o.score));
    this.setAll('gbest', fmt(o.best));
    this.setAll('gdist', o.length ? `${fmt((o.dist / o.length) * 100)}%` : `${fmt(o.dist)} m`);
    const er = $(this.root, '[data-k="erank"]');
    er.innerHTML = o.runRank ? `${classBadge(o.runRank, 'lg')}<span><small>RACE RANK</small><b>${o.runRank}</b></span>` : '';
    if (o.runRank) er.style.setProperty('--cc', CLASS_COLOR[o.runRank]);
    $(this.root, '[data-k="epos"]').innerHTML = o.pos ? `${ICON.podium}<b>${o.pos}</b>` : '';
    $(this.root, '[data-k="newbest"]').classList.toggle('show', o.isBest);
    $(this.root, '[data-k="grwd"]').innerHTML = this.rewardsHtml(o.rewards, [{ label: 'race', coins: o.coins }, { label: `${o.level} bonus`, coins: o.speedBonus }]);
  }

  // --------------------------------------------------------------- garage
  garageSync(s: SaveData, previewId?: string) {
    if (previewId) this.garageIndex = SKINS.findIndex((x) => x.id === previewId);
    if (this.garageIndex < 0) this.garageIndex = 0;
    const skin = SKINS[this.garageIndex];
    this.setAll('carname', skin.name);
    this.setAll('carcls', skin.cls);
    const myClass = playerRank(s.expBest, s.exp2Best);
    const vis = carVisibility(s.unlocked, skin.id);
    const rankOk = (k: (typeof SKINS)[number]) => CLASSES.indexOf(myClass) >= CLASSES.indexOf((k.need ?? 'D') as RankClass);
    $(this.root, '[data-k="lockbadge"]').hidden = vis === 'own';
    this.setAll('locktxt', vis === 'dark' ? `RANK ${skin.need} NEEDED` : 'LOCKED');
    const strip = $(this.root, '[data-k="carstrip"]');
    strip.innerHTML = SKINS.map((k, i) => {
      const v = carVisibility(s.unlocked, k.id);
      const img = v === 'dark' ? `<img class="cimg shadow" src="${carShadow}" alt="" />` : CAR_IMG[k.id] ? `<img class="cimg" src="${CAR_IMG[k.id]}" alt="" />` : carSvg(k.shape, k.body, k.glow);
      const label = v === 'own' ? (s.vehicle === k.id ? 'In use' : 'Owned') : v === 'next' ? (rankOk(k) ? `${ICON.coin}${fmt(k.price)}` : `${ICON.lock} Rank ${k.need}`) : `Rank ${k.need}`;
      return `<button class="ccard ${v === 'own' ? '' : 'locked'} ${v} ${i === this.garageIndex ? 'on' : ''} ${s.vehicle === k.id ? 'cur' : ''}" data-a="pickcar" data-id="${k.id}" style="--rc:${RARITY_COLOR[k.rarity ?? 'Common']}">
        ${img}${v === 'dark' ? '<i class="q">?</i>' : ''}<b>${v === 'dark' ? '???' : k.name.replace('XWAVE ', '')}</b><small>${label}</small>${v === 'own' ? '' : `<i class="lk">${ICON.lock}</i>`}</button>`;
    }).join('') + `<button class="ccard locked dark more" data-a="morecars"><img class="cimg shadow" src="${carShadow}" alt="" /><i class="q">+</i><b>MORE</b><small>${classBadge('S')}${classBadge('SS')}${classBadge('SSS')}</small></button>`;
    // details: rarity, tagline, stats, score bonus, signature skills (hidden for dark cars)
    const st = skin.stats ?? [7, 7, 7, 7];
    const bars = ['Speed', 'Acceleration', 'Handling', 'Energy'].map((n, i) => `<div class="cst"><span>${n}</span><i><b style="width:${st[i] * 10}%"></b></i><em>${vis === 'dark' ? '?' : st[i]}</em></div>`).join('');
    $(this.root, '[data-k="carinfo"]').innerHTML = vis === 'dark'
      ? `<div class="crare" style="--rc:${RARITY_COLOR[skin.rarity ?? 'Common']}"><b class="cname">???</b>${skin.rarity ?? ''}</div><p class="cdark">${ICON.lock} Reach rank ${classBadge(skin.need as RankClass)} to reveal and unlock this car. Drive farther in one run to earn EXP.</p>`
      : `<div class="crare" style="--rc:${RARITY_COLOR[skin.rarity ?? 'Common']}"><b class="cname">${skin.name}</b>${skin.rarity ?? ''}<small>${esc(skin.cls.split('·')[1]?.trim() ?? '')}</small></div>
         <div class="cbonus">${ICON.lock} Unlocks at rank ${classBadge(skin.need as RankClass)}</div>
         <p class="cfair">Every car drives the same — EXP stays fair. Cars show off your rank.</p>`;
    void bars;
    const on = strip.querySelector<HTMLElement>('.ccard.on');
    if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
    $(this.root, '[data-k="cardots"]').innerHTML = SKINS.map((_, i) => `<i class="${i === this.garageIndex ? 'on' : ''}"></i>`).join('');
    const btn = $(this.root, '[data-k="carbtn"]');
    const owned = s.unlocked.includes(skin.id);
    if (!owned) {
      btn.dataset.mode = 'rank';
      btn.className = 'btn purple';
      btn.innerHTML = `${ICON.lock} Reach rank ${skin.need}`;
      btn.removeAttribute('disabled');
    } else if (!owned) {
      btn.dataset.mode = 'buy';
      btn.className = 'btn gold';
      btn.innerHTML = `${ICON.lock} Unlock <span class="price">${ICON.coin}${fmt(skin.price)}</span>`;
      btn.removeAttribute('disabled');
      if (s.wallet < skin.price) {
        btn.dataset.mode = 'shop';
        btn.className = 'btn pink';
        btn.innerHTML = `${ICON.lock} Need ${ICON.coin}${fmt(skin.price - s.wallet)} more · Get coins`;
      }
    } else if (s.vehicle === skin.id) {
      btn.dataset.mode = 'sel';
      btn.className = 'btn ghost';
      btn.innerHTML = `${ICON.check} Selected`;
      btn.removeAttribute('disabled');
    } else {
      btn.dataset.mode = 'sel';
      btn.className = 'btn';
      btn.innerHTML = `Select`;
      btn.removeAttribute('disabled');
    }
    const rows: { k: UpgradeKey; name: string; desc: string; icon: string }[] = [
      { k: 'engine', name: 'Engine', desc: 'Longer Turbo Boost', icon: ICON.engine },
      { k: 'shield', name: 'Shield', desc: 'Longer shield bubble', icon: ICON.shield },
      { k: 'magnet', name: 'Magnet', desc: 'Bigger radius & duration', icon: ICON.magnet },
    ];
    $(this.root, '[data-k="upgrades"]').innerHTML =
      `<div class="label">Upgrades</div>` +
      rows
        .map((r) => {
          const lvl = s.upgrades[r.k];
          const max = lvl >= UPGRADE_MAX;
          const cost = upgradeCost(lvl);
          const pips = Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
          return `<div class="upg"><div class="ic">${r.icon}</div><div><div class="nm">${r.name}<small>${r.desc}</small></div><div class="pips">${pips}</div></div>
            <button class="btn sm ${max ? 'ghost' : 'blue'}" data-a="up-${r.k}" ${max || s.wallet < cost ? 'disabled' : ''}>${max ? 'MAX' : `<span class="price">${ICON.coin}${fmt(cost)}</span>`}</button></div>`;
        })
        .join('');
    this.setAll('wallet', fmt(s.wallet));
  }

  // --------------------------------------------------------------- missions
  missionsSync(s: SaveData) {
    const lv = pilotLevel(s);
    const done = Object.values(s.career?.tier ?? {}).reduce((a, b) => a + b, 0);
    const all = CHAINS.reduce((a, c) => a + c.tiers.length, 0);
    this.setAll('rank', String(lv));
    this.setAll('ranktitle', `Pilot level ${lv}`);
    this.setAll('rankprog', `${done} / ${all} mission tiers done`);
    const auto = s.settings.autoClaim !== false;
    this.root.querySelectorAll<HTMLElement>('.switch[data-a="autoclaim"]').forEach((b) => b.setAttribute('aria-checked', String(auto)));
    this.setAll('acnote', auto ? 'On · rewards go straight to your wallet' : 'Off · claim each reward yourself');
    const pend = s.pendingMissions;
    $(this.root, '[data-k="mpending"]').innerHTML = pend.length
      ? `<div class="bhead"><b>Ready to claim</b>${pend.length > 1 ? `<button class="btn sm gold" data-a="claimm" data-i="-1">${ICON.gift} Claim all</button>` : ''}</div>` +
        pend.map((m, i) => `<div class="mrow pend"><i class="ok">${ICON.check}</i><span>${esc(m.text)}</span><button class="btn sm green" data-a="claimm" data-i="${i}">${ICON.coin}+${fmt(m.reward)}</button></div>`).join('')
      : '';
    const ic: Record<string, string> = { rank: ICON.podium, flag: ICON.flag, globe: ICON.target, gate: ICON.shield, gift: ICON.gift, rocket: ICON.rocket, coin: ICON.coin, car: ICON.car, trophy: ICON.trophy, play: ICON.play };
    $(this.root, '[data-k="mlist"]').innerHTML = activeChains(s)
      .map((v) => {
        const k = Math.min(1, v.value / v.target);
        const dots = Array.from({ length: v.tiers }, (_, i) => `<i class="${i < v.tier ? 'on' : i === v.tier ? 'cur' : ''}"></i>`).join('');
        return `<div class="mcard panel"><div class="t"><span class="mi">${ic[v.icon] ?? ICON.target}</span><span class="mt">${esc(v.text)}</span><span class="price">${ICON.coin}${fmt(v.reward)}</span></div>
          <div class="track"><i style="width:${(k * 100).toFixed(0)}%"></i></div>
          <div class="meta"><span class="tiers">${dots}</span><span>${fmt(v.value)} / ${fmt(v.target)}</span></div></div>`;
      })
      .join('');
    this.setAll('wallet', fmt(s.wallet));
  }

  // --------------------------------------------------------------- tracks
  private starsHtml(n: number, of = 3) {
    return Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
  }

  lastSave: SaveData | null = null;
  /**
   * v2 track list: Endless (the rank road), Track 2 (unlocks at AAA, ranks S / SS / SSS) and three
   * "coming soon" teasers. The old 20 courses are retired.
   */
  tracksSync(s: SaveData, liveTrack?: string) {
    void liveTrack;
    this.lastSave = s;
    const rank = playerRank(s.expBest, s.exp2Best);
    const aaa = CLASSES.indexOf(rank) >= CLASSES.indexOf('AAA');
    const lv = s.settings.speed;
    const endless = `<button class="tcard endless v2 ${s.track !== 'track2' ? 'sel' : ''}" data-a="track" data-id="endless">
        <img src="${THUMBS.endless}" alt="" draggable="false" />
        <div class="tinfo"><b>Endless <em class="lvtag">${LEVELS[lv].label}</em></b><span class="label">The rank road · D → AAA</span>
        <span class="tmeta">${XPT}<span>${fmt(s.expBest)}</span>${classBadge(CLASSES[Math.min(5, CLASSES.indexOf(classOfBolts(s.expBest)))])}</span></div>
        <span class="tbadge">1</span></button>`;
    const t2 = aaa
      ? `<button class="tcard t2 ${s.track === 'track2' ? 'sel' : ''}" data-a="track" data-id="track2">
        <img src="${THUMBS['mega-city']}" alt="" draggable="false" />
        <div class="tinfo"><b>Mega Rush <em class="lvtag">${LEVELS[lv].label}</em></b><span class="label">Harder · EXP ×1.25 · ranks S+</span>
        <span class="tmeta">${XPT}<span>${fmt(s.exp2Best)}</span>${classBadge('S')}${classBadge('SS')}${classBadge('SSS')}</span></div>
        <span class="tbadge">2</span></button>`
      : `<button class="tcard t2 tlocked dark" data-a="rankguide">
        <img src="${THUMBS['mega-city']}" alt="" draggable="false" />
        <div class="tinfo"><b>Mega Rush</b><span class="label">Harder road · ranks S+</span>
        <span class="tmeta">${ICON.lock}<span>Reach rank</span>${classBadge('AAA')}</span></div>
        <span class="tbadge">${ICON.lock}</span></button>`;
    // tracks 3–5 open at S / SS / SSS (earned on Mega Rush)
    const soon = (['S', 'SS', 'SSS'] as RankClass[])
      .map((r, i) => `<button class="tcard mystery" data-a="soon" data-v="${r}"><div class="mq">?</div>
        <div class="tinfo"><b>${['Ocean Drive', 'Volcano Run', 'Aurora Peak'][i]}</b><span class="tmeta">${ICON.lock}<span>Reach rank</span>${classBadge(r)}</span></div>
        <span class="tbadge">${i + 3}</span></button>`)
      .join('');
    $(this.root, '[data-k="tracklist"]').innerHTML = endless + t2 + soon;
    this.scheduleFit();
    this.setAll('wallet', fmt(s.wallet));
  }

  /** HUD progress bar for track mode (null hides it). */
  trackHud(o: { section: string; dist: number; length: number; marks: number[] } | null) {
    const el = this.root.querySelector<HTMLElement>('[data-h="trackbar"]')!;
    el.hidden = !o;
    if (!o) return;
    this.hset('tsection', o.section.toUpperCase());
    this.hset('tdist', `${fmt(Math.min(o.dist, o.length))} / ${fmt(o.length)} m`);
    const w = `${Math.min(100, (o.dist / o.length) * 100).toFixed(1)}%`;
    const bar = this.root.querySelector<HTMLElement>('[data-h="tbar"]')!;
    if (bar.style.width !== w) bar.style.width = w;
    this.hset('tmarks', o.marks.map((m) => `<s style="left:${((m / o.length) * 100).toFixed(2)}%"></s>`).join(''), true);
  }

  finish(o: { track: string; stars: number; score: number; isBest: boolean; time: number; coins: number; coinTarget: number; lost: number; reward: number; hasNext: boolean; rewards: RunRewards | null; speedBonus: number; level: string; leftover?: { pts: number; items: string } | null; bonusItems?: string[]; bonus?: boolean }) {
    this.setAll('ftrack', o.track);
    $(this.root, '[data-k="fstars"]').innerHTML = o.bonus ? '' : this.starsHtml(o.stars);
    $(this.root, '[data-k="frules"]').hidden = !!o.bonus;
    this.setAll('ffinal', fmt(o.score));
    $(this.root, '[data-k="fnewbest"]').classList.toggle('show', o.isBest);
    const m = Math.floor(o.time / 60);
    this.setAll('ftime', `${m}:${(o.time % 60).toFixed(1).padStart(4, '0')}`);
    this.setAll('fcoins', `${fmt(o.coins)}`);
    this.setAll('flost', `${o.lost}`);
    this.setAll('freward', `+${fmt(o.reward)}`);
    const tb = $(this.root, '[data-k="fbonus"]');
    tb.hidden = !o.bonusItems?.length;
    if (o.bonusItems?.length) this.setAll('fbonustxt', o.bonusItems.join(' · '));
    const lo = $(this.root, '[data-k="fleft"]');
    lo.hidden = !o.leftover;
    if (o.leftover) {
      this.setAll('fleftpts', `+${fmt(o.leftover.pts)}`);
      this.setAll('flefttxt', o.leftover.items);
    }
    const rule = (ok: boolean, t: string) => `<span class="srule ${ok ? 'got' : ''}"><i>${ok ? '★' : '☆'}</i>${t}</span>`;
    $(this.root, '[data-k="frules"]').innerHTML =
      rule(true, 'Finish') + rule(o.lost === 0, 'No lives lost') + rule(o.coins >= o.coinTarget, `${o.coinTarget} coins`);
    $(this.root, '[data-k="fnext"]').hidden = !o.hasNext;
    $(this.root, '[data-k="frwd"]').innerHTML = this.rewardsHtml(o.rewards, [
      { label: 'run', coins: o.coins },
      { label: `${o.level} bonus`, coins: o.speedBonus },
      { label: 'track', coins: o.reward },
    ]);
  }

  /** Show the guided-gesture card for a training step (null hides it). */
  tutPrompt(step: { index: number; total: number; need: string; title: string; sub: string } | null) {
    const scr = this.screens.tutprompt;
    if (!step) {
      scr.classList.remove('show');
      $(this.root, '[data-k="rocketbtn"]').classList.remove('call');
      return;
    }
    const keys: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓', sos: 'E / Enter · or tap SOS', rocket: 'R / Shift · or tap the ROADSTER button' };
    this.setAll('tutstep', `STEP ${step.index + 1} / ${step.total}`);
    this.setAll('tuttitle', step.title);
    this.setAll('tutsub', step.sub);
    this.setAll('tutkey', `Keyboard: ${keys[step.need]}`);
    $(this.root, '[data-k="rocketbtn"]').classList.toggle('call', step.need === 'rocket');
    $(this.root, '[data-k="tutgesture"]').className = `tut-gesture dir-${step.need}`;
    scr.classList.add('show');
  }

  tutWrong() {
    const c = $(this.root, '[data-k="tutcard"]');
    c.classList.remove('shake');
    void c.offsetWidth;
    c.classList.add('shake');
  }

  // --------------------------------------------------------------- ads
  /** "what to do next time" box after a crash */
  tipHtml(el: HTMLElement, t: CrashTip | null) {
    el.hidden = !t;
    if (!t) return;
    const rot: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
    const ic = t.move === 'sos' ? ICON.sos : `<svg viewBox="0 0 24 24" style="transform:rotate(${rot[t.move]}deg)"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    el.innerHTML = `<span class="tip-ic">${ic}</span><span class="tip-t"><b>How to avoid the ${esc(t.what)}</b>${esc(t.text)}</span>`;
  }

  /** v2: revive by rewarded ad (max 2 per race); the 3rd crash ends the race */
  /** training / practice end card (practice = the special just practised) */
  tutDone(practice: SpecialKey | null) {
    this.setAll('tdtitle', practice ? `${SPECIAL_SHORT[practice].toUpperCase()} PRACTICE DONE` : 'TRAINING COMPLETE');
    $(this.root, '[data-k="tdlead"]').innerHTML = practice
      ? `Nice! In a race, carry it in from your <b>Magic Bag</b> — 1 special per race.`
      : `You're ready! <b>Distance = EXP</b>, and EXP is your rank. Every new rank is guarded by a hard <b>rank gate</b>.`;
    this.hideEl('tdpath', !!practice);
    this.setAll('tdrace', practice ? 'Race' : 'Race Endless');
    this.setAll('tdagain', practice ? 'Again' : 'Replay');
    this.show('tutdone');
  }

  continueOffer(o: { left: number; tip?: CrashTip | null }) {
    void o.tip;
    $(this.root, '[data-k="contleft"]').innerHTML = `<b>${o.left} / 2</b> revives left`;
    this.continueTick(1, 7);
    this.show('hud', 'continue');
  }

  continueTick(k: number, secLeft: number) {
    this.setAll('contsec', String(Math.max(0, Math.ceil(secLeft))));
    const c = this.root.querySelector<SVGCircleElement>('[data-k="contring"]')!;
    const len = 2 * Math.PI * 52;
    c.style.strokeDasharray = `${len}`;
    c.style.strokeDashoffset = `${len * (1 - k)}`;
  }

  hideEl(key: string, hide: boolean) {
    const el = this.root.querySelector<HTMLElement>(`[data-k="${key}"]`);
    if (el) el.hidden = hide;
  }

  /** Reset/disable a rewarded-ad button (text after use). */
  adButton(key: 'ad2x' | 'ad2xf' | 'adboost', state: 'ready' | 'used', usedText = '') {
    const b = $(this.root, `[data-k="${key}"]`);
    if (!b.dataset.ready) b.dataset.ready = b.innerHTML;
    if (state === 'ready') {
      b.innerHTML = b.dataset.ready;
      b.removeAttribute('disabled');
      b.classList.remove('used');
    } else {
      b.innerHTML = `${ICON.check} ${usedText}`;
      b.setAttribute('disabled', '');
      b.classList.add('used');
    }
  }

  freeCoins(left: number, amount: number) {
    const fb = this.root.querySelector<HTMLElement>('[data-k="freebadge"]');
    if (fb) fb.hidden = left <= 0;
    this.setAll('adfree', left > 0 ? `+${amount}` : 'Tomorrow');
    this.root.querySelectorAll<HTMLElement>('[data-a="adfree"]').forEach((b) => b.toggleAttribute('disabled', left <= 0));
  }

  setLoadingText(t: string) {
    this.setAll('loadtxt', t);
  }

  debug(text: string | null) {
    const d = $(this.root, '#debug');
    d.classList.toggle('show', text !== null);
    if (text !== null) d.textContent = text;
  }

  // =============================================================== live-ops screens


  /** the player's own class (for their avatar plate) */
  myClass: RankClass = 'D';

  homeSync(o: { name: string; color: string; best: number; avatar: number; bolts: number; weekRank: number | null; allRank?: number | null; dailyBadge: number; bonus: { live: boolean; name: string; theme: string; text: string }; sale: boolean; pass: boolean }) {
    this.setAll('pname', o.name);
    // home chip: plain avatar (no corner badge over the text) · rank badge · best EXP
    $(this.root, '[data-k="ava"]').innerHTML = `<span class="ava img rk-${this.myClass} ${o.pass ? 'pass' : ''}">${avatarSvg(o.avatar)}</span>`;
    $(this.root, '[data-k="pline"]').innerHTML = `${classBadge(this.myClass)}<span class="pbolt">${fmt(o.bolts)}${BOLT}</span>`;
    // all-time position on the avatar (tap → profile)
    $(this.root, '[data-k="ava"]').insertAdjacentHTML('beforeend', `<em class="avrank">${o.allRank ? `#${o.allRank >= 10000 ? `${Math.round(o.allRank / 1000)}K` : fmt(o.allRank)}` : '#—'}</em>`);
    const b = $(this.root, '[data-k="dailybadge"]');
    b.hidden = o.dailyBadge <= 0;
    b.textContent = String(o.dailyBadge);
    $(this.root, '[data-k="saletag"]').hidden = !o.sale;
    // v2: the strip shows the Bonus event (open now / next one)
    const c = o.bonus;
    const strip = $(this.root, '[data-k="cupstrip"]');
    strip.style.setProperty('--cc', BONUS_COLOR[c.theme] ?? '#ffc21a');
    strip.innerHTML = `<span class="ci">${ICON.gift}</span><span class="ct"><b>BONUS · ${c.name}</b><small class="bt">${c.live ? '<em class="live">OPEN</em>' : '<em class="soon">NEXT</em>'}<span>${c.text}</span></small></span><span class="cgo">${ICON.chevR}</span>`;
    this.root.querySelectorAll<HTMLElement>('.rbtn .tag.live').forEach((t) => (t.hidden = !c.live));
  }

  /** v2 Bonus event card: today's place, time left / next opening, rules, RACE */
  bonusSync(o: { live: boolean; theme: string; name: string; left: string; opens: string; opensAt: string; next: string; finish: number; minutes: number; played: boolean }) {
    $(this.root, '[data-k="bnbody"]').innerHTML = `
      <div class="bn-hero" style="--cc:${BONUS_COLOR[o.theme] ?? '#ffc21a'}" data-theme="${o.theme}"><span class="bn-ic">${BONUS_EMOJI[o.theme] ?? '🏁'}</span><b>${o.name}</b>
        <small>${o.live ? `<em class="live">OPEN</em> ${o.left} left` : `<em class="soon">NEXT</em> ${o.opens}`}</small></div>
      <div class="bn-rules">
        <span>${ICON.clock}<b>${o.minutes} min</b> to the finish · <b>Replay freely</b></span>
        <span>${ICON.coin}<b>Coins only</b> · finish +${fmt(o.finish)}</span>
        <span>${ICON.rocket}<b>Rare specials</b> fire by themselves</span>
        <span>${ICON.gift}<b>Every hour</b> · open 30 min · random place</span>
      </div>
      ${o.live && !o.played ? `<button class="btn big gold" data-a="bonusgo">${ICON.play} Race</button>` : o.live ? `<button class="btn" disabled>${ICON.check} Played · next ${o.opensAt}</button>` : `<button class="btn" disabled>${ICON.lock} Opens ${o.opensAt}</button>`}
      ${o.next ? `<div class="label bn-next">Next: ${o.next}</div>` : ''}`;
    this.screens.bonus.classList.add('show');
    this.scheduleFit();
  }

  /** own profile (editable) or a rival's card */
  profileSync(o: { self: true; name: string; avatar: number; cls: RankClass; bolts: number; next: RankClass | null; k: number; need: number; best: number; weekRank: number | null; runs: number; trophies: SaveData['trophies']; car: string; country: string }) {
    this.myClass = o.cls;
    this.setAll('proftitle', 'YOUR PROFILE');
    const strip = Array.from({ length: AVATAR_COUNT }, (_, i) => `<button class="avpick ${i === o.avatar ? 'on' : ''}" data-a="avpick" data-i="${i}" aria-label="Avatar ${i + 1}">${avatarSvg(i)}</button>`).join('');
    $(this.root, '[data-k="profbody"]').innerHTML = `
      <div class="ph">${avaHtml(o.avatar, o.cls, 'xl')}<div class="pn">
        <div class="nameedit"><input data-k="pnameinput" maxlength="14" value="${esc(o.name)}" aria-label="Pilot name" /><button class="btn sm blue" data-a="savepname">Save</button></div>
        <small>Tap the name to change it</small></div></div>
      <div class="avrow2"><div class="avstrip" data-k="pavstrip">${strip}</div><button class="btn sm purple" data-a="avrand" aria-label="Random avatar">🎲</button></div>
      <button class="ctryrow bagrow" data-a="bag"><span class="fl">${BAG_ICON}</span><span><small>Magic Bag</small><b>Specials · 1 per race</b></span><em>Open</em></button>
      <button class="ctryrow" data-a="country"><span class="fl">${flagOf(o.country)}</span><span><small>Country</small><b>${esc(countryName(o.country || 'US'))}</b></span><em>Change</em></button>
      ${this.classCard(o.cls, o.bolts, o.next, o.k, o.need)}
      <div class="pstats two">
        <div><span class="label">Races</span><b>${fmt(o.runs)}</b></div>
        <div><span class="label">Car</span><b class="sm">${esc(o.car.replace('XWAVE ', ''))}</b></div>
      </div>
      <div class="sbtns two"><button class="btn sm ghost" data-a="rankguide">${ICON.info} EXP guide</button><button class="btn sm ghost" data-a="ranks">${ICON.podium} Leaderboard</button></div>`;
    const on = this.root.querySelector<HTMLElement>('[data-k="pavstrip"] .avpick.on');
    const st = this.root.querySelector<HTMLElement>('[data-k="pavstrip"]');
    if (on && st) st.scrollLeft = on.offsetLeft - st.clientWidth / 2 + on.clientWidth / 2;
  }

  private classCard(cls: RankClass, bolts: number, next: RankClass | null, k: number, need: number) {
    const ladder = CLASSES.map((c) => `<span class="lad ${c === cls ? 'cur' : CLASSES.indexOf(c) < CLASSES.indexOf(cls) ? 'done' : ''}" style="--cc:${CLASS_COLOR[c]}">${c}</span>`).join('');
    // big rank shield + big EXP: the two numbers that matter
    return `<div class="clscard rkhero rk-${cls}" style="--cc:${CLASS_COLOR[cls]}">
      <div class="rk-top"><div class="rk-shield"><span>${cls}</span><small>RANK</small></div>
        <div class="rk-exp"><small>BEST EXP</small><b>${fmt(bolts)}</b>${XPT}</div></div>
      <div class="cc-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></div>
      <div class="rk-next">${next ? `<b>${fmt(need)}</b> EXP to ${classBadge(next)}` : 'Top rank reached'}</div>
      <div class="ladder">${ladder}</div></div>`;
  }

  /** rows of the last rendered board, for tapping into a rival's profile */
  private rowCache: { r: LbRow; cls: RankClass }[] = [];

  showPlayer(i: number) {
    const e = this.rowCache[i];
    if (!e) return;
    const { r, cls } = e;
    if (r.you) return this.h.profile();
    const p = rivalProfile(r.name, r.score);
    this.setAll('proftitle', 'PILOT');
    $(this.root, '[data-k="profbody"]').innerHTML = `
      <div class="ph">${avaHtml(r.av ?? avatarForName(r.name), cls, 'xl', r.rank <= 3 ? `<i class="crown">${ICON.crown}</i>` : '')}<div class="pn">
        <b class="big ${r.pass ? 'gold' : ''}">${esc(r.name)}</b><small>${r.flag} · <span class="${p.online ? 'online' : ''}">${p.seen}</span></small></div></div>
      <div class="clscard" style="--cc:${CLASS_COLOR[cls]}"><div class="cc-top">${classBadge(cls, 'lg')}<div><b>Rank ${cls}</b><small>#${fmt(r.rank)} on this board</small></div><span class="cc-bolts">${BOLT}${fmt(r.score)}</span></div></div>
      <div class="pstats">
        <div><span class="label">Avg EXP</span><b>${fmt(p.avg)}</b></div>
        <div><span class="label">Races</span><b>${fmt(p.runs)}</b></div>
        <div><span class="label">Streak</span><b>${p.streak} d</b></div>
        <div><span class="label">Car</span><b class="sm">${p.car}</b></div>
      </div>`;
    this.screens.profile.classList.add('show');
  }

  /**
   * MAGIC BAG: every item the player owns (bag = inventory), what is equipped for the next run,
   * class locks, shop shortcuts and the rules / which item fits which track.
   */
  hideOverlay(id: string) {
    this.screens[id]?.classList.remove('show');
  }

  /** v2: before a race — ONE big button shows the special you carry (tap → Magic Bag to change), then GO */
  specialPick(s: SaveData, track: string) {
    const k = s.special && s.items[s.special] > 0 ? s.special : null;
    const big = k
      ? `<span class="spi">${ITEM_ICON[k]}</span><span class="spt"><b>${SPECIAL_SHORT[k]}</b><small>×${s.items[k]} in bag · tap to change</small></span>`
      : `<span class="spi none">${BAG_ICON}</span><span class="spt"><b>No special</b><small>Tap to pick one</small></span>`;
    $(this.root, '[data-k="spbody"]').innerHTML = `
      <div class="sp-track">${esc(track)}</div>
      <button class="sp-big ${k ?? 'none'}" data-a="bagpick">${big}<i class="chev">${ICON.chevR}</i></button>
      <div class="sprules">${ICON.info}<span>1 special per race · used only if you tap it</span></div>
      <button class="btn big spgo" data-a="sgo">${ICON.play} GO</button>`;
    this.screens.specialpick.classList.add('show');
    this.scheduleFit();
  }

  showOverlay(id: string) {
    this.screens[id]?.classList.add('show');
    this.scheduleFit();
  }

  /**
   * Magic Bag: your specials (pick one when opened before a race), "get with coins" below,
   * and the AAA teasers. One line of rules — no long texts.
   */
  bagSync(s: SaveData, pick = false) {
    this.lastSave = s;
    this.bagPick = pick;
    // "In your bag": always all 3 specials with their count (×0 greyed)
    const tile = (k: SpecialKey) => {
      const n = s.items[k];
      const on = pick && s.special === k && n > 0;
      return `<button class="bgt ${k} ${n > 0 ? '' : 'zero'} ${on ? 'on' : ''}" data-a="${pick ? 'spick' : 'boostinfo'}" data-v="${k}"><span class="spi">${ITEM_ICON[k]}</span><b>${SPECIAL_SHORT[k]}</b><em class="cnt">×${n}</em>${on ? `<i class="tick">${ICON.check}</i>` : ''}</button>`;
    };
    const none = pick ? `<button class="bgnone ${!s.special ? 'on' : ''}" data-a="spick" data-v="">${!s.special ? ICON.check : '—'}<span>Race without a special</span></button>` : '';
    $(this.root, '[data-k="bagbody"]').innerHTML = `
      <div class="spwallet">${ICON.coin}<b>${fmt(s.wallet)}</b><span class="bgrule">1 special per race</span></div>
      <div class="bhead out"><b>${pick ? 'Pick your special' : 'In your bag'}</b></div>
      <div class="bggrid">${SPECIALS.map(tile).join('')}</div>
      ${none}
      <button class="btn gold bgbuybtn" data-a="bagbuy">${ICON.coin} Buy items</button>
      <div class="bglocked">${LOCKED_SPECIALS.map((x) => `<button class="bgl" data-a="slocked" title="${esc(x.name)}"><span>${LOCKED_ICON[x.id]}</span><small>${x.short}</small></button>`).join('')}<span class="bglk">${ICON.lock}${classBadge('AAA')}</span></div>`;
    this.setAll('bagbadge', String(SPECIALS.reduce((a, k) => a + s.items[k], 0)));
    if (this.screens.bagbuy?.classList.contains('show')) this.buySync(s);
  }
  private bagPick = false;

  /** separate Buy popup: the 3 specials with coin prices */
  buySync(s: SaveData) {
    const row = (k: SpecialKey) => `<div class="bgbuy ${k}"><span class="spi">${ITEM_ICON[k]}</span><span class="bn"><b>${SPECIAL_SHORT[k]} <em>×${s.items[k]}</em></b><small>${SPECIAL_LINE[k]}</small></span><button class="btn sm ${s.wallet >= ITEM_PRICE[k] ? 'gold' : 'pink'}" data-a="sbuy" data-v="${k}">${ICON.coin}${fmt(ITEM_PRICE[k])}</button></div>`;
    $(this.root, '[data-k="buybody"]').innerHTML = `
      <div class="spwallet">${ICON.coin}<b>${fmt(s.wallet)}</b><span class="bgrule">Buy any amount · keep them in the bag</span></div>
      <div class="bgbuys">${SPECIALS.map(row).join('')}</div>
      <button class="btn ghost" data-a="closeov" data-v="bagbuy">${ICON.chevL} Back to the bag</button>`;
  }

  private shareText = '';
  /** shown when the native share sheet is not available (e.g. inside a preview frame) */
  sharePreview(blob: Blob | null, text: string) {
    this.shareText = text;
    const img = $<HTMLImageElement>(this.root, '[data-k="shpvimg"]');
    const a = $<HTMLAnchorElement>(this.root, '[data-k="shpvdl"]');
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    const u = blob ? URL.createObjectURL(blob) : '';
    img.src = u;
    img.hidden = !u;
    a.href = u;
    // inside a preview frame downloads are blocked: long-press the image instead
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true;
    }
    a.hidden = !u || framed;
    this.showOverlay('sharepv');
  }

  acctLine(t: string) {
    this.setAll('acctline', t);
  }

  /** Account popup: guest / signed in / cloud not configured */
  accountSync(o: { enabled: boolean; signedIn: boolean; email: string | null; providers: string[]; lastSync: number; codeFor?: string; busy?: boolean; msg?: string }) {
    const ago = (t: number) => {
      if (!t) return 'not yet';
      const m = Math.round((Date.now() - t) / 60000);
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
    };
    this.setAll('acctline', !o.enabled ? 'This device' : o.signedIn ? (o.email ?? o.providers[0] ?? 'Signed in') : 'Guest');
    const msg = o.msg ? `<p class="acmsg">${esc(o.msg)}</p>` : '';
    let body: string;
    if (!o.enabled) {
      body = `<div class="achero">☁️</div><p class="aclead">Cloud save is coming soon. For now your progress is saved <b>on this device</b> only.</p>
        <button class="btn" disabled>Sign in</button>`;
    } else if (o.signedIn) {
      body = `<div class="achero ok">${ICON.check}</div>
        <p class="aclead">Signed in${o.email ? ` as <b>${esc(o.email)}</b>` : ''}${o.providers.length ? ` · ${o.providers.map((p) => p[0].toUpperCase() + p.slice(1)).join(' · ')}` : ''}</p>
        <div class="acrow">${ICON.check}<span>Progress saved to the cloud · synced <b>${ago(o.lastSync)}</b></span></div>
        <p class="acsub">Reinstall or new phone? Sign in the same way and everything comes back.</p>${msg}
        <div class="td-row"><button class="btn" data-a="acsync">${ICON.retry} Sync now</button><button class="btn ghost" data-a="acout">Sign out</button></div>`;
    } else {
      body = `<p class="aclead">Sign in to keep your <b>rank, EXP, coins and cars</b> if you reinstall or change phone.</p>
        <button class="btn acg" data-a="acgoogle"><span class="aclogo">G</span> Continue with Google</button>
        <button class="btn aca" data-a="acapple"><span class="aclogo"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#fff" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg></span> Continue with Apple</button>
        <div class="acor"><span>or with email</span></div>
        ${o.codeFor
          ? `<p class="acsub">We sent a 6-digit code to <b>${esc(o.codeFor)}</b></p>
             <div class="acin"><input data-k="accode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code" /><button class="btn gold" data-a="acverify">Sign in</button></div>`
          : `<div class="acin"><input data-k="acemail" type="email" placeholder="you@email.com" autocomplete="email" /><button class="btn" data-a="acsend">Send code</button></div>`}
        ${msg}<p class="acsub">Until then, progress is saved as a guest on this device.</p>`;
    }
    $(this.root, '[data-k="acbody"]').innerHTML = `<div class="acbody ${o.busy ? 'busy' : ''}">${body}</div>`;
    this.showOverlay('account');
  }

  /** both this device and the cloud have progress: let the player pick */
  cloudChoice(device: { rank: RankClass; exp: number; coins: number; races: number }, cloud: { rank: RankClass; exp: number; coins: number; races: number }) {
    const card = (k: 'device' | 'cloud', t: string, s: typeof device) => `<button class="cpcard" data-a="ckeep" data-v="${k}">
      <small>${t}</small>${classBadge(s.rank, 'lg')}<b>${fmt(s.exp)} ${XPT}</b><span>${ICON.coin}${fmt(s.coins)} · ${fmt(s.races)} races</span><em>Keep this</em></button>`;
    $(this.root, '[data-k="cpbody"]').innerHTML = `<div class="mhead"><h2>☁️ WHICH PROGRESS?</h2></div>
      <p class="aclead">This phone and your account have different progress. Pick the one to keep — the other is replaced.</p>
      <div class="cpgrid">${card('device', 'THIS PHONE', device)}${card('cloud', 'ACCOUNT (CLOUD)', cloud)}</div>`;
    this.showOverlay('cloudpick');
  }

  /** confirm popup before taking a special into the race */
  spConfirm(k: SpecialKey) {
    $(this.root, '[data-k="spcbody"]').innerHTML = `
      <div class="spc-hero ${k}">${ITEM_ICON[k]}</div>
      <h2>Take ${SPECIAL_SHORT[k]}?</h2>
      <p class="spc-line">${SPECIAL_LINE[k]}. It is used only if you tap it in the race.</p>
      <div class="td-row">
        <button class="btn ghost" data-a="closeov" data-v="spconfirm">Cancel</button>
        <button class="btn gold" data-a="spok" data-v="${k}">${ICON.check} Take it</button>
      </div>`;
    this.showOverlay('spconfirm');
  }

  /** boost info card: what it does + equip + practice */
  /** item card (v2): what it does in one line, practice, buy — no long texts */
  boostSync(k: ItemKey, owned: number, equipped: boolean, wallet = 0) {
    void equipped;
    const sk = (SPECIALS as readonly string[]).includes(k) ? (k as SpecialKey) : null;
    $(this.root, '[data-k="binfo"]').innerHTML = `
      <div class="mhead"><h2>${(sk ? SPECIAL_SHORT[sk] : ITEM_NAME[k]).toUpperCase()}</h2><button class="icon-btn sm" data-a="closeov" data-v="boostinfo" aria-label="Close">${ICON.close}</button></div>
      <div class="bi-hero ${k}">${ITEM_ICON[k]}<span class="own">×${owned}</span></div>
      <p class="bi-one">${sk ? SPECIAL_HOW[sk] : BOOST_INFO[k].what}</p>
      ${sk ? `<button class="btn big" data-a="boosttrain" data-v="${k}">${ICON.target} Practice</button>` : ''}
      ${sk ? `<button class="btn ${wallet >= ITEM_PRICE[k] ? 'gold' : 'pink'}" data-a="sbuy" data-v="${k}">${ICON.coin}${fmt(ITEM_PRICE[k])} · Buy 1</button>` : ''}`;
  }

  settingsSync(s: SaveData, name: string, version: string) {
    void name;
    this.refreshProfile(s);
    this.setAll('sfoot', version);
  }

  private rowClass(r: LbRow, div?: RankClass) {
    return r.you ? this.myClass : div ?? classForScore(r.score);
  }
  private lbRow(r: LbRow, div?: RankClass, total = 0) {
    const cls = this.rowClass(r, div);
    const i = this.rowCache.push({ r, cls }) - 1;
    const unranked = r.you && r.score <= 0;
    const pct = total && r.rank > 100 && !unranked ? Math.max(0.1, (r.rank / total) * 100) : 0;
    return `<button class="lbrow ${r.you ? 'you' : ''} ${r.rank <= 3 ? `top${r.rank}` : ''}" data-a="viewp" data-i="${i}">
      <span class="lr"><small>RANK</small><b>${unranked ? '—' : `#${fmt(r.rank)}`}</b>${pct ? `<em>Top ${pct < 1 ? pct.toFixed(1) : Math.ceil(pct)}%</em>` : ''}</span>
      <span class="ava img sm rk-${cls}">${avatarSvg(r.av ?? avatarForName(r.name))}</span>
      <span class="ln"><b class="${r.pass ? 'gold' : ''}">${esc(r.name)}${r.you ? ' <em>YOU</em>' : ''}</b><small>${r.flag} ${classBadge(cls)}</small></span>
      <span class="ls">${fmt(r.score)}${XPT}</span></button>`;
  }

  ranksSync(board: Board, tab: 'week' | 'all', extra: string) {
    this.root.querySelectorAll<HTMLElement>('[data-a="ranktab"]').forEach((b) => b.classList.toggle('on', b.dataset.v === tab));
    this.rowCache = [];
    const top = board.rows.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    $(this.root, '[data-k="podium"]').innerHTML = order
      .map((r) => {
        const cls = this.rowClass(r);
        const i = this.rowCache.push({ r, cls }) - 1;
        return `<button class="pod p${r.rank} ${r.you ? 'you' : ''}" data-a="viewp" data-i="${i}">${avaHtml(r.av ?? avatarForName(r.name), cls, '', r.rank === 1 ? `<i class="crown">${ICON.crown}</i>` : '')}<b>${esc(r.name)}</b><small>${r.flag} ${fmt(r.score)}${XPT}</small><span class="step">#${r.rank}</span></button>`;
      })
      .join('');
    $(this.root, '[data-k="lblist"]').innerHTML = board.rows.slice(3).map((r) => this.lbRow(r)).join('') + (SAMPLE_BOARD_NOTE ? `<div class="lbnote">${extra}</div>` : '');
    const y = board.you;
    const pct = Math.max(0.1, (y.rank / board.total) * 100);
    $(this.root, '[data-k="lbyou"]').innerHTML = `${this.lbRow(y, undefined, board.total)}<div class="lbnext">${y.score <= 0 ? 'Play a run to get ranked' : board.next ? `Top ${pct < 1 ? pct.toFixed(1) : Math.ceil(pct)}% · EXP <b>${fmt(board.next.score)}</b> to reach <b>#${fmt(board.next.rank)}</b>` : 'You are #1!'}</div>`;
  }

  dailySync(o: { slot: number; claimedToday: boolean; streak: number; quests: (Quest & { progress: number; done: boolean; claimed: boolean })[]; pts: number; chests: number[]; resetIn: string; pass: { active: boolean; claimed: boolean; days: number } }) {
    this.setAll('cistreak', `Streak ${o.streak} / 7`);
    $(this.root, '[data-k="cigrid"]').innerHTML = checkinGrid(o.slot, o.claimedToday);
    const btn = $(this.root, '[data-k="cibtn"]');
    btn.toggleAttribute('disabled', o.claimedToday);
    btn.innerHTML = o.claimedToday ? `${ICON.check} Come back tomorrow` : `${ICON.gift} Claim day ${o.slot + 1}`;
    const pr = $(this.root, '[data-k="passrow"]');
    pr.hidden = true; // v2: no XWAVE Pass (the shop sells only coins)
    pr.innerHTML = o.pass.active
      ? `<div class="passin">${ICON.crown}<div><b>XWAVE Pass</b><small>${o.pass.days} days left · 300 coins + 1 Roadster Jump every day</small></div><button class="btn sm gold" data-a="claimpass" ${o.pass.claimed ? 'disabled' : ''}>${o.pass.claimed ? 'Claimed' : 'Claim'}</button></div>`
      : `<div class="passin">${ICON.crown}<div><b>XWAVE Pass</b><small>300 coins + Roadster Jump every day · ×2 quest coins</small></div><button class="btn sm gold" data-a="buy" data-sku="xwave_pass">$4.99</button></div>`;
    this.setAll('dreset', `resets in ${o.resetIn}`);
    $(this.root, '[data-k="qlist"]').innerHTML = o.quests
      .map((q) => `<div class="quest ${q.claimed ? 'claimed' : q.done ? 'done' : ''}">
        <div class="qt"><b>${q.text}</b><span class="qr"><span class="rchip">${ICON.coin}${q.coins}</span></span></div>
        <div class="qb"><div class="track"><i style="width:${Math.min(100, (q.progress / q.target) * 100)}%"></i></div><span>${fmt(q.progress)}/${fmt(q.target)}</span>
        ${q.claimed ? `<i class="ok">${ICON.check}</i>` : q.done ? `<button class="btn sm green" data-a="claimq" data-id="${q.id}">Claim</button>` : ''}</div></div>`)
      .join('');
  }

  eventsSync(o: {
    cls: RankClass; bolts: number; live: boolean; mine: EventInst; now: number; best: number; rank: number | null; total: number;
    divisions: { div: RankClass; cup: EventInst; open: boolean; need: number }[]; prizes: Prize[];
    upcoming: { start: number; cup: EventInst }[]; trophies: SaveData['trophies']; boardOpen: boolean; board?: Board;
  }) {
    this.myClass = o.cls;
    const e = o.mine;
    const c = e.cup;
    const top = o.prizes[0];
    const hero = $(this.root, '[data-k="cuphero"]');
    hero.style.setProperty('--cc', c.color);
    hero.innerHTML = `
      <div class="ch-top">${o.live ? '<em class="live">LIVE</em>' : '<em class="soon">NEXT</em>'}${classBadge(e.division)}<span class="label">${ICON.clock} ${o.live ? `ends in <b>${fmtLeft(e.end - o.now)}</b>` : `starts <b>${localTime(e.start)}</b> · in <b>${fmtLeft(e.start - o.now)}</b>`}</span></div>
      <div class="ch-name">${c.name}</div>
      <div class="ch-tag">Class ${e.division} division · ${c.tag}</div>
      <div class="ch-prize">${ICON.hyper}<div><b>#1 wins HYPER JUMP ×${top.hyper}</b><small>+ ${fmt(top.coins)} coins + Gold trophy · run bolts ×2 while it is live</small></div></div>
      <div class="ch-stats"><div><span class="label">Your best</span><b>${o.best ? fmt(o.best) : '—'}</b></div><div><span class="label">Your rank</span><b>${o.rank ? `#${fmt(o.rank)}` : '—'}</b></div><div><span class="label">Racers</span><b>${fmt(o.total)}</b></div></div>
      <div class="ch-btns">${o.live ? `<button class="btn big" data-a="racecup">${ICON.play} Race now</button>` : `<button class="btn big ghost" disabled>${ICON.clock} Opens ${localTime(e.start)}</button>`}<button class="btn sm ghost" data-a="cupboard">${ICON.podium} ${o.boardOpen ? 'Hide' : 'Standings'}</button></div>`;
    const cb = $(this.root, '[data-k="cupboard"]');
    cb.hidden = !o.boardOpen || !o.board;
    this.rowCache = [];
    if (o.board) {
      const b = o.board;
      const rows = b.rows.slice(0, 10).map((r) => this.lbRow(r, e.division)).join('');
      cb.innerHTML = `<div class="bhead"><b>Standings · class ${e.division}</b><span class="label">top 10 · tap a pilot</span></div>${rows}${b.you.rank > 10 ? `<div class="lbgap">···</div>${this.lbRow(b.you, e.division)}` : ''}`;
    }
    $(this.root, '[data-k="prizes"]').innerHTML = o.prizes
      .map((p) => `<div class="prize ${p.trophy ?? ''}"><span class="pl">${p.trophy ? ICON.cup : ''}${p.label}</span><span class="pr"><span class="rchip bolt">${BOLT}${p.bolts}</span>${p.hyper ? `<span class="rchip hyper">${ICON.hyper}×${p.hyper}</span>` : ''}${p.superJ ? `<span class="rchip super">${ICON.rocket}×${p.superJ}</span>` : ''}<span class="rchip">${ICON.coin}${fmt(p.coins)}</span></span></div>`)
      .join('');
    $(this.root, '[data-k="divisions"]').innerHTML = o.divisions
      .map((d) => `<div class="divc ${d.open ? 'open' : CLASSES.indexOf(d.div) < CLASSES.indexOf(o.cls) ? 'past' : 'locked'}" style="--cc:${CLASS_COLOR[d.div]}">${classBadge(d.div, 'md')}<small>${d.open ? d.cup.cup.name : CLASSES.indexOf(d.div) < CLASSES.indexOf(o.cls) ? 'Moved up' : `${ICON.lock} ${BOLT}${fmt(d.need)}`}</small></div>`)
      .join('');
    $(this.root, '[data-k="upcoming"]').innerHTML = o.upcoming
      .map((u) => `<div class="upc" style="--cc:${u.cup.cup.color}"><span class="ci">${ICON.cup}</span><div><b>${classBadge(u.cup.division)} ${u.cup.cup.name}</b><small>${u.cup.cup.tag} · ${localTime(u.start)}</small></div><span class="starts"><small>starts in</small><b>${fmtLeft(u.start - o.now)}</b></span></div>`)
      .join('');
    const t = o.trophies;
    $(this.root, '[data-k="trophies"]').innerHTML = `<span class="label">Trophy cabinet</span><span class="tro gold">${ICON.cup}${t.gold}</span><span class="tro silver">${ICON.cup}${t.silver}</span><span class="tro bronze">${ICON.cup}${t.bronze}</span>`;
  }

  shopSync(s: SaveData) {
    const card = (p: Product) => {
      const owned = (p.sku === 'no_ads' && s.noAds) || (p.sku === 'starter_pack' && s.starterBought);
      const passOn = p.sku === 'xwave_pass' && s.passUntil > Date.now();
      return `<div class="pcard ${p.kind} art-${p.art} ${owned ? 'owned' : ''}">
        ${p.badge ? `<em class="pbadge">${p.badge}</em>` : ''}
        <div class="part">${this.productArt(p)}</div>
        <div class="pinfo"><b>${p.name}</b><small>${p.desc}</small>${p.kind === 'bundle' || p.sku === 'starter_pack' ? `<em class="pworth">${ICON.coin} worth ${fmt(rewardValue(p.grant))} coins</em>` : ''}</div>
        <button class="btn sm ${p.kind === 'coins' ? 'blue' : 'gold'} pbuy" data-a="buy" data-sku="${p.sku}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : passOn ? `Extend · ${p.price}` : p.price}</button></div>`;
    };
    const specials = PRODUCTS.filter((p) => p.kind !== 'coins' && !(p.once && p.sku === 'starter_pack' && s.starterBought));
    const coins = PRODUCTS.filter((p) => p.kind === 'coins');
    const inv = (SPECIALS as readonly ItemKey[]).map((k) => `<span class="rchip ${k}">${ITEM_ICON[k]}×${s.items[k]}</span>`).join('');
    $(this.root, '[data-k="shoplist"]').innerHTML = `
      <div class="inv panel"><span class="label">Your items</span>${inv}</div>
      ${specials.map(card).join('')}
      <div class="bhead out"><b>Coins</b></div>
      <div class="coingrid">${coins.map(card).join('')}</div>
      <div class="label shopnote">Demo store — purchases are simulated, no payment is taken.</div>`;
    this.setAll('wallet', fmt(s.wallet));
  }

  private productArt(p: Product) {
    switch (p.art) {
      case 'starter': return `<span class="stack">${ICON.coin}${ICON.rocket}${ICON.hyper}</span>`;
      case 'pass': return ICON.crown;
      case 'noads': return ICON.noads;
      case 'jumps': return `<span class="stack">${ICON.rocket}${ICON.hyper}</span>`;
      case 'hyper': return ICON.hyper;
      case 'escape': return ICON.sos;
      default: {
        const n = { 'coins-s': 1, 'coins-m': 2, 'coins-l': 3, 'coins-xl': 4 }[p.art] ?? 1;
        return `<span class="coins n${n}">${ICON.coin.repeat(n)}</span>`;
      }
    }
  }

  eventResults(list: EventResult[]) {
    $(this.root, '[data-k="eventres"]').innerHTML = list
      .map((r) => `<div class="eres" style="--cc:${r.inst.cup.color}"><b>${classBadge(r.inst.division)} ${r.inst.cup.name}</b><div class="erank">#${fmt(r.rank)}</div><small>Your best ${fmt(r.score)} · ${r.prize.label}</small>
        <div class="erew"><span class="rchip bolt">${BOLT}${r.prize.bolts}</span>${r.prize.trophy ? `<span class="rchip ${r.prize.trophy}">${ICON.cup}${r.prize.trophy}</span>` : ''}${rewardChips({ coins: r.prize.coins, items: { hyper: r.prize.hyper, super: r.prize.superJ ?? 0 } })}</div></div>`)
      .join('');
  }

  /** result-screen rewards box (compact): coins total + breakdown, EXP + rank bar, standings */
  private rewardsHtml(r: RunRewards | null, coins: { label: string; coins: number }[]) {
    const parts = coins.filter((c) => c.coins > 0).map((c) => ({ label: c.label, n: c.coins }));
    if (r) for (const m of r.missions) parts.push({ label: 'mission', n: m.reward });
    const total = parts.reduce((a, p) => a + p.n, 0);
    const rows: string[] = [];
    if (total > 0) rows.push(`<div class="rw-line"><span class="rl">${ICON.coin} Coins</span><span class="rs">${parts.map((p) => `${fmt(p.n)} ${esc(p.label.toLowerCase())}`).join(' · ') || '—'}</span><b class="c">+${fmt(total)}</b></div>`);
    if (!r) return rows.length ? `<div class="rw-h"><b>Rewards</b></div>${rows.join('')}` : '';
    // (this race's EXP is the big number at the top of the END screen)
    const ci = CLASSES.indexOf(r.clsAfter);
    const next = CLASSES[ci + 1] ?? null;
    const lo = CLASS_MIN[r.clsAfter];
    const hi = next ? CLASS_MIN[next] : lo;
    const kTo = next ? Math.min(1, (r.to - lo) / (hi - lo)) : 1;
    const kFrom = next && r.clsAfter === r.clsBefore ? Math.max(0, Math.min(1, (r.from - lo) / (hi - lo))) : 0;
    const up = r.clsAfter !== r.clsBefore;
    rows.push(`<div class="rw-bar ${up ? 'up' : ''}" style="--cc:${CLASS_COLOR[r.clsAfter]}">${classBadge(r.clsAfter)}<div class="bar"><i class="old" style="width:${(kFrom * 100).toFixed(1)}%"></i><i class="new" style="left:${(kFrom * 100).toFixed(1)}%;width:${((kTo - kFrom) * 100).toFixed(1)}%"></i></div>${next ? classBadge(next) : ''}<small>${up ? `<b class="upt">RANK UP!</b>` : next ? `${fmt(hi - r.to)} EXP to ${next}` : 'top'}</small></div>`);
    const chips: string[] = [];
    if (r.cup) chips.push(`<span>${ICON.cup} ${classBadge(r.cup.div)} #${fmt(r.cup.rank)}</span>`);
    for (const q of r.quests) chips.push(`<span class="qd" title="${esc(q)}">${ICON.check}<em>${esc(q)}</em></span>`);
    if (chips.length) rows.push(`<div class="rw-chips">${chips.join('')}</div>`);
    return `<div class="rw-h"><b>Rewards</b><button class="linkbtn" data-a="rankguide">${ICON.info} EXP guide</button></div>${rows.join('')}`;
  }

  /** EXP & rank guide: rank · EXP needed · what it unlocks. EXP can not be bought. */
  rankGuide() {
    const car = (id: string, n: string) => `<span class="ul"><img src="${CAR_IMG[id]}" alt="" />${n}</span>`;
    const road = (n: string) => `<span class="ul">${ICON.flag}${n}</span>`;
    const UNL: Record<RankClass, string> = {
      D: car('zenith', 'Zenith'),
      C: car('vega', 'Vega'),
      B: car('volt', 'Volt'),
      A: car('phantom', 'Phantom'),
      AA: car('inferno', 'Inferno'),
      AAA: `${car('nexus', 'Nexus')}${road('Mega Rush')}<span class="ul">${ICON.rocket}AAA specials</span>`,
      S: road('Ocean Drive'),
      SS: road('Volcano Run'),
      SSS: road('Aurora Peak'),
    };
    const ladder = CLASSES.map((c) => `<tr><td>${classBadge(c, 'md')}</td><td>${fmt(CLASS_MIN[c])}</td><td class="uls">${UNL[c]}</td></tr>`).join('');
    $(this.root, '[data-k="rgbody"]').innerHTML = `
      <table class="rgt"><thead><tr><th>Rank</th><th>EXP</th><th>Unlocks</th></tr></thead><tbody>${ladder}</tbody></table>
      <div class="rg-line">${XPT}<span>= metres × <b>Hard 1.7 · Normal 1.05 · Easy 1</b></span></div>
      <div class="rg-line">${ICON.lock}<span>EXP can't be bought</span></div>
`;
    this.screens.rankguide.classList.add('show');
  }

  /** tooltip under the speed selector: what the level means + its reward tier */
  /** one-line description of the selected speed level, always shown under the selector (never covers a button) */
  speedTip(k: 'easy' | 'normal' | 'hard') {
    const t = $(this.root, '[data-k="speedtip"]');
    const L = LEVELS[k];
    t.innerHTML = `<b>${L.label}</b> ${L.desc}`;
    t.dataset.v = k;
  }


  /** reward popups (image-2 style): daily reward · watch-ad reward · welcome-back gift */
  popup(kind: 'daily' | 'ad' | 'gift' | 'entry' | 'launch' | 'share' | 'invite' | 'rate' | 'addscreen' | 'offline', d: Record<string, unknown>) {
    const head = (icon: string, title: string, cls: string) => `<div class="p3h"><span class="p3i ${cls}">${icon}</span><h2>${title}</h2><button class="icon-btn sm" data-a="closeov" data-v="popup" aria-label="Close">${ICON.close}</button></div>`;
    let html = '';
    if (kind === 'daily') {
      const slot = Number(d.slot);
      const claimed = !!d.claimed;
      html = head(calendarGift(44), 'DAILY REWARD', 'art') + checkinList(slot, claimed) +
        (claimed ? `<button class="btn big ghost" disabled>${ICON.check} Come back tomorrow</button>` : `<button class="btn big blue" data-a="popa" data-v="claimdaily">CLAIM</button>`) +
        `<div class="label p3foot">Streak ${Number(d.streak)} / 7 · missing a day restarts at Day 1</div>`;
    } else if (kind === 'ad') {
      const left = Number(d.left);
      html = head(ICON.play, 'WATCH AD REWARD', 'gold') +
        `<p class="p3t">Watch an ad to get</p><div class="pzbig">${coinPile(230, 126)}${amount(`x${fmt(Number(d.amount))}`, 'xl')}</div>` +
        (left > 0 ? `<button class="btn big gold" data-a="popa" data-v="watchad">${ICON.play} WATCH AD</button>` : `<button class="btn big ghost" disabled>${ICON.clock} Come back tomorrow</button>`) +
        `<div class="label p3foot">${left > 0 ? `${left} left today` : 'All free rewards used today'}</div>`;
    } else if (kind !== 'gift') {
      html = this.perkPopup(kind, d, head);
    } else {
      html = head(giftBox(46), 'REVISIT GIFT', 'art') +
        `<p class="p3t">Welcome back!<br/>Here's a gift for you!</p>
        <div class="pzbig">${coinPile(230, 126)}${amount(`x${fmt(Number(d.coins))}`, 'xl')}</div>
        ${Number(d.shield) ? `<div class="pzplus">+ <span class="rchip shield">${ICON.shield}×${Number(d.shield)} Start Shield</span></div>` : ''}
        <button class="btn big gold" data-a="popa" data-v="gift">CLAIM</button>`;
    }
    $(this.root, '[data-k="popbody"]').innerHTML = html;
    this.screens.popup.classList.add('show');
  }

  private perkPopup(kind: string, d: Record<string, unknown>, head: (icon: string, title: string, cls: string) => string) {
    // illustrated step cards (mock-up style): purple number, caption, art strip under it
    const step = (n: number, text: string, done: boolean, art = '', act = '') =>
      `<div class="pzs ${done ? 'done' : ''}"><i class="pzn">${done ? ICON.check : n}</i><div class="pzb"><span>${text}</span>${art ? (act ? `<button class="pza tap" data-a="${act}">${art}</button>` : `<div class="pza">${art}</div>`) : ''}</div></div>`;
    const coinBanner = (n: unknown) => `<div class="pzcoins">${coinPile(150, 72)}${amount(`x${fmt(Number(n))}`)}</div>`;
    const hand = `<span class="pzhand">${ICON.hand}</span>`;
    const av = Number(d.avatar ?? 0);
    switch (kind) {
      case 'entry': {
        const st = d.entrySteps as boolean[];
        const all = st.every(Boolean);
        const done = !!d.entry;
        const name = esc(String(d.name || 'Pilot name'));
        const explore = [
          ['daily', ICON.calendar, 'Daily'], ['shop', ICON.bag, 'Shop'], ['garage', ICON.engine, 'Garage'],
          ['help', TUT_ICON, 'Tutorial'], ['play', ICON.flag, 'Race'], ['events', ICON.cup, 'Cups'],
        ];
        return head(giftBox(46), 'ENTRY REWARD', 'art') +
          `<div class="pzsteps">
            ${step(1, 'Open your pilot profile', st[0], `<div class="pzrow"><span class="pztile plus">${ICON.plus}</span><span class="pztile chat">${ICON.user}<em>99+</em></span><span class="pztile ava on">${avatarSvg(av)}${tapMarks()}</span></div>`, 'profile')}
            ${step(2, 'Set your pilot name', st[1], `<div class="pzbanner"><img src="${logoUrl}" alt="" /><span class="pzname">${name}</span><span class="pzmenu">≡</span></div>`, 'profile')}
            ${step(3, 'Pick your racing helmet', st[2], `<div class="pzcard"><img src="${carImage('zenith')}" alt="" /><span class="pzhelm">${avatarSvg(av)}</span>${hand}${tapMarks('r')}</div>`, 'profile')}
            ${step(4, 'Claim your rewards', done, coinBanner(d.entryReward))}
          </div>` +
          (done
            ? `<div class="pzdone">${ICON.check} Reward claimed — explore Sky Roadster</div>
               <div class="pzgo">${explore.map(([a, ic, t]) => `<button data-a="popgo" data-v="${a}"><span>${ic}</span><b>${t}</b></button>`).join('')}</div>`
            : all ? `<button class="btn big gold" data-a="popa" data-v="entry">CLAIM</button>` : `<button class="btn big blue" data-a="profile">${ICON.user} OPEN PROFILE</button>`);
      }
      case 'launch': {
        const sa = !!d.standalone;
        const done = !!d.launch;
        return head(megaphone(46), 'LAUNCH REWARD', 'art') +
          `<div class="pzsteps">
            ${step(1, 'Click the button below', sa, `<div class="pzgobtn"><button class="btn blue" data-a="popa" data-v="go:addscreen">${ICON.play} GO</button>${hand}${tapMarks('r')}</div>`)}
            ${step(2, 'Open Sky Roadster from your Home Screen', sa, `<div class="pzapps"><span class="pzgrid"><i></i><i></i><i></i><i></i></span><span class="pzarrow">→</span><img class="pzicon" src="${appIcon}" alt="" /></div>`)}
            ${step(3, 'Claim your rewards', done, coinBanner(d.launchReward))}
          </div>` +
          (done ? `<button class="btn big ghost" disabled>${ICON.check} Claimed</button>` : sa ? `<button class="btn big gold" data-a="popa" data-v="launch">CLAIM</button>` : `<button class="btn big blue" data-a="popa" data-v="go:addscreen">GO</button>`);
      }
      case 'share': {
        const done = !!d.shareToday;
        return head(shareNodes(46), 'SHARE REWARDS', 'art') +
          `<button class="pzshare" data-a="popa" data-v="share"><img src="${carImage(String(d.vehicle ?? 'zenith'))}" alt="" /><span class="pzhelm">${avatarSvg(av)}</span>${hand}${tapMarks('r')}<em>${ICON.share} Tap to share your card</em></button>
          <div class="pzcoins">${coinPile(150, 72)}${amount(`+${fmt(Number(d.shareReward))}`)}</div>` +
          (done ? `<button class="btn big green" data-a="popa" data-v="share">${ICON.share} SHARE AGAIN</button><div class="label p3foot">✓ Reward taken today · new one tomorrow</div>` : `<button class="btn big green" data-a="popa" data-v="share">${ICON.share} SHARE</button>`) +
          `<button class="linkbtn center" data-a="popa" data-v="go:invite">Invite friends instead →</button>`;
      }
      case 'invite': {
        const done = !!d.inviteToday;
        const side = (who: string) => `<div class="pzinv"><span class="pzppl">${friends(70)}</span><span class="pzinvc">${coinFace(30)}</span><b>${who}</b>${amount(`x${fmt(Number(d.inviteReward))}`, 'sm')}</div>`;
        return head(friends(42, '#4fc3ff'), 'INVITE FRIENDS', 'art') +
          `<p class="p3t">Invite friends to play<br/>and get rewards!</p>
          <div class="pzinvrow">${side('YOU')}<span class="pzlink">🔗</span>${side('FRIEND')}</div>` +
          (done ? `<button class="btn big ghost" disabled>${ICON.check} Invite sent today</button>` : `<button class="btn big green" data-a="popa" data-v="invite">🔗 INVITE</button>`) +
          `<div class="label p3foot">${Number(d.invites)} friends invited</div>`;
      }
      case 'rate':
        return head(starBig(40), 'RATE US', 'art') +
          `<p class="p3t">Enjoying Sky Roadster?<br/>Give us a 5-star rating!</p>
          <div class="pzstars">${[1, 2, 3, 4, 5].map((n) => `<button data-a="popa" data-v="rate${n}" aria-label="${n} stars">${starBig(44)}</button>`).join('')}</div>
          <button class="btn big blue" data-a="popa" data-v="rate5">RATE NOW</button>
          <button class="btn big dark" data-a="closeov" data-v="popup">NOT NOW</button>`;
      case 'addscreen': {
        const can = !!d.canInstall;
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const sheet = [
          [`<span class="pzsq on">${ICON.plus}</span>`, 'Add to<br/>Home Screen', 'install'], [`<span class="pzsq">${ICON.share}</span>`, 'Share', 'sharelink'],
          [`<span class="pzsq">🔗</span>`, 'Copy Link', 'copylink'], [`<span class="pzsq">•••</span>`, 'More', 'sharelink'],
        ];
        return head(phonePlus(44), 'ADD TO SCREEN', 'art') +
          `<p class="p3t">Add Sky Roadster to your<br/>Home Screen for faster access!</p>
          <div class="pzphone"><i class="notch"></i><div class="pzsheet">${sheet.map(([ic, t, a]) => `<button class="pztile2" data-a="popa" data-v="${a}">${ic}<small>${t}</small></button>`).join('')}</div>
            <ol class="pzol">${ios ? '<li>Tap <b>Share</b></li><li>Select <b>Add to Home Screen</b></li>' : '<li>Tap the browser menu <b>⋮</b></li><li>Select <b>Install app</b> / <b>Add to Home screen</b></li>'}<li>Find Sky Roadster on your Home Screen</li></ol></div>` +
          (can ? `<button class="btn big blue" data-a="popa" data-v="install">INSTALL NOW</button>` : `<button class="btn big blue" data-a="closeov" data-v="popup">GOT IT</button>`);
      }
      default:
        return head(`<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="#fff"/></svg>`, 'NO CONNECTION', 'red') +
          `<p class="p3t">Please check your internet<br/>connection and try again.</p>
          <div class="pzbig robot">${wifiRobot(200, 132)}</div>
          <button class="btn big blue" data-a="popa" data-v="retry">${ICON.retry} RETRY</button>
          <div class="label p3foot">You can still race offline — cups sync when you're back.</div>`;
    }
  }

  perkBadges(o: Record<'entry' | 'launch' | 'share', 'todo' | 'ready' | 'done'>) {
    // v3.0.11: a reward button shows only while its reward can still be earned (Entry / Launch: not
    // claimed; Share: not yet rewarded today — it comes back the next day). The rail keeps the
    // visible ones centred and glides them to their new place (FLIP, 200 ms).
    const rail = this.root.querySelector<HTMLElement>('.rail.right');
    const btns = rail ? Array.from(rail.querySelectorAll<HTMLElement>('.rbtn')) : [];
    const before = new Map(btns.map((b) => [b, b.getBoundingClientRect().top]));
    for (const [k, st] of Object.entries(o)) {
      const b = this.root.querySelector<HTMLElement>(`[data-k="pk-${k}"]`);
      if (!b) continue;
      b.hidden = st === 'done';
      b.classList.toggle('done', st === 'done');
      const e = b.querySelector<HTMLElement>('.badge');
      if (e) e.hidden = st !== 'ready' || k === 'share'; // no '!' on Share
    }
    if (rail) {
      rail.hidden = btns.every((b) => b.hidden);
      for (const b of btns) {
        const t0 = before.get(b);
        if (b.hidden || t0 === undefined || !t0) continue;
        const dy = t0 - b.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) continue;
        b.animate?.([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
  }

  /** country picker: search + list (auto-detected by IP until the player picks) */
  countryPicker() {
    const list = [...COUNTRIES].map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n));
    $(this.root, '[data-k="popbody"]').innerHTML = `<div class="p3h"><span class="p3i blue">🌍</span><h2>COUNTRY</h2><button class="icon-btn sm" data-a="closeov" data-v="popup" aria-label="Close">${ICON.close}</button></div>
      <input class="ctrysearch" data-k="ctryq" placeholder="Search country…" aria-label="Search country" />
      <div class="ctrylist" data-k="ctrylist">${list.map(({ c, n }) => `<button class="ctryopt" data-a="setcountry" data-v="${c}" data-n="${n.toLowerCase()}"><span class="fl">${flagOf(c)}</span><span>${n}</span></button>`).join('')}</div>`;
    this.screens.popup.classList.add('show');
    const q = $<HTMLInputElement>(this.root, '[data-k="ctryq"]');
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      this.root.querySelectorAll<HTMLElement>('.ctryopt').forEach((b) => (b.hidden = !!v && !b.dataset.n!.includes(v) && !b.dataset.v!.toLowerCase().startsWith(v)));
    });
  }

  /** language picker (6 basic languages) */
  langPicker() {
    const cur = getLang();
    $(this.root, '[data-k="popbody"]').innerHTML = `<div class="p3h"><span class="p3i blue">🌐</span><h2>LANGUAGE</h2><button class="icon-btn sm" data-a="closeov" data-v="popup" aria-label="Close">${ICON.close}</button></div>
      <div class="langgrid">${LANGS.map((l) => `<button class="langopt ${l.code === cur ? 'on' : ''}" data-a="setlang" data-v="${l.code}"><span class="fl">${l.flag}</span><span>${l.name}</span>${l.code === cur ? ICON.check : ''}</button>`).join('')}</div>`;
    this.screens.popup.classList.add('show');
  }

  applyLang(code: string) {
    const l = LANGS.find((x) => x.code === code) ?? LANGS[0];
    setLang(l.code as Lang, this.root);
    this.setAll('langflag', l.flag);
    this.setAll('langname', l.name);
  }

  closePopup() {
    this.screens.popup.classList.remove('show');
  }

  needRocket(o: { owned: number; wallet: number; price: number }) {
    const b: string[] = [];
    if (o.owned > 0) b.push(`<button class="btn big" data-a="rocketfix" data-v="use">${ICON.rocket} Use one · you own ×${o.owned}</button>`);
    b.push(o.wallet >= o.price
      ? `<button class="btn gold" data-a="rocketfix" data-v="buy">Buy 1 · <span class="price">${ICON.coin}${fmt(o.price)}</span></button>`
      : `<button class="btn pink" data-a="rocketfix" data-v="shop">${ICON.bag} Get Roadster Jumps</button>`);
    b.push(`<button class="btn ghost sm" data-a="rocketfix" data-v="retry">${ICON.retry} Retry & collect the rocket</button>`);
    $(this.root, '[data-k="nrbtns"]').innerHTML = b.join('');
  }

  /** danger-assist arrow (null hides) */
  /** the player did the hinted move: quick confirm + fade out */
  dangerOk() {
    const d = $(this.root, '[data-k="danger"]');
    d.classList.add('ok');
    window.setTimeout(() => {
      d.hidden = true;
      d.classList.remove('ok');
    }, 260);
  }

  /** the ROADSTER button lights up (steady glow + "TAP!") when a jump is the way through */
  private rocketReady = false;
  /** training: ROADSTER tapped before the blockade — nudge the button and explain */
  rocketWait() {
    const b = $(this.root, '[data-k="rocketbtn"]');
    b.classList.remove('wait');
    void b.offsetWidth;
    b.classList.add('wait');
    this.toast(`${ICON.rocket} Save it! Tap ROADSTER when the button lights up`, '#9b6bff');
  }

  danger(hint: string | null) {
    this.rocketReady = hint === 'rocket';
    $(this.root, '[data-k="rocketbtn"]').classList.toggle('ready', this.rocketReady);
    const d = $(this.root, '[data-k="danger"]');
    d.classList.remove('ok');
    const sos = $(this.root, '[data-k="sosbtn"]');
    sos.classList.toggle('urgent', hint === 'sos');
    if (hint === 'rocket') {
      d.className = 'danger rocket';
      $(this.root, '[data-k="dgarrow"]').innerHTML = ICON.rocket;
      this.setAll('dgtxt', 'ROADSTER');
      d.hidden = false;
      return;
    }
    if (!hint || hint === 'sos') {
      d.hidden = hint !== 'sos';
      if (hint === 'sos') {
        d.className = 'danger sosh';
        $(this.root, '[data-k="dgarrow"]').innerHTML = ICON.sos;
        this.setAll('dgtxt', 'TAP SOS!');
      }
      return;
    }
    // thin chevron icon, placed at the screen edge on the side of the move
    const rot: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
    d.className = `danger dir-${hint}`;
    $(this.root, '[data-k="dgarrow"]').innerHTML = `<svg viewBox="0 0 24 24" style="transform:rotate(${rot[hint]}deg)"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    this.setAll('dgtxt', hint.toUpperCase());
    d.hidden = false;
  }

  rewardToast(title: string, r: Reward) {
    this.toast(`${ICON.gift} ${title} ${rewardChips(r)}`, 'var(--gold)');
  }
}
