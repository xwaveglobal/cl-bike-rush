/** v3 native UI — race HUD, ROADSTER / SOS buttons, notices, pops, flyers */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { C, Gfx, bar, cssColor, fmt, rankBadge, shade } from './gfx.ts';
import type { UI } from './NativeUI.ts';
import { ARROW, BOLT, CHEV, ICON } from './consts.ts';
import { CLASSES, CLASS_COLOR, CLASS_MIN, classFor } from '../../meta/Rank.ts';
import { withAlpha } from './svg.ts';
import { belowCap, capRow, safeTop, safeBottom } from './layout.ts';

const CHIP_COL: Record<string, string> = { coin2: '#ffd24a', shield: '#3d9bff', magnet: '#ff3b4e', turbo: '#b6ff2e', double: '#ffc21a', super: '#9b6bff', hyper: '#ffc21a', dash: '#2ee6c8' };
const CHIP_IC: Record<string, string> = { coin2: ICON.coin, shield: ICON.shield, magnet: ICON.magnet, turbo: ICON.bolt, double: ICON.x2, super: ICON.rocket, hyper: ICON.hyper, dash: ICON.dash };

/** where HUD things are (flyers aim here) */
export const hudPos: Record<string, { x: number; y: number }> = {};

export function drawHud(ui: UI, g: Gfx) {
  const run = ui.hud.run;
  const W = g.W;
  const row = capRow(g);
  const top = row.top;
  const t = g.time;
  // ---- pause (H5: 44 px glossy square)
  {
    const k = 'pause';
    const pr = g.isPressed(k);
    g.shadow('rgba(0,0,0,.45)', 6, 2);
    g.rr(12, top, 44, 44, 14, g.lin(0, top, 0, top + 44, [[0, pr ? '#2a3f8f' : '#3a55c0'], [1, '#18286a']]), 'rgba(170,200,255,.55)', 1.2);
    g.shadow(null);
    g.rr(15, top + 3, 38, 16, 10, 'rgba(255,255,255,.14)');
    g.icon(ICON.pause, 23, top + 11, 22, '#ffffff');
    g.hit(8, top - 4, 52, 52, k, () => ui.h.pause());
  }
  if (ui.trainHud) {
    const k = 'tutskip';
    g.rr(12, top + 52, 64, 28, 14, g.isPressed(k) ? 'rgba(255,255,255,.3)' : 'rgba(10,22,60,.85)', 'rgba(255,255,255,.3)');
    g.text('Skip ›', 44, top + 66, { size: 12.5, align: 'center' });
    g.hit(12, top + 48, 64, 36, k, () => ui.h.skipTutorial());
  }
  if (!run) return;
  // ---- right column: coins (this race + wallet total) · distance
  const wallet = ui.save?.wallet ?? 0;
  const cw = 104;
  const px = W - 12 - cw;
  // v3.0.8: pause + score box share the line with TikTok's capsule; coins + distance sit under it
  const ct = row.capped ? Math.max(top, belowCap()) : top;
  {
    const s = bump(ui, 'coins', t);
    g.ctx.save();
    if (s !== 1) {
      g.ctx.translate(px + cw / 2, ct + 21);
      g.ctx.scale(s, s);
      g.ctx.translate(-(px + cw / 2), -(ct + 21));
    }
    g.rr(px, ct, cw, 42, 14, g.lin(0, ct, 0, ct + 42, [[0, 'rgba(48,36,4,.9)'], [1, 'rgba(22,16,2,.92)']]), 'rgba(255,194,26,.7)', 1.3);
    g.icon(ICON.coin, px + 8, ct + 6, 20);
    g.text(`+${fmt(run.coins)}`, px + 33, ct + 16.5, { size: 16, color: '#ffe28a', maxW: cw - 40, noTr: true, weight: 900, font: 'b' });
    g.text('TOTAL', px + 9, ct + 33, { size: 8, color: 'rgba(255,226,138,.7)', font: 'b', weight: 800, noTr: true, shadow: null });
    g.text(fmt(wallet + run.coins), px + cw - 9, ct + 33, { size: 10.5, align: 'right', color: '#ffffff', font: 'b', weight: 800, maxW: cw - 48, noTr: true, shadow: null });
    g.ctx.restore();
  }
  hudPos.coins = { x: px + 18, y: ct + 16 };
  pill(g, px, ct + 48, cw, 28, `${ICON.flag} <b>${fmt(run.distance)} m</b>`, 1);
  // ---- score box: [EXP · level]  big race EXP  ·  RACE rank shield
  //                 ───────────────────────────────────────────────
  //                 YOU ◆ BEST 316                    NEXT ◆ 2,948
  //                 ━━━━━━━━━━━━━━━━━━━━ progress to the next rank, best marked
  const exp = run.exp;
  const bx = 66,
    bw = Math.max(150, Math.min(row.right, px - 8) - bx);
  const expRace = run.expRate > 0 && !ui.bonusHud;
  const showBest = ui.hudBest > 0 && !ui.trainHud && expRace;
  const cur = classFor(exp);
  const ni = CLASSES.indexOf(cur);
  const nx = ni < CLASSES.indexOf(ui.hudTop) ? CLASSES[ni + 1] : null;
  const showNext = !!nx && !ui.trainHud && expRace;
  const foot = showBest || showNext;
  const bh = foot ? 86 : 58;
  const by = top - 1;
  g.shadow('rgba(0,0,0,.35)', 10, 3);
  g.rr(bx, by, bw, bh, 16, g.lin(0, by, 0, by + bh, [[0, 'rgba(20,34,82,.94)'], [1, 'rgba(8,15,40,.96)']]), 'rgba(98,170,255,.45)', 1.2);
  g.shadow(null);
  const ix = bx + 12,
    rx = bx + bw - 12;
  if (ui.bonusHud) {
    g.rich(`${ICON.coin} <b>BONUS COINS</b>`, ix, by + 7, bw - 24, { size: 11, color: C.gold });
    g.text(fmt(run.coins), ix, by + 40, { size: 30, italic: true, noTr: true });
  } else {
    // top-left: EXP chip + level tag
    g.icon(BOLT, ix, by + 8, 26, '#fff', 14);
    if (ui.trainHud) levelPill(g, ix + 31, by + 8, 'TRAINING', '#9fb3dd', '#0b1436');
    else if (ui.hudLevel) {
      const lv = ui.hudLevel.toUpperCase();
      const [lb, lf] = lv === 'HARD' ? ['#ff5a48', '#ffffff'] : lv === 'EASY' ? ['#5ef08e', '#064a22'] : ['#ffc84a', '#5a2a00'];
      levelPill(g, ix + 31, by + 8, lv, lb, lf);
    }
    // big race EXP
    g.text(fmt(exp), ix, by + 41, { size: 30, italic: true, noTr: true, maxW: bw - 80 });
    // right: the rank this race has reached
    if (expRace || ui.trainHud) {
      g.text('RACE', rx - 15, by + 11, { size: 8.5, align: 'center', color: C.muted, font: 'b', weight: 800, noTr: true, shadow: null });
      shieldBadge(g, cur, rx - 30, by + 18, 32);
    }
  }
  if (foot) {
    g.rr(ix, by + 57, bw - 24, 1, 0, 'rgba(160,190,255,.18)');
    const fy = by + 67;
    if (showBest) {
      const beat = exp > ui.hudBest;
      g.text('YOU', ix, fy, { size: 8.5, color: C.muted, font: 'b', weight: 800, noTr: true, shadow: null });
      shieldBadge(g, ui.hudMe, ix + 22, fy - 7, 14);
      g.text('BEST', ix + 42, fy, { size: 8.5, color: C.muted, font: 'b', weight: 800, noTr: true, shadow: null });
      g.text(beat ? 'BEATEN!' : fmt(ui.hudBest), ix + 67, fy, { size: 11, color: beat ? C.gold : '#fff', font: 'b', weight: 900, noTr: true, shadow: null });
    }
    if (showNext && nx) {
      const need = fmt(CLASS_MIN[nx] - exp);
      const nw = g.measure(need, { size: 11, font: 'b', weight: 900 });
      g.text(need, rx, fy, { size: 11, align: 'right', font: 'b', weight: 900, noTr: true, shadow: null });
      shieldBadge(g, nx, rx - nw - 18, fy - 7, 14);
      g.text('NEXT', rx - nw - 22, fy, { size: 8.5, align: 'right', color: C.muted, font: 'b', weight: 800, noTr: true, shadow: null });
    }
    // progress to the next rank (gold once the best is beaten), best EXP marked with a tick
    const lo = CLASS_MIN[cur];
    const hi = nx ? CLASS_MIN[nx] : lo + 1;
    const k = nx ? (exp - lo) / Math.max(1, hi - lo) : 1;
    const beat = showBest && exp > ui.hudBest;
    bar(g, ix, by + 76, bw - 24, 4, k, beat ? C.gold : g.lin(ix, 0, rx, 0, [[0, '#4fc3ff'], [1, '#a77bff']]));
    if (showBest && ui.hudBest > lo && ui.hudBest < hi) {
      const mx = ix + (bw - 24) * ((ui.hudBest - lo) / Math.max(1, hi - lo));
      g.rr(mx - 1, by + 73, 2, 10, 1, '#ffffff');
    }
  }
  const bottomY = Math.max(by + bh, ct + 76);

  // ---- speed (H5: "SPEED 91 KM/H", rainbow bar) + hearts
  const r2 = bottomY + 12;
  g.text(`SPEED ${fmt(ui.hud.speed * 3.6)} KM/H`, 14, r2 + 6, { size: 11.5, font: 'b', weight: 800, color: '#cfe0ff', noTr: true });
  bar(g, 14, r2 + 15, 118, 6, ui.hud.speed / Math.max(1, ui.hud.maxSpeed), g.lin(14, 0, 132, 0, [[0, '#39b6ff'], [0.5, '#b6ff2e'], [1, '#ff8a1f']]));
  for (let i = 0; i < run.maxLives; i++) g.icon(i < run.lives ? ICON.heart : ICON.heartEmpty, W - 12 - (run.maxLives - i) * 25, r2 - 1, 23);
  hudPos.hearts = { x: W - 40, y: r2 + 10 };
  let ly = r2 + 30;

  // ---- rank gate strip
  if (ui.hud.gate) {
    const gw = 220,
      gx = (W - gw) / 2;
    g.rr(gx, ly, gw, 24, 12, 'rgba(60,8,30,.82)', '#ff5a8a');
    g.text('RANK GATE', gx + 10, ly + 12, { size: 10, color: '#ff8ab0' });
    rankBadge(g, ui.hud.gate.next, gx + 82, ly + 5, 14);
    bar(g, gx + 116, ly + 9, gw - 128, 6, ui.hud.gate.k, '#ff5a8a');
    ly += 28;
  }
  // ---- track progress (courses)
  const tr = ui.hud.track;
  if (tr) {
    const tw = W - 28;
    g.rr(14, ly, tw, 32, 10, 'rgba(8,16,44,.78)', 'rgba(120,180,255,.3)');
    g.text(tr.section.toUpperCase(), 22, ly + 10, { size: 10, maxW: tw / 2 });
    g.text(`${fmt(Math.min(tr.dist, tr.length))} / ${fmt(tr.length)} m`, 14 + tw - 8, ly + 10, { size: 10, align: 'right', font: 'b' });
    bar(g, 22, ly + 21, tw - 16, 5, tr.dist / tr.length, C.cyan);
    for (const m of tr.marks) g.rr(22 + (tw - 16) * (m / tr.length) - 1, ly + 19, 2, 9, 1, '#fff');
    ly += 36;
  }
  // ---- power-up chips
  const d = run.durations();
  const chips: { kind: string; left: number; total: number; n?: string }[] = [];
  if (run.shield) chips.push({ kind: 'shield', left: run.shieldT, total: d.shield, n: run.shieldHits ? `×${run.shieldHits}` : '' });
  if (run.magnetT > 0) chips.push({ kind: 'magnet', left: run.magnetT, total: d.magnet });
  if (run.turboT > 0) chips.push({ kind: 'turbo', left: run.turboT, total: d.turbo });
  if (run.doubleT > 0) chips.push({ kind: 'double', left: run.doubleT, total: d.double });
  if (run.coin2T > 0) chips.push({ kind: 'coin2', left: run.coin2T, total: 8, n: '×2' });
  if (run.dashes > 0) chips.push({ kind: 'dash', left: 1, total: 1, n: `×${run.dashes}` });
  let cx = 14;
  hudPos.powers = { x: 34, y: ly + 20 };
  for (const c of chips) {
    const k = Math.max(0, Math.min(1, c.left / c.total));
    const col = CHIP_COL[c.kind];
    const blink = c.left < 2 && Math.floor(t / 180) % 2 === 0;
    g.circle(cx + 20, ly + 20, 19, 'rgba(8,16,44,.82)', 'rgba(255,255,255,.18)', 3);
    const ctx = g.ctx;
    ctx.beginPath();
    ctx.arc(cx + 20, ly + 20, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    g.alpha(blink ? 0.45 : 1);
    g.icon(CHIP_IC[c.kind], cx + 9, ly + 9, 22);
    g.alpha(1);
    if (c.n) g.text(c.n, cx + 36, ly + 34, { size: 10, align: 'right', color: col, stroke: '#000', strokeW: 3, shadow: null });
    cx += 46;
  }
  // ---- danger hint
  const dg = ui.hud.danger;
  if (dg) {
    const ok = t - ui.hud.dangerOkT < 300;
    const pulse = 0.75 + 0.25 * Math.sin(t / 120);
    g.alpha(ok ? 0.5 : pulse);
    if (dg === 'rocket' || dg === 'sos') {
      const col = dg === 'rocket' ? '#9b6bff' : '#ff5a3c';
      const yy = g.H * 0.42;
      g.rr(W / 2 - 70, yy, 140, 44, 22, withAlpha(col, 0.85), '#fff', 1.5);
      g.icon(dg === 'rocket' ? ICON.rocket : ICON.sos, W / 2 - 60, yy + 8, 28);
      g.text(dg === 'rocket' ? 'ROADSTER' : 'TAP SOS!', W / 2 + 14, yy + 22, { size: 15, align: 'center' });
    } else {
      const pos: Record<string, [number, number, number]> = { left: [30, g.H * 0.5, 180], right: [W - 30, g.H * 0.5, 0], up: [W / 2, g.H * 0.36, 270], down: [W / 2, g.H * 0.64, 90] };
      const p = pos[dg] ?? pos.up;
      g.circle(p[0], p[1], 26, 'rgba(255,194,26,.25)', C.gold, 2);
      g.icon(CHEV(p[2]), p[0] - 18, p[1] - 18, 36, C.gold);
      g.text(dg.toUpperCase(), p[0], p[1] + 40, { size: 12, align: 'center', color: C.gold });
    }
    g.alpha(1);
  }
  // ---- ROADSTER / SOS (bottom right) — fire on touch-down
  const sb = safeBottom(g);
  const rockets = run.hyperJumps + run.superJumps;
  const bx2 = W - 16 - 76;
  let byy = g.H - sb - 20 - 76;
  if (run.escapes > 0) {
    const urgent = dg === 'sos';
    const s = urgent ? 1 + 0.06 * Math.sin(t / 90) : 1;
    roundBtn(g, 'sos', bx2 + 8, byy + 12, 60 * s, '#ff5a3c', ICON.sos, 'SOS', String(run.escapes), () => ui.h.sos());
    hudPos.sos = { x: bx2 + 38, y: byy + 42 };
    byy -= 86;
  }
  if (rockets > 0) {
    const hyper = run.hyperJumps > 0;
    const call = ui.tut?.need === 'rocket';
    const ready = ui.rocketReady || call;
    const wait = t - ui.hud.rocketWaitT < 600 ? Math.sin((t - ui.hud.rocketWaitT) / 40) * 4 : 0;
    const s = ready ? 1 + 0.07 * Math.sin(t / 110) : 1;
    if (ready) g.circle(bx2 + 38 + wait, byy + 38, 50, withAlpha(hyper ? '#ffc21a' : '#9b6bff', 0.25 + 0.15 * Math.sin(t / 110)));
    roundBtn(g, 'rocket', bx2 + wait, byy, 76 * s, hyper ? '#ffb31a' : '#8a4dff', hyper ? ICON.hyper : ICON.rocket, ready ? 'TAP!' : hyper ? 'HYPER' : 'ROADSTER', String(rockets), () => ui.h.rocket(), hyper ? { c0: '#ffe07a', c1: '#e79a00', rim: 'rgba(255,255,255,.8)', text: '#3a2000' } : { c0: '#2a1d5c', c1: '#120a33', rim: '#b48cff', text: '#e6dcff' });
    hudPos.rocket = { x: bx2 + 38, y: byy + 38 };
  }
  // ---- mission (bottom)
  const m = ui.hud.mission;
  if (m) {
    const mw = Math.min(260, W - 130),
      mx = 14,
      my = g.H - sb - 16 - 40;
    g.rr(mx, my, mw, 40, 10, 'rgba(8,16,44,.75)', 'rgba(120,180,255,.25)');
    g.text(m.text, mx + 10, my + 13, { size: 10, font: 'b', maxW: mw - 70 });
    g.text(`${fmt(m.progress)}/${fmt(m.target)}`, mx + mw - 8, my + 13, { size: 10, align: 'right', font: 'b', color: C.muted });
    bar(g, mx + 10, my + 26, mw - 20, 5, m.progress / m.target, C.green);
  }
}

function bump(ui: UI, k: string, t: number) {
  const b = ui.bumps[k];
  if (!b) return 1;
  const p = (t - b) / 220;
  return p >= 1 ? 1 : 1 + 0.16 * Math.sin(p * Math.PI);
}

function pill(g: Gfx, x: number, y: number, w: number, h: number, html: string, s = 1, rim = 'rgba(79,195,255,.32)') {
  g.ctx.save();
  if (s !== 1) {
    g.ctx.translate(x + w / 2, y + h / 2);
    g.ctx.scale(s, s);
    g.ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  g.rr(x, y, w, h, h / 2, 'rgba(9,16,44,.86)', rim, 1.2);
  g.rich(html, x + 7, y + h / 2 - 10, w - 12, { size: 15, align: 'left' });
  g.ctx.restore();
}

function roundBtn(g: Gfx, key: string, x: number, y: number, s: number, col: string, icon: string, label: string, n: string, fn: () => void, look?: { c0: string; c1: string; rim: string; text: string }) {
  const cx = x + 38 * (s / 76) + (76 - s) / 2,
    cy = y + s / 2;
  const r = s / 2;
  const pr = g.isPressed(key);
  const rr = pr ? r * 0.92 : r;
  g.shadow('rgba(0,0,0,.5)', 8, 3);
  g.circle(cx, cy, rr, g.rad(cx, cy - rr * 0.3, rr * 0.1, rr * 1.15, look ? [[0, look.c0], [0.75, look.c1], [1, look.c1]] : [[0, shade(col, 0.35)], [1, shade(col, -0.25)]]));
  g.shadow(null);
  g.circle(cx, cy, rr - 1, null, look?.rim ?? 'rgba(255,255,255,.7)', 2);
  g.icon(icon, cx - rr * 0.38, cy - rr * 0.64, rr * 0.76);
  g.text(label, cx, cy + rr * 0.45, { size: Math.max(9, rr * 0.27), align: 'center', maxW: rr * 1.7, color: look?.text ?? '#fff', italic: true });
  g.circle(cx + rr * 0.72, cy - rr * 0.72, 11, '#fff');
  g.text(n, cx + rr * 0.72, cy - rr * 0.72 + 0.5, { size: 12, align: 'center', color: '#1a1040', shadow: null, noTr: true });
  g.hit(cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12, key, fn, true);
}

// =============================================================== notices / pops / flyers
export function drawNotices(ui: UI, g: Gfx) {
  const t = g.time;
  const W = g.W;
  const inRun = ui.shown.has('hud');
  // ---- toast / banner lane
  const n = ui.notice;
  if (n) {
    const p = (t - n.t0) / n.ms;
    const a = p < 0.08 ? p / 0.08 : p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1;
    const y0 = inRun ? safeTop(g) + 150 : safeTop(g) + 64;
    g.alpha(a);
    if (n.kind === 'banner') {
      g.text(n.w, W / 2, y0 + 10, { size: 12, align: 'center', color: C.cyan });
      g.text(n.n, W / 2, y0 + 36, { size: 26, align: 'center', italic: true, stroke: 'rgba(0,0,0,.5)', strokeW: 4 });
    } else {
      const mw = Math.min(W - 40, 340);
      const col = cssColor(n.color);
      g.dry++;
      const th = g.rich(n.html, 0, 0, mw - 24, { size: 13 });
      g.dry--;
      const h = th + 16;
      const x = (W - mw) / 2;
      g.rr(x, y0, mw, h, 12, 'rgba(8,16,44,.92)', col, 1.6);
      g.rich(n.html, x + 12, y0 + 8, mw - 24, { size: 13, align: 'center' });
    }
    g.alpha(1);
  }
  // ---- score pop (one at a time)
  const pp = ui.pops;
  if (pp) {
    const k = (t - pp.t0) / 1100;
    if (k >= 1) ui.pops = null;
    else {
      const y = g.H * 0.34 - k * 40;
      g.alpha(k > 0.7 ? (1 - k) / 0.3 : 1);
      const s = k < 0.12 ? 0.7 + (k / 0.12) * 0.3 : 1;
      g.ctx.save();
      g.ctx.translate(W / 2, y);
      g.ctx.scale(s, s);
      g.rich(pp.text, -W / 2 + 20, -16, W - 40, { size: 24, align: 'center', color: cssColor(pp.color), italic: true });
      if (pp.sub) g.rich(pp.sub, -W / 2 + 20, 14, W - 40, { size: 12, align: 'center', color: '#fff' });
      g.ctx.restore();
      g.alpha(1);
    }
  }
  // ---- big pickup title
  const bp = ui.big;
  if (bp) {
    const k = (t - bp.t0) / 1200;
    if (k >= 1) ui.big = null;
    else {
      const s = 1.5 - k * 0.6;
      const y = g.H * 0.38;
      g.alpha(k > 0.65 ? (1 - k) / 0.35 : Math.min(1, k * 6));
      g.ctx.save();
      g.ctx.translate(W / 2, y);
      g.ctx.scale(s, s);
      g.icon(bp.icon, -22, -60, 44);
      g.text(bp.label, 0, 2, { size: 24, align: 'center', italic: true, color: cssColor(bp.color), stroke: 'rgba(0,0,0,.55)', strokeW: 4 });
      if (bp.sub) g.rich(bp.sub, -W / 2 + 20, 18, W - 40, { size: 11, align: 'center' });
      g.ctx.restore();
      g.alpha(1);
    }
  }
  // ---- flyers (pickup → HUD counter)
  if (ui.flyers.length) {
    for (let i = ui.flyers.length - 1; i >= 0; i--) {
      const f = ui.flyers[i];
      const tp = hudPos[f.target] ?? hudPos.powers ?? { x: 40, y: 140 };
      let k = (t - f.t0) / f.dur;
      if (k >= 1) {
        ui.flyers.splice(i, 1);
        ui.bumps[f.target] = t;
        continue;
      }
      k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const cx = (f.x + tp.x) / 2 + (tp.x > f.x ? -40 : 40);
      const cy = Math.min(f.y, tp.y) - 70;
      const px = (1 - k) * (1 - k) * f.x + 2 * (1 - k) * k * cx + k * k * tp.x;
      const py = (1 - k) * (1 - k) * f.y + 2 * (1 - k) * k * cy + k * k * tp.y;
      const sc = f.target === 'coins' ? 1.1 - 0.5 * k : 1.6 - 1.05 * k;
      const s = 24 * sc;
      g.icon(f.icon, px - s / 2, py - s / 2, s);
    }
  }
}

export { ARROW };


/** H5 class badge: a shield with the class letters (white → class colour) */
export function shieldBadge(g: Gfx, cls: string, x: number, y: number, h: number) {
  if (g.dry) return;
  const cc = CLASS_COLOR[cls as keyof typeof CLASS_COLOR] ?? '#9fb3dd';
  const w = h * 0.92;
  const c = g.ctx;
  c.beginPath();
  c.moveTo(x, y + h * 0.12);
  c.quadraticCurveTo(x + w / 2, y - h * 0.04, x + w, y + h * 0.12);
  c.lineTo(x + w, y + h * 0.55);
  c.quadraticCurveTo(x + w, y + h * 0.86, x + w / 2, y + h);
  c.quadraticCurveTo(x, y + h * 0.86, x, y + h * 0.55);
  c.closePath();
  c.fillStyle = g.lin(0, y, 0, y + h, [[0, '#f4f7ff'], [1, cc]]);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)';
  c.lineWidth = 1;
  c.stroke();
  g.text(cls, x + w / 2, y + h * 0.47, { size: h * (cls.length > 2 ? 0.34 : cls.length > 1 ? 0.42 : 0.55), align: 'center', color: '#0b1436', shadow: null, noTr: true, italic: true });
}

/** the EASY / NORMAL / HARD tag next to EXP */
function levelPill(g: Gfx, x: number, y: number, label: string, bg: string, fg: string) {
  const w = g.measure(label, { size: 9, font: 'b', weight: 900 }) + 14;
  g.rr(x, y, w, 15, 5, bg);
  g.text(label, x + w / 2, y + 8, { size: 9, align: 'center', color: fg, font: 'b', weight: 900, shadow: null, noTr: true });
  return w + 6;
}
