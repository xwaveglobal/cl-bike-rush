/**
 * v3 native UI toolkit: an immediate-mode canvas painter with hit regions, scroll areas and a tiny
 * rich-text engine for the game's HTML strings (<b>, <small>, <br>, inline <svg> icons, rank badges).
 * Coordinates are CSS pixels; the backing canvas is `scale` × larger.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { svgFlags } from '../../meta/Flags.ts';
import { drawSvg, roundRectPath, svgAspect, svgImage, withAlpha } from './svg.ts';
import { CLASS_COLOR, type RankClass } from '../../meta/Rank.ts';
import { getLang, tr as tr0 } from '../../ui/i18n.ts';
/** translate a known label (English stays exactly as written) */
const tr = (s: string) => (getLang() === 'en' ? s : tr0(s));

export const FONT_D = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
export const FONT_B = '"Helvetica Neue", Arial, sans-serif';
export const C = {
  bg: '#04071a',
  panel: 'rgba(9,16,44,0.92)',
  panelSolid: '#0b1436',
  rim: 'rgba(79,195,255,0.55)',
  rimSoft: 'rgba(98,170,255,0.38)',
  card: 'rgba(10,20,52,0.82)',
  cardRim: 'rgba(130,175,255,0.18)',
  blue: '#2f8cff',
  cyan: '#4fc3ff',
  green: '#2fd36b',
  purple: '#8a3dff',
  gold: '#ffc21a',
  red: '#ff3b5c',
  pink: '#ff4fd8',
  text: '#ffffff',
  muted: '#9fb3dd',
};
/** css var() colours used in Game strings */
export function cssColor(c: string): string {
  const m = /var\(--([\w-]+)/.exec(c);
  if (!m) return c;
  return (C as Record<string, string>)[m[1]] ?? C.cyan;
}

export interface Hit {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string;
  fn: () => void;
  /** fires on touch-down (ROADSTER / SOS) */
  down?: boolean;
}
export interface ScrollArea {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string;
  content: number;
  horiz?: boolean;
}

// ------------------------------------------------------------------ rich text
type Tok =
  | { t: 'txt'; s: string; b: boolean; sm: boolean; col: string | null; it: boolean }
  | { t: 'svg'; svg: string; col: string | null; sm: boolean }
  | { t: 'badge'; cls: string; col: string; size: string }
  | { t: 'br' };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', middot: '·', times: '×', rarr: '→', larr: '←' };
const decode = (s: string) => s.replace(/&(#?\w+);/g, (m, k) => ENT[k] ?? (k[0] === '#' ? String.fromCharCode(parseInt(k.slice(1), 10)) : m));

const tokCache = new Map<string, Tok[]>();
export function tokenize(html: string): Tok[] {
  const hit = tokCache.get(html);
  if (hit) return hit;
  const out: Tok[] = [];
  const st: { tag: string; b?: boolean; sm?: boolean; col?: string | null; it?: boolean; badge?: { col: string; size: string } }[] = [];
  const cur = () => {
    let b = false,
      sm = false,
      col: string | null = null,
      it = false;
    for (const s of st) {
      if (s.b) b = true;
      if (s.sm) sm = true;
      if (s.col) col = s.col;
      if (s.it) it = true;
    }
    return { b, sm, col, it };
  };
  const re = /<svg[\s\S]*?<\/svg>|<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<svg')) {
      const c = cur();
      out.push({ t: 'svg', svg: m[0], col: c.col, sm: c.sm });
      continue;
    }
    if (m[3] !== undefined) {
      const s = decode(m[3]);
      if (!s) continue;
      const badge = st.find((x) => x.badge)?.badge;
      if (badge) {
        out.push({ t: 'badge', cls: s.trim(), col: badge.col, size: badge.size });
        continue;
      }
      const c = cur();
      out.push({ t: 'txt', s, ...c });
      continue;
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    if (m[0][1] === '/') {
      for (let i = st.length - 1; i >= 0; i--)
        if (st[i].tag === tag) {
          st.length = i;
          break;
        }
      continue;
    }
    if (tag === 'br') {
      out.push({ t: 'br' });
      continue;
    }
    if (/\/\s*$/.test(attrs) || tag === 'img' || tag === 'input') continue;
    const cls = /class="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const style = /style="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const e: (typeof st)[number] = { tag };
    if (tag === 'b' || tag === 'strong') e.b = true;
    if (tag === 'small') e.sm = true;
    if (tag === 'em' || tag === 'i') e.it = true;
    if (/\bclsb\b/.test(cls)) {
      const cc = /--cc:\s*([^;"]+)/.exec(style)?.[1] ?? '#9fb3dd';
      e.badge = { col: cc.trim(), size: /\blg\b/.test(cls) ? 'lg' : /\bmd\b/.test(cls) ? 'md' : 'sm' };
    }
    if (/\bprice\b/.test(cls)) e.col = C.gold;
    if (/\bgold\b/.test(cls)) e.col = C.gold;
    if (/\blive\b/.test(cls)) e.col = C.green;
    if (/\bsoon\b/.test(cls)) e.col = C.cyan;
    const col = /(?:^|;)\s*color:\s*([^;]+)/.exec(style)?.[1];
    if (col) e.col = cssColor(col.trim());
    st.push(e);
  }
  if (tokCache.size > 600) tokCache.clear();
  tokCache.set(html, out);
  return out;
}

/** plain text of an html string */
export function plain(html: string) {
  return tokenize(html)
    .map((t) => (t.t === 'txt' ? t.s : t.t === 'badge' ? t.cls : t.t === 'br' ? '\n' : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TextOpts {
  size?: number;
  color?: string;
  weight?: number | string;
  font?: 'd' | 'b';
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  baseline?: CanvasTextBaseline;
  maxW?: number;
  shadow?: string | null;
  stroke?: string;
  strokeW?: number;
  /** line height factor */
  lh?: number;
  /** translate the whole string (exact dictionary match) */
  noTr?: boolean;
}

export function font(o: TextOpts, size: number) {
  const fam = o.font === 'b' ? FONT_B : FONT_D;
  const w = o.weight ?? (o.font === 'b' ? 600 : 900);
  return `${o.italic ? 'italic ' : ''}${w} ${size}px ${fam}`;
}

// ------------------------------------------------------------------ painter
export class Gfx {
  ctx: any;
  scale = 2;
  W = 390;
  H = 844;
  hits: Hit[] = [];
  scrolls: ScrollArea[] = [];
  /** scroll offsets by key */
  off: Record<string, number> = {};
  pressed = '';
  time = 0;
  /** measuring pass: nothing is drawn, no hits registered */
  dry = 0;
  private tf: { tx: number; ty: number; k: number }[] = [{ tx: 0, ty: 0, k: 1 }];
  private clips: [number, number, number, number][] = [];
  images = new Map<string, any>();
  onImageLoad: () => void = () => {};
  makeImage: () => any = () => null;

  constructor(public canvas: any) {
    this.ctx = canvas.getContext('2d');
  }

  resize(w: number, h: number, scale: number) {
    this.W = w;
    this.H = h;
    this.scale = scale;
    this.canvas.width = Math.round(w * scale);
    this.canvas.height = Math.round(h * scale);
  }

  /** draw errors seen (reported once each) */
  errors: string[] = [];
  onError: (where: string, msg: string) => void = () => {};
  /** run a draw step; on an exception restore the canvas state and report it once */
  guard(where: string, fn: () => void) {
    const depth = this.tf.length,
      clips = this.clips.length;
    const dry = this.dry;
    this.ctx.save();
    try {
      fn();
    } catch (e) {
      const msg = `${where}: ${String((e as Error)?.message ?? e).slice(0, 90)}`;
      if (!this.errors.includes(msg)) {
        this.errors.push(msg);
        console.error('[ui]', msg, e);
        this.onError(where, msg);
      }
      while (this.tf.length > depth) this.tf.pop();
      this.clips.length = clips;
      this.dry = dry;
      // unwind any save() the failed step left open (extra restore() calls are no-ops)
      for (let i = 0; i < 64; i++) this.ctx.restore();
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.ctx.globalAlpha = 1;
      this.shadow(null);
      return;
    }
    this.ctx.restore();
    this.ctx.globalAlpha = 1;
    this.shadow(null);
  }

  begin(t: number) {
    this.time = t;
    this.hits.length = 0;
    this.scrolls.length = 0;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.tf = [{ tx: 0, ty: 0, k: 1 }];
    this.clips = [];
  }

  // ---- transforms (mirrored for hit testing)
  push(tx: number, ty: number, k = 1) {
    const t = this.tf[this.tf.length - 1];
    this.tf.push({ tx: t.tx + tx * t.k, ty: t.ty + ty * t.k, k: t.k * k });
    this.ctx.save();
    this.ctx.translate(tx, ty);
    if (k !== 1) this.ctx.scale(k, k);
  }
  pop() {
    this.tf.pop();
    this.ctx.restore();
  }
  private toScreen(x: number, y: number, w: number, h: number) {
    const t = this.tf[this.tf.length - 1];
    let r = { x: t.tx + x * t.k, y: t.ty + y * t.k, w: w * t.k, h: h * t.k };
    const cl = this.clips[this.clips.length - 1];
    if (cl) {
      const x1 = Math.max(r.x, cl[0]),
        y1 = Math.max(r.y, cl[1]),
        x2 = Math.min(r.x + r.w, cl[0] + cl[2]),
        y2 = Math.min(r.y + r.h, cl[1] + cl[3]);
      r = { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
    }
    return r;
  }
  clip(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    const s = this.toScreen(x, y, w, h);
    this.clips.push([s.x, s.y, s.w, s.h]);
  }
  unclip() {
    this.clips.pop();
    this.ctx.restore();
  }

  hit(x: number, y: number, w: number, h: number, key: string, fn: () => void, down = false) {
    if (this.dry) return;
    const s = this.toScreen(x, y, w, h);
    if (s.w <= 0 || s.h <= 0) return;
    this.hits.push({ ...s, key, fn, down });
  }
  /** region that swallows taps (modal backdrop / panel body) */
  block(x: number, y: number, w: number, h: number, fn: () => void = () => {}) {
    this.hit(x, y, w, h, '#block', fn);
  }
  scroll(x: number, y: number, w: number, h: number, key: string, content: number, horiz = false) {
    if (this.dry) return 0;
    const s = this.toScreen(x, y, w, h);
    const max = Math.max(0, content - (horiz ? w : h));
    const o = Math.min(max, Math.max(0, this.off[key] ?? 0));
    this.off[key] = o;
    this.scrolls.push({ ...s, key, content: content * this.tf[this.tf.length - 1].k, horiz });
    return o;
  }
  isPressed(key: string) {
    return this.pressed === key;
  }

  // ---- shapes
  rr(x: number, y: number, w: number, h: number, r: number, fill?: any, stroke?: any, lw = 1) {
    if (this.dry) return;
    const c = this.ctx;
    c.beginPath();
    roundRectPath(c, x, y, w, h, r);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  circle(x: number, y: number, r: number, fill?: any, stroke?: any, lw = 1) {
    if (this.dry) return;
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  lin(x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
    const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  rad(x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
    const g = this.ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  alpha(a: number) {
    this.ctx.globalAlpha = a;
  }
  shadow(color: string | null, blur = 0, oy = 0) {
    const c = this.ctx;
    c.shadowColor = color ?? 'transparent';
    c.shadowBlur = color ? blur * this.scale : 0;
    c.shadowOffsetY = color ? oy * this.scale : 0;
    c.shadowOffsetX = 0;
  }

  // ---- images
  icon(svg: string, x: number, y: number, size: number, color = '#ffffff', h = size) {
    if (this.dry || !svg) return;
    const k = this.scale * (this.tf[this.tf.length - 1].k || 1);
    const ar = svgAspect(svg);
    let w = size;
    let hh = h;
    if (ar > 1.05) hh = size / ar;
    else if (ar < 0.95) w = h * ar;
    if (size * k > 300) {
      drawSvg(this.ctx, svg, x + (size - w) / 2, y + (h - hh) / 2, w, hh, color);
      return;
    }
    const img = svgImage(svg, w * k, hh * k, color);
    this.ctx.drawImage(img, x + (size - w) / 2, y + (h - hh) / 2, w, hh);
  }
  img(url: string, x: number, y: number, w: number, h: number, mode: 'cover' | 'contain' | 'fill' = 'cover', r = 0) {
    if (this.dry || !url) return;
    let im = this.images.get(url);
    if (!im) {
      im = this.makeImage();
      if (!im) return;
      im.onload = () => {
        im._ok = true;
        this.onImageLoad();
      };
      im.src = url;
      this.images.set(url, im);
    }
    if (!im._ok && !(im.complete && im.width)) return;
    const iw = im.width,
      ih = im.height;
    if (!iw || !ih) return;
    let sx = 0,
      sy = 0,
      sw = iw,
      sh = ih,
      dx = x,
      dy = y,
      dw = w,
      dh = h;
    if (mode === 'cover') {
      const k = Math.max(w / iw, h / ih);
      sw = w / k;
      sh = h / k;
      sx = (iw - sw) / 2;
      sy = (ih - sh) / 2;
    } else if (mode === 'contain') {
      const k = Math.min(w / iw, h / ih);
      dw = iw * k;
      dh = ih * k;
      dx = x + (w - dw) / 2;
      dy = y + (h - dh) / 2;
    }
    const c = this.ctx;
    if (r) {
      c.save();
      c.beginPath();
      roundRectPath(c, x, y, w, h, r);
      c.clip();
    }
    c.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
    if (r) c.restore();
  }

  // ---- text
  measure(s: string, o: TextOpts = {}) {
    const size = o.size ?? 14;
    this.ctx.font = font(o, size);
    return this.ctx.measureText(s).width as number;
  }
  /** single-line text, shrunk to fit maxW */
  text(s: string, x: number, y: number, o: TextOpts = {}) {
    if (!o.noTr) s = tr(s);
    let size = o.size ?? 14;
    const c = this.ctx;
    c.font = font(o, size);
    let w = c.measureText(s).width;
    if (o.maxW && w > o.maxW) {
      size = Math.max(6, (size * o.maxW) / w);
      c.font = font(o, size);
      w = c.measureText(s).width;
    }
    if (this.dry) return w;
    c.textAlign = o.align ?? 'left';
    c.textBaseline = o.baseline ?? 'middle';
    if (o.shadow !== null) this.shadow(o.shadow ?? 'rgba(0,0,0,.45)', 3, 1);
    if (o.stroke) {
      c.lineJoin = 'round';
      c.strokeStyle = o.stroke;
      c.lineWidth = o.strokeW ?? 3;
      c.strokeText(s, x, y);
    }
    c.fillStyle = o.color ?? C.text;
    c.fillText(s, x, y);
    this.shadow(null);
    return w;
  }

  /** wrapped plain text; returns the height used */
  para(s: string, x: number, y: number, maxW: number, o: TextOpts = {}) {
    return this.rich(s.replace(/&/g, '&amp;').replace(/</g, '&lt;'), x, y, maxW, o);
  }

  /** rich text (game HTML) with wrapping; returns the height used */
  rich(html: string, x: number, y: number, maxW: number, o: TextOpts = {}): number {
    const size = o.size ?? 14;
    const lh = size * (o.lh ?? 1.3);
    const c = this.ctx;
    const toks = tokenize(svgFlags(html));
    // translate a whole plain run when it is a known label
    type Item = { w: number; draw: (x: number, mid: number) => void; space?: boolean; br?: boolean };
    const items: Item[] = [];
    const base = o.color ?? C.text;
    for (const t of toks) {
      if (t.t === 'br') {
        items.push({ w: 0, draw: () => {}, br: true });
      } else if (t.t === 'svg') {
        const s = (t.sm ? 0.85 : 1.08) * size;
        const ar = svgAspect(t.svg);
        const w = ar > 1.2 ? s * ar * 0.9 : s;
        const col = t.col ?? base;
        items.push({ w: w + 3, draw: (xx, mid) => this.icon(t.svg, xx, mid - (ar > 1.2 ? (s * 0.9) / 2 : s / 2), w, col, ar > 1.2 ? s * 0.9 : s) });
      } else if (t.t === 'badge') {
        const bs = t.size === 'lg' ? size * 1.5 : t.size === 'md' ? size * 1.2 : size * 1.05;
        const bw = rankBadgeW(this, t.cls, bs);
        items.push({ w: bw + 3, draw: (xx, mid) => rankBadge(this, t.cls, xx, mid - bs / 2, bs, t.col) });
      } else {
        const sz = t.sm ? size * 0.8 : size;
        const fo = { ...o, weight: t.b ? 900 : o.weight, italic: t.it || o.italic };
        const col = t.col ?? (t.sm ? withAlpha(base.startsWith('#') ? base : '#ffffff', 0.72) : base);
        const whole = t.s.trim();
        const str = o.noTr ? t.s : whole && tr(whole) !== whole ? t.s.replace(whole, tr(whole)) : t.s;
        // split into words (keep spaces as separate breakable items)
        for (const part of str.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            c.font = font(fo, sz);
            items.push({ w: c.measureText(' ').width, draw: () => {}, space: true });
            continue;
          }
          c.font = font(fo, sz);
          const w = c.measureText(part).width;
          items.push({
            w,
            draw: (xx, mid) => {
              c.font = font(fo, sz);
              c.textAlign = 'left';
              c.textBaseline = 'middle';
              c.fillStyle = col;
              c.fillText(part, xx, mid);
            },
          });
        }
      }
    }
    // lines
    const lines: Item[][] = [[]];
    let lw = 0;
    for (const it of items) {
      if (it.br) {
        lines.push([]);
        lw = 0;
        continue;
      }
      const line = lines[lines.length - 1];
      if (it.space && !line.length) continue;
      if (lw + it.w > maxW && line.length && !it.space) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push([it]);
        lw = it.w;
        continue;
      }
      line.push(it);
      lw += it.w;
    }
    if (this.dry) return lines.length * lh;
    if (o.shadow !== null) this.shadow(o.shadow ?? 'rgba(0,0,0,.4)', 2, 1);
    let yy = y;
    for (const line of lines) {
      while (line.length && line[line.length - 1].space) line.pop();
      const w = line.reduce((a, b) => a + b.w, 0);
      let xx = o.align === 'center' ? x + (maxW - w) / 2 : o.align === 'right' ? x + maxW - w : x;
      // whole line too wide (one long word): squeeze
      const k = w > maxW ? maxW / w : 1;
      if (k < 1) {
        c.save();
        c.translate(xx, 0);
        c.scale(k, 1);
        xx = 0;
      }
      for (const it of line) {
        it.draw(xx, yy + lh / 2);
        xx += it.w;
      }
      if (k < 1) c.restore();
      yy += lh;
    }
    this.shadow(null);
    return lines.length * lh;
  }

  /** width of a one-line rich string */
  richW(html: string, size: number) {
    const d = this.dry;
    this.dry = 1;
    let w = 0;
    const toks = tokenize(html);
    for (const t of toks) {
      if (t.t === 'svg') w += size * 1.08 + 3;
      else if (t.t === 'badge') w += rankBadgeW(this, t.cls, size * 1.05) + 3;
      else if (t.t === 'txt') w += this.measure(tr(t.s.trim()) !== t.s.trim() ? tr(t.s.trim()) : t.s, { size: t.sm ? size * 0.8 : size, weight: t.b ? 900 : undefined });
    }
    this.dry = d;
    return w;
  }
}

// ------------------------------------------------------------------ shared widgets
export function rankBadgeW(g: Gfx, cls: string, h: number) {
  return Math.max(h * 1.15, g.measure(cls, { size: h * 0.62 }) + h * 0.7);
}
/** the hex rank plate (D … SSS) */
export function rankBadge(g: Gfx, cls: string, x: number, y: number, h: number, col?: string) {
  if (g.dry) return;
  const cc = col ?? CLASS_COLOR[cls as RankClass] ?? '#9fb3dd';
  const w = rankBadgeW(g, cls, h);
  const c = g.ctx;
  const n = h * 0.28;
  c.beginPath();
  c.moveTo(x + n, y);
  c.lineTo(x + w - n, y);
  c.lineTo(x + w, y + h / 2);
  c.lineTo(x + w - n, y + h);
  c.lineTo(x + n, y + h);
  c.lineTo(x, y + h / 2);
  c.closePath();
  c.fillStyle = '#0b1020';
  c.fill();
  c.strokeStyle = cc;
  c.lineWidth = Math.max(1.2, h * 0.09);
  c.stroke();
  g.text(cls, x + w / 2, y + h / 2 + 0.5, { size: h * 0.62, color: cc, align: 'center', shadow: null, noTr: true });
}

export type BtnStyle = 'blue' | 'gold' | 'green' | 'purple' | 'pink' | 'ghost' | 'dark' | 'red' | 'cyan';
const BTN: Record<BtnStyle, [string, string, string]> = {
  blue: ['#3aa0ff', '#1f5fe0', '#ffffff'],
  gold: ['#ffd84a', '#ff9a1a', '#2a1600'],
  green: ['#3fe07c', '#13a04a', '#ffffff'],
  purple: ['#b06bff', '#6a2ee0', '#ffffff'],
  pink: ['#ff6bb0', '#e0247a', '#ffffff'],
  red: ['#ff6b6b', '#d81f3c', '#ffffff'],
  cyan: ['#5ee6ff', '#1a9fd8', '#06223a'],
  ghost: ['rgba(255,255,255,.10)', 'rgba(255,255,255,.06)', '#ffffff'],
  dark: ['#25335f', '#151f44', '#ffffff'],
};

export interface BtnOpts {
  style?: BtnStyle;
  size?: number;
  disabled?: boolean;
  r?: number;
  down?: boolean;
  align?: 'center' | 'left';
  icon?: string;
  sub?: string;
}

/** a game button; `label` may hold html (icons, prices) */
export function button(g: Gfx, key: string, x: number, y: number, w: number, h: number, label: string, fn: () => void, o: BtnOpts = {}) {
  const st = o.style ?? 'blue';
  const [c1, c2, tc] = BTN[st];
  const pr = g.isPressed(key) && !o.disabled;
  const r = o.r ?? Math.min(h / 2, 14);
  if (!g.dry) {
    g.ctx.save();
    if (o.disabled) g.ctx.globalAlpha *= 0.45;
    if (pr) {
      g.ctx.translate(x + w / 2, y + h / 2);
      g.ctx.scale(0.96, 0.96);
      g.ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (st !== 'ghost') {
      g.shadow('rgba(0,0,0,.45)', 6, 3);
      g.rr(x, y + 2, w, h, r, shade(c2, -0.35));
      g.shadow(null);
    }
    g.rr(x, y, w, h, r, g.lin(0, y, 0, y + h, [[0, c1], [1, c2]]), st === 'ghost' ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.28)', 1);
    if (st !== 'ghost') g.rr(x + 3, y + 2, w - 6, h * 0.42, r * 0.8, 'rgba(255,255,255,.16)');
    const size = o.size ?? Math.min(18, h * 0.42);
    const lab = o.icon ? `${o.icon} ${label}` : label;
    if (o.sub) {
      g.rich(lab, x + 6, y + h * 0.3 - size * 0.65, w - 12, { size, color: tc, align: 'center', shadow: st === 'gold' || st === 'cyan' ? null : undefined });
      g.rich(o.sub, x + 6, y + h * 0.62, w - 12, { size: size * 0.62, color: tc, align: 'center', font: 'b', shadow: null });
    } else {
      const tw = g.richW(lab, size);
      const sz = tw > w - 16 ? Math.max(8, (size * (w - 16)) / tw) : size;
      g.rich(lab, x + 8, y + h / 2 - (sz * 1.3) / 2, w - 16, { size: sz, color: tc, align: o.align ?? 'center', shadow: st === 'gold' || st === 'cyan' ? null : undefined });
    }
    g.ctx.restore();
  }
  if (!o.disabled) g.hit(x, y, w, h, key, fn, o.down);
}

/** small round icon button (back / close / pause) */
export function iconBtn(g: Gfx, key: string, x: number, y: number, s: number, svg: string, fn: () => void, color = '#ffffff') {
  const pr = g.isPressed(key);
  if (!g.dry) {
    g.rr(x, y, s, s, s * 0.3, pr ? 'rgba(79,195,255,.35)' : 'rgba(10,22,60,.82)', 'rgba(130,190,255,.45)', 1.2);
    g.icon(svg, x + s * 0.22, y + s * 0.22, s * 0.56, color);
  }
  g.hit(x - 4, y - 4, s + 8, s + 8, key, fn);
}

/** glass panel */
export function panel(g: Gfx, x: number, y: number, w: number, h: number, r = 18, rim = C.rimSoft) {
  if (g.dry) return;
  g.shadow('rgba(0,0,0,.55)', 18, 6);
  g.rr(x, y, w, h, r, g.lin(0, y, 0, y + h, [[0, 'rgba(18,32,76,.97)'], [1, 'rgba(8,15,40,.98)']]));
  g.shadow(null);
  g.rr(x + 0.5, y + 0.5, w - 1, h - 1, r, null, rim, 1.2);
}
export function card(g: Gfx, x: number, y: number, w: number, h: number, r = 12, rim = C.cardRim, fill = C.card) {
  g.rr(x, y, w, h, r, fill, rim, 1);
}

/** progress bar */
export function bar(g: Gfx, x: number, y: number, w: number, h: number, k: number, col: any = C.cyan, bg = 'rgba(255,255,255,.12)') {
  if (g.dry) return;
  g.rr(x, y, w, h, h / 2, bg);
  const kk = Math.max(0, Math.min(1, k));
  if (kk > 0) g.rr(x, y, Math.max(h, w * kk), h, h / 2, col);
}

/** on/off switch */
export function toggle(g: Gfx, key: string, x: number, y: number, on: boolean, fn: () => void) {
  const w = 46,
    h = 26;
  if (!g.dry) {
    g.rr(x, y, w, h, h / 2, on ? g.lin(x, 0, x + w, 0, [[0, '#2fd36b'], [1, '#1fb5ff']]) : 'rgba(255,255,255,.14)', 'rgba(255,255,255,.25)');
    g.circle(on ? x + w - h / 2 : x + h / 2, y + h / 2, h / 2 - 3, '#ffffff');
  }
  g.hit(x - 6, y - 8, w + 12, h + 16, key, fn);
}

/** lighten (+) / darken (−) a #rrggbb colour */
export function shade(c: string, k: number) {
  if (!c.startsWith('#')) return c;
  let h = c.slice(1);
  if (h.length === 3) h = h.replace(/./g, (x) => x + x);
  const n = parseInt(h, 16);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const r = f((n >> 16) & 255),
    gg = f((n >> 8) & 255),
    b = f(n & 255);
  return `rgb(${r},${gg},${b})`;
}

export const fmt = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
