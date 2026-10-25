/** v3 native UI — overlays: results, pause, revive, settings, profile, Magic Bag, popups… */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LOG, logErrors } from '../log.ts';
import { C, Gfx, bar, button, card, fmt, iconBtn, panel, rankBadge, toggle, type BtnStyle } from './gfx.ts';
import type { UI } from './NativeUI.ts';
import { BAG_ICON, BOLT, BONUS_COLOR, BONUS_EMOJI, ICON, ITEM_ICON, ITEM_NAME, LOCKED_ICON, SPECIAL_COLOR, SPECIAL_HOW, SPECIAL_LINE, SPECIAL_SHORT, TUT_ICON, WIFI, BOOST_WHAT } from './consts.ts';
import { safeBottom, safeTop } from './layout.ts';
import { avatar } from './screens.ts';
import { AVATAR_COUNT, avatarSvg, avatarForName } from '../../ui/avatars.ts';
import { CLASSES, CLASS_COLOR, CLASS_MIN, type RankClass } from '../../meta/Rank.ts';
import { CHECKIN, ITEM_PRICE, LOCKED_SPECIALS, SPECIALS, type ItemKey, type SpecialKey } from '../../meta/Daily.ts';
import { COUNTRIES, countryName } from '../../meta/Country.ts';
import { codeOfFlag, flagSvg, svgFlags } from '../../meta/Flags.ts';
import { LANGS } from '../../ui/i18n.ts';
import { SKINS } from '../../render/Vehicle.ts';
import { carImage, carRear, logoImg } from '../../ui/shared.ts';
import { calendarGift, coinPile, giftBox, megaphone, shareNodes, starBig, wifiRobot, phonePlus } from '../../ui/art.ts';
import type { RunRewards } from '../../ui/UI.ts';
import { hs } from '../hs.ts';
import { askText } from '../text.ts';

type Close = 'modal' | 'ov' | 'none';
interface ModalOpts {
  title?: string;
  icon?: string;
  close?: Close;
  w?: number;
  /** no panel chrome (custom) */
  bare?: boolean;
  rim?: string;
}

/** centred modal panel; content draws at (x, y) within width w and returns its bottom y */
function modal(ui: UI, g: Gfx, id: string, o: ModalOpts, content: (x: number, y: number, w: number) => number) {
  const W = g.W,
    H = g.H;
  const close = o.close ?? 'ov';
  // backdrop
  g.rr(0, 0, W, H, 0, 'rgba(2,4,16,.66)');
  g.block(0, 0, W, H, close === 'modal' ? () => ui.h.closeModal() : () => {});
  const pw = Math.min(W - 24, o.w ?? 380);
  const pad = 16;
  const headH = o.title ? 46 : 0;
  g.dry++;
  const ch = content(pad, headH + 8, pw - pad * 2) - (headH + 8);
  g.dry--;
  const h = headH + 8 + ch + pad;
  const avail = H - safeTop(g) - safeBottom(g) - 24;
  let k = 1;
  if (h > avail) k = Math.max(0.78, avail / h);
  const ph = Math.min(h, avail / k);
  const px = (W - pw * k) / 2;
  const py = safeTop(g) + 12 + (avail - ph * k) / 2;
  g.push(px, py, k);
  if (!o.bare) panel(g, 0, 0, pw, ph, 20, o.rim);
  g.block(0, 0, pw, ph);
  if (o.title) {
    if (o.icon) g.icon(o.icon, pad, 12, 24);
    g.text(o.title, o.icon ? pad + 30 : pad, 25, { size: 17, italic: true, maxW: pw - 100 });
    if (close !== 'none') iconBtn(g, `x-${id}`, pw - 46, 8, 34, ICON.close, close === 'modal' ? () => ui.h.closeModal() : () => ui.hideOverlay(id));
  }
  if (h > ph + 1) {
    // still too tall: the body scrolls
    const top = headH + 4;
    const off = g.scroll(0, top, pw, ph - top - 6, `m-${id}`, ch + 20);
    g.clip(0, top, pw, ph - top - 6);
    content(pad, headH + 8 - off, pw - pad * 2);
    g.unclip();
  } else content(pad, headH + 8, pw - pad * 2);
  g.pop();
}

const OV: Record<string, (ui: UI, g: Gfx) => void> = {
  finish: finishOv,
  gameover: gameoverOv,
  continue: continueOv,
  pause: pauseOv,
  tutdone: tutdoneOv,
  tutintro: tutintroOv,
  settings: settingsOv,
  logs: logsOv,
  guide: guideOv,
  eventres: eventresOv,
  profile: profileOv,
  bonus: bonusOv,
  specialpick: specialpickOv,
  bag: bagOv,
  bagbuy: bagbuyOv,
  boostinfo: boostinfoOv,
  spconfirm: spconfirmOv,
  rankguide: rankguideOv,
  needrocket: needrocketOv,
  account: accountOv,
  cloudpick: cloudpickOv,
  popup: popupOv,
};
export function drawOverlay(ui: UI, g: Gfx, id: string) {
  OV[id]?.(ui, g);
}

/** v3.0.11 tap guards of the reward popups */
const tapAt: Record<string, number> = {};
let shareBusy = false;

// ------------------------------------------------------------------ helpers
const badge = (c: RankClass) => `<span class="clsb" style="--cc:${CLASS_COLOR[c]}">${c}</span>`;
function navRow(g: Gfx, x: number, y: number, w: number, items: [string, string, string, BtnStyle, () => void][]) {
  const n = items.length;
  const bw = (w - (n - 1) * 8) / n;
  items.forEach(([key, icon, label, st, fn], i) => button(g, key, x + i * (bw + 8), y, bw, 54, label, fn, { style: st, size: 16, icon }));
  return y + 60;
}
/** ad button: only drawn while the platform can show that ad (HS rule 12) */
function adBtn(ui: UI, g: Gfx, key: 'ad2x' | 'ad2xf', x: number, y: number, w: number) {
  if (!hs.hasAds() || !hs.canShowAd('double_coins')) return y;
  const st = ui.adState[key];
  if (st?.used) button(g, key, x, y, w, 42, `${ICON.check} ${st.text}`, () => {}, { style: 'ghost', disabled: true, size: 13 });
  else button(g, key, x, y, w, 42, `${ICON.play} Watch ad · +20% coins`, () => ui.h.adDouble(), { style: 'gold', size: 14 });
  return y + 50;
}
/** results "Rewards" box: coins (+ breakdown) and the rank bar */
function rewards(ui: UI, g: Gfx, r: RunRewards | null, coins: { label: string; coins: number }[], x: number, y: number, w: number) {
  const parts = coins.filter((c) => c.coins > 0).map((c) => ({ label: c.label, n: c.coins }));
  if (r) for (const m of r.missions) parts.push({ label: 'mission', n: m.reward });
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total && !r) return y;
  const y0 = y;
  g.dry++;
  const hh = rewardsBody();
  g.dry--;
  card(g, x, y0, w, hh - y0, 12);
  rewardsBody();
  return hh + 8;
  function rewardsBody() {
    let yy = y0 + 10;
    g.text('Rewards', x + 12, yy + 7, { size: 13 });
    if (r) {
      g.rich(`${ICON.info} EXP guide`, x + w - 110, yy - 2, 98, { size: 11, align: 'right', color: C.cyan });
      g.hit(x + w - 110, yy - 6, 104, 26, 'rg-link', () => ui.rankGuide());
    }
    yy += 20;
    if (total > 0) {
      g.rich(`${ICON.coin} <small>${parts.map((p) => `${fmt(p.n)} ${p.label.toLowerCase()}`).join(' · ')}</small>`, x + 12, yy, w - 100, { size: 12 });
      g.text(`+${fmt(total)}`, x + w - 12, yy + 9, { size: 16, align: 'right', color: C.gold, noTr: true });
      yy += 24;
    }
    if (r) {
      const ci = CLASSES.indexOf(r.clsAfter);
      const next = CLASSES[ci + 1] ?? null;
      const lo = CLASS_MIN[r.clsAfter];
      const hi = next ? CLASS_MIN[next] : lo;
      const kTo = next ? Math.min(1, (r.to - lo) / (hi - lo)) : 1;
      const kFrom = next && r.clsAfter === r.clsBefore ? Math.max(0, Math.min(1, (r.from - lo) / (hi - lo))) : 0;
      const up = r.clsAfter !== r.clsBefore;
      rankBadge(g, r.clsAfter, x + 12, yy, 18);
      const bx = x + 46,
        bw = w - 100;
      bar(g, bx, yy + 6, bw, 7, kTo, CLASS_COLOR[r.clsAfter]);
      if (kFrom > 0) bar(g, bx, yy + 6, bw * kFrom, 7, 1, 'rgba(255,255,255,.55)', 'transparent');
      if (next) rankBadge(g, next, x + w - 46, yy, 18);
      yy += 24;
      g.rich(up ? '<b class="gold">RANK UP!</b>' : next ? `${fmt(hi - r.to)} EXP to ${next}` : 'top', x + 12, yy, w - 24, { size: 11, align: 'center', font: 'b', color: C.muted });
      yy += 18;
      const chips: string[] = [];
      if (r.cup) chips.push(`${ICON.cup} ${badge(r.cup.div)} #${fmt(r.cup.rank)}`);
      for (const q of r.quests) chips.push(`${ICON.check} ${q}`);
      if (chips.length) {
        yy += g.rich(chips.join('  ·  '), x + 12, yy, w - 24, { size: 10.5, font: 'b', color: C.green });
      }
    }
    return yy + 6;
  }
}

// ------------------------------------------------------------------ END (Endless / Mega Rush / Bonus)
function gameoverOv(ui: UI, g: Gfx) {
  const o = ui.over;
  if (!o) return;
  const brag = !!o.runRank && CLASSES.indexOf(o.runRank) >= CLASSES.indexOf('C');
  modal(ui, g, 'gameover', { close: 'none', rim: brag ? CLASS_COLOR[o.runRank as RankClass] : undefined }, (x, y, w) => {
    iconBtn(g, 'go-x', x - 4, y - 4, 34, ICON.close, () => ui.h.home());
    iconBtn(g, 'go-share', x + w - 30, y - 4, 34, ICON.share, () => ui.h.share());
    g.img(logoImg, x + w / 2 - 60, y - 6, 120, 40, 'contain');
    y += 40;
    g.text(o.bonus ? 'BONUS END' : 'FINISH', x + w / 2, y + 14, { size: 26, align: 'center', italic: true, color: C.gold });
    y += 34;
    if (brag && o.runRank) {
      const cc = CLASS_COLOR[o.runRank as RankClass];
      const t = g.time / 2000;
      // rays + shield
      if (!g.dry) {
        g.ctx.save();
        g.ctx.translate(x + w / 2, y + 60);
        for (let i = 0; i < 12; i++) {
          g.ctx.rotate(Math.PI / 6);
          g.ctx.beginPath();
          g.ctx.moveTo(0, 0);
          g.ctx.arc(0, 0, 90, t, t + 0.18);
          g.ctx.fillStyle = `${cc}22`;
          g.ctx.fill();
        }
        g.ctx.restore();
      }
      rankBadge(g, o.runRank, x + w / 2 - 44, y + 22, 76);
      y += 120;
      g.rich(`RANK ${o.runRank}${o.isBest ? ` · <b class="gold">${ICON.trophy} NEW BEST</b>` : ''}`, x, y, w, { size: 15, align: 'center' });
      y += 24;
      g.rich(`<b>${fmt(o.score)}</b> ${BOLT}`, x, y, w, { size: 28, align: 'center' });
      y += 40;
      g.rich(`${ICON.flag}${fmt(o.dist)} m${o.pos ? ` · ${ICON.podium}${o.pos}` : ''}`, x, y, w, { size: 12, align: 'center', font: 'b', color: C.muted });
      y += 22;
      g.img(carRear(o.car ?? 'zenith'), x + w / 2 - 70, y, 140, 70, 'contain');
      y += 74;
      if (hs.hasShare()) {
        button(g, 'go-brag', x + 30, y, w - 60, 42, `${ICON.share} Share my rank`, () => ui.h.share(), { style: 'gold', size: 14 });
        y += 50;
      }
    } else {
      g.rich(`${BOLT} <b>${fmt(o.score)}</b>`, x, y, w, { size: 34, align: 'center' });
      y += 50;
      let line = '';
      if (o.runRank) line += `${badge(o.runRank)} <small>RACE RANK</small> <b>${o.runRank}</b>  `;
      if (o.isBest) line += `<b class="gold">${ICON.trophy} NEW BEST</b>  `;
      if (o.pos) line += `${ICON.podium}<b>${o.pos}</b>`;
      if (line) y += g.rich(line, x, y, w, { size: 13, align: 'center' }) + 6;
      if (!ui.hidden.gstats) {
        const sw = (w - 8) / 2;
        card(g, x, y, sw, 46, 10);
        card(g, x + sw + 8, y, sw, 46, 10);
        g.text('Distance', x + sw / 2, y + 13, { size: 9.5, align: 'center', font: 'b', color: C.muted });
        g.rich(`${ICON.flag}<b>${o.length ? `${fmt((o.dist / o.length) * 100)}%` : `${fmt(o.dist)} m`}</b>`, x, y + 22, sw, { size: 14, align: 'center' });
        g.text('Best', x + sw * 1.5 + 8, y + 13, { size: 9.5, align: 'center', font: 'b', color: C.muted });
        g.text(fmt(o.best), x + sw * 1.5 + 8, y + 33, { size: 14, align: 'center', noTr: true });
        y += 54;
      }
    }
    y = rewards(ui, g, o.rewards, [{ label: 'race', coins: o.coins }, { label: `${o.level} bonus`, coins: o.speedBonus }], x, y, w);
    y = adBtn(ui, g, 'ad2x', x, y, w);
    button(g, 'go-retry', x, y, w, 52, `${ICON.retry} Retry`, () => ui.h.retry(), { style: 'blue', size: 20 });
    y += 60;
    return navRow(g, x, y, w, [
      ['go-home', ICON.home, 'Home', 'blue', () => ui.h.home()],
      ['go-tracks', ICON.flag, 'Tracks', 'purple', () => ui.h.play()],
      ['go-garage', ICON.car, 'Garage', 'dark', () => ui.h.garage()],
    ]);
  });
}

function finishOv(ui: UI, g: Gfx) {
  const o = ui.fin;
  if (!o) return;
  modal(ui, g, 'finish', { close: 'none' }, (x, y, w) => {
    iconBtn(g, 'fi-x', x - 4, y - 4, 34, ICON.close, () => ui.h.home());
    if (hs.hasShare()) iconBtn(g, 'fi-share', x + w - 30, y - 4, 34, ICON.share, () => ui.h.share());
    g.img(logoImg, x + w / 2 - 60, y - 6, 120, 40, 'contain');
    y += 40;
    g.text('FINISH!', x + w / 2, y + 14, { size: 26, align: 'center', italic: true, color: C.gold });
    g.text(o.track, x + w / 2, y + 36, { size: 11, align: 'center', font: 'b', color: C.muted, noTr: true });
    y += 50;
    if (!o.bonus) {
      g.text([0, 1, 2].map((i) => (i < o.stars ? '★' : '☆')).join(' '), x + w / 2, y + 12, { size: 28, align: 'center', color: C.gold, noTr: true });
      y += 30;
    }
    g.text(fmt(o.score), x + w / 2, y + 16, { size: 30, align: 'center', italic: true, noTr: true });
    y += 34;
    if (o.isBest) {
      g.rich(`<b class="gold">${ICON.trophy} NEW BEST!</b>`, x, y, w, { size: 13, align: 'center' });
      y += 22;
    }
    if (o.bonusItems?.length) {
      card(g, x, y, w, 36, 10, C.purple);
      g.icon(BAG_ICON, x + 8, y + 6, 24);
      g.rich(`<b>Track bonus</b> <small>${o.bonusItems.join(' · ')}</small>`, x + 38, y + 9, w - 80, { size: 12 });
      g.text('BAG', x + w - 12, y + 18, { size: 12, align: 'right', color: C.gold });
      y += 42;
    }
    if (o.leftover) {
      card(g, x, y, w, 36, 10);
      g.icon(ICON.rocket, x + 8, y + 6, 24);
      g.rich(`<b>Unused boosts</b> <small>${o.leftover.items}</small>`, x + 38, y + 9, w - 90, { size: 12 });
      g.text(`+${fmt(o.leftover.pts)}`, x + w - 12, y + 18, { size: 12, align: 'right', color: C.gold, noTr: true });
      y += 42;
    }
    const m = Math.floor(o.time / 60);
    const stats: [string, string, string][] = [
      ['Time', ICON.flag, `${m}:${(o.time % 60).toFixed(1).padStart(4, '0')}`],
      ['Coins', ICON.coin, fmt(o.coins)],
      ['Lives lost', ICON.heart, String(o.lost)],
      ['Reward', ICON.coin, `+${fmt(o.reward)}`],
    ];
    const sw = (w - 18) / 4;
    stats.forEach(([l, ic, v], i) => {
      const sx = x + i * (sw + 6);
      card(g, sx, y, sw, 46, 10);
      g.text(l, sx + sw / 2, y + 12, { size: 8.5, align: 'center', font: 'b', color: C.muted, maxW: sw - 4 });
      g.rich(`${ic}<b>${v}</b>`, sx, y + 22, sw, { size: 11, align: 'center' });
    });
    y += 54;
    if (!o.bonus) {
      const rule = (ok: boolean, t: string) => `<span style="color:${ok ? C.gold : C.muted}">${ok ? '★' : '☆'} ${t}</span>`;
      y += g.rich(`${rule(true, 'Finish')}   ${rule(o.lost === 0, 'No lives lost')}   ${rule(o.coins >= o.coinTarget, `${o.coinTarget} coins`)}`, x, y, w, { size: 11, align: 'center', font: 'b' }) + 6;
    }
    y = rewards(ui, g, o.rewards, [{ label: 'run', coins: o.coins }, { label: `${o.level} bonus`, coins: o.speedBonus }, { label: 'track', coins: o.reward }], x, y, w);
    y = adBtn(ui, g, 'ad2xf', x, y, w);
    if (o.hasNext) {
      button(g, 'fi-next', x, y, w, 50, `${ICON.play} Next track`, () => ui.h.nextTrack(), { style: 'blue', size: 18 });
      y += 58;
    }
    return navRow(g, x, y, w, [
      ['fi-retry', ICON.retry, 'Retry', 'blue', () => ui.h.retry()],
      ['fi-tracks', ICON.flag, 'Tracks', 'purple', () => ui.h.play()],
      ['fi-home', ICON.home, 'Home', 'dark', () => ui.h.home()],
    ]);
  });
}

function continueOv(ui: UI, g: Gfx) {
  modal(ui, g, 'continue', { close: 'none', w: 320 }, (x, y, w) => {
    g.text('REVIVE?', x + w / 2, y + 14, { size: 26, align: 'center', italic: true });
    y += 36;
    const cx = x + w / 2,
      cy = y + 60;
    if (!g.dry) {
      g.circle(cx, cy, 52, 'rgba(0,0,0,.3)', 'rgba(255,255,255,.15)', 8);
      const c = g.ctx;
      c.beginPath();
      c.arc(cx, cy, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ui.cont.k);
      c.strokeStyle = C.gold;
      c.lineWidth = 8;
      c.lineCap = 'round';
      c.stroke();
    }
    g.text(String(Math.max(0, Math.ceil(ui.cont.sec))), cx, cy + 2, { size: 40, align: 'center', noTr: true });
    y += 130;
    g.rich(`<b>${ui.cont.left} / 2</b> revives left`, x, y, w, { size: 13, align: 'center' });
    y += 26;
    // v3.0.11: the ad button only while HSGame has a revive ad ready (re-checked every frame —
    // the countdown redraws the popup); otherwise a quiet "loading" line, never a dead button
    if (hs.canShowAd('continue')) button(g, 'contad', x, y, w, 54, `${ICON.play} Watch ad · Revive`, () => ui.h.continueAd(), { style: 'gold', size: 17 });
    else button(g, 'contad', x, y, w, 54, hs.hasAds() ? `${ICON.clock} Ad loading…` : `${ICON.info} No ad available`, () => {}, { style: 'ghost', disabled: true, size: 15 });
    y += 62;
    button(g, 'contno', x + 30, y, w - 60, 38, 'No thanks · end race', () => ui.h.continueNo(), { style: 'ghost', size: 13 });
    return y + 42;
  });
}

function pauseOv(ui: UI, g: Gfx) {
  const s = ui.save;
  modal(ui, g, 'pause', { close: 'none', w: 330 }, (x, y, w) => {
    g.text('Paused', x + w / 2, y + 16, { size: 31, align: 'center', italic: true });
    y += 44;
    const tw = (w - 16) / 3;
    const items: [string, string, string, () => void, boolean][] = [
      ['p-sound', s?.settings.sound ? ICON.sound : ICON.soundOff, 'SFX', () => ui.h.toggleSound(), !!s?.settings.sound],
      ['p-music', s?.settings.music ? ICON.music : ICON.musicOff, 'MUSIC', () => ui.h.toggleMusic(), !!s?.settings.music],
      ['p-q', ICON.gear, (ui.liveQuality ?? s?.settings.quality ?? 'high').toUpperCase(), () => ui.h.toggleQuality(), true],
    ];
    items.forEach(([k, ic, l, fn, on], i) => button(g, k, x + i * (tw + 8), y, tw, 46, l, fn, { style: on ? 'dark' : 'ghost', icon: ic, size: 15 }));
    y += 56;
    button(g, 'resume', x, y, w, 60, `${ICON.play} Resume`, () => ui.h.resume(), { style: 'gold', size: 24 });
    y += 68;
    return navRow(g, x, y, w, [
      ['p-retry', ICON.retry, 'Retry', 'blue', () => ui.h.retry()],
      ['p-home', ICON.home, 'Home', 'dark', () => ui.h.home()],
    ]);
  });
}

function tutdoneOv(ui: UI, g: Gfx) {
  const p = ui.tutDoneP ?? null;
  modal(ui, g, 'tutdone', { close: 'none', w: 340 }, (x, y, w) => {
    g.circle(x + w / 2, y + 30, 28, C.green);
    g.icon(ICON.check, x + w / 2 - 18, y + 12, 36, '#fff');
    y += 70;
    g.text(p ? `${SPECIAL_SHORT[p].toUpperCase()} PRACTICE DONE` : 'TRAINING COMPLETE', x + w / 2, y, { size: 20, align: 'center', italic: true, maxW: w });
    y += 18;
    y += g.rich(p ? 'Nice! In a race, carry it in from your <b>Magic Bag</b> — 1 special per race.' : "You're ready! <b>Distance = EXP</b>, and EXP is your rank. Every new rank is guarded by a hard <b>rank gate</b>.", x, y, w, { size: 12.5, align: 'center', font: 'b', color: '#cfe0ff' }) + 8;
    if (!p) {
      y += g.rich(`${badge('D')} → ${badge('C')} <small>≈ 3 min on Hard</small>`, x, y, w, { size: 14, align: 'center' }) + 8;
    }
    button(g, 'td-play', x, y, w, 54, `${ICON.play} ${p ? 'Race' : 'Race Endless'}`, () => ui.h.play(), { style: 'gold', size: 19 });
    y += 62;
    const bw = (w - 8) / 2;
    button(g, 'td-again', x, y, bw, 44, `${ICON.retry} ${p ? 'Again' : 'Replay'}`, () => ui.h.trainAgain(), { style: 'ghost', size: 13 });
    button(g, 'td-home', x + bw + 8, y, bw, 44, `${ICON.home} Home`, () => ui.h.home(), { style: 'ghost', size: 13 });
    return y + 48;
  });
}

function tutintroOv(ui: UI, g: Gfx) {
  modal(ui, g, 'tutintro', { title: 'TUTORIAL', icon: TUT_ICON, close: 'modal' }, (x, y, w) => {
    y += g.rich("Learn the moves and practise each special. You can't crash in training.", x, y, w, { size: 12, font: 'b', color: '#cfe0ff', align: 'center' }) + 8;
    g.text('1  Basics · first flight', x, y + 8, { size: 13, color: C.cyan });
    y += 22;
    const tiles: [string, string, string][] = [
      ['← →', 'Swipe left / right', 'Exactly one lane per swipe'],
      ['↑', 'Swipe up', 'One hop over low obstacles'],
      ['↓', 'Swipe down', 'Slide under beams'],
      ['', 'Your special', 'Tap its button to jump a block'],
    ];
    const tw = (w - 8) / 2;
    tiles.forEach(([gl, b, s], i) => {
      const tx = x + (i % 2) * (tw + 8),
        ty = y + Math.floor(i / 2) * 70;
      card(g, tx, ty, tw, 64, 10);
      if (gl) g.text(gl, tx + 26, ty + 32, { size: 18, align: 'center', color: C.gold, noTr: true });
      else g.icon(ICON.rocket, tx + 12, ty + 18, 28);
      g.text(b, tx + 48, ty + 22, { size: 11.5, maxW: tw - 54 });
      g.para(s, tx + 48, ty + 32, tw - 54, { size: 9.5, font: 'b', color: C.muted });
    });
    y += 144;
    button(g, 'tutstart', x, y, w, 46, `${ICON.play} Start training`, () => ui.h.startTutorial(), { style: 'blue', size: 16 });
    y += 56;
    g.text('2  Special items', x, y + 8, { size: 13, color: C.cyan });
    y += 22;
    const iw = (w - 16) / 3;
    (['super', 'hyper', 'escape'] as ItemKey[]).forEach((k, i) => {
      const ix = x + i * (iw + 8);
      const key = `bt-${k}`;
      g.rr(ix, y, iw, 76, 12, g.isPressed(key) ? 'rgba(79,195,255,.25)' : 'rgba(10,20,52,.8)', SPECIAL_COLOR[k as SpecialKey]);
      g.icon(ITEM_ICON[k], ix + iw / 2 - 15, y + 8, 30);
      g.text(ITEM_NAME[k], ix + iw / 2, y + 50, { size: 10, align: 'center', maxW: iw - 6 });
      g.rich(`${ICON.target} <small>Practise</small>`, ix, y + 58, iw, { size: 11, align: 'center', color: C.cyan });
      g.hit(ix, y, iw, 76, key, () => ui.h.boostTrain(k));
    });
    y += 86;
    button(g, 'tutskip', x + 40, y, w - 80, 38, 'Skip · go racing', () => ui.h.skipTutorial(), { style: 'ghost', size: 13 });
    return y + 42;
  });
}

function settingsOv(ui: UI, g: Gfx) {
  const s = ui.save;
  if (!s) return;
  modal(ui, g, 'settings', { title: 'SETTINGS', close: 'modal' }, (x, y, w) => {
    const tiles: [string, string, string, boolean, () => void][] = [
      ['sound', ICON.sound, 'Sound', s.settings.sound, () => ui.h.toggleSound()],
      ['music', ICON.music, 'Music', s.settings.music, () => ui.h.toggleMusic()],
      ['vibrate', '≋', 'Vibration', s.settings.vibrate !== false, () => ui.h.toggleVibrate()],
      ['assist', ICON.info, 'Hint arrows', s.settings.assist !== false, () => ui.h.toggleAssist()],
      ['comfort', '◐', 'Eye comfort', s.settings.comfort !== false, () => ui.h.toggleComfort()],
    ];
    const tw = (w - 8) / 2;
    tiles.forEach(([k, ic, l, on, fn], i) => {
      const tx = x + (i % 2) * (tw + 8),
        ty = y + Math.floor(i / 2) * 56;
      card(g, tx, ty, tw, 48, 12);
      if (ic.startsWith('<svg')) g.icon(ic, tx + 8, ty + 13, 22, C.cyan);
      else g.text(ic, tx + 19, ty + 24, { size: 16, align: 'center', color: C.cyan, noTr: true });
      g.text(l, tx + 36, ty + 24, { size: 11.5, maxW: tw - 92 });
      toggle(g, `s-${k}`, tx + tw - 54, ty + 11, on, fn);
    });
    // graphics HI / LO
    {
      const tx = x + tw + 8,
        ty = y + 112;
      card(g, tx, ty, tw, 48, 12);
      g.icon(ICON.gear, tx + 8, ty + 13, 22, C.cyan);
      g.text('Graphics', tx + 36, ty + 24, { size: 11.5, maxW: tw - 110 });
      const q = ui.liveQuality ?? s.settings.quality;
      (['high', 'low'] as const).forEach((v, i) => {
        const bx = tx + tw - 76 + i * 34;
        const on = q === v;
        g.rr(bx, ty + 12, 32, 24, 8, on ? C.blue : 'rgba(255,255,255,.1)', 'rgba(255,255,255,.25)');
        g.text(v === 'high' ? 'HI' : 'LO', bx + 16, ty + 24, { size: 11, align: 'center', noTr: true });
        g.hit(bx - 2, ty + 6, 36, 36, `q-${v}`, () => (on ? undefined : ui.h.toggleQuality()));
      });
    }
    y += 172;
    const row = (key: string, ic: string, label: string, val: string, fn: () => void) => {
      g.rr(x, y, w, 44, 12, g.isPressed(key) ? 'rgba(79,195,255,.2)' : 'rgba(10,20,52,.8)', 'rgba(130,175,255,.2)');
      g.text(ic, x + 18, y + 22, { size: 16, align: 'center', noTr: true });
      g.text(label, x + 38, y + 22, { size: 13 });
      g.text(val, x + w - 30, y + 22, { size: 12, align: 'right', font: 'b', color: C.muted, maxW: w / 2, noTr: true });
      g.icon(ICON.chevR, x + w - 24, y + 14, 16, '#fff');
      g.hit(x, y, w, 44, key, fn);
      y += 52;
    };
    row('s-lang', '🌐', 'Language', LANGS.find((l) => l.code === ui.lang)?.name ?? 'English', () => ui.langPicker());
    const bw = (w - 8) / 2;
    button(g, 's-prof', x, y, bw, 40, `${ICON.user} Profile`, () => ui.h.profile(), { style: 'ghost', size: 12 });
    button(g, 's-help', x + bw + 8, y, bw, 40, `${ICON.info} How to play`, () => ui.h.help(), { style: 'ghost', size: 12 });
    y += 50;
    g.text(`Sky Roadster ${ui.version}`, x + w / 2, y + 6, { size: 10, align: 'center', font: 'b', color: C.muted, noTr: true });
    // hidden test info: tap the version 5 times (colour calibration, GPU, audio)
    g.hit(x + w / 2 - 60, y - 6, 120, 24, 's-ver', () => {
      ui.verTaps = (ui.verTaps ?? 0) + 1;
      if (ui.verTaps >= 5) ui.showDiag = !ui.showDiag;
    });
    y += 16;
    if (ui.showDiag && ui.colorCtl) y += g.para(ui.colorCtl.line(), x, y, w, { size: 8.5, font: 'b', color: C.muted, align: 'center', noTr: true });
    if (ui.showDiag) {
      button(g, 's-logs', x + w / 2 - 70, y + 4, 140, 32, `Logs · ${logErrors()} errors`, () => ui.showOverlay('logs'), { style: 'ghost', size: 11 });
      y += 40;
    }
    return y + 4;
  });
}

/** v3.0.11 in-game log viewer (src/native/log.ts) — newest first, errors red, warnings amber */
function logsOv(ui: UI, g: Gfx) {
  const W = g.W,
    H = g.H;
  g.rr(0, 0, W, H, 0, 'rgba(2,4,14,.94)');
  g.block(0, 0, W, H);
  const top = safeTop(g) + 6;
  g.text(`LOG · ${LOG.length} lines · ${logErrors()} errors`, 14, top + 16, { size: 13, font: 'b', noTr: true });
  button(g, 'lg-close', W - 84, top, 72, 32, 'Close', () => ui.hideOverlay('logs'), { style: 'blue', size: 12 });
  button(g, 'lg-clear', W - 164, top, 72, 32, 'Clear', () => {
    LOG.length = 0;
    ui.dirty = true;
  }, { style: 'ghost', size: 12 });
  let y = top + 44;
  const lines = LOG.slice().reverse();
  for (const l of lines) {
    if (y > H - safeBottom(g) - 14) break;
    const tm = new Date(l.t);
    const ts = `${String(tm.getHours()).padStart(2, '0')}:${String(tm.getMinutes()).padStart(2, '0')}:${String(tm.getSeconds()).padStart(2, '0')}`;
    const col = l.lv === 'error' ? '#ff8a8a' : l.lv === 'warn' ? '#ffd27a' : '#c9d8f5';
    y += g.para(`${ts} ${l.msg}`, 10, y, W - 20, { size: 9.5, font: 'b', color: col, noTr: true }) + 3;
  }
}

function guideOv(ui: UI, g: Gfx) {
  modal(ui, g, 'guide', { title: 'ROADSTER JUMP', close: 'modal' }, (x, y, w) => {
    y += g.rich('The rocket jump that clears <b>two rows</b> of obstacles and rolls 360° in the sky.', x, y, w, { size: 12, font: 'b', color: '#cfe0ff', align: 'center' }) + 8;
    const steps: [string, string][] = [
      ['Spot the purple rocket', 'Appears after 250 m, floating in a lane. Swipe into its lane to grab it.'],
      ['The ROADSTER button appears', 'A purple ROADSTER button shows bottom-right with how many you hold.'],
      ['Tap ROADSTER to launch', 'Flies 5.6 m over cars blocking every lane, barrel roll at the top.'],
    ];
    steps.forEach(([b, s], i) => {
      g.dry++;
      const hh = g.para(s, 0, 0, w - 60, { size: 11, font: 'b' });
      g.dry--;
      card(g, x, y, w, hh + 34, 12);
      g.circle(x + 20, y + 20, 12, C.purple);
      g.text(String(i + 1), x + 20, y + 20.5, { size: 12, align: 'center', noTr: true });
      g.text(b, x + 42, y + 18, { size: 13, maxW: w - 50 });
      g.para(s, x + 42, y + 28, w - 54, { size: 11, font: 'b', color: C.muted });
      y += hh + 42;
    });
    card(g, x, y, w, 64, 12, C.gold);
    g.icon(ICON.hyper, x + 10, y + 14, 34);
    g.text('Mythic HYPER JUMP', x + 52, y + 16, { size: 13, color: C.gold });
    g.para('7.4 m high, double roll, golden trail. Fires from the same button (gold).', x + 52, y + 26, w - 60, { size: 10.5, font: 'b', color: C.muted });
    y += 72;
    button(g, 'g-train', x, y, w, 48, `${ICON.play} Practice it`, () => ui.h.boostTrain('super'), { style: 'blue', size: 16 });
    return y + 52;
  });
}

function eventresOv(ui: UI, g: Gfx) {
  modal(ui, g, 'eventres', { close: 'none' }, (x, y, w) => {
    g.icon(ICON.cup, x + w / 2 - 24, y, 48);
    y += 56;
    g.text('CUP RESULTS', x + w / 2, y + 8, { size: 20, align: 'center', italic: true });
    y += 26;
    for (const r of ui.eventRes) {
      card(g, x, y, w, 80, 12, r.inst.cup.color);
      g.rich(`${badge(r.inst.division)} <b>${r.inst.cup.name}</b>`, x + 10, y + 8, w - 20, { size: 13 });
      g.text(`#${fmt(r.rank)}`, x + w - 14, y + 20, { size: 22, align: 'right', color: C.gold, noTr: true });
      g.text(`Your best ${fmt(r.score)} · ${r.prize.label}`, x + 10, y + 42, { size: 10.5, font: 'b', color: C.muted, maxW: w - 20, noTr: true });
      g.rich(`${BOLT}${r.prize.bolts}  <span class="price">${ICON.coin}${fmt(r.prize.coins)}</span>${r.prize.hyper ? `  ${ICON.hyper}×${r.prize.hyper}` : ''}`, x + 10, y + 54, w - 20, { size: 12 });
      y += 88;
    }
    button(g, 'claimresults', x, y, w, 52, `${ICON.gift} Collect`, () => ui.h.claimResults(), { style: 'gold', size: 18 });
    return y + 56;
  });
}

// ------------------------------------------------------------------ profile
function profileOv(ui: UI, g: Gfx) {
  if (ui.player !== null) return rivalOv(ui, g);
  const o = ui.prof;
  if (!o) return;
  modal(ui, g, 'profile', { title: 'YOUR PROFILE' }, (x, y, w) => {
    avatar(g, o.avatar, x, y, 76, o.cls);
    // name: tap to change (native text prompt)
    const nk = 'pname';
    g.rr(x + 90, y + 6, w - 90, 40, 10, g.isPressed(nk) ? 'rgba(79,195,255,.25)' : 'rgba(255,255,255,.08)', 'rgba(255,255,255,.25)');
    g.text(o.name, x + 102, y + 26, { size: 16, maxW: w - 140, noTr: true });
    g.text('✎', x + w - 18, y + 26, { size: 15, align: 'center', color: C.cyan, noTr: true });
    g.hit(x + 90, y + 6, w - 90, 40, nk, () => void askText('Pilot name', o.name, 14).then((n) => n !== null && ui.h.setName(n)));
    g.text('Tap the name to change it', x + 92, y + 60, { size: 10, font: 'b', color: C.muted });
    y += 88;
    // avatar strip (horizontal)
    const s = 46;
    const total = AVATAR_COUNT * (s + 6);
    const sw = w - 52;
    const off = g.scroll(x, y, sw, s + 8, 'avstrip', total, true);
    g.clip(x, y - 2, sw, s + 10);
    for (let i = 0; i < AVATAR_COUNT; i++) {
      const ax = x + i * (s + 6) - off;
      if (ax < x - s || ax > x + sw) continue;
      if (i === o.avatar) g.circle(ax + s / 2, y + s / 2 + 2, s / 2 + 2, null, C.gold, 3);
      g.icon(avatarSvg(i), ax, y + 2, s);
      g.hit(ax, y, s, s + 4, `av-${i}`, () => ui.h.setAvatar(i));
    }
    g.unclip();
    button(g, 'avrand', x + w - 44, y + 4, 44, 44, '🎲', () => ui.h.randomAvatar(), { style: 'purple', size: 18 });
    y += s + 16;
    const rowBtn = (key: string, icon: string, small: string, big: string, act: string, fn: () => void) => {
      g.rr(x, y, w, 50, 12, g.isPressed(key) ? 'rgba(79,195,255,.2)' : 'rgba(10,20,52,.8)', 'rgba(130,175,255,.2)');
      if (icon.startsWith('<svg')) g.icon(icon, x + 10, y + 11, 28);
      else g.text(icon, x + 24, y + 25, { size: 22, align: 'center', noTr: true });
      g.text(small, x + 48, y + 16, { size: 9.5, font: 'b', color: C.muted });
      g.text(big, x + 48, y + 34, { size: 13, maxW: w - 130, noTr: true });
      g.text(act, x + w - 12, y + 25, { size: 11, align: 'right', color: C.cyan });
      g.hit(x, y, w, 50, key, fn);
      y += 58;
    };
    rowBtn('p-bag', BAG_ICON, 'Magic Bag', 'Specials · 1 per race', 'Open', () => ui.h.bag());
    rowBtn('p-ctry', flagSvg(o.country || 'US'), 'Country', countryName(o.country || 'US'), 'Change', () => ui.countryPicker());
    // rank hero
    const cc = CLASS_COLOR[o.cls];
    card(g, x, y, w, 132, 16, cc, 'rgba(10,20,52,.9)');
    rankBadge(g, o.cls, x + 14, y + 14, 54);
    g.text('RANK', x + 14 + 32, y + 80, { size: 9, align: 'center', color: cc });
    g.text('BEST EXP', x + 110, y + 24, { size: 10, font: 'b', color: C.muted });
    g.rich(`<b>${fmt(o.bolts)}</b> ${BOLT}`, x + 110, y + 34, w - 120, { size: 24 });
    bar(g, x + 14, y + 94, w - 28, 7, o.k, cc);
    g.rich(o.next ? `<b>${fmt(o.need)}</b> EXP to ${badge(o.next)}` : 'Top rank reached', x + 14, y + 106, w - 28, { size: 11.5, align: 'center' });
    y += 140;
    // ladder
    const lw = (w - 8 * 4) / CLASSES.length;
    CLASSES.forEach((c, i) => {
      const lx = x + i * (lw + 4);
      const cur = c === o.cls;
      const done = CLASSES.indexOf(c) < CLASSES.indexOf(o.cls);
      g.rr(lx, y, lw, 22, 6, cur ? `${CLASS_COLOR[c]}55` : done ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.25)', cur ? CLASS_COLOR[c] : 'rgba(255,255,255,.12)');
      g.text(c, lx + lw / 2, y + 11, { size: 9.5, align: 'center', color: done || cur ? CLASS_COLOR[c] : C.muted, maxW: lw - 2, noTr: true });
    });
    y += 30;
    const sw2 = (w - 8) / 2;
    card(g, x, y, sw2, 46, 10);
    card(g, x + sw2 + 8, y, sw2, 46, 10);
    g.text('Races', x + sw2 / 2, y + 13, { size: 9.5, align: 'center', font: 'b', color: C.muted });
    g.text(fmt(o.runs), x + sw2 / 2, y + 32, { size: 15, align: 'center', noTr: true });
    g.text('Car', x + sw2 * 1.5 + 8, y + 13, { size: 9.5, align: 'center', font: 'b', color: C.muted });
    g.text(o.car.replace('XWAVE ', ''), x + sw2 * 1.5 + 8, y + 32, { size: 13, align: 'center', maxW: sw2 - 8, noTr: true });
    y += 54;
    button(g, 'p-guide', x, y, sw2, 38, `${ICON.info} EXP guide`, () => ui.rankGuide(), { style: 'ghost', size: 12 });
    button(g, 'p-ranks', x + sw2 + 8, y, sw2, 38, `${ICON.podium} Leaderboard`, () => ui.h.ranks(), { style: 'ghost', size: 12 });
    return y + 42;
  });
}

function rivalOv(ui: UI, g: Gfx) {
  const e = ui.rowCache[ui.player!];
  if (!e) return;
  const { r, cls } = e;
  const p = rival(r.name, r.score);
  modal(ui, g, 'profile', { title: 'PILOT' }, (x, y, w) => {
    avatar(g, r.av ?? avatarForName(r.name), x, y, 70, cls);
    if (r.rank <= 3) g.icon(ICON.crown, x + 23, y - 14, 24);
    g.text(r.name, x + 86, y + 24, { size: 18, maxW: w - 90, color: r.pass ? C.gold : '#fff', noTr: true });
    g.rich(`${svgFlags(r.flag ?? '')} · ${p.seen}`, x + 86, y + 41, w - 90, { size: 11, font: 'b', color: p.online ? C.green : C.muted });
    y += 84;
    card(g, x, y, w, 60, 14, CLASS_COLOR[cls]);
    rankBadge(g, cls, x + 12, y + 14, 32);
    g.text(`Rank ${cls}`, x + 60, y + 22, { size: 15, noTr: true });
    g.text(`#${fmt(r.rank)} on this board`, x + 60, y + 41, { size: 10.5, font: 'b', color: C.muted, noTr: true });
    g.rich(`${BOLT}<b>${fmt(r.score)}</b>`, x + w - 120, y + 20, 108, { size: 14, align: 'right' });
    y += 68;
    const st: [string, string][] = [['Avg EXP', fmt(p.avg)], ['Races', fmt(p.runs)], ['Streak', `${p.streak} d`], ['Car', p.car]];
    const sw = (w - 8) / 2;
    st.forEach(([l, v], i) => {
      const sx = x + (i % 2) * (sw + 8),
        sy = y + Math.floor(i / 2) * 54;
      card(g, sx, sy, sw, 46, 10);
      g.text(l, sx + sw / 2, sy + 13, { size: 9.5, align: 'center', font: 'b', color: C.muted });
      g.text(v, sx + sw / 2, sy + 32, { size: 14, align: 'center', maxW: sw - 8, noTr: true });
    });
    return y + 108;
  });
}

function rival(name: string, score: number) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  const rnd = (k: number) => ((Math.imul(h ^ (k * 2654435761), 1597334677) >>> 0) % 10000) / 10000;
  const online = rnd(1) < 0.3;
  return {
    runs: Math.round(40 + rnd(2) * 900 + score / 40),
    car: SKINS[Math.floor(rnd(3) * SKINS.length)].name.replace('XWAVE ', ''),
    avg: Math.round(score * (0.45 + rnd(11) * 0.25)),
    seen: online ? 'Online now' : rnd(7) < 0.5 ? `Last seen ${1 + Math.floor(rnd(8) * 50)}m ago` : `Last seen ${1 + Math.floor(rnd(9) * 20)}h ago`,
    online,
    streak: 1 + Math.floor(rnd(10) * 30),
  };
}

// ------------------------------------------------------------------ bonus / special / bag
function bonusOv(ui: UI, g: Gfx) {
  const o = ui.bonus;
  if (!o) return;
  modal(ui, g, 'bonus', { title: 'BONUS', icon: ICON.gift }, (x, y, w) => {
    const cc = BONUS_COLOR[o.theme] ?? '#ffc21a';
    g.rr(x, y, w, 100, 16, g.lin(0, y, 0, y + 100, [[0, `${cc}66`], [1, `${cc}22`]]), cc, 1.5);
    g.text(BONUS_EMOJI[o.theme] ?? '🏁', x + w / 2, y + 30, { size: 32, align: 'center', noTr: true });
    g.text(o.name, x + w / 2, y + 64, { size: 20, align: 'center', italic: true, noTr: true });
    g.rich(o.live ? `<b class="live">OPEN</b> ${o.left} left` : `<b class="soon">NEXT</b> ${o.opens}`, x, y + 76, w, { size: 11.5, align: 'center', font: 'b' });
    y += 110;
    const rules = [
      `${ICON.clock}<b>${o.minutes} min</b> to the finish · <b>Replay freely</b>`,
      `${ICON.coin}<b>Coins only</b> · finish +${fmt(o.finish)}`,
      `${ICON.rocket}<b>Rare specials</b> fire by themselves`,
      `${ICON.gift}<b>Every hour</b> · open 30 min · random place`,
    ];
    for (const r of rules) y += g.rich(r, x + 4, y, w - 8, { size: 12, font: 'b', color: '#dfe8ff' }) + 4;
    y += 6;
    if (o.live && !o.played) button(g, 'bonusgo', x, y, w, 54, `${ICON.play} Race`, () => ui.h.bonusGo(), { style: 'gold', size: 20 });
    else button(g, 'bonusgo', x, y, w, 46, o.live ? `${ICON.check} Played · next ${o.opensAt}` : `${ICON.lock} Opens ${o.opensAt}`, () => {}, { style: 'ghost', disabled: true, size: 13 });
    y += 60;
    if (o.next) y += g.rich(`Next: ${o.next}`, x, y, w, { size: 10.5, align: 'center', font: 'b', color: C.muted });
    return y + 4;
  });
}

function specialpickOv(ui: UI, g: Gfx) {
  const s = ui.save;
  if (!s || !ui.pick) return;
  modal(ui, g, 'specialpick', { title: 'SPECIAL', icon: BAG_ICON }, (x, y, w) => {
    g.text(ui.pick!.track, x + w / 2, y + 8, { size: 14, align: 'center', color: C.cyan, noTr: true });
    y += 24;
    const k = s.special && s.items[s.special] > 0 ? s.special : null;
    const key = 'bagpick';
    const cc = k ? SPECIAL_COLOR[k] : '#8a52f0';
    g.rr(x, y, w, 84, 16, g.isPressed(key) ? `${cc}66` : `${cc}2a`, cc, 2);
    g.icon(k ? ITEM_ICON[k] : BAG_ICON, x + 14, y + 14, 56);
    g.text(k ? SPECIAL_SHORT[k] : 'No special', x + 84, y + 34, { size: 20, italic: true, maxW: w - 120 });
    g.text(k ? `×${s.items[k]} in bag · tap to change` : 'Tap to pick one', x + 84, y + 56, { size: 11, font: 'b', color: C.muted, maxW: w - 120 });
    g.icon(ICON.chevR, x + w - 30, y + 30, 22, '#fff');
    g.hit(x, y, w, 84, key, () => ui.h.bagPick());
    y += 94;
    g.rich(`${ICON.info} 1 special per race · used only if you tap it`, x, y, w, { size: 11, align: 'center', font: 'b', color: C.muted });
    y += 26;
    button(g, 'sgo', x, y, w, 58, `${ICON.play} GO`, () => ui.h.goRace(), { style: 'gold', size: 24 });
    return y + 62;
  });
}

function bagOv(ui: UI, g: Gfx) {
  const s = ui.save;
  if (!s) return;
  const pick = ui.bagPick;
  modal(ui, g, 'bag', { title: 'MAGIC BAG', icon: BAG_ICON }, (x, y, w) => {
    card(g, x, y, w, 38, 10);
    g.icon(ICON.coin, x + 8, y + 8, 22);
    g.text(fmt(s.wallet), x + 36, y + 19, { size: 15, noTr: true });
    g.text('1 special per race', x + w - 10, y + 19, { size: 10.5, align: 'right', font: 'b', color: C.muted });
    y += 46;
    g.text(pick ? 'Pick your special' : 'In your bag', x, y + 8, { size: 14 });
    y += 22;
    const tw = (w - 16) / 3;
    SPECIALS.forEach((k, i) => {
      const n = s.items[k];
      const on = pick && s.special === k && n > 0;
      const tx = x + i * (tw + 8);
      const key = `bg-${k}`;
      g.alpha(n > 0 ? 1 : 0.45);
      g.rr(tx, y, tw, 96, 14, on ? `${SPECIAL_COLOR[k]}55` : g.isPressed(key) ? 'rgba(79,195,255,.2)' : 'rgba(10,20,52,.85)', on ? SPECIAL_COLOR[k] : 'rgba(255,255,255,.2)', on ? 2.5 : 1);
      g.icon(ITEM_ICON[k], tx + tw / 2 - 20, y + 10, 40);
      g.text(SPECIAL_SHORT[k], tx + tw / 2, y + 64, { size: 13, align: 'center', maxW: tw - 6 });
      g.text(`×${n}`, tx + tw / 2, y + 82, { size: 12, align: 'center', color: C.gold, noTr: true });
      g.alpha(1);
      if (on) g.icon(ICON.check, tx + tw - 22, y + 4, 18, C.green);
      g.hit(tx, y, tw, 96, key, () => {
        if (pick) {
          if (n > 0) ui.spConfirm(k);
          else ui.h.chooseSpecial(k);
        } else ui.h.boostInfo(k);
      });
    });
    y += 106;
    if (pick) {
      const key = 'bg-none';
      const on = !s.special;
      g.rr(x, y, w, 40, 12, on ? 'rgba(255,255,255,.14)' : 'rgba(10,20,52,.8)', on ? '#fff' : 'rgba(255,255,255,.2)');
      g.rich(`${on ? ICON.check : '—'} Race without a special`, x, y + 11, w, { size: 12.5, align: 'center' });
      g.hit(x, y, w, 40, key, () => ui.h.chooseSpecial(''));
      y += 48;
    }
    button(g, 'bagbuy', x, y, w, 46, `${ICON.coin} Buy items`, () => {
      ui.buySync(s);
      ui.showOverlay('bagbuy');
    }, { style: 'gold', size: 15 });
    y += 56;
    const lw = (w - 60) / LOCKED_SPECIALS.length;
    LOCKED_SPECIALS.forEach((l, i) => {
      const lx = x + i * lw;
      g.alpha(0.5);
      g.icon(LOCKED_ICON[l.id] ?? ICON.lock, lx + lw / 2 - 13, y, 26);
      g.text(l.short, lx + lw / 2, y + 36, { size: 9.5, align: 'center', font: 'b', noTr: true });
      g.alpha(1);
      g.hit(lx, y - 4, lw, 46, `lk-${l.id}`, () => ui.toast(`${ICON.lock} Opens at rank AAA · try it now in a Bonus event`, '#b7a6ff'));
    });
    g.rich(`${ICON.lock}${badge('AAA')}`, x + w - 60, y + 10, 60, { size: 12, align: 'right' });
    return y + 46;
  });
}

function bagbuyOv(ui: UI, g: Gfx) {
  const s = ui.save;
  if (!s) return;
  modal(ui, g, 'bagbuy', { title: 'BUY ITEMS', icon: ICON.coin }, (x, y, w) => {
    card(g, x, y, w, 38, 10);
    g.icon(ICON.coin, x + 8, y + 8, 22);
    g.text(fmt(s.wallet), x + 36, y + 19, { size: 15, noTr: true });
    g.text('Buy any amount · keep them in the bag', x + w - 10, y + 19, { size: 10, align: 'right', font: 'b', color: C.muted, maxW: w - 110 });
    y += 46;
    for (const k of SPECIALS) {
      card(g, x, y, w, 64, 12, SPECIAL_COLOR[k]);
      g.icon(ITEM_ICON[k], x + 10, y + 12, 40);
      g.rich(`<b>${SPECIAL_SHORT[k]}</b> <span class="price">×${s.items[k]}</span>`, x + 60, y + 12, w - 170, { size: 14 });
      g.text(SPECIAL_LINE[k], x + 60, y + 44, { size: 10.5, font: 'b', color: C.muted, maxW: w - 170 });
      button(g, `sbuy-${k}`, x + w - 100, y + 14, 90, 36, `${ICON.coin}${fmt(ITEM_PRICE[k])}`, () => ui.h.buySpecial(k), { style: s.wallet >= ITEM_PRICE[k] ? 'gold' : 'pink', size: 13 });
      y += 72;
    }
    button(g, 'bb-back', x, y, w, 42, `${ICON.chevL} Back to the bag`, () => ui.hideOverlay('bagbuy'), { style: 'ghost', size: 13 });
    return y + 46;
  });
}

function boostinfoOv(ui: UI, g: Gfx) {
  const b = ui.boost;
  if (!b) return;
  const sk = (SPECIALS as readonly string[]).includes(b.k) ? (b.k as SpecialKey) : null;
  modal(ui, g, 'boostinfo', { title: (sk ? SPECIAL_SHORT[sk] : ITEM_NAME[b.k]).toUpperCase() }, (x, y, w) => {
    g.circle(x + w / 2, y + 50, 46, sk ? `${SPECIAL_COLOR[sk]}33` : 'rgba(255,255,255,.08)', sk ? SPECIAL_COLOR[sk] : '#fff', 2);
    g.icon(ITEM_ICON[b.k], x + w / 2 - 30, y + 20, 60);
    g.text(`×${b.owned}`, x + w / 2 + 44, y + 86, { size: 16, color: C.gold, noTr: true });
    y += 110;
    y += g.para(sk ? SPECIAL_HOW[sk] : BOOST_WHAT[b.k], x, y, w, { size: 13, font: 'b', color: '#dfe8ff', align: 'center' }) + 10;
    if (sk) {
      button(g, 'bi-train', x, y, w, 50, `${ICON.target} Practice`, () => ui.h.boostTrain(b.k), { style: 'blue', size: 17 });
      y += 58;
      button(g, 'bi-buy', x, y, w, 44, `${ICON.coin}${fmt(ITEM_PRICE[b.k])} · Buy 1`, () => ui.h.buySpecial(b.k), { style: b.wallet >= ITEM_PRICE[b.k] ? 'gold' : 'pink', size: 15 });
      y += 48;
    }
    return y;
  });
}

function spconfirmOv(ui: UI, g: Gfx) {
  const k = ui.spc;
  if (!k) return;
  modal(ui, g, 'spconfirm', { close: 'none', w: 320 }, (x, y, w) => {
    g.circle(x + w / 2, y + 44, 42, `${SPECIAL_COLOR[k]}33`, SPECIAL_COLOR[k], 2);
    g.icon(ITEM_ICON[k], x + w / 2 - 28, y + 16, 56);
    y += 100;
    g.text(`Take ${SPECIAL_SHORT[k]}?`, x + w / 2, y, { size: 20, align: 'center', italic: true });
    y += 18;
    y += g.para(`${SPECIAL_LINE[k]}. It is used only if you tap it in the race.`, x, y, w, { size: 12, font: 'b', color: '#cfe0ff', align: 'center' }) + 10;
    const bw = (w - 8) / 2;
    button(g, 'spc-no', x, y, bw, 46, 'Cancel', () => ui.hideOverlay('spconfirm'), { style: 'ghost', size: 14 });
    button(g, 'spc-ok', x + bw + 8, y, bw, 46, `${ICON.check} Take it`, () => {
      ui.hideOverlay('spconfirm');
      ui.h.chooseSpecial(k);
    }, { style: 'gold', size: 14 });
    return y + 50;
  });
}

function rankguideOv(ui: UI, g: Gfx) {
  modal(ui, g, 'rankguide', { title: '& RANK', icon: BOLT }, (x, y, w) => {
    const UNL: Record<RankClass, [string, string][]> = {
      D: [['car:zenith', 'Zenith']], C: [['car:vega', 'Vega']], B: [['car:volt', 'Volt']], A: [['car:phantom', 'Phantom']], AA: [['car:inferno', 'Inferno']],
      AAA: [['car:nexus', 'Nexus'], ['flag', 'Mega Rush'], ['rocket', 'AAA specials']],
      S: [['flag', 'Ocean Drive']], SS: [['flag', 'Volcano Run']], SSS: [['flag', 'Aurora Peak']],
    };
    g.text('Rank', x + 8, y + 8, { size: 10, font: 'b', color: C.muted });
    g.text('EXP', x + 70, y + 8, { size: 10, font: 'b', color: C.muted });
    g.text('Unlocks', x + 140, y + 8, { size: 10, font: 'b', color: C.muted });
    y += 20;
    for (const c of CLASSES) {
      // v3.0.9: unlocks wrap onto extra lines inside the row (AAA has three) — never past the card
      const ux0 = x + 140,
        right = x + w - 6;
      const items = UNL[c].map(([ic, n]) => ({ ic, n, iw: 34 + Math.min(g.measure(n, { size: 10, font: 'b' }), right - ux0 - 36) + 10 }));
      let lines = 1,
        cx = ux0;
      for (const it of items) {
        if (cx > ux0 && cx + it.iw > right) {
          lines++;
          cx = ux0;
        }
        cx += it.iw;
      }
      const rh = 36 + (lines - 1) * 28;
      g.rr(x, y, w, rh, 8, 'rgba(255,255,255,.04)');
      rankBadge(g, c, x + 6, y + rh / 2 - 10, 20);
      g.text(fmt(CLASS_MIN[c]), x + 70, y + rh / 2, { size: 12, noTr: true });
      let ux = ux0,
        ly = y;
      for (const it of items) {
        if (ux > ux0 && ux + it.iw > right) {
          ux = ux0;
          ly += 28;
        }
        if (it.ic.startsWith('car:')) g.img(carImage(it.ic.slice(4)), ux, ly + 6, 34, 24, 'contain');
        else g.icon(it.ic === 'flag' ? ICON.flag : ICON.rocket, ux + 8, ly + 9, 18, C.cyan);
        g.text(it.n, ux + 36, ly + 18, { size: 10, font: 'b', maxW: it.iw - 44, noTr: true });
        ux += it.iw;
      }
      y += rh + 4;
    }
    y += 4;
    y += g.rich(`${BOLT} = metres × <b>Hard 1.7 · Normal 1.05 · Easy 1</b>`, x, y, w, { size: 12, font: 'b' }) + 4;
    y += g.rich(`${ICON.lock} EXP can't be bought`, x, y, w, { size: 12, font: 'b' });
    return y + 4;
  });
}

function needrocketOv(ui: UI, g: Gfx) {
  const o = ui.nr;
  modal(ui, g, 'needrocket', { close: 'none', w: 340 }, (x, y, w) => {
    g.icon(ICON.rocket, x + w / 2 - 28, y, 56);
    y += 66;
    g.text('ROADSTER JUMP NEEDED', x + w / 2, y, { size: 17, align: 'center', italic: true, maxW: w });
    y += 16;
    y += g.rich('Cars block every lane — only a <b>Roadster Jump</b> gets you past. Collect the purple rocket on the road, or get one now.', x, y, w, { size: 12, font: 'b', color: '#cfe0ff', align: 'center' }) + 10;
    if (o) {
      if (o.owned > 0) {
        button(g, 'nr-use', x, y, w, 50, `${ICON.rocket} Use one · you own ×${o.owned}`, () => ui.h.rocketFix('use'), { style: 'blue', size: 15 });
        y += 58;
      }
      if (o.wallet >= o.price) button(g, 'nr-buy', x, y, w, 46, `Buy 1 · <span class="price">${ICON.coin}${fmt(o.price)}</span>`, () => ui.h.rocketFix('buy'), { style: 'gold', size: 15 });
      else button(g, 'nr-shop', x, y, w, 46, `${ICON.bag} Get Roadster Jumps`, () => ui.h.rocketFix('shop'), { style: 'pink', size: 15 });
      y += 54;
      button(g, 'nr-retry', x + 20, y, w - 40, 38, `${ICON.retry} Retry & collect the rocket`, () => ui.h.rocketFix('retry'), { style: 'ghost', size: 12 });
      y += 42;
    }
    return y;
  });
}

function accountOv(ui: UI, g: Gfx) {
  modal(ui, g, 'account', { title: 'ACCOUNT' }, (x, y, w) => {
    g.text('☁️', x + w / 2, y + 26, { size: 40, align: 'center', noTr: true });
    y += 60;
    y += g.rich('Your progress is saved <b>on this device</b>.', x, y, w, { size: 13, align: 'center', font: 'b' });
    return y + 10;
  });
}

function cloudpickOv(ui: UI, g: Gfx) {
  const c = ui.cloudPick;
  if (!c) return;
  modal(ui, g, 'cloudpick', { title: 'WHICH PROGRESS?', close: 'none' }, (x, y, w) => {
    y += g.para('This phone and your account have different progress. Pick the one to keep — the other is replaced.', x, y, w, { size: 12, font: 'b', color: '#cfe0ff', align: 'center' }) + 8;
    const cw = (w - 8) / 2;
    ([['device', 'THIS PHONE', c.device], ['cloud', 'ACCOUNT (CLOUD)', c.cloud]] as const).forEach(([k, t, s], i) => {
      const cx = x + i * (cw + 8);
      card(g, cx, y, cw, 150, 14, C.cyan);
      g.text(t, cx + cw / 2, y + 14, { size: 10, align: 'center', font: 'b', color: C.muted });
      rankBadge(g, s.rank, cx + cw / 2 - 22, y + 26, 36);
      g.text(`${fmt(s.exp)} EXP`, cx + cw / 2, y + 82, { size: 14, align: 'center', noTr: true });
      g.text(`${fmt(s.coins)} coins · ${fmt(s.races)} races`, cx + cw / 2, y + 102, { size: 9.5, align: 'center', font: 'b', color: C.muted, maxW: cw - 8, noTr: true });
      button(g, `ck-${k}`, cx + 8, y + 112, cw - 16, 30, 'Keep this', () => ui.h.cloud('keep', k), { style: 'blue', size: 12 });
    });
    return y + 156;
  });
}

// ------------------------------------------------------------------ popups (daily · ad · gift · Entry / Launch / Share · country · language)
function popupOv(ui: UI, g: Gfx) {
  if (ui.popView === 'country') return countryOv(ui, g);
  if (ui.popView === 'lang') return langOv(ui, g);
  const p = ui.popData;
  if (!p) return;
  const d = p.d;
  const close = () => ui.closePopup();
  const head = (art: string, title: string, x: number, y: number, w: number) => {
    g.icon(art, x, y - 4, 40);
    g.text(title, x + 48, y + 16, { size: 18, italic: true, maxW: w - 96 });
    iconBtn(g, 'pop-x', x + w - 32, y, 34, ICON.close, close);
    return y + 48;
  };
  const coinBig = (n: number, x: number, y: number, w: number, pre = 'x') => {
    g.icon(coinPile(230, 126), x + w / 2 - 90, y, 180, '#fff', 98);
    g.text(`${pre}${fmt(n)}`, x + w / 2, y + 112, { size: 28, align: 'center', italic: true, color: C.gold, stroke: '#4a2a00', strokeW: 4, noTr: true });
    return y + 134;
  };
  const steps = (list: [string, boolean][], x: number, y: number, w: number) => {
    list.forEach(([t, done], i) => {
      card(g, x, y, w, 40, 10, done ? C.green : 'rgba(167,123,255,.4)');
      g.circle(x + 20, y + 20, 12, done ? C.green : '#8a3dff');
      if (done) g.icon(ICON.check, x + 12, y + 12, 16, '#fff');
      else g.text(String(i + 1), x + 20, y + 20.5, { size: 12, align: 'center', noTr: true });
      g.text(t, x + 42, y + 20, { size: 12, font: 'b', maxW: w - 50 });
      y += 46;
    });
    return y;
  };
  // v3.0.11: one tap = one start (rapid taps never start a mission / share twice)
  const once = (key: string, fn: () => unknown, ms = 1500) => () => {
    const now = Date.now();
    if (now - (tapAt[key] ?? 0) < ms) return;
    tapAt[key] = now;
    fn();
  };
  const rewardOf = (r: Record<string, number> | null, fallback: number) => (r ? r.coins ?? Object.values(r)[0] ?? 0 : fallback);
  modal(ui, g, 'popup', { close: 'none', w: 360 }, (x, y, w) => {
    switch (p.kind) {
      case 'daily': {
        const slot = Number(d.slot);
        const claimed = !!d.claimed;
        y = head(calendarGift(44), 'DAILY REWARD', x, y, w);
        CHECKIN.forEach((r, i) => {
          const got = i < slot || (claimed && i === slot);
          const today = i === slot && !claimed;
          g.rr(x, y, w, 36, 10, today ? 'rgba(255,194,26,.2)' : got ? 'rgba(47,211,107,.1)' : 'rgba(255,255,255,.04)', today ? C.gold : 'rgba(255,255,255,.1)', today ? 2 : 1);
          g.text(`Day ${i + 1}`, x + 12, y + 18, { size: 12, color: today ? C.gold : '#fff', noTr: true });
          const items = Object.entries(r.items ?? {}).filter(([, n]) => n) as [ItemKey, number][];
          let ix = x + 80;
          for (const [k, n] of items) {
            g.icon(ITEM_ICON[k], ix, y + 7, 22);
            g.text(`${ITEM_NAME[k]}${n > 1 ? ` ×${n}` : ''}`, ix + 26, y + 18, { size: 10.5, font: 'b', maxW: 110, noTr: true });
            ix += 140;
          }
          if (r.coins) {
            g.icon(ICON.coin, ix, y + 8, 20);
            g.text(`x${fmt(r.coins)}`, ix + 24, y + 18, { size: 12, noTr: true });
          }
          if (got) g.icon(ICON.check, x + w - 28, y + 9, 18, C.green);
          else if (!today) g.icon(ICON.lock, x + w - 28, y + 9, 18, 'rgba(255,255,255,.4)');
          y += 40;
        });
        y += 4;
        if (claimed) button(g, 'pd-claim', x, y, w, 50, `${ICON.check} Come back tomorrow`, () => {}, { style: 'ghost', disabled: true });
        else button(g, 'pd-claim', x, y, w, 50, 'CLAIM', () => ui.h.popAction('claimdaily'), { style: 'blue', size: 20 });
        y += 58;
        g.text(`Streak ${Number(d.streak)} / 7 · missing a day restarts at Day 1`, x + w / 2, y + 4, { size: 10, align: 'center', font: 'b', color: C.muted, noTr: true });
        return y + 14;
      }
      case 'ad': {
        const left = Number(d.left);
        y = head(ICON.play, 'WATCH AD REWARD', x, y, w);
        g.text('Watch an ad to get', x + w / 2, y, { size: 13, align: 'center', font: 'b' });
        y = coinBig(Number(d.amount), x, y + 12, w);
        const can = hs.hasAds() && hs.canShowAd('free_coins');
        if (left > 0 && can) button(g, 'pa-watch', x, y, w, 54, `${ICON.play} WATCH AD`, () => ui.h.popAction('watchad'), { style: 'gold', size: 20 });
        else button(g, 'pa-watch', x, y, w, 50, `${ICON.clock} ${left > 0 ? 'No ad available right now' : 'Come back tomorrow'}`, () => {}, { style: 'ghost', disabled: true, size: 13 });
        y += 62;
        g.text(left > 0 ? `${left} left today` : 'All free rewards used today', x + w / 2, y + 4, { size: 10.5, align: 'center', font: 'b', color: C.muted });
        return y + 14;
      }
      case 'gift': {
        y = head(giftBox(46), 'REVISIT GIFT', x, y, w);
        y += g.rich('Welcome back!<br/>Here\'s a gift for you!', x, y, w, { size: 14, align: 'center' });
        y = coinBig(Number(d.coins), x, y + 8, w);
        if (Number(d.shield)) {
          y += g.rich(`+ ${ICON.shield}×${Number(d.shield)} Start Shield`, x, y, w, { size: 13, align: 'center' }) + 6;
        }
        button(g, 'pg-claim', x, y, w, 52, 'CLAIM', () => ui.h.popAction('gift'), { style: 'gold', size: 20 });
        return y + 56;
      }
      // ---- TikTok review popups (HS kit): numbered steps + the reward from HSGame.rewards(key)
      case 'entry':
      case 'invite': {
        y = head(giftBox(46), 'ENTRY REWARD', x, y, w);
        const done = hs.entryDone();
        y = steps([['Go to your TikTok profile', done], ['Open "TikTok Minis"', done], ['Open Sky Roadster from there', done], ['Come back and get the reward', done]], x, y, w);
        y = coinBig(rewardOf(hs.entryReward(), 300), x, y + 4, w, '+');
        if (done) button(g, 'pe-go', x, y, w, 50, `${ICON.check} Reward claimed`, () => {}, { style: 'ghost', disabled: true });
        else button(g, 'pe-go', x, y, w, 54, 'GO', once('entry', () => hs.entryStart()), { style: 'blue', size: 22 });
        return y + 58;
      }
      case 'launch':
      case 'addscreen': {
        y = head(megaphone(46), 'LAUNCH REWARD', x, y, w);
        const done = hs.launchDone();
        y = steps([['Tap "Go"', done], ['Add the game to your home screen', done], ['Open the game from the new icon', done], ['Get the reward', done]], x, y, w);
        y = coinBig(rewardOf(hs.launchReward(), 300), x, y + 4, w, '+');
        if (done) button(g, 'pl-go', x, y, w, 50, `${ICON.check} Reward claimed`, () => {}, { style: 'ghost', disabled: true });
        else button(g, 'pl-go', x, y, w, 54, 'GO', once('launch', () => hs.launchStart()), { style: 'blue', size: 22 });
        return y + 58;
      }
      case 'share': {
        const rw = hs.shareReward();
        y = head(shareNodes(46), 'SHARE REWARDS', x, y, w);
        g.text('Share the game with friends', x + w / 2, y + 4, { size: 14, align: 'center' });
        y += 20;
        const key = 'ps-card';
        g.rr(x, y, w, 120, 14, g.isPressed(key) ? 'rgba(79,195,255,.25)' : 'rgba(10,20,52,.85)', 'rgba(130,190,255,.35)');
        g.img(carImage(String(d.vehicle ?? 'zenith')), x + 10, y + 8, w - 20, 84, 'contain');
        g.icon(avatarSvg(Number(d.avatar ?? 0)), x + 12, y + 10, 40);
        g.rich(`${ICON.share} Tap to share`, x, y + 96, w, { size: 12, align: 'center', color: C.cyan });
        const share = () => {
          if (shareBusy) return; // the share sheet is already open
          shareBusy = true;
          void hs
            .share('Sky Roadster', `Race me in Sky Roadster! Rank ${ui.myClass}.`)
            .then((r) => {
              // a rewarded share shows "Reward Claimed!" from HSGame's 'given' event (main.ts)
              if (r === 'shared' && !rw) ui.toast(`${ICON.check} Shared — thanks!`, 'var(--green)');
            })
            .finally(() => {
              shareBusy = false;
              ui.dirty = true;
            });
        };
        g.hit(x, y, w, 120, key, share);
        y += 128;
        if (rw) y = coinBig(rewardOf(rw, 0), x, y, w, '+');
        button(g, 'ps-go', x, y, w, 54, `${ICON.share} SHARE`, share, { style: 'green', size: 20 });
        y += 62;
        if (rw) g.text('Reward once a day', x + w / 2, y + 2, { size: 10.5, align: 'center', font: 'b', color: C.muted });
        return y + 12;
      }
      case 'rate': {
        // no store rating inside a mini game: thank the player instead
        y = head(starBig(40), 'ENJOYING IT?', x, y, w);
        y += g.rich('Thanks for racing Sky Roadster!<br/>Share it with a friend if you like it.', x, y, w, { size: 13, align: 'center', font: 'b' }) + 10;
        button(g, 'pr-ok', x, y, w, 48, 'OK', close, { style: 'blue', size: 18 });
        return y + 52;
      }
      default: {
        y = head(WIFI, 'NO CONNECTION', x, y, w);
        y += g.rich('Please check your internet<br/>connection and try again.', x, y, w, { size: 13, align: 'center', font: 'b' }) + 6;
        g.icon(wifiRobot(200, 132), x + w / 2 - 80, y, 160, '#fff', 106);
        y += 112;
        button(g, 'po-retry', x, y, w, 50, `${ICON.retry} RETRY`, () => ui.h.popAction('retry'), { style: 'blue', size: 18 });
        y += 58;
        g.text("You can still race offline.", x + w / 2, y + 2, { size: 10.5, align: 'center', font: 'b', color: C.muted });
        return y + 12;
      }
    }
  });
  void phonePlus;
}

function countryOv(ui: UI, g: Gfx) {
  const list = [...COUNTRIES].map((c) => ({ c, n: countryName(c) })).sort((a, b) => a.n.localeCompare(b.n));
  const W = g.W,
    H = g.H;
  g.rr(0, 0, W, H, 0, 'rgba(2,4,16,.66)');
  g.block(0, 0, W, H);
  const pw = Math.min(W - 24, 360);
  const px = (W - pw) / 2,
    py = safeTop(g) + 20;
  const ph = H - py - safeBottom(g) - 20;
  panel(g, px, py, pw, ph, 20);
  g.block(px, py, pw, ph);
  g.text('🌍', px + 26, py + 26, { size: 20, align: 'center', noTr: true });
  g.text('COUNTRY', px + 48, py + 26, { size: 17, italic: true });
  iconBtn(g, 'ct-x', px + pw - 46, py + 9, 34, ICON.close, () => ui.closePopup());
  const top = py + 52;
  const lh = ph - 60;
  const off = g.scroll(px, top, pw, lh, 'country', list.length * 44 + 10);
  g.clip(px, top, pw, lh);
  list.forEach(({ c, n }, i) => {
    const y = top + i * 44 - off;
    if (y < top - 44 || y > top + lh) return;
    const key = `ct-${c}`;
    g.rr(px + 10, y, pw - 20, 38, 10, g.isPressed(key) ? 'rgba(79,195,255,.25)' : 'rgba(255,255,255,.04)');
    g.icon(flagSvg(c), px + 18, y + 11, 24);
    g.text(n, px + 52, y + 19, { size: 13, font: 'b', maxW: pw - 80, noTr: true });
    g.hit(px + 10, y, pw - 20, 38, key, () => {
      ui.closePopup();
      ui.h.setCountry(c);
    });
  });
  g.unclip();
}

function langOv(ui: UI, g: Gfx) {
  modal(ui, g, 'popup', { title: 'LANGUAGE', close: 'none', w: 340 }, (x, y, w) => {
    iconBtn(g, 'lg-x', x + w - 30, y - 50, 34, ICON.close, () => ui.closePopup());
    const bw = (w - 8) / 2;
    LANGS.forEach((l, i) => {
      const bx = x + (i % 2) * (bw + 8),
        by = y + Math.floor(i / 2) * 50;
      const on = l.code === ui.lang;
      const key = `lg-${l.code}`;
      g.rr(bx, by, bw, 42, 12, on ? 'rgba(79,195,255,.25)' : g.isPressed(key) ? 'rgba(255,255,255,.12)' : 'rgba(10,20,52,.8)', on ? C.cyan : 'rgba(255,255,255,.15)');
      g.icon(flagSvg(codeOfFlag(l.flag)), bx + 8, by + 13, 24);
      g.text(l.name, bx + 40, by + 21, { size: 12, font: 'b', maxW: bw - 64, noTr: true });
      if (on) g.icon(ICON.check, bx + bw - 24, by + 12, 18, C.green);
      g.hit(bx, by, bw, 42, key, () => {
        ui.closePopup();
        ui.h.setLang(l.code);
      });
    });
    return y + Math.ceil(LANGS.length / 2) * 50;
  });
}
