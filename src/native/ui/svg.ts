/**
 * v3 native — a small SVG → Canvas 2D renderer for the game's own inline icons, avatars and art
 * (the native runtime has no <img src="data:image/svg+xml">). Supports what the game's SVG strings
 * use: svg/g/path/circle/ellipse/rect/line/polyline/polygon/text, fill / stroke / opacity attributes,
 * currentColor, transform (translate/scale/rotate/matrix), linear + radial gradients (url(#id)).
 * Filters are ignored. Results are cached as small canvases (see svgImage).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface Node {
  tag: string;
  a: Record<string, string>;
  c: Node[];
  text: string;
}

// ------------------------------------------------------------------ xml
function parseXml(src: string): Node {
  const root: Node = { tag: '#root', a: {}, c: [], text: '' };
  const stack: Node[] = [root];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[4] !== undefined) {
      const t = m[4];
      if (t.trim()) stack[stack.length - 1].text += decode(t);
      continue;
    }
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') {
      for (let i = stack.length - 1; i > 0; i--)
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      continue;
    }
    const a: Record<string, string> = {};
    const ar = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
    let am: RegExpExecArray | null;
    while ((am = ar.exec(m[2] || ''))) a[am[1].toLowerCase()] = decode(am[2] ?? am[3] ?? '');
    if (a.style) {
      for (const part of a.style.split(';')) {
        const i = part.indexOf(':');
        if (i > 0) a[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
      }
    }
    const n: Node = { tag, a, c: [], text: '' };
    stack[stack.length - 1].c.push(n);
    if (!m[3]) stack.push(n);
  }
  return root;
}
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

// ------------------------------------------------------------------ path
type Cmd = [string, ...number[]];
/** path data → absolute M / L / C / Z commands (arcs and quadratics become cubics) */
function parsePath(d: string): Cmd[] {
  const out: Cmd[] = [];
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;
  let cmd = '';
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    lcx = 0,
    lcy = 0,
    lqx = 0,
    lqy = 0;
  let prev = '';
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  while (i < toks.length) {
    if (/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      out.push(['Z']);
      x = sx;
      y = sy;
      prev = 'Z';
      continue;
    }
    if (!isNum()) continue;
    do {
      if (C === 'M') {
        const nx = num() + (rel ? x : 0),
          ny = num() + (rel ? y : 0);
        out.push(['M', nx, ny]);
        x = sx = nx;
        y = sy = ny;
        cmd = rel ? 'l' : 'L';
        prev = 'M';
        break; // following pairs are line-tos (handled by the next loop turn)
      } else if (C === 'L') {
        x = num() + (rel ? x : 0);
        y = num() + (rel ? y : 0);
        out.push(['L', x, y]);
      } else if (C === 'H') {
        x = num() + (rel ? x : 0);
        out.push(['L', x, y]);
      } else if (C === 'V') {
        y = num() + (rel ? y : 0);
        out.push(['L', x, y]);
      } else if (C === 'C') {
        const x1 = num() + (rel ? x : 0),
          y1 = num() + (rel ? y : 0),
          x2 = num() + (rel ? x : 0),
          y2 = num() + (rel ? y : 0),
          ex = num() + (rel ? x : 0),
          ey = num() + (rel ? y : 0);
        out.push(['C', x1, y1, x2, y2, ex, ey]);
        lcx = x2;
        lcy = y2;
        x = ex;
        y = ey;
      } else if (C === 'S') {
        const x1 = prev === 'C' || prev === 'S' ? 2 * x - lcx : x,
          y1 = prev === 'C' || prev === 'S' ? 2 * y - lcy : y;
        const x2 = num() + (rel ? x : 0),
          y2 = num() + (rel ? y : 0),
          ex = num() + (rel ? x : 0),
          ey = num() + (rel ? y : 0);
        out.push(['C', x1, y1, x2, y2, ex, ey]);
        lcx = x2;
        lcy = y2;
        x = ex;
        y = ey;
      } else if (C === 'Q' || C === 'T') {
        let qx: number, qy: number;
        if (C === 'Q') {
          qx = num() + (rel ? x : 0);
          qy = num() + (rel ? y : 0);
        } else {
          qx = prev === 'Q' || prev === 'T' ? 2 * x - lqx : x;
          qy = prev === 'Q' || prev === 'T' ? 2 * y - lqy : y;
        }
        const ex = num() + (rel ? x : 0),
          ey = num() + (rel ? y : 0);
        out.push(['C', x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]);
        lqx = qx;
        lqy = qy;
        x = ex;
        y = ey;
      } else if (C === 'A') {
        const rx = num(),
          ry = num(),
          rot = num(),
          large = num(),
          sweep = num();
        const ex = num() + (rel ? x : 0),
          ey = num() + (rel ? y : 0);
        for (const c of arcToCubics(x, y, rx, ry, rot, !!large, !!sweep, ex, ey)) out.push(c);
        x = ex;
        y = ey;
      } else {
        i++;
      }
      prev = C;
    } while (isNum());
  }
  return out;
}

function arcToCubics(x1: number, y1: number, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, x2: number, y2: number): Cmd[] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [['L', x2, y2]];
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi),
    sin = Math.sin(phi);
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy,
    y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry,
    cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2,
    cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const d = dt / segs;
  const k = (4 / 3) * Math.tan(d / 4);
  const out: Cmd[] = [];
  let t = t1;
  const pt = (a: number): [number, number] => {
    const ex = rx * Math.cos(a),
      ey = ry * Math.sin(a);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const dp = (a: number): [number, number] => {
    const ex = -rx * Math.sin(a),
      ey = ry * Math.cos(a);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  for (let s = 0; s < segs; s++) {
    const a1 = t,
      a2 = t + d;
    const p1 = pt(a1),
      p2 = pt(a2),
      d1 = dp(a1),
      d2 = dp(a2);
    out.push(['C', p1[0] + k * d1[0], p1[1] + k * d1[1], p2[0] - k * d2[0], p2[1] - k * d2[1], p2[0], p2[1]]);
    t = a2;
  }
  return out;
}

// ------------------------------------------------------------------ style
interface Style {
  fill: string;
  stroke: string;
  sw: number;
  cap: string;
  join: string;
  op: number;
  fop: number;
  sop: number;
  fs: number;
  ff: string;
  fw: string;
  fst: string;
  anchor: string;
}
const BASE: Style = { fill: '#000', stroke: 'none', sw: 1, cap: 'butt', join: 'miter', op: 1, fop: 1, sop: 1, fs: 16, ff: 'sans-serif', fw: 'normal', fst: 'normal', anchor: 'start' };

function inherit(p: Style, a: Record<string, string>): Style {
  const s = { ...p, op: 1 };
  if (a.fill !== undefined) s.fill = a.fill;
  if (a.stroke !== undefined) s.stroke = a.stroke;
  if (a['stroke-width'] !== undefined) s.sw = parseFloat(a['stroke-width']) || 0;
  if (a['stroke-linecap']) s.cap = a['stroke-linecap'];
  if (a['stroke-linejoin']) s.join = a['stroke-linejoin'];
  if (a.opacity !== undefined) s.op = parseFloat(a.opacity);
  if (a['fill-opacity'] !== undefined) s.fop = parseFloat(a['fill-opacity']);
  if (a['stroke-opacity'] !== undefined) s.sop = parseFloat(a['stroke-opacity']);
  if (a['font-size']) s.fs = parseFloat(a['font-size']);
  if (a['font-family']) s.ff = a['font-family'];
  if (a['font-weight']) s.fw = a['font-weight'];
  if (a['font-style']) s.fst = a['font-style'];
  if (a['text-anchor']) s.anchor = a['text-anchor'];
  return s;
}

function applyTransform(ctx: any, t: string) {
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const v = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (m[1]) {
      case 'matrix':
        ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
        break;
      case 'translate':
        ctx.translate(v[0] || 0, v[1] || 0);
        break;
      case 'scale':
        ctx.scale(v[0], v.length > 1 ? v[1] : v[0]);
        break;
      case 'rotate':
        if (v.length > 2) {
          ctx.translate(v[1], v[2]);
          ctx.rotate((v[0] * Math.PI) / 180);
          ctx.translate(-v[1], -v[2]);
        } else ctx.rotate((v[0] * Math.PI) / 180);
        break;
      case 'skewX':
        ctx.transform(1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0);
        break;
      case 'skewY':
        ctx.transform(1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0);
        break;
    }
  }
}

type BBox = [number, number, number, number];
const len = (v: string | undefined, ref: number, dflt: number) => {
  if (v === undefined || v === '') return dflt;
  return v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v);
};

// ------------------------------------------------------------------ render
interface Ctx {
  ctx: any;
  color: string;
  defs: Record<string, Node>;
}

function paint(rc: Ctx, v: string, bb: BBox, opacity: number): any {
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v === 'currentColor' || v === 'currentcolor') return rc.color;
  const m = /^url\(\s*#([^)]+)\)/.exec(v);
  if (m) {
    const g = rc.defs[m[1]];
    if (!g) return null;
    return gradient(rc, g, bb, opacity);
  }
  return v;
}

function gradient(rc: Ctx, g: Node, bb: BBox, _opacity: number): any {
  const ctx = rc.ctx;
  const user = g.a.gradientunits === 'userSpaceOnUse';
  const [bx, by, bw, bh] = user ? [0, 0, 1, 1] : bb;
  const X = (v: string | undefined, d: number) => bx + (user ? len(v, 1, d) : (v?.endsWith('%') ? parseFloat(v) / 100 : v !== undefined ? parseFloat(v) : d)) * (user ? 1 : bw);
  const Y = (v: string | undefined, d: number) => by + (user ? len(v, 1, d) : (v?.endsWith('%') ? parseFloat(v) / 100 : v !== undefined ? parseFloat(v) : d)) * (user ? 1 : bh);
  let gr: any;
  try {
    if (g.tag === 'lineargradient') gr = ctx.createLinearGradient(X(g.a.x1, 0), Y(g.a.y1, 0), X(g.a.x2, 1), Y(g.a.y2, 0));
    else {
      const cx = X(g.a.cx, 0.5),
        cy = Y(g.a.cy, 0.5);
      const r = (user ? len(g.a.r, 1, 0.5) : g.a.r?.endsWith('%') ? parseFloat(g.a.r) / 100 : g.a.r !== undefined ? parseFloat(g.a.r) : 0.5) * (user ? 1 : Math.max(bw, bh));
      gr = ctx.createRadialGradient(X(g.a.fx, g.a.cx ? parseFloat(g.a.cx) / (g.a.cx.endsWith('%') ? 100 : 1) : 0.5), Y(g.a.fy, g.a.cy ? parseFloat(g.a.cy) / (g.a.cy.endsWith('%') ? 100 : 1) : 0.5), 0, cx, cy, Math.max(0.01, r));
    }
  } catch {
    return null;
  }
  // stops may live in a referenced gradient (href)
  let stops = g.c.filter((n) => n.tag === 'stop');
  const href = (g.a['xlink:href'] || g.a.href || '').replace('#', '');
  if (!stops.length && href && rc.defs[href]) stops = rc.defs[href].c.filter((n) => n.tag === 'stop');
  for (const s of stops) {
    let off = s.a.offset ?? '0';
    let o = off.endsWith('%') ? parseFloat(off) / 100 : parseFloat(off);
    if (!isFinite(o)) o = 0;
    let col = s.a['stop-color'] || '#000';
    if (col === 'currentColor') col = rc.color;
    const so = s.a['stop-opacity'] !== undefined ? parseFloat(s.a['stop-opacity']) : 1;
    try {
      gr.addColorStop(Math.min(1, Math.max(0, o)), so < 1 ? withAlpha(col, so) : col);
    } catch {
      /* bad colour */
    }
    off = '';
  }
  return gr;
}

/** '#rrggbb' / '#rgb' / 'rgb()' + alpha → rgba() */
export function withAlpha(c: string, a: number): string {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(',').map((x) => x.trim());
    return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] !== undefined ? parseFloat(p[3]) : 1) * a})`;
  }
  return c;
}

function shapePath(ctx: any, n: Node): BBox | null {
  const a = n.a;
  const f = (k: string, d = 0) => (a[k] !== undefined ? parseFloat(a[k]) : d);
  ctx.beginPath();
  switch (n.tag) {
    case 'path': {
      const cmds = parsePath(a.d || '');
      let minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      const ext = (x: number, y: number) => {
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
      };
      for (const c of cmds) {
        if (c[0] === 'M') {
          ctx.moveTo(c[1], c[2]);
          ext(c[1], c[2]);
        } else if (c[0] === 'L') {
          ctx.lineTo(c[1], c[2]);
          ext(c[1], c[2]);
        } else if (c[0] === 'C') {
          ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
          ext(c[5], c[6]);
          ext(c[1], c[2]);
          ext(c[3], c[4]);
        } else ctx.closePath();
      }
      return isFinite(minx) ? [minx, miny, maxx - minx || 1, maxy - miny || 1] : null;
    }
    case 'circle': {
      const cx = f('cx'),
        cy = f('cy'),
        r = f('r');
      if (r <= 0) return null;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      return [cx - r, cy - r, r * 2, r * 2];
    }
    case 'ellipse': {
      const cx = f('cx'),
        cy = f('cy'),
        rx = f('rx'),
        ry = f('ry');
      if (rx <= 0 || ry <= 0) return null;
      const k = 0.5522847498;
      ctx.moveTo(cx + rx, cy);
      ctx.bezierCurveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry);
      ctx.bezierCurveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy);
      ctx.bezierCurveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry);
      ctx.bezierCurveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy);
      ctx.closePath();
      return [cx - rx, cy - ry, rx * 2, ry * 2];
    }
    case 'rect': {
      const x = f('x'),
        y = f('y'),
        w = f('width'),
        h = f('height');
      if (w <= 0 || h <= 0) return null;
      let rx = a.rx !== undefined ? f('rx') : a.ry !== undefined ? f('ry') : 0;
      rx = Math.min(rx, w / 2, h / 2);
      roundRectPath(ctx, x, y, w, h, rx);
      return [x, y, w, h];
    }
    case 'line': {
      const x1 = f('x1'),
        y1 = f('y1'),
        x2 = f('x2'),
        y2 = f('y2');
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1) || 1, Math.abs(y2 - y1) || 1];
    }
    case 'polyline':
    case 'polygon': {
      const v = (a.points || '').split(/[\s,]+/).filter(Boolean).map(Number);
      if (v.length < 4) return null;
      ctx.moveTo(v[0], v[1]);
      let minx = v[0],
        miny = v[1],
        maxx = v[0],
        maxy = v[1];
      for (let i = 2; i + 1 < v.length; i += 2) {
        ctx.lineTo(v[i], v[i + 1]);
        minx = Math.min(minx, v[i]);
        maxx = Math.max(maxx, v[i]);
        miny = Math.min(miny, v[i + 1]);
        maxy = Math.max(maxy, v[i + 1]);
      }
      if (n.tag === 'polygon') ctx.closePath();
      return [minx, miny, maxx - minx || 1, maxy - miny || 1];
    }
  }
  return null;
}

export function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  if (r) ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  if (r) ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  if (r) ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  if (r) ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function collectDefs(n: Node, defs: Record<string, Node>) {
  if (n.a.id) defs[n.a.id] = n;
  for (const c of n.c) collectDefs(c, defs);
}

function draw(rc: Ctx, n: Node, st: Style, alpha: number) {
  const { ctx } = rc;
  if (n.tag === 'defs' || n.tag === 'lineargradient' || n.tag === 'radialgradient' || n.tag === 'filter' || n.tag === 'title' || n.tag === 'clippath' || n.tag === 'mask') return;
  if (n.a.display === 'none' || n.a.visibility === 'hidden') return;
  const s = inherit(st, n.a);
  const a = alpha * s.op;
  if (a <= 0.001) return;
  const tr = n.a.transform;
  if (tr) {
    ctx.save();
    applyTransform(ctx, tr);
  }
  if (n.tag === 'g' || n.tag === 'svg' || n.tag === '#root' || n.tag === 'a') {
    for (const c of n.c) draw(rc, c, s, a);
  } else if (n.tag === 'text' || n.tag === 'tspan') {
    const txt = (n.text + n.c.map((c) => c.text).join('')).trim();
    if (txt) {
      const fam = /arial black/i.test(s.ff) ? 'Arial Black, Arial, sans-serif' : s.ff;
      ctx.font = `${s.fst === 'italic' ? 'italic ' : ''}${s.fw} ${s.fs}px ${fam}`;
      ctx.textAlign = s.anchor === 'middle' ? 'center' : s.anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      const x = parseFloat(n.a.x || '0'),
        y = parseFloat(n.a.y || '0');
      const fp = paint(rc, s.fill, [x, y - s.fs, s.fs * txt.length * 0.6, s.fs], a);
      if (fp) {
        ctx.globalAlpha = a * s.fop;
        ctx.fillStyle = fp;
        ctx.fillText(txt, x, y);
      }
    }
  } else {
    const bb = shapePath(ctx, n);
    if (bb) {
      const isLine = n.tag === 'line' || n.tag === 'polyline';
      const fp = isLine ? null : paint(rc, s.fill, bb, a);
      if (fp) {
        ctx.globalAlpha = a * s.fop;
        ctx.fillStyle = fp;
        ctx.fill(n.a['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero');
      }
      const sp = paint(rc, s.stroke, bb, a);
      if (sp && s.sw > 0) {
        ctx.globalAlpha = a * s.sop;
        ctx.strokeStyle = sp;
        ctx.lineWidth = s.sw;
        ctx.lineCap = s.cap;
        ctx.lineJoin = s.join;
        ctx.stroke();
      }
    }
  }
  if (tr) ctx.restore();
}

const trees = new Map<string, { root: Node; vb: [number, number, number, number]; defs: Record<string, Node> }>();
function tree(svg: string) {
  let t = trees.get(svg);
  if (t) return t;
  const root = parseXml(svg);
  const s = root.c.find((n) => n.tag === 'svg') ?? root;
  const vbs = (s.a.viewbox || `0 0 ${parseFloat(s.a.width || '24')} ${parseFloat(s.a.height || '24')}`).split(/[\s,]+/).map(Number);
  const defs: Record<string, Node> = {};
  collectDefs(root, defs);
  t = { root: s, vb: [vbs[0] || 0, vbs[1] || 0, vbs[2] || 24, vbs[3] || 24], defs };
  if (trees.size > 400) trees.clear();
  trees.set(svg, t);
  return t;
}

/** aspect ratio (w / h) of an svg string's viewBox */
export function svgAspect(svg: string) {
  const t = tree(svg);
  return t.vb[2] / t.vb[3];
}

/** draw an svg string into the box (x, y, w, h) of a 2D context, keeping its aspect (centred) */
export function drawSvg(ctx: any, svg: string, x: number, y: number, w: number, h: number, color = '#ffffff') {
  const t = tree(svg);
  const [vx, vy, vw, vh] = t.vb;
  const k = Math.min(w / vw, h / vh);
  ctx.save();
  ctx.translate(x + (w - vw * k) / 2, y + (h - vh * k) / 2);
  ctx.scale(k, k);
  ctx.translate(-vx, -vy);
  draw({ ctx, color, defs: t.defs }, t.root, { ...BASE }, 1);
  ctx.restore();
}

// ------------------------------------------------------------------ cache (rasterised icons)
const cache = new Map<string, any>();
let makeCanvas: () => any = () => (globalThis as any).document.createElement('canvas');
export function setCanvasFactory(f: () => any) {
  makeCanvas = f;
}

/** the svg as a small canvas at pixel size (cached) — draw with ctx.drawImage(img, x, y, w, h) */
export function svgImage(svg: string, pw: number, ph: number, color = '#ffffff'): any {
  pw = Math.max(1, Math.ceil(pw));
  ph = Math.max(1, Math.ceil(ph));
  const key = `${pw}x${ph}|${color}|${svg}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas();
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext('2d');
  drawSvg(ctx, svg, 0, 0, pw, ph, color);
  if (cache.size > 360) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, c);
  return c;
}
