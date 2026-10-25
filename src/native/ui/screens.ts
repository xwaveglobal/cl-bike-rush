/** v3 native UI — full screens (home, tracks, garage, missions, ranks, daily, shop…) */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PERK_ORDER, perkLayout, perkVisible } from '../../meta/Perks.ts';
import { C, Gfx, bar, button, card, fmt, iconBtn, panel, rankBadge, toggle } from './gfx.ts';
import type { UI } from './NativeUI.ts';
import { BAG_ICON, BOLT, CAR_LINE, ICON, ITEM_ICON, RARITY_COLOR, ROCKET_W, SPECIAL_SHORT, TUT_ICON } from './consts.ts';
import { capRow, column, safeBottom, safeTop } from './layout.ts';
import { drawOverlay } from './popups.ts';
import { avatarSvg, avatarForName } from '../../ui/avatars.ts';
import { CLASSES, CLASS_COLOR, classFor, playerRank, type RankClass } from '../../meta/Rank.ts';
import { LEVELS } from '../../config.ts';
import { SKINS, carVisibility } from '../../render/Vehicle.ts';
import { carImage, logoImg } from '../../ui/shared.ts';
import { CHAINS, activeChains, pilotLevel } from '../../meta/Career.ts';
import { CHECKIN, SPECIALS, type ItemKey } from '../../meta/Daily.ts';
import { fmtLeft, localTime } from '../../meta/Events.ts';
import { hs } from '../hs.ts';
import loadingUrl from '../../assets/images/loading.jpg';
import thEndless from '../../assets/images/tracks/endless.jpg';
import thMega from '../../assets/images/tracks/mega-city.jpg';
import carShadow from '../../assets/images/car/x1-back.webp';

const SCREENS: Record<string, (ui: UI, g: Gfx) => void> = {
  loading,
  start,
  tracks,
  garage,
  missions,
  ranks,
  daily,
  events,
  shop,
  countdown,
  tutprompt,
};

export function drawScreens(ui: UI, g: Gfx, ids: string[], layer: 'base' | 'overlay') {
  for (const id of ids) {
    if (!ui.shown.has(id)) continue;
    // one screen failing to draw must never take the others (and their buttons) down with it
    g.guard(id, () => (layer === 'base' ? SCREENS[id]?.(ui, g) : drawOverlay(ui, g, id)));
  }
  if (layer === 'base' && ui.tutHint && ui.shown.has('hud')) swipeHint(g);
}

// ------------------------------------------------------------------ shared
/** dark gradient behind full pages (the 3D scene shows faintly) */
function pageBg(g: Gfx, a = 0.86) {
  g.rr(0, 0, g.W, g.H, 0, g.lin(0, 0, 0, g.H, [[0, `rgba(6,10,34,${a})`], [1, `rgba(3,6,22,${a + 0.06})`]]));
  g.block(0, 0, g.W, g.H);
}

/** page header: back · title · wallet */
export function pageHead(ui: UI, g: Gfx, title: string, back = () => ui.h.home()) {
  const row = capRow(g);
  const y = row.top + 2;
  iconBtn(g, 'back', 12, y, 40, ICON.chevL, back);
  const ww = wallet(ui, g, row.right, y + 4);
  const l = 60,
    r = row.right - ww - 8;
  g.text(title, (l + r) / 2, y + 20, { size: 19, align: 'center', italic: true, maxW: Math.max(60, r - l) });
  return Math.max(y + 50, safeTop(g) + 4);
}

/** coin chip: tap → shop, "+" → free coins (only while an ad can be shown) */
export function wallet(ui: UI, g: Gfx, right: number, y: number, compact = false) {
  const n = ui.save?.wallet ?? 0;
  const txt = compact && n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : fmt(n);
  const plus = true; // v3.0.8: "+" always opens the shop (coin packs · Remove Ads · free coins)
  const tw = g.measure(txt, { size: 14 });
  const w = 34 + tw + (plus ? 26 : 10);
  const x = right - w;
  g.rr(x, y, w, 32, 16, g.isPressed('wallet') ? 'rgba(79,195,255,.3)' : 'rgba(10,22,60,.86)', 'rgba(255,194,26,.55)', 1.2);
  g.icon(ICON.coin, x + 6, y + 5, 22);
  g.text(txt, x + 31, y + 16.5, { size: 14, noTr: true });
  g.hit(x, y - 4, w - (plus ? 26 : 0), 40, 'wallet', () => ui.h.shop());
  if (plus) {
    g.circle(x + w - 15, y + 16, 10, g.isPressed('freepop') ? '#fff' : '#2fd36b');
    g.icon(ICON.plus, x + w - 22, y + 9, 14, '#fff');
    g.hit(x + w - 30, y - 4, 30, 40, 'freepop', () => ui.h.shop());
  }
  return w;
}

function avatar(g: Gfx, av: number, x: number, y: number, s: number, cls?: RankClass, ring = true) {
  if (ring && cls) g.circle(x + s / 2, y + s / 2, s / 2 + 2.5, null, CLASS_COLOR[cls], 2.5);
  g.icon(avatarSvg(av), x, y, s);
  if (cls) rankBadge(g, cls, x + s - s * 0.38, y + s - s * 0.34, s * 0.36);
}

/** vertical list with its own scroll offset; content(y) draws from y and returns the bottom */
function scrollList(g: Gfx, key: string, x: number, y: number, w: number, h: number, content: (y: number) => number) {
  g.dry++;
  const total = content(0);
  g.dry--;
  const off = g.scroll(x, y, w, h, key, total + 12);
  g.clip(x, y, w, h);
  content(y - off);
  g.unclip();
}

// ------------------------------------------------------------------ loading
function loading(ui: UI, g: Gfx) {
  g.rr(0, 0, g.W, g.H, 0, '#04071a');
  g.img(loadingUrl, 0, 0, g.W, g.H, 'cover');
  g.block(0, 0, g.W, g.H);
  const y = g.H - safeBottom(g) - 70;
  const w = Math.min(280, g.W - 80);
  bar(g, (g.W - w) / 2, y, w, 8, ui.loading, g.lin(0, 0, g.W, 0, [[0, '#4fc3ff'], [1, '#ff4fd8']]), 'rgba(0,0,0,.5)');
  g.text(ui.loadText, g.W / 2, y + 26, { size: 13, align: 'center', font: 'b' });
}

// ------------------------------------------------------------------ home
/** v3.0.11: animated y of a rail tile (eases to a new target in 200 ms; first sight = no animation) */
function railY(ui: UI, key: string, target: number, t: number) {
  const m = ui.railAnim[key];
  if (!m) {
    ui.railAnim[key] = { from: target, to: target, t0: t };
    return target;
  }
  if (Math.abs(m.to - target) > 0.5) {
    const k = Math.min(1, (t - m.t0) / 200);
    const cur = m.from + (m.to - m.from) * (1 - Math.pow(1 - k, 3));
    ui.railAnim[key] = { from: cur, to: target, t0: t };
  }
  const n = ui.railAnim[key];
  const k = Math.min(1, (t - n.t0) / 200);
  if (k < 1) ui.railMovingUntil = Math.max(ui.railMovingUntil, n.t0 + 200);
  return n.from + (n.to - n.from) * (1 - Math.pow(1 - k, 3));
}
function start(ui: UI, g: Gfx) {
  const s = ui.save;
  const o = ui.home;
  const W = g.W;
  const row = capRow(g);
  const top = row.top - 6;
  const t = g.time;
  // soft vignette top & bottom so the buttons read over the 3D city
  g.rr(0, 0, W, 150, 0, g.lin(0, 0, 0, 150, [[0, 'rgba(3,6,22,.55)'], [1, 'rgba(3,6,22,0)']]));
  g.rr(0, g.H - 300, W, 300, 0, g.lin(0, g.H - 300, 0, g.H, [[0, 'rgba(3,6,22,0)'], [1, 'rgba(3,6,22,.8)']]));
  // ---- top right: wallet · tutorial · settings (left of TikTok's capsule; How to play is in Settings then)
  const sq = (x: number, key: string, icon: string, fn: () => void) => {
    const s2 = 44;
    g.rr(x, top + 6, s2, s2, 12, g.isPressed(key) ? 'rgba(79,195,255,.35)' : g.lin(0, top, 0, top + s2, [[0, '#1c3a8c'], [1, '#0d1d55']]), 'rgba(120,170,255,.5)', 1.2);
    g.icon(icon, x + 11, top + 17, 22, '#ffffff');
    g.hit(x - 2, top + 2, s2 + 4, s2 + 8, key, fn);
  };
  let rx = row.right - (row.capped ? 0 : 6);
  sq(rx - 44, 'settings', ICON.gear, () => ui.h.settings());
  rx -= 50;
  if (!row.capped || rx - 50 - 150 > 18 + 150) {
    sq(rx - 44, 'help', TUT_ICON, () => ui.h.help());
    rx -= 50;
  }
  const wl = rx - wallet(ui, g, rx, top + 12, true);
  // ---- profile chip (avatar with rank glow · name · rank shield · best EXP)
  if (o) {
    const pk = 'profile';
    // v3.0.8: chip fits its content and keeps a clear gap to the coin chip
    const content = Math.max(g.measure(o.name, { size: 13.5, font: 'b' }), 24 + g.measure(fmt(o.bolts), { size: 12.5 }) + 34);
    const cw = Math.max(110, Math.min(172, 54 + content + 14, wl - 14 - 18));
    const cc = CLASS_COLOR[ui.myClass];
    g.rr(18, top + 6, cw, 44, 22, g.isPressed(pk) ? 'rgba(79,195,255,.3)' : 'rgba(12,24,70,.86)', 'rgba(110,160,255,.45)', 1.2);
    g.shadow(cc, 10, 0);
    g.circle(40, top + 28, 22, cc);
    g.shadow(null);
    g.icon(avatarSvg(o.avatar), 20, top + 8, 40);
    g.text(o.name, 64, top + 18, { size: 13.5, maxW: cw - 54, noTr: true, weight: 800, font: 'b' });
    shieldBadge(g, ui.myClass, 64, top + 27, 18);
    g.rich(`<b>${fmt(o.bolts)}</b> ${BOLT}`, 88, top + 27, cw - 72, { size: 12.5 });
    const rk = o.allRank ? `#${o.allRank >= 10000 ? `${Math.round(o.allRank / 1000)}K` : fmt(o.allRank)}` : '#—';
    const rw = g.measure(rk, { size: 9 }) + 14;
    g.rr(40 - rw / 2, top + 44, rw, 15, 7.5, g.lin(0, top + 44, 0, top + 59, [[0, '#ffd84a'], [1, '#f0a800']]), '#7a4a00', 1);
    g.text(rk, 40, top + 52, { size: 9, align: 'center', color: '#2a1600', shadow: null, noTr: true });
    g.hit(14, top, cw + 4, 62, pk, () => ui.h.profile());
  }
  // ---- logo
  const lw = Math.min(W * 0.86, 360);
  const lh = lw * 0.4;
  g.img(logoImg, (W - lw) / 2, top + 58, lw, lh, 'contain');
  // ---- side rails: square tiles, icon + label inside
  const tile = (x: number, y: number, key: string, icon: string, label: string, col: [string, string], fn: () => void, badge = '') => {
    const s2 = 50;
    const pr = g.isPressed(key);
    g.shadow('rgba(0,0,0,.45)', 8, 3);
    g.rr(x, y, s2, s2, 13, g.lin(0, y, 0, y + s2, [[0, col[0]], [1, col[1]]]), 'rgba(160,200,255,.28)', 1);
    g.shadow(null);
    if (pr) g.rr(x, y, s2, s2, 13, 'rgba(255,255,255,.18)');
    g.icon(icon, x + 15, y + 7, 20, '#ffffff');
    g.text(label.toUpperCase(), x + s2 / 2, y + 38, { size: 8.6, align: 'center', maxW: s2 - 6, weight: 900, font: 'b' });
    if (badge) {
      g.circle(x + s2 - 2, y + 2, 9, '#ff3b5c', '#fff', 1.5);
      g.text(badge, x + s2 - 2, y + 2.5, { size: 10, align: 'center', shadow: null, noTr: true });
    }
    g.hit(x - 4, y - 4, s2 + 8, s2 + 8, key, fn);
  };
  const ry = top + 58 + lh - 2;
  const navy: [string, string] = ['#1d3c90', '#0c1b52'];
  tile(18, ry, 'daily', ICON.calendar, 'Daily', navy, () => ui.h.daily(), o && o.dailyBadge > 0 ? String(o.dailyBadge) : '');
  tile(18, ry + 60, 'events', ICON.gift, 'Bonus', ['#d9802e', '#9a4a12'], () => ui.h.events());
  tile(18, ry + 120, 'ranks', ICON.podium, 'Ranks', navy, () => ui.h.ranks());
  // right rail: Share · Entry · Launch (v3.0.11) — only the rewards that can still be earned are
  // shown (hs.perkVisible: reward config + claim state). The visible tiles stay centred in the
  // 3-slot block (3 · 2 · 1 · none) and glide to their new place in 200 ms when one disappears.
  const perks = [
    { key: 'pk-share', kind: 'share' as const, icon: ICON.share, label: 'Share', col: ['#1aa79a', '#0b6a66'] as [string, string], badge: false },
    { key: 'pk-entry', kind: 'entry' as const, icon: ICON.gift, label: 'Entry', col: ['#7b3fe0', '#4a1d9e'] as [string, string], badge: true },
    { key: 'pk-launch', kind: 'launch' as const, icon: ROCKET_W, label: 'Launch', col: ['#5a3fe0', '#2c1d9e'] as [string, string], badge: true },
  ];
  const pst = hs.perkState();
  const lay = perkLayout(PERK_ORDER.filter((k) => perkVisible(k, pst)), ry, 60, 50);
  perks.forEach((p) => {
    const target = lay[p.kind];
    if (target === null) return;
    const y = railY(ui, p.key, target, g.time);
    tile(W - 68, y, p.key, p.icon, p.label, p.col, () => ui.h.perk(p.kind), p.badge ? '!' : '');
  });
  // ---- bottom menu
  const col = column(g);
  const sb = safeBottom(g);
  const bx = col.x + 46,
    bw = col.w - 92;
  let y = g.H - sb - 18;
  // mini row: Garage · Shop · Missions
  const mh = 42;
  y -= mh;
  const mw = (bw - 16) / 3;
  const mini = (i: number, key: string, icon: string, label: string, fn: () => void, c: [string, string], ic = '#fff') => {
    const x = bx + i * (mw + 8);
    g.shadow('rgba(0,0,0,.4)', 6, 2);
    g.rr(x, y, mw, mh, 12, g.lin(0, y, 0, y + mh, [[0, c[0]], [1, c[1]]]), 'rgba(255,255,255,.22)', 1);
    g.shadow(null);
    if (g.isPressed(key)) g.rr(x, y, mw, mh, 12, 'rgba(255,255,255,.18)');
    const lab = label.toUpperCase();
    const tw = Math.min(g.measure(lab, { size: 12, font: 'b', weight: 900 }), mw - 40);
    const cx = x + (mw - (tw + 24)) / 2;
    g.icon(icon, cx, y + mh / 2 - 9, 18, ic);
    g.text(lab, cx + 24, y + mh / 2 + 0.5, { size: 12, maxW: mw - 40, font: 'b', weight: 900 });
    g.hit(x, y - 2, mw, mh + 4, key, fn);
  };
  mini(0, 'garage', CAR_LINE, 'Garage', () => ui.h.garage(), ['#1b2e6e', '#0d1a48']);
  mini(1, 'shop', ICON.bag, 'Shop', () => ui.h.shop(), ['#7b3fe0', '#4d1fa8']);
  mini(2, 'missions', ICON.target, 'Missions', () => ui.h.missions(), ['#c46a2a', '#8a4214']);
  // PLAY
  const ph = 66;
  y -= ph + 12;
  const pulse = 1 + 0.018 * Math.sin(t / 300);
  const key = 'play';
  g.ctx.save();
  g.ctx.translate(W / 2, y + ph / 2);
  g.ctx.scale(g.isPressed(key) ? 0.97 : pulse, g.isPressed(key) ? 0.97 : pulse);
  g.ctx.translate(-W / 2, -(y + ph / 2));
  g.shadow('rgba(80,200,255,.75)', 16, 0);
  g.rr(bx, y, bw, ph, 20, g.lin(0, y, 0, y + ph, [[0, '#3c8cff'], [1, '#1640c8']]), '#7fe6ff', 2.5);
  g.shadow(null);
  g.rr(bx + 4, y + 3, bw - 8, ph * 0.42, 16, 'rgba(255,255,255,.14)');
  g.rr(bx + 14, y + 9, 52, ph - 18, 12, 'rgba(10,30,110,.55)', 'rgba(150,210,255,.4)', 1);
  g.icon(ICON.play, bx + 26, y + ph / 2 - 14, 28, '#fff');
  g.text('PLAY', bx + bw / 2 + 12, y + ph / 2 + 1, { size: 34, align: 'center', italic: true, weight: 900, maxW: bw - 150 });
  const ch = (Math.sin(t / 220) + 1) / 2;
  g.alpha(0.6 + 0.4 * ch);
  g.icon(ICON.dash, bx + bw - 54, y + ph / 2 - 15, 30, '#7fe6ff');
  g.alpha(1);
  g.ctx.restore();
  g.hit(bx, y, bw, ph, key, () => ui.h.play());
  // speed selector: one bar, three segments (Easy green · Normal gold · Hard red)
  const lv = s?.settings.speed ?? 'normal';
  const sh = 52;
  y -= sh + 12;
  g.rr(bx, y, bw, sh, 16, 'rgba(10,22,66,.88)', 'rgba(110,160,255,.4)', 1.2);
  const sw = (bw - 12) / 3;
  const SPD: Record<string, string> = { easy: '#2fd36b', normal: '#ffc21a', hard: '#ff3b5c' };
  (['easy', 'normal', 'hard'] as const).forEach((k, i) => {
    const x = bx + 6 + i * sw;
    const on = k === lv;
    const kk = `speed-${k}`;
    if (on) g.rr(x, y + 5, sw, sh - 10, 12, g.lin(0, y, 0, y + sh, [[0, k === 'normal' ? '#ffe07a' : k === 'easy' ? '#7af0a4' : '#ff8a9a'], [1, k === 'normal' ? '#e8a800' : k === 'easy' ? '#1fa858' : '#d8203c']]));
    g.text('★'.repeat(i + 1), x + sw / 2, y + 12, { size: 8.5, align: 'center', color: on ? 'rgba(40,20,0,.75)' : SPD[k], shadow: null, noTr: true });
    g.text(LEVELS[k].label.toUpperCase(), x + sw / 2, y + 26, { size: 13, align: 'center', color: on ? '#3a2400' : '#dfe8ff', maxW: sw - 8, shadow: on ? null : undefined, font: 'b', weight: 900 });
    g.text(`EXP ×${['1.0', '1.05', '1.7'][i]}`, x + sw / 2, y + 40, { size: 10, align: 'center', font: 'b', weight: 800, color: on ? 'rgba(58,36,0,.8)' : SPD[k], shadow: null, noTr: true });
    g.hit(x, y, sw, sh, kk, () => ui.h.setSpeed(k));
  });
}

/** rank shield (home chip) */
function shieldBadge(g: Gfx, cls: RankClass, x: number, y: number, h: number) {
  const cc = CLASS_COLOR[cls];
  const w = h * 0.95;
  const c = g.ctx;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h * 0.55);
  c.quadraticCurveTo(x + w, y + h * 0.85, x + w / 2, y + h);
  c.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.55);
  c.closePath();
  c.fillStyle = g.lin(0, y, 0, y + h, [[0, '#e8eefc'], [1, cc]]);
  c.fill();
  g.text(cls, x + w / 2, y + h * 0.45, { size: h * (cls.length > 2 ? 0.36 : 0.5), align: 'center', color: '#0b1436', shadow: null, noTr: true });
}

// ------------------------------------------------------------------ tracks
function tracks(ui: UI, g: Gfx) {
  pageBg(g, 0.55);
  const s = ui.save;
  if (!s) return;
  // ---- header: back · SELECT TRACK · [Training] (v3.0.10: training lives here after the first run)
  const row = capRow(g);
  const hy = row.top + 2;
  iconBtn(g, 'back', 12, hy, 40, ICON.chevL, () => ui.h.home());
  const tw = 104;
  const tx = row.right - tw;
  {
    const k = 'tr-training';
    const pr = g.isPressed(k);
    g.rr(tx, hy + 3, tw, 34, 17, pr ? 'rgba(79,195,255,.35)' : g.lin(0, hy, 0, hy + 34, [[0, '#2a4fb8'], [1, '#14286e']]), 'rgba(140,190,255,.6)', 1.2);
    g.icon(ICON.hand, tx + 10, hy + 10, 20, '#ffffff');
    g.text('Training', tx + 34, hy + 20.5, { size: 13, maxW: tw - 42 });
    g.hit(tx - 4, hy - 2, tw + 8, 44, k, () => ui.h.help());
  }
  g.text('SELECT TRACK', 62, hy + 20, { size: 18, italic: true, maxW: tx - 62 - 10 });
  const top = Math.max(hy + 50, safeTop(g) + 4);
  const col = column(g);
  const rank = playerRank(s.expBest, s.exp2Best);
  const aaa = CLASSES.indexOf(rank) >= CLASSES.indexOf('AAA');
  const lv = LEVELS[s.settings.speed].label;
  const x = col.x + 12,
    w = col.w - 24;
  scrollList(g, 'tracks', 0, top, g.W, g.H - top - safeBottom(g), (y) => {
    const tcard = (key: string, img: string, title: string, sub: string, meta: string, num: string, sel: boolean, locked: boolean, fn: () => void, h = 112) => {
      const pr = g.isPressed(key);
      g.rr(x, y, w, h, 16, '#0b1436', sel ? C.gold : 'rgba(130,175,255,.3)', sel ? 2 : 1);
      if (img) {
        g.alpha(locked ? 0.35 : pr ? 0.8 : 1);
        g.img(img, x + 1, y + 1, w - 2, h - 2, 'cover', 15);
        g.alpha(1);
      }
      g.rr(x + 1, y + 1, w - 2, h - 2, 15, g.lin(x, 0, x + w, 0, [[0, 'rgba(4,8,26,.92)'], [0.6, 'rgba(4,8,26,.45)'], [1, 'rgba(4,8,26,0)']]));
      g.text(title, x + 16, y + 26, { size: 19, italic: true, maxW: w * 0.6 });
      g.rich(sub, x + 16, y + 40, w * 0.62, { size: 11, font: 'b', color: C.muted });
      g.rich(meta, x + 16, y + h - 34, w * 0.75, { size: 13 });
      g.circle(x + w - 24, y + 24, 14, 'rgba(0,0,0,.5)', 'rgba(255,255,255,.5)');
      if (num.startsWith('<svg')) g.icon(num, x + w - 32, y + 16, 16, '#ffffff');
      else g.text(num, x + w - 24, y + 24.5, { size: 13, align: 'center', noTr: true });
      g.hit(x, y, w, h, key, fn);
      y += h + 10;
    };
    tcard('tr-endless', thEndless, 'Endless', `<b>${lv}</b> · The rank road · D → AAA`, `${BOLT} <b>${fmt(s.expBest)}</b> <span class="clsb" style="--cc:${CLASS_COLOR[classFor(s.expBest)]}">${CLASSES[Math.min(5, CLASSES.indexOf(classFor(s.expBest)))]}</span>`, '1', s.track !== 'track2', false, () => ui.h.pickTrack('endless'));
    if (aaa)
      tcard('tr-t2', thMega, 'Mega Rush', `<b>${lv}</b> · Harder · EXP ×1.25 · ranks S+`, `${BOLT} <b>${fmt(s.exp2Best)}</b> ${['S', 'SS', 'SSS'].map((r) => `<span class="clsb" style="--cc:${CLASS_COLOR[r as RankClass]}">${r}</span>`).join(' ')}`, '2', s.track === 'track2', false, () => ui.h.pickTrack('track2'));
    else tcard('tr-t2', thMega, 'Mega Rush', 'Harder road · ranks S+', `${ICON.lock} Reach rank <span class="clsb" style="--cc:${CLASS_COLOR.AAA}">AAA</span>`, ICON.lock, false, true, () => ui.rankGuide());
    (['S', 'SS', 'SSS'] as RankClass[]).forEach((r, i) => {
      const key = `soon-${r}`;
      const h = 70;
      g.rr(x, y, w, h, 16, 'rgba(20,14,50,.85)', 'rgba(167,123,255,.35)');
      g.text('?', x + w - 70, y + h / 2 + 1, { size: 40, align: 'center', color: 'rgba(167,123,255,.35)', shadow: null });
      g.text(['Ocean Drive', 'Volcano Run', 'Aurora Peak'][i], x + 16, y + 24, { size: 17, italic: true, maxW: w - 120 });
      g.rich(`${ICON.lock} Reach rank <span class="clsb" style="--cc:${CLASS_COLOR[r]}">${r}</span>`, x + 16, y + 38, w - 120, { size: 11, font: 'b', color: C.muted });
      g.circle(x + w - 24, y + 24, 14, 'rgba(0,0,0,.5)', 'rgba(255,255,255,.5)');
      g.text(String(i + 3), x + w - 24, y + 24.5, { size: 13, align: 'center', noTr: true });
      g.hit(x, y, w, h, key, () => ui.toast(`${ICON.lock} Reach rank ${r} on Mega Rush to open this track`, '#b7a6ff'));
      y += h + 10;
    });
    return y;
  });
}

// ------------------------------------------------------------------ garage
function garage(ui: UI, g: Gfx) {
  const s = ui.save;
  pageHead(ui, g, 'GARAGE');
  if (!s) return;
  const W = g.W;
  const col = column(g);
  const skin = SKINS[Math.max(0, ui.garageIndex)];
  const vis = carVisibility(s.unlocked, skin.id);
  const top = safeTop(g) + 64;
  // car info card (top)
  const rc = RARITY_COLOR[skin.rarity ?? 'Common'];
  const ih = vis === 'dark' ? 70 : 76;
  card(g, col.x + 12, top, col.w - 24, ih, 12, 'rgba(130,175,255,.25)', 'rgba(8,16,44,.82)');
  if (vis === 'dark') {
    g.text(`??? · ${skin.rarity ?? ''}`, col.x + 24, top + 16, { size: 13, italic: true, color: rc });
    g.rich(`${ICON.lock} Reach rank <span class="clsb" style="--cc:${CLASS_COLOR[skin.need as RankClass]}">${skin.need}</span> to reveal and unlock this car. Drive farther in one run to earn EXP.`, col.x + 24, top + 28, col.w - 48, { size: 11, font: 'b', color: '#c9d8f5' });
  } else {
    g.text(`${skin.name} · ${skin.rarity ?? ''}`, col.x + 24, top + 16, { size: 13, italic: true, color: rc, maxW: col.w - 48 });
    g.text(skin.cls.split('·')[1]?.trim() ?? '', col.x + 24, top + 33, { size: 10, font: 'b', color: '#c9d8f5', maxW: col.w - 48, noTr: true });
    g.rich(`${ICON.lock} Unlocks at rank <span class="clsb" style="--cc:${CLASS_COLOR[skin.need as RankClass]}">${skin.need}</span>`, col.x + 24, top + 42, col.w - 48, { size: 11, color: '#ffe08a' });
    g.text('Every car drives the same — EXP stays fair. Cars show off your rank.', col.x + 24, top + 66, { size: 9.5, font: 'b', color: C.muted, maxW: col.w - 48 });
  }
  if (vis !== 'own') {
    const lt = vis === 'dark' ? `RANK ${skin.need} NEEDED` : 'LOCKED';
    const lw = g.measure(lt, { size: 13 }) + 52;
    const ly = g.H * 0.34;
    g.rr((W - lw) / 2, ly, lw, 36, 18, 'rgba(0,0,0,.6)', 'rgba(255,255,255,.35)');
    g.icon(ICON.lock, (W - lw) / 2 + 14, ly + 9, 18, '#fff');
    g.text(lt, (W - lw) / 2 + 38, ly + 18, { size: 13 });
  }
  // bottom: strip · selector · button
  const sb = safeBottom(g);
  let y = g.H - sb - 12 - 50;
  const owned = s.unlocked.includes(skin.id);
  const myClass = playerRank(s.expBest, s.exp2Best);
  if (!owned) button(g, 'carbtn', col.x + 12, y, col.w - 24, 50, `${ICON.lock} Reach rank ${skin.need}`, () => ui.rankGuide(), { style: 'purple' });
  else if (s.vehicle === skin.id) button(g, 'carbtn', col.x + 12, y, col.w - 24, 50, `${ICON.check} Selected`, () => ui.h.selectSkin(skin.id), { style: 'ghost' });
  else button(g, 'carbtn', col.x + 12, y, col.w - 24, 50, 'Select', () => ui.h.selectSkin(skin.id), { style: 'blue' });
  y -= 72;
  card(g, col.x + 12, y, col.w - 24, 62, 14, 'rgba(130,175,255,.3)', 'rgba(8,16,44,.85)');
  iconBtn(g, 'prevcar', col.x + 22, y + 11, 40, ICON.chevL, () => {
    ui.garageIndex = (ui.garageIndex + SKINS.length - 1) % SKINS.length;
    ui.h.previewSkin(SKINS[ui.garageIndex].id);
  });
  iconBtn(g, 'nextcar', col.x + col.w - 62, y + 11, 40, ICON.chevR, () => {
    ui.garageIndex = (ui.garageIndex + 1) % SKINS.length;
    ui.h.previewSkin(SKINS[ui.garageIndex].id);
  });
  g.text(vis === 'dark' ? '???' : skin.name, W / 2, y + 20, { size: 18, align: 'center', italic: true, maxW: col.w - 140, noTr: true });
  g.text(skin.cls.split('·')[0].trim(), W / 2, y + 38, { size: 10, align: 'center', font: 'b', color: C.muted, noTr: true });
  SKINS.forEach((_, i) => g.circle(W / 2 - (SKINS.length - 1) * 6 + i * 12, y + 52, 3.5, i === ui.garageIndex ? C.cyan : 'rgba(255,255,255,.25)'));
  // car strip (horizontal scroll)
  const ch = 96,
    cw = 86;
  y -= ch + 10;
  const n = SKINS.length + 1;
  const total = n * (cw + 8);
  const off = g.scroll(0, y, W, ch, 'carstrip', total + 24, true);
  g.clip(0, y - 4, W, ch + 8);
  SKINS.forEach((k, i) => {
    const x = 12 + i * (cw + 8) - off;
    const v = carVisibility(s.unlocked, k.id);
    const on = i === ui.garageIndex;
    const key = `car-${k.id}`;
    const rcol = RARITY_COLOR[k.rarity ?? 'Common'];
    g.rr(x, y, cw, ch, 12, on ? `${rcol}40` : 'rgba(10,22,60,.85)', on ? rcol : 'rgba(255,255,255,.18)', on ? 2 : 1);
    g.alpha(v === 'dark' ? 0.25 : 1);
    g.img(v === 'dark' ? carShadow : carImage(k.id), x + 4, y + 6, cw - 8, 50, 'contain');
    g.alpha(1);
    if (v === 'dark') g.text('?', x + cw / 2, y + 30, { size: 26, align: 'center', color: '#a9b8ff' });
    g.text(v === 'dark' ? '???' : k.name.replace('XWAVE ', ''), x + cw / 2, y + 66, { size: 11, align: 'center', maxW: cw - 8, noTr: true });
    const rankOk = CLASSES.indexOf(myClass) >= CLASSES.indexOf((k.need ?? 'D') as RankClass);
    const label = v === 'own' ? (s.vehicle === k.id ? 'In use' : 'Owned') : v === 'next' ? (rankOk ? `${ICON.coin}${fmt(k.price)}` : `${ICON.lock} Rank ${k.need}`) : `Rank ${k.need}`;
    g.rich(label, x + 4, y + 74, cw - 8, { size: 9.5, align: 'center', font: 'b', color: v === 'own' ? C.green : C.muted });
    g.hit(x, y, cw, ch, key, () => {
      ui.garageIndex = i;
      ui.h.previewSkin(k.id);
    });
  });
  {
    const x = 12 + SKINS.length * (cw + 8) - off;
    g.rr(x, y, cw, ch, 12, 'rgba(10,22,60,.85)', 'rgba(255,255,255,.18)');
    g.text('+', x + cw / 2, y + 30, { size: 26, align: 'center', color: '#a9b8ff' });
    g.text('MORE', x + cw / 2, y + 62, { size: 11, align: 'center' });
    g.rich(['S', 'SS', 'SSS'].map((r) => `<span class="clsb" style="--cc:${CLASS_COLOR[r as RankClass]}">${r}</span>`).join(''), x + 2, y + 70, cw - 4, { size: 9, align: 'center' });
    g.hit(x, y, cw, ch, 'morecars', () => ui.toast(`${ICON.car} More cars unlock at rank S · SS · SSS on Mega Rush`, '#ff7a2e'));
  }
  g.unclip();
}

// ------------------------------------------------------------------ missions
function missions(ui: UI, g: Gfx) {
  pageBg(g);
  const s = ui.save;
  const top = pageHead(ui, g, 'MISSIONS');
  if (!s) return;
  const col = column(g);
  const x = col.x + 12,
    w = col.w - 24;
  const sb = safeBottom(g);
  button(g, 'mplay', g.W / 2 - 90, g.H - sb - 64, 180, 50, `${ICON.play} Play`, () => ui.h.play(), { style: 'gold' });
  scrollList(g, 'missions', 0, top, g.W, g.H - top - sb - 74, (y) => {
    const lv = pilotLevel(s);
    const done = Object.values(s.career?.tier ?? {}).reduce((a: number, b) => a + (b as number), 0);
    const all = CHAINS.reduce((a, c) => a + c.tiers.length, 0);
    card(g, x, y, w, 64, 14);
    g.circle(x + 34, y + 32, 22, g.lin(0, y, 0, y + 64, [[0, '#ffd84a'], [1, '#ff9a1a']]));
    g.text(String(lv), x + 34, y + 33, { size: 18, align: 'center', color: '#2a1600', shadow: null, noTr: true });
    g.text('Pilot rank', x + 66, y + 16, { size: 10, font: 'b', color: C.muted });
    g.text(`Pilot level ${lv}`, x + 66, y + 33, { size: 16, italic: true });
    g.text(`${done} / ${all} mission tiers done`, x + 66, y + 50, { size: 10, font: 'b', color: C.muted, noTr: true });
    y += 72;
    const auto = s.settings.autoClaim !== false;
    card(g, x, y, w, 52, 14);
    g.text('Auto-collect rewards', x + 14, y + 18, { size: 13 });
    g.text(auto ? 'On · rewards go straight to your wallet' : 'Off · claim each reward yourself', x + 14, y + 36, { size: 10, font: 'b', color: C.muted, maxW: w - 90 });
    toggle(g, 'autoclaim', x + w - 60, y + 13, auto, () => ui.h.toggleAutoClaim());
    y += 60;
    const pend = s.pendingMissions;
    if (pend.length) {
      g.text('Ready to claim', x + 4, y + 12, { size: 13 });
      if (pend.length > 1) button(g, 'claimall', x + w - 110, y, 110, 26, `${ICON.gift} Claim all`, () => ui.h.claimMission(-1), { style: 'gold', size: 11 });
      y += 32;
      pend.forEach((m, i) => {
        card(g, x, y, w, 44, 12, 'rgba(47,211,107,.45)');
        g.icon(ICON.check, x + 10, y + 12, 20, C.green);
        g.text(m.text, x + 38, y + 22, { size: 11, font: 'b', maxW: w - 150, noTr: true });
        button(g, `claimm-${i}`, x + w - 100, y + 8, 92, 28, `${ICON.coin}+${fmt(m.reward)}`, () => ui.h.claimMission(i), { style: 'green', size: 12 });
        y += 50;
      });
    }
    const ic: Record<string, string> = { rank: ICON.podium, flag: ICON.flag, globe: ICON.target, gate: ICON.shield, gift: ICON.gift, rocket: ICON.rocket, coin: ICON.coin, car: ICON.car, trophy: ICON.trophy, play: ICON.play };
    for (const v of activeChains(s)) {
      const k = Math.min(1, v.value / v.target);
      card(g, x, y, w, 70, 14);
      g.icon(ic[v.icon] ?? ICON.target, x + 12, y + 10, 24, C.cyan);
      g.text(v.text, x + 44, y + 22, { size: 12, font: 'b', maxW: w - 130, noTr: true });
      g.rich(`<span class="price">${ICON.coin}${fmt(v.reward)}</span>`, x + w - 90, y + 13, 80, { size: 12, align: 'right' });
      bar(g, x + 12, y + 40, w - 24, 7, k, g.lin(x, 0, x + w, 0, [[0, '#4fc3ff'], [1, '#a77bff']]));
      for (let i = 0; i < v.tiers; i++) g.circle(x + 16 + i * 12, y + 58, 4, i < v.tier ? C.gold : i === v.tier ? C.cyan : 'rgba(255,255,255,.2)');
      g.text(`${fmt(v.value)} / ${fmt(v.target)}`, x + w - 12, y + 58, { size: 10, align: 'right', font: 'b', color: C.muted, noTr: true });
      y += 78;
    }
    g.rich(`Daily challenges are in ${ICON.calendar} Daily`, x, y + 4, w, { size: 11, align: 'center', font: 'b', color: C.muted });
    return y + 30;
  });
}

// ------------------------------------------------------------------ ranks
function ranks(ui: UI, g: Gfx) {
  pageBg(g);
  const b = ui.board;
  let y = pageHead(ui, g, 'TOP PILOTS');
  if (!b) return;
  const col = column(g);
  const x = col.x + 12,
    w = col.w - 24;
  ui.rowCache = [];
  // tabs
  const tw = (w - 8) / 2;
  (['week', 'all'] as const).forEach((tb, i) => {
    const on = b.tab === tb;
    const key = `rt-${tb}`;
    g.rr(x + i * (tw + 8), y, tw, 34, 17, on ? g.lin(0, y, 0, y + 34, [[0, '#3aa0ff'], [1, '#1f5fe0']]) : 'rgba(10,22,60,.8)', on ? '#fff' : 'rgba(255,255,255,.2)');
    g.text(tb === 'week' ? 'This week' : 'All time', x + i * (tw + 8) + tw / 2, y + 17, { size: 13, align: 'center' });
    g.hit(x + i * (tw + 8), y, tw, 34, key, () => ui.h.rankTab(tb));
  });
  y += 44;
  // podium
  const top3 = b.board.rows.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]];
  const pw = w / 3;
  order.forEach((r, i) => {
    if (!r) return;
    const cls = r.you ? ui.myClass : classFor(r.score);
    const idx = ui.rowCache.push({ r, cls }) - 1;
    const px = x + i * pw;
    const hgt = r.rank === 1 ? 0 : 16;
    const s = r.rank === 1 ? 60 : 50;
    avatar(g, r.av ?? avatarForName(r.name), px + (pw - s) / 2, y + hgt, s, cls);
    if (r.rank === 1) g.icon(ICON.crown, px + pw / 2 - 12, y - 14, 24);
    g.text(r.name, px + pw / 2, y + hgt + s + 12, { size: 11, align: 'center', maxW: pw - 6, color: r.you ? C.gold : '#fff', noTr: true });
    g.rich(`${r.flag} <b>${fmt(r.score)}</b>`, px, y + hgt + s + 20, pw, { size: 10, align: 'center' });
    const sh = r.rank === 1 ? 26 : r.rank === 2 ? 20 : 16;
    const stc = r.rank === 1 ? '#ffc21a' : r.rank === 2 ? '#c9d8f5' : '#ff9a5c';
    g.rr(px + 8, y + 116 - sh + 18, pw - 16, sh, 6, `${stc}55`, stc);
    g.text(`#${r.rank}`, px + pw / 2, y + 116 - sh / 2 + 18, { size: 12, align: 'center', noTr: true });
    g.hit(px, y, pw, 134, `pod-${i}`, () => ui.h.viewPlayer(idx));
  });
  y += 142;
  // you (fixed bottom)
  const sb = safeBottom(g);
  const youH = 80;
  const listH = g.H - y - sb - youH - 8;
  const row = (r: any, yy: number, total = 0) => {
    const cls = r.you ? ui.myClass : classFor(r.score);
    const idx = ui.rowCache.push({ r, cls }) - 1;
    const key = `lb-${idx}`;
    const unranked = r.you && r.score <= 0;
    g.rr(x, yy, w, 50, 12, r.you ? 'rgba(255,194,26,.16)' : g.isPressed(key) ? 'rgba(79,195,255,.2)' : 'rgba(10,20,52,.72)', r.you ? C.gold : 'rgba(130,175,255,.16)');
    g.text(unranked ? '—' : `#${fmt(r.rank)}`, x + 30, yy + 21, { size: 13, align: 'center', maxW: 52, noTr: true });
    const pct = total && r.rank > 100 && !unranked ? Math.max(0.1, (r.rank / total) * 100) : 0;
    if (pct) g.text(`Top ${pct < 1 ? pct.toFixed(1) : Math.ceil(pct)}%`, x + 30, yy + 37, { size: 8.5, align: 'center', color: C.gold, noTr: true });
    g.icon(avatarSvg(r.av ?? avatarForName(r.name)), x + 60, yy + 7, 36);
    g.text(r.name + (r.you ? '  YOU' : ''), x + 104, yy + 17, { size: 12, maxW: w - 210, color: r.pass ? C.gold : '#fff', noTr: true });
    g.rich(`${r.flag} <span class="clsb" style="--cc:${CLASS_COLOR[cls]}">${cls}</span>`, x + 104, yy + 25, w - 210, { size: 11 });
    g.rich(`<b>${fmt(r.score)}</b> ${BOLT}`, x + w - 110, yy + 16, 100, { size: 12, align: 'right' });
    g.hit(x, yy, w, 50, key, () => ui.h.viewPlayer(idx));
  };
  const rest = b.board.rows.slice(3);
  scrollList(g, 'lb', 0, y, g.W, listH, (yy) => {
    for (const r of rest) {
      row(r, yy);
      yy += 56;
    }
    g.para(b.extra.replace(/<[^>]+>/g, ''), x, yy + 4, w, { size: 10, font: 'b', color: C.muted, align: 'center' });
    return yy + 40;
  });
  const yy = g.H - sb - youH;
  const you = b.board.you;
  row(you, yy, b.board.total);
  const pct = Math.max(0.1, (you.rank / b.board.total) * 100);
  g.rich(you.score <= 0 ? 'Play a run to get ranked' : b.board.next ? `Top ${pct < 1 ? pct.toFixed(1) : Math.ceil(pct)}% · EXP <b>${fmt(b.board.next.score)}</b> to reach <b>#${fmt(b.board.next.rank)}</b>` : 'You are #1!', x, yy + 56, w, { size: 11, align: 'center', font: 'b', color: C.muted });
}

// ------------------------------------------------------------------ daily
function daily(ui: UI, g: Gfx) {
  pageBg(g);
  const o = ui.daily;
  const top = pageHead(ui, g, 'DAILY');
  if (!o) return;
  const col = column(g);
  const x = col.x + 12,
    w = col.w - 24;
  scrollList(g, 'daily', 0, top, g.W, g.H - top - safeBottom(g), (y) => {
    const h0 = y;
    g.dry++;
    g.dry--;
    card(g, x, y, w, 254, 16);
    g.text('Check-in', x + 14, y + 18, { size: 15 });
    g.text(`Streak ${o.streak} / 7`, x + w - 14, y + 18, { size: 11, align: 'right', font: 'b', color: C.muted, noTr: true });
    // 4 + 3 grid
    const gw = (w - 28 - 18) / 4;
    CHECKIN.forEach((r, i) => {
      const got = i < o.slot || (o.claimedToday && i === o.slot);
      const today = i === o.slot && !o.claimedToday;
      const row = i < 4 ? 0 : 1;
      const ci = i < 4 ? i : i - 4;
      const cw = row ? (w - 28 - 12) / 3 : gw;
      const cx = x + 14 + ci * (cw + 6);
      const cy = y + 36 + row * 80;
      g.rr(cx, cy, cw, 72, 10, today ? 'rgba(255,194,26,.22)' : got ? 'rgba(47,211,107,.15)' : 'rgba(255,255,255,.05)', today ? C.gold : got ? C.green : 'rgba(255,255,255,.12)', today ? 2 : 1);
      g.text(`Day ${i + 1}`, cx + cw / 2, cy + 11, { size: 9.5, align: 'center', font: 'b', color: C.muted, noTr: true });
      const item = Object.entries(r.items ?? {}).find(([, n]) => n) as [ItemKey, number] | undefined;
      g.icon(item ? ITEM_ICON[item[0]] : ICON.coin, cx + cw / 2 - 13, cy + 20, 26);
      g.text(fmt(r.coins ?? 0), cx + cw / 2, cy + 59, { size: 12, align: 'center', noTr: true });
      if (got) g.icon(ICON.check, cx + cw - 18, cy + 4, 14, C.green);
    });
    button(g, 'checkin', x + 14, y + 200, w - 28, 44, o.claimedToday ? `${ICON.check} Come back tomorrow` : `${ICON.gift} Claim day ${o.slot + 1}`, () => ui.h.checkIn(), { style: o.claimedToday ? 'ghost' : 'gold', disabled: o.claimedToday });
    y += 264;
    const qh = 34 + o.quests.length * 62;
    card(g, x, y, w, qh, 16);
    g.text('Daily missions', x + 14, y + 18, { size: 15 });
    g.rich(`${ICON.clock} resets in ${o.resetIn}`, x + w / 2, y + 10, w / 2 - 14, { size: 10.5, align: 'right', font: 'b', color: C.muted });
    let qy = y + 34;
    for (const q of o.quests) {
      g.rr(x + 10, qy, w - 20, 56, 10, q.claimed ? 'rgba(47,211,107,.1)' : 'rgba(255,255,255,.04)', 'rgba(255,255,255,.1)');
      g.text(q.text, x + 20, qy + 16, { size: 11.5, font: 'b', maxW: w - 120, noTr: true });
      g.rich(`<span class="price">${ICON.coin}${q.coins}</span>`, x + w - 90, qy + 7, 70, { size: 12, align: 'right' });
      bar(g, x + 20, qy + 34, w - 140, 7, q.progress / q.target, C.cyan);
      g.text(`${fmt(q.progress)}/${fmt(q.target)}`, x + w - 112, qy + 38, { size: 10, font: 'b', color: C.muted, noTr: true });
      if (q.claimed) g.icon(ICON.check, x + w - 44, qy + 26, 22, C.green);
      else if (q.done) button(g, `cq-${q.id}`, x + w - 80, qy + 26, 64, 26, 'Claim', () => ui.h.claimQuest(q.id), { style: 'green', size: 12 });
      qy += 62;
    }
    void h0;
    return y + qh + 10;
  });
}

// ------------------------------------------------------------------ cups (v1 events page, kept reachable)
function events(ui: UI, g: Gfx) {
  pageBg(g);
  const o = ui.events;
  const top = pageHead(ui, g, 'CUPS');
  if (!o) return;
  const col = column(g);
  const x = col.x + 12,
    w = col.w - 24;
  scrollList(g, 'events', 0, top, g.W, g.H - top - safeBottom(g), (y) => {
    const e = o.mine;
    card(g, x, y, w, 150, 16, e.cup.color);
    g.rich(`${o.live ? '<b class="live">LIVE</b>' : '<b class="soon">NEXT</b>'} <span class="clsb" style="--cc:${CLASS_COLOR[e.division]}">${e.division}</span> ${ICON.clock} ${o.live ? `ends in <b>${fmtLeft(e.end - o.now)}</b>` : `starts <b>${localTime(e.start)}</b>`}`, x + 14, y + 10, w - 28, { size: 11 });
    g.text(e.cup.name, x + 14, y + 44, { size: 20, italic: true, noTr: true });
    g.text(`Your best ${o.best ? fmt(o.best) : '—'} · rank ${o.rank ? `#${fmt(o.rank)}` : '—'} · ${fmt(o.total)} racers`, x + 14, y + 68, { size: 11, font: 'b', color: C.muted, maxW: w - 28, noTr: true });
    if (o.live) button(g, 'racecup', x + 14, y + 90, w - 28, 46, `${ICON.play} Race now`, () => ui.h.raceCup(), { style: 'gold' });
    else button(g, 'racecup', x + 14, y + 90, w - 28, 46, `${ICON.clock} Opens ${localTime(e.start)}`, () => {}, { style: 'ghost', disabled: true });
    y += 160;
    for (const p of o.prizes) {
      card(g, x, y, w, 40, 10);
      g.text(p.label, x + 12, y + 20, { size: 12, noTr: true });
      g.rich(`${BOLT}${p.bolts} ${p.hyper ? `${ICON.hyper}×${p.hyper}` : ''} <span class="price">${ICON.coin}${fmt(p.coins)}</span>`, x + w / 2, y + 11, w / 2 - 12, { size: 12, align: 'right' });
      y += 46;
    }
    return y;
  });
}

// ------------------------------------------------------------------ shop
function shop(ui: UI, g: Gfx) {
  pageBg(g);
  const s = ui.save;
  const top = pageHead(ui, g, 'SHOP');
  if (!s) return;
  const col = column(g);
  const x = col.x + 12,
    w = col.w - 24;
  scrollList(g, 'shop', 0, top, g.W, g.H - top - safeBottom(g), (y) => {
    // TikTok Beans products (HS dashboard) — shown only while the platform has a shop
    const prods = hs.hasShop() ? ui.products : [];
    const noAds = prods.filter((p) => !!p.items?.no_ads);
    const packs = prods.filter((p) => !p.items?.no_ads).sort((a, b) => (a.beans_cost ?? 0) - (b.beans_cost ?? 0) || (a.items?.coins ?? 0) - (b.items?.coins ?? 0));
    const buy = (p: (typeof prods)[number]) =>
      void hs.buy(p.product_id).then((r) => {
        // HSGame adds the items to the profile itself (coins / no_ads) — the game only says so
        if (r.ok) ui.toast(r.delivered === false ? `${ICON.clock} ${p.name} · paid — it arrives next time you open the game` : `${ICON.check} ${p.name} · thank you!`, 'var(--gold)');
        else if (r.error && !/cancel/i.test(r.error)) ui.toast(`${ICON.info} ${r.error}`, 'var(--red)');
        ui.dirty = true;
      });
    const badge = (text: string, bx: number, by: number, col = C.gold) => {
      const bw = g.measure(text, { size: 9 }) + 14;
      g.rr(bx - bw, by - 7, bw, 16, 8, col);
      g.text(text, bx - bw / 2, by + 1, { size: 9, align: 'center', color: '#2a1600', shadow: null, noTr: true });
    };
    // ---- Remove Ads (one purchase, forever)
    for (const p of noAds) {
      const owned = s.noAds;
      const h = 84;
      card(g, x, y, w, h, 16, owned ? C.green : '#ff4fd8');
      g.rr(x + 1, y + 1, w - 2, h - 2, 15, g.lin(x, 0, x + w, 0, [[0, 'rgba(255,79,216,.22)'], [1, 'rgba(79,195,255,.12)']]));
      if (p.badge && !owned) badge(p.badge, x + w - 10, y, '#ff8ae6');
      g.icon(ICON.noads, x + 14, y + 20, 44, '#fff');
      g.text(p.name, x + 68, y + 30, { size: 16, maxW: w - 196, noTr: true });
      g.para(p.description ?? 'No ad after a race, forever', x + 68, y + 42, w - 196, { size: 10.5, font: 'b', color: '#e8d6ff', noTr: true });
      const label = owned ? 'Owned' : p.price || `${p.beans_cost ?? 0} Beans`;
      button(g, `buy-${p.product_id}`, x + w - 116, y + 22, 104, 40, owned ? `${ICON.check} Owned` : label, () => buy(p), { style: owned ? 'ghost' : 'pink', disabled: owned, size: 13 });
      y += h + 12;
    }
    // ---- free coins (rewarded ad)
    if (hs.hasAds()) {
      const h = 58;
      card(g, x, y, w, h, 14, 'rgba(47,211,107,.55)');
      g.icon(ICON.play, x + 14, y + 15, 28, C.green);
      g.text('Free coins', x + 52, y + 23, { size: 14 });
      g.text('Watch an ad', x + 52, y + 41, { size: 10.5, font: 'b', color: C.muted });
      button(g, 'shop-free', x + w - 116, y + 11, 104, 36, `${ICON.play} Watch`, () => ui.h.freePop(), { style: 'green', size: 13 });
      y += h + 12;
    }
    // ---- coin packs
    if (packs.length) {
      g.text('Coin packs', x + 4, y + 12, { size: 15 });
      y += 26;
      // two columns of tiles (the cheapest first)
      const gap = 10;
      const tw = (w - gap) / 2,
        th = 136;
      packs.forEach((p, i) => {
        const tx = x + (i % 2) * (tw + gap),
          ty = y + Math.floor(i / 2) * (th + gap);
        const hot = !!p.badge;
        card(g, tx, ty, tw, th, 16, hot ? C.gold : 'rgba(130,175,255,.25)');
        if (hot) badge(p.badge!, tx + tw - 8, ty, C.gold);
        const coins = p.items?.coins ?? 0;
        const n = Math.min(4, 1 + i);
        for (let k = 0; k < n; k++) g.icon(ICON.coin, tx + tw / 2 - 16 - (n - 1) * 6 + k * 12, ty + 14 - (k % 2) * 4, 32);
        g.text(coins ? fmt(coins) : p.name, tx + tw / 2, ty + 62, { size: 18, align: 'center', italic: true, maxW: tw - 12, noTr: true });
        g.text(p.description ?? 'coins', tx + tw / 2, ty + 80, { size: 10, align: 'center', font: 'b', color: C.muted, maxW: tw - 12, noTr: true });
        button(g, `buy-${p.product_id}`, tx + 10, ty + th - 42, tw - 20, 34, p.price || `${p.beans_cost ?? 0} Beans`, () => buy(p), { style: 'gold', size: 13 });
      });
      y += Math.ceil(packs.length / 2) * (th + gap) + 4;
    } else if (!prods.length) {
      g.para('Coin packs and Remove Ads open soon on this platform. Earn coins by racing, daily check-in and missions.', x + 10, y + 6, w - 20, { size: 12, font: 'b', color: C.muted, align: 'center' });
      y += 60;
    }
    // ---- your items (bought with coins)
    card(g, x, y, w, 50, 14);
    g.text('Your items', x + 14, y + 25, { size: 12, font: 'b', color: C.muted });
    let ix = x + 100;
    for (const k of SPECIALS) {
      g.icon(ITEM_ICON[k], ix, y + 13, 24);
      g.text(`×${s.items[k]}`, ix + 27, y + 25, { size: 13, noTr: true });
      ix += 70;
    }
    y += 58;
    button(g, 'shop-bag', x, y, w, 46, `${ICON.coin} Buy items with coins`, () => {
      ui.buySync(s);
      ui.showOverlay('bagbuy');
    }, { style: 'purple' });
    return y + 56;
  });
}

// ------------------------------------------------------------------ countdown / tutorial
function countdown(ui: UI, g: Gfx) {
  const k = Math.min(1, (g.time - ui.countT) / 600);
  const s = 1.6 - 0.6 * (1 - Math.pow(1 - k, 3));
  g.alpha(1 - Math.max(0, (g.time - ui.countT - 700) / 400));
  g.ctx.save();
  g.ctx.translate(g.W / 2, g.H * 0.4);
  g.ctx.scale(s, s);
  g.text(ui.count, 0, 0, { size: 72, align: 'center', italic: true, color: ui.count === 'GO!' ? C.gold : '#fff', stroke: 'rgba(0,0,0,.5)', strokeW: 6 });
  g.ctx.restore();
  g.alpha(1);
}

function tutprompt(ui: UI, g: Gfx) {
  const st = ui.tut;
  if (!st) return;
  const W = g.W;
  const shake = g.time - ui.tutWrongT < 400 ? Math.sin((g.time - ui.tutWrongT) / 30) * 6 : 0;
  const w = Math.min(300, W - 40);
  const x = (W - w) / 2 + shake,
    y = safeTop(g) + 150;
  g.rr(x, y, w, 150, 18, 'rgba(8,16,44,.88)', C.cyan, 1.5);
  g.text(`STEP ${st.index + 1} / ${st.total}`, W / 2 + shake, y + 16, { size: 10, align: 'center', color: C.cyan, noTr: true });
  // gesture
  const rot: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
  const t = (g.time % 1200) / 1200;
  if (st.need in rot) {
    const r = (rot[st.need] * Math.PI) / 180;
    const dx = Math.cos(r) * (t * 50 - 25),
      dy = Math.sin(r) * (t * 50 - 25);
    g.icon(`<svg viewBox="0 0 24 24"><g transform="rotate(${rot[st.need]} 12 12)"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="#ffc21a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`, W / 2 - 20 + shake, y + 28, 40);
    g.icon(ICON.hand, W / 2 - 14 + dx + shake, y + 40 + dy, 28);
  } else g.icon(st.need === 'sos' ? ICON.sos : ICON.rocket, W / 2 - 20 + shake, y + 28, 40);
  g.text(st.title, W / 2 + shake, y + 92, { size: 20, align: 'center', italic: true, maxW: w - 20, noTr: true });
  g.para(st.sub, x + 14, y + 106, w - 28, { size: 11.5, font: 'b', color: '#cfe0ff', align: 'center', noTr: true });
}

function swipeHint(g: Gfx) {
  const t = (g.time % 1400) / 1400;
  const y = g.H * 0.62;
  g.icon(ICON.hand, g.W / 2 - 20 + Math.sin(t * Math.PI * 2) * 50, y, 40);
  g.text('SWIPE TO DODGE', g.W / 2, y + 60, { size: 18, align: 'center', italic: true, stroke: 'rgba(0,0,0,.5)', strokeW: 4 });
  g.text('← → change lane · ↑ fly up · ↓ fly down', g.W / 2, y + 84, { size: 11, align: 'center', font: 'b' });
}

export { panel, SPECIAL_SHORT, BAG_ICON, avatar };
