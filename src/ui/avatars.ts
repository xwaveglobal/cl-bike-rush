/**
 * Procedural avatars (pure SVG strings, no image files): racing emblem badges.
 * A new pilot gets a random one; it can be changed or re-rolled in the profile.
 */
import { CLASS_COLOR, type RankClass } from '../meta/Rank.ts';

// v2.1 — owner: the helmet portraits looked bad. New set: clean racing emblems (badge style) —
// 16 emblems × 2 colour schemes = 32 avatars (same count, so saved avatar indices stay valid).
const PALETTES: [string, string, string][] = [
  ['#2a7bff', '#0a1a5c', '#7fe3ff'], ['#9b4dff', '#2a0a5c', '#e0b0ff'], ['#ff3b6b', '#5c0a24', '#ffb0c4'], ['#11b8a6', '#04403a', '#8affe8'],
  ['#ff8a1f', '#5c2a04', '#ffd27a'], ['#ffcf1f', '#5c4304', '#fff3a0'], ['#22c8ff', '#043a5c', '#c4f2ff'], ['#3dd16b', '#0a4a22', '#b6ffcf'],
];
const W = '#ffffff';
/** emblem paths drawn in a 64×64 box, centred on 32,32 */
const EMBLEMS: string[] = [
  // bolt
  `<path d="M35 10L19 36h11l-4 18 19-28H33z" fill="${W}"/>`,
  // flame
  `<path d="M32 9c3 8 13 12 13 25a13 13 0 0 1-26 0c0-7 4-10 6-14 1 5 3 7 5 8-1-7 0-13 2-19z" fill="${W}"/><path d="M32 36c2 3 6 5 6 10a6 6 0 0 1-12 0c0-3 3-5 6-10z" fill="#000" opacity=".25"/>`,
  // star
  `<path d="M32 10l6.5 13.4 14.8 2-10.7 10.3 2.6 14.6L32 43.4l-13.2 6.9 2.6-14.6-10.7-10.3 14.8-2z" fill="${W}"/>`,
  // crown
  `<path d="M14 44l-3-22 11 9 10-15 10 15 11-9-3 22z" fill="${W}"/><rect x="14" y="46" width="36" height="5" rx="2" fill="${W}"/>`,
  // wings
  `<path d="M32 26c-6-7-15-9-23-7 4 3 6 5 7 8-4 0-6 1-8 3 5 1 9 3 11 6-3 1-4 2-5 4 7 0 13-2 18-7zM32 26c6-7 15-9 23-7-4 3-6 5-7 8 4 0 6 1 8 3-5 1-9 3-11 6 3 1 4 2 5 4-7 0-13-2-18-7z" fill="${W}"/><circle cx="32" cy="34" r="5" fill="${W}"/>`,
  // planet
  `<circle cx="32" cy="32" r="12" fill="${W}"/><ellipse cx="32" cy="32" rx="22" ry="7" fill="none" stroke="${W}" stroke-width="3.5" transform="rotate(-20 32 32)"/>`,
  // diamond
  `<path d="M20 22h24l7 9-19 23-19-23z" fill="${W}"/><path d="M13 31h38M26 22l6 9 6-9M32 31v23" stroke="#000" stroke-opacity=".22" stroke-width="2" fill="none"/>`,
  // comet
  `<circle cx="40" cy="24" r="9" fill="${W}"/><path d="M33 31L12 52M36 34L18 54M30 28L10 44" stroke="${W}" stroke-width="4" stroke-linecap="round" opacity=".85"/>`,
  // chevron shield
  `<path d="M32 9l19 7v14c0 12-8 20-19 25-11-5-19-13-19-25V16z" fill="${W}"/><path d="M22 28l10-7 10 7M22 38l10-7 10 7" stroke="#000" stroke-opacity=".3" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // rocket
  `<path d="M32 8c8 6 11 16 9 28H23c-2-12 1-22 9-28z" fill="${W}"/><circle cx="32" cy="24" r="4" fill="#000" opacity=".3"/><path d="M23 30l-7 10 8-2zM41 30l7 10-8-2z" fill="${W}"/><path d="M27 40h10l-5 13z" fill="#ffd23d"/>`,
  // steering wheel
  `<circle cx="32" cy="32" r="19" fill="none" stroke="${W}" stroke-width="5"/><circle cx="32" cy="32" r="5" fill="${W}"/><path d="M13 30h14M37 30h14M32 37v14" stroke="${W}" stroke-width="5"/>`,
  // chequered flag
  `<path d="M16 10v46" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/><path d="M18 12h30v24H18z" fill="${W}"/><path d="M18 12h7.5v6H18zM33 12h7.5v6H33zM25.5 18H33v6h-7.5zM40.5 18H48v6h-7.5zM18 24h7.5v6H18zM33 24h7.5v6H33zM25.5 30H33v6h-7.5zM40.5 30H48v6h-7.5z" fill="#000" opacity=".55"/>`,
  // target
  `<circle cx="32" cy="32" r="18" fill="none" stroke="${W}" stroke-width="4"/><circle cx="32" cy="32" r="10" fill="none" stroke="${W}" stroke-width="4"/><circle cx="32" cy="32" r="3.5" fill="${W}"/><path d="M32 8v10M32 46v10M8 32h10M46 32h10" stroke="${W}" stroke-width="3"/>`,
  // mountain peaks
  `<path d="M8 50l16-26 8 12 6-9 18 23z" fill="${W}"/><path d="M24 24l-4 7 4-2 4 2zM38 27l-3 5 3-1 3 1z" fill="#000" opacity=".25"/><circle cx="46" cy="16" r="5" fill="${W}"/>`,
  // speedometer
  `<path d="M12 42a20 20 0 1 1 40 0" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round"/><path d="M32 42l12-14" stroke="${W}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="42" r="4.5" fill="${W}"/><path d="M16 28l3 2M32 20v4M48 28l-3 2" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
  // trophy
  `<path d="M22 12h20v10a10 10 0 0 1-20 0z" fill="${W}"/><path d="M22 15h-6c0 7 3 10 7 11M42 15h6c0 7-3 10-7 11" fill="none" stroke="${W}" stroke-width="3"/><path d="M29 32h6v9h-6z" fill="${W}"/><rect x="22" y="41" width="20" height="6" rx="2" fill="${W}"/>`,
];

export const AVATAR_COUNT = 32;

/** every avatar gets its own gradient/filter ids: a shared id inside a hidden screen makes Chrome draw the avatar empty */
let uid = 0;
export function avatarSvg(i: number) {
  const k = ((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const emblem = EMBLEMS[k % EMBLEMS.length];
  const [c1, c2, hi] = PALETTES[(k * 3 + Math.floor(k / EMBLEMS.length) * 5) % PALETTES.length];
  const id = `av${k}_${(uid = (uid + 1) % 1e9).toString(36)}`;
  return `<svg viewBox="0 0 64 64" class="avsvg" aria-hidden="true"><defs>
    <radialGradient id="${id}g" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
    <filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.2" flood-color="#000" flood-opacity=".45"/></filter></defs>
    <circle cx="32" cy="32" r="31" fill="url(#${id}g)"/>
    <circle cx="32" cy="32" r="27.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/>
    <path d="M10 22a24 24 0 0 1 44 0" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
    <g filter="url(#${id}s)" transform="translate(32 32) scale(.78) translate(-32 -32)">${emblem}</g></svg>`;
}

export function avatarForName(name: string) {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % AVATAR_COUNT;
}

/** small hexagonal class plate for an avatar corner (D … AAA) */
export function classCorner(c: RankClass) {
  const col = CLASS_COLOR[c];
  const fs = c.length >= 3 ? 7.2 : c.length === 2 ? 9 : 11;
  return `<svg viewBox="0 0 24 24" class="tierb" aria-label="Class ${c}"><path d="M12 1.5l9.5 5.2v10.6L12 22.5l-9.5-5.2V6.7z" fill="#0b1020" stroke="${col}" stroke-width="2"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${fs}" fill="${col}">${c}</text></svg>`;
}
