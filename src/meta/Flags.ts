/**
 * v3.0.9 country flags as small SVGs (30×20) — emoji flags do not draw on every phone / canvas
 * (Android mini-game runtimes show two letters or nothing). Simplified but recognisable designs for
 * every code in COUNTRIES. Pure strings: no DOM, works in the canvas UI (src/native/ui/svg.ts) and
 * in HTML. Unknown codes → a chequered race flag.
 */
const W = 30,
  H = 20;
const R = '#da291c',
  WH = '#ffffff',
  BL = '#0039a6',
  NV = '#012169',
  YE = '#ffcd00',
  BK = '#111111',
  SKY = '#74acdf';

const svg = (body: string) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${body}<rect x="0.25" y="0.25" width="${W - 0.5}" height="${H - 0.5}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="0.5"/></svg>`;
const rect = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const circ = (cx: number, cy: number, r: number, c: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
const poly = (pts: number[], c: string) => `<polygon points="${pts.join(' ')}" fill="${c}"/>`;

/** horizontal stripes (optional relative heights) */
function hs(cols: string[], parts?: number[]) {
  const p = parts ?? cols.map(() => 1);
  const tot = p.reduce((a, b) => a + b, 0);
  let y = 0;
  return cols
    .map((c, i) => {
      const h = (H * p[i]) / tot;
      const r = rect(0, y, W, h + 0.05, c);
      y += h;
      return r;
    })
    .join('');
}
/** vertical stripes */
function vs(cols: string[], parts?: number[]) {
  const p = parts ?? cols.map(() => 1);
  const tot = p.reduce((a, b) => a + b, 0);
  let x = 0;
  return cols
    .map((c, i) => {
      const w = (W * p[i]) / tot;
      const r = rect(x, 0, w + 0.05, H, c);
      x += w;
      return r;
    })
    .join('');
}
/** 5-point star */
function star(cx: number, cy: number, r: number, c: string) {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(+(cx + Math.cos(a) * rr).toFixed(2), +(cy + Math.sin(a) * rr).toFixed(2));
  }
  return poly(pts, c);
}
/** Nordic cross */
function nordic(bg: string, cross: string, border?: string) {
  let s = rect(0, 0, W, H, bg);
  if (border) s += rect(8, 0, 6, H, border) + rect(0, 7, W, 6, border);
  s += rect(9.5, 0, 3, H, cross) + rect(0, 8.5, W, 3, cross);
  return s;
}
/** crescent: big circle minus an offset circle in the background colour */
const crescent = (cx: number, cy: number, r: number, c: string, bg: string, dx = r * 0.3) => circ(cx, cy, r, c) + circ(cx + dx, cy, r * 0.8, bg);
/** Union Jack in a box */
function jack(x: number, y: number, w: number, h: number) {
  const l = (x1: number, y1: number, x2: number, y2: number, c: string, sw: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}"/>`;
  return (
    rect(x, y, w, h, NV) +
    l(x, y, x + w, y + h, WH, h * 0.2) +
    l(x + w, y, x, y + h, WH, h * 0.2) +
    l(x, y, x + w, y + h, '#c8102e', h * 0.07) +
    l(x + w, y, x, y + h, '#c8102e', h * 0.07) +
    rect(x + w / 2 - h * 0.17, y, h * 0.34, h, WH) +
    rect(x, y + h * 0.33, w, h * 0.34, WH) +
    rect(x + w / 2 - h * 0.1, y, h * 0.2, h, '#c8102e') +
    rect(x, y + h * 0.4, w, h * 0.2, '#c8102e')
  );
}

const F: Record<string, () => string> = {
  VN: () => rect(0, 0, W, H, R) + star(15, 10.5, 6, YE),
  TH: () => hs([R, WH, '#2d2a4a', WH, R], [1, 1, 2, 1, 1]),
  ID: () => hs([R, WH]),
  PH: () => hs([BL, R]) + poly([0, 0, 13, 10, 0, 20], WH) + circ(4.5, 10, 2, YE),
  MY: () => hs([R, WH, R, WH, R, WH, R]) + rect(0, 0, 15, 11.4, NV) + crescent(6, 5.7, 3.6, YE, NV, 1.3) + star(11, 5.7, 2.4, YE),
  SG: () => hs([R, WH]) + crescent(6, 5, 3.4, WH, R, 1.3) + star(10.5, 5, 1.6, WH),
  KH: () => hs([BL, R, BL], [1, 2, 1]) + poly([9, 13.5, 21, 13.5, 19, 10, 17, 8, 15, 5.5, 13, 8, 11, 10], WH),
  LA: () => hs(['#ce1126', '#002868', '#ce1126'], [1, 2, 1]) + circ(15, 10, 4, WH),
  MM: () => hs(['#fecb00', '#34b233', '#ea2839']) + star(15, 11, 7, WH),
  BN: () => rect(0, 0, W, H, '#f7e017') + poly([0, 5, 30, 12, 30, 17, 0, 10], WH) + poly([0, 10, 30, 17, 30, 20, 0, 13], BK) + circ(15, 10.5, 3.2, '#cf1126'),
  JP: () => rect(0, 0, W, H, WH) + circ(15, 10, 6, '#bc002d'),
  KR: () =>
    rect(0, 0, W, H, WH) +
    poly(half(15, 10, 5, -1), '#cd2e3a') +
    poly(half(15, 10, 5, 1), '#0047a0') +
    rect(3, 3, 4, 1, BK) + rect(23, 3, 4, 1, BK) + rect(3, 16, 4, 1, BK) + rect(23, 16, 4, 1, BK),
  CN: () => rect(0, 0, W, H, '#ee1c25') + star(5, 5, 3.2, YE) + star(10, 2, 1, YE) + star(12, 4.5, 1, YE) + star(12, 7.5, 1, YE) + star(10, 9.5, 1, YE),
  TW: () => rect(0, 0, W, H, '#fe0000') + rect(0, 0, 15, 10, '#000095') + circ(7.5, 5, 3, WH),
  HK: () => rect(0, 0, W, H, '#de2910') + circ(15, 10, 5, WH) + circ(15, 10, 2.2, '#de2910'),
  IN: () => hs(['#ff9933', WH, '#138808']) + circ(15, 10, 2.6, '#000080') + circ(15, 10, 1.9, WH) + circ(15, 10, 0.6, '#000080'),
  PK: () => rect(0, 0, W, H, '#01411c') + rect(0, 0, 7.5, H, WH) + crescent(18.5, 10, 5, WH, '#01411c', 1.6) + star(21.5, 7.5, 1.8, WH),
  BD: () => rect(0, 0, W, H, '#006a4e') + circ(13.5, 10, 6, '#f42a41'),
  LK: () => rect(0, 0, W, H, '#ffb700') + rect(1, 1, 3.5, 18, '#00534e') + rect(4.5, 1, 3.5, 18, '#eb7400') + rect(9, 1, 20, 18, '#8d153a') + circ(19, 10, 3.5, '#ffb700'),
  NP: () => rect(0, 0, W, H, 'rgba(0,0,0,0)') + poly([6, 0, 22, 9, 12, 9, 22, 20, 6, 20], '#003893') + poly([7.2, 1.8, 18.5, 8.2, 9.8, 8.2, 18.6, 19, 7.2, 19], '#dc143c') + circ(10.5, 6.5, 1.6, WH) + circ(10.5, 14.5, 2, WH),
  AU: () => rect(0, 0, W, H, NV) + jack(0, 0, 15, 10) + star(7.5, 15, 2.6, WH) + star(23, 4, 1.3, WH) + star(26.5, 9, 1.3, WH) + star(23, 16, 1.3, WH) + star(19.5, 9, 1.3, WH),
  NZ: () => rect(0, 0, W, H, NV) + jack(0, 0, 15, 10) + star(23, 4.5, 1.5, '#c8102e') + star(26.5, 9, 1.5, '#c8102e') + star(23, 16, 1.6, '#c8102e') + star(19.8, 9.5, 1.4, '#c8102e'),
  US: () => {
    let s = '';
    for (let i = 0; i < 13; i++) s += rect(0, (i * H) / 13, W, H / 13 + 0.05, i % 2 ? WH : '#b22234');
    s += rect(0, 0, 12, (H * 7) / 13, '#3c3b6e');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) s += circ(1.4 + c * 2.3, 1.4 + r * 2.5, 0.5, WH);
    return s;
  },
  CA: () => vs(['#d52b1e', WH, '#d52b1e'], [1, 2, 1]) + poly([15, 4, 16.3, 7, 18.5, 6.4, 17.6, 10.2, 19.6, 9.4, 18.8, 12, 15.5, 12.5, 15.5, 15.5, 14.5, 15.5, 14.5, 12.5, 11.2, 12, 10.4, 9.4, 12.4, 10.2, 11.5, 6.4, 13.7, 7], '#d52b1e'),
  MX: () => vs(['#006847', WH, '#ce1126']) + circ(15, 10, 2.8, '#8c5a2b'),
  BR: () => rect(0, 0, W, H, '#009c3b') + poly([15, 2, 28, 10, 15, 18, 2, 10], '#ffdf00') + circ(15, 10, 4.6, '#002776'),
  AR: () => hs([SKY, WH, SKY]) + circ(15, 10, 2.2, '#f6b40e'),
  CL: () => hs([WH, '#d52b1e']) + rect(0, 0, 10, 10, '#0039a6') + star(5, 5, 2.6, WH),
  CO: () => hs(['#fcd116', '#003893', '#ce1126'], [2, 1, 1]),
  PE: () => vs(['#d91023', WH, '#d91023']),
  GB: () => jack(0, 0, W, H),
  IE: () => vs(['#169b62', WH, '#ff883e']),
  FR: () => vs(['#0055a4', WH, '#ef4135']),
  DE: () => hs([BK, '#dd0000', '#ffce00']),
  ES: () => hs(['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]) + rect(7, 7.5, 3.5, 5, '#aa151b'),
  PT: () => vs(['#046a38', '#da291c'], [2, 3]) + circ(12, 10, 3.6, '#ffe900') + circ(12, 10, 2.2, '#da291c') + circ(12, 10, 1.4, WH),
  IT: () => vs(['#009246', WH, '#ce2b37']),
  NL: () => hs(['#ae1c28', WH, '#21468b']),
  BE: () => vs([BK, '#fdda24', '#ef3340']),
  CH: () => rect(0, 0, W, H, '#da291c') + rect(13, 4, 4, 12, WH) + rect(9, 8, 12, 4, WH),
  AT: () => hs(['#ed2939', WH, '#ed2939']),
  SE: () => nordic('#006aa7', '#fecc00'),
  NO: () => nordic('#ba0c2f', '#00205b', WH),
  DK: () => nordic('#c8102e', WH),
  FI: () => nordic(WH, '#002f6c'),
  PL: () => hs([WH, '#dc143c']),
  CZ: () => hs([WH, '#d7141a']) + poly([0, 0, 15, 10, 0, 20], '#11457e'),
  HU: () => hs(['#ce2939', WH, '#477050']),
  RO: () => vs(['#002b7f', '#fcd116', '#ce1126']),
  UA: () => hs(['#0057b7', '#ffd700']),
  RU: () => hs([WH, '#0039a6', '#d52b1e']),
  TR: () => rect(0, 0, W, H, '#e30a17') + crescent(11, 10, 5, WH, '#e30a17', 1.3) + star(17.5, 10, 2.4, WH),
  GR: () => {
    let s = '';
    for (let i = 0; i < 9; i++) s += rect(0, (i * H) / 9, W, H / 9 + 0.05, i % 2 ? WH : '#0d5eaf');
    return s + rect(0, 0, 11.1, 11.1, '#0d5eaf') + rect(4.4, 0, 2.2, 11.1, WH) + rect(0, 4.4, 11.1, 2.2, WH);
  },
  IL: () =>
    rect(0, 0, W, H, WH) + rect(0, 2, W, 2.5, '#0038b8') + rect(0, 15.5, W, 2.5, '#0038b8') +
    `<polygon points="15,5.6 18.8,12.2 11.2,12.2" fill="none" stroke="#0038b8" stroke-width="0.9"/><polygon points="15,14.4 18.8,7.8 11.2,7.8" fill="none" stroke="#0038b8" stroke-width="0.9"/>`,
  AE: () => hs(['#00732f', WH, BK]) + rect(0, 0, 7.5, H, '#ff0000'),
  SA: () => rect(0, 0, W, H, '#006c35') + rect(7, 7, 16, 1.6, WH) + rect(8, 13, 14, 1, WH),
  QA: () => rect(0, 0, W, H, '#8a1538') + poly([0, 0, 9, 0, 11, 1.1, 9, 2.2, 11, 3.3, 9, 4.4, 11, 5.5, 9, 6.6, 11, 7.7, 9, 8.8, 11, 10, 9, 11.1, 11, 12.2, 9, 13.3, 11, 14.4, 9, 15.5, 11, 16.6, 9, 17.7, 11, 18.8, 9, 20, 0, 20], WH),
  EG: () => hs(['#ce1126', WH, BK]) + circ(15, 10, 2, '#c09300'),
  MA: () => rect(0, 0, W, H, '#c1272d') + `<polygon points="${starOutline(15, 10.5, 5)}" fill="none" stroke="#006233" stroke-width="1"/>`,
  NG: () => vs(['#008751', WH, '#008751']),
  KE: () => hs([BK, WH, '#bb0000', WH, '#006600'], [6, 1, 6, 1, 6]) + `<ellipse cx="15" cy="10" rx="3" ry="6" fill="#bb0000" stroke="${BK}" stroke-width="0.8"/>`,
  ZA: () =>
    rect(0, 0, W, 10, '#e03c31') + rect(0, 10, W, 10, '#001489') +
    poly([0, 0, 4, 0, 13, 7.2, 30, 7.2, 30, 12.8, 13, 12.8, 4, 20, 0, 20], WH) +
    poly([0, 1.8, 2.2, 1.8, 12, 8.6, 30, 8.6, 30, 11.4, 12, 11.4, 2.2, 18.2, 0, 18.2], '#007749') +
    poly([0, 4.2, 7.5, 10, 0, 15.8], '#ffb81c') + poly([0, 5.6, 5.6, 10, 0, 14.4], BK),
};

/** half disc as polygon points (dir -1 = top half, 1 = bottom half) */
function half(cx: number, cy: number, r: number, dir: number) {
  const pts: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    pts.push(+(cx - Math.cos(a) * r).toFixed(2), +(cy + dir * Math.sin(a) * r).toFixed(2));
  }
  return pts;
}

function starOutline(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

const RACE = () => {
  let s = rect(0, 0, W, H, WH);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2) s += rect(c * 5, r * 5, 5, 5, BK);
  return s;
};

const cache = new Map<string, string>();
/** SVG flag for an ISO country code ('VN') — 30×20 viewBox */
export function flagSvg(code: string | null | undefined): string {
  const c = (code ?? '').toUpperCase();
  let s = cache.get(c);
  if (!s) {
    s = svg((F[c] ?? RACE)());
    cache.set(c, s);
  }
  return s;
}

/** '🇻🇳' → 'VN' (null when the text is not a flag emoji) */
export function codeOfFlag(emoji: string): string | null {
  const cps = Array.from(emoji.trim()).map((ch) => ch.codePointAt(0) ?? 0);
  if (cps.length !== 2 || cps.some((p) => p < 0x1f1e6 || p > 0x1f1ff)) return null;
  return String.fromCharCode(65 + cps[0] - 0x1f1e6, 65 + cps[1] - 0x1f1e6);
}

/** every flag emoji inside a rich-text string → inline SVG flag */
export function svgFlags(html: string): string {
  if (html.indexOf('\uD83C') < 0) return html;
  return html.replace(/\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g, (m) => flagSvg(codeOfFlag(m)));
}

export const FLAG_CODES = Object.keys(F);
