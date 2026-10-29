/** v3 native UI — shared icons / names (mirrors the DOM UI's constants) */
import { ICON } from '../../ui/icons.ts';
import type { ItemKey, SpecialKey } from '../../meta/Daily.ts';
import { XPT } from '../../meta/Rank.ts';

export const BAG_ICON = `<svg viewBox="0 0 24 24"><defs><linearGradient id="bgp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98bff"/><stop offset="1" stop-color="#6a2ee0"/></linearGradient></defs><path d="M8.3 7.4C5 9.6 3.6 13 4.3 16.4c.7 3.2 3.6 4.8 7.7 4.8s7-1.6 7.7-4.8c.7-3.4-.7-6.8-4-9z" fill="url(#bgp)" stroke="#2a1060" stroke-width="1.1" stroke-linejoin="round"/><path d="M8.6 7.4c-.9-1.6-.3-3.4 1.3-3.4 1 0 1.3.7 2.1.7s1.1-.7 2.1-.7c1.6 0 2.2 1.8 1.3 3.4z" fill="#8a52f0" stroke="#2a1060" stroke-width="1.1" stroke-linejoin="round"/><rect x="7.6" y="6.8" width="8.8" height="1.9" rx=".9" fill="#ffd23d" stroke="#7a4a00" stroke-width=".6"/><path d="M12 11.2l1.05 2.15 2.35.33-1.7 1.66.4 2.34L12 16.6l-2.1 1.08.4-2.34-1.7-1.66 2.35-.33z" fill="#ffe680"/><circle cx="17.6" cy="11" r=".8" fill="#fff"/><circle cx="6.6" cy="13.4" r=".55" fill="#fff" opacity=".8"/></svg>`;
export const TUT_ICON = `<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M10.2 8.3a2 2 0 1 1 2.6 1.9c-.5.2-.8.6-.8 1.1v.6"/><path d="M12 14.4h.01"/></g></svg>`;
export const ROCKET_W = `<svg viewBox="0 0 24 24"><path d="M14.8 3.2c2.9-.6 5.4-.4 6 .2.6.6.8 3.1.2 6-.6 3-2.6 5.8-5.3 7.7l.3 2.6-2.6 2-1.1-3.2-3.6-3.6-3.2-1.1 2-2.6 2.6.3C11 8.8 11.8 3.8 14.8 3.2z" fill="#fff"/><circle cx="16" cy="8" r="1.8" fill="#2c4a9a"/><path d="M6.5 14.8c-1.6.4-2.8 2.4-3 5.7 3.3-.2 5.3-1.4 5.7-3z" fill="#7fe6ff"/></svg>`;
export const CAR_LINE = `<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><circle cx="5.5" cy="16.5" r="3.2"/><circle cx="18.5" cy="16.5" r="3.2"/><path d="M5.5 16.5 9.5 10h5l3 3.5-4.5 3H9.5l-2-4"/><path d="M13.5 7.5h3l2 2.5"/></g></svg>`;
export const ARROW = (deg: number) => `<svg viewBox="0 0 24 24"><g transform="rotate(${deg} 12 12)"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
export const CHEV = (deg: number) => `<svg viewBox="0 0 24 24"><g transform="rotate(${deg} 12 12)"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
export const WIFI = `<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="#fff"/></svg>`;
export const BOLT = XPT;

export const ITEM_ICON: Record<ItemKey, string> = { super: ICON.rocket, hyper: ICON.hyper, shield: ICON.shield, escape: ICON.sos, turbo: ICON.bolt, magnet: ICON.magnet, double: ICON.x2, life: ICON.heart };
export const ITEM_NAME: Record<ItemKey, string> = { super: 'Jump Booster', hyper: 'HYPER FLIGHT', shield: 'Aegis Shield', escape: 'Emergency Rescue', turbo: 'Aero Nitro', magnet: 'Flux Magnet', double: 'Double Coin', life: 'Armor Core' };
export const SPECIAL_LINE: Record<SpecialKey, string> = { escape: 'Emergency lift before a crash', super: 'Boost jump over a whole block', hyper: 'Hyper flight over a long stretch' };
export const SPECIAL_SHORT: Record<SpecialKey, string> = { escape: 'RESCUE', super: 'BOOSTER', hyper: 'HYPER' };
export const SPECIAL_HOW: Record<SpecialKey, string> = {
  escape: 'Tap RESCUE just before a crash: launch upward and glide down safely.',
  super: 'Tap BOOSTER: leap over a whole block of obstacles.',
  hyper: 'Tap HYPER: soar high over a long stretch.',
};
export const SPECIAL_COLOR: Record<SpecialKey, string> = { escape: '#ff5a3c', super: '#9b6bff', hyper: '#ffc21a' };
export const BOOST_WHAT: Record<ItemKey, string> = {
  super: 'A jump booster hop that clears two rows of obstacles at once.',
  hyper: 'The mythic flight: 7.4 m high, an aerial roll and a golden trail.',
  escape: 'Emergency rescue thruster straight up: cruise safely above the highway, then land cleanly.',
  shield: 'Start the run inside an Aegis Shield dome that absorbs one hit.',
  turbo: 'Start the run with an Aero Nitro afterburner burst.',
  magnet: 'Start with the Flux Magnet active.',
  double: 'Double EXP & score multiplier: every metre counts twice while active.',
  life: 'Start the run with an extra Armor Core heart.',
};
export const BONUS_COLOR: Record<string, string> = { desert: '#ff9a3c', forest: '#3dbf6a', country: '#e8c040', sea: '#2fb6ff' };
export const BONUS_EMOJI: Record<string, string> = { desert: '🌵', forest: '🌲', country: '🌾', sea: '🌊' };
export const RARITY_COLOR: Record<string, string> = { Common: '#4fb3ff', Rare: '#a77bff', Epic: '#ffc24a', Legendary: '#ff4a3c', Mythic: '#d04dff' };
export const LOCKED_ICON: Record<string, string> = {
  tunnel: `<svg viewBox="0 0 24 24"><path d="M3 20V12a9 9 0 0 1 18 0v8" fill="none" stroke="#7fe6ff" stroke-width="2"/><path d="M7 20v-7a5 5 0 0 1 10 0v7" fill="none" stroke="#7fe6ff" stroke-width="1.4" opacity=".6"/><rect x="8.5" y="1.6" width="7" height="3.4" rx="1.2" fill="#fff"/></svg>`,
  wall: `<svg viewBox="0 0 24 24"><path d="M3 3v18M6 3v18" stroke="#9b6bff" stroke-width="2"/><path d="M9 16l6-4-6-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 16l6-4-6-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/></svg>`,
  ghost: `<svg viewBox="0 0 24 24"><path d="M5 21V11a7 7 0 0 1 14 0v10l-2.4-1.8L14.3 21 12 19.2 9.7 21l-2.3-1.8z" fill="#cfe0ff" fill-opacity=".85"/><circle cx="9.5" cy="11" r="1.3" fill="#1b1450"/><circle cx="14.5" cy="11" r="1.3" fill="#1b1450"/></svg>`,
  rail: `<svg viewBox="0 0 24 24"><path d="M2 6h20" stroke="#ffc21a" stroke-width="2.2" stroke-linecap="round"/><path d="M12 6v5" stroke="#fff" stroke-width="1.6"/><rect x="7" y="11" width="10" height="5" rx="2" fill="#fff"/><path d="M3 20l4-3M21 20l-4-3" stroke="#ffc21a" stroke-width="1.4" opacity=".6"/></svg>`,
};
export { ICON };
