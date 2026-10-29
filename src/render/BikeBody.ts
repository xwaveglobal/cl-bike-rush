import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BikeRiderMaterials } from './BikeRiderAsset.ts';
import { catmull, ellipsoid, paintGeo, band, mix, solid, type Painter, type V3 } from './RiderHuman.ts';

/**
 * Bike Rush hero bike — smooth supersport body matched to the reference sheet
 * (silver / gloss-black / cobalt livery, twin angular cyan headlights, gold USD forks,
 * twin front rotors, blue rim stripes, high tail with angular cyan tail lights,
 * short right-side silencer, aluminium twin-spar frame and swingarm).
 *
 * Coordinates: chassis space, ground at y = 0, forward = -Z, right = +X.
 * Pivots are unchanged from the original asset so poses, wheel spin and IK targets still line up:
 *   SteeringPivot (0, 0.74, -0.52) · front axle (0, 0.31, -0.71) · rear axle (0, 0.33, 0.71)
 *   grips ≈ (±0.265, 0.80, -0.435) · footpegs (±0.215, 0.445, 0.16) · seat ≈ y 0.77 @ z 0.22
 *
 * Bodywork is one vertex-painted clear-coated material, so livery edges follow the curved
 * surfaces instead of being separate slabs.
 */

const C = (hex: number) => new THREE.Color(hex);
const WHITE = C(0xffffff);
const K = {
  silver: C(0xc3c9d2),
  silverDark: C(0x8e96a3),
  black: C(0x0e1014),
  blue: C(0x1d56f2),
  grey: C(0x30343c),
};

interface BodyKey {
  z: number;
  x?: number;
  yb: number;
  yt: number;
  hwB: number;
  hwM: number;
  hwT: number;
  p?: number;
}

/** Smooth body shell lofted along +Z (keys must be in increasing z). */
function shell(keys: BodyKey[], paint: Painter, radial = 36, sub = 5): THREE.BufferGeometry {
  const at = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))];
  const f = (k: keyof BodyKey, i: number, t: number) =>
    catmull((at(i - 1)[k] ?? 0) as number, (at(i)[k] ?? 0) as number, (at(i + 1)[k] ?? 0) as number, (at(i + 2)[k] ?? 0) as number, t);
  const rings: { z: number; x: number; yb: number; yt: number; hwB: number; hwM: number; hwT: number; p: number }[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const n = i === keys.length - 2 ? sub + 1 : sub;
    for (let s = 0; s < n; s++) {
      const t = s / sub;
      const pa = at(i).p ?? 2.4, pb = at(i + 1).p ?? 2.4;
      rings.push({
        z: f('z', i, t), x: f('x', i, t), yb: f('yb', i, t), yt: f('yt', i, t),
        hwB: Math.max(0.002, f('hwB', i, t)), hwM: Math.max(0.002, f('hwM', i, t)), hwT: Math.max(0.002, f('hwT', i, t)),
        p: pa + (pb - pa) * t,
      });
    }
  }
  const R = radial;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) {
    const e = 2 / r.p, yc = (r.yb + r.yt) / 2, hh = Math.max(0.002, (r.yt - r.yb) / 2);
    for (let j = 0; j <= R; j++) {
      const th = (j / R) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const w = s >= 0 ? r.hwM + (r.hwT - r.hwM) * s : r.hwM + (r.hwB - r.hwM) * -s;
      pos.push(r.x + Math.sign(c) * Math.pow(Math.abs(c), e) * w, yc + Math.sign(s) * Math.pow(Math.abs(s), e) * hh, r.z);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < R; j++) {
      const a = r * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  for (const [r, end] of [[0, false], [rings.length - 1, true]] as const) {
    const ring = rings[r];
    const ci = pos.length / 3;
    pos.push(ring.x, (ring.yb + ring.yt) / 2, ring.z);
    for (let j = 0; j < R; j++) {
      const a = r * (R + 1) + j, b = a + 1;
      if (end) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let r = 0; r < rings.length; r++) {
    const a = r * (R + 1), b = a + R;
    const nx = nrm.getX(a) + nrm.getX(b), ny = nrm.getY(a) + nrm.getY(b), nz = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  paintGeo(g, paint);
  return g;
}


/**
 * Faceted shell: each ring is a polygon from `profile(params)` (CCW from +X), params are
 * interpolated smoothly along +Z, and normals are creased so polygon corners become sharp
 * character lines (like the reference fairing) while the long surfaces stay smooth.
 */
type FKey = { z: number } & Record<string, number>;
function facetShell(
  keys: FKey[], profile: (k: Record<string, number>) => [number, number][], paint: Painter,
  sub = 5, edgeSub = 2, crease = 0.42,
): THREE.BufferGeometry {
  const names = Object.keys(keys[0]);
  const at = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))];
  const rings: { z: number; pts: [number, number][] }[] = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const n = i === keys.length - 2 ? sub + 1 : sub;
    for (let s = 0; s < n; s++) {
      const t = s / sub;
      const prm: Record<string, number> = {};
      for (const k of names) prm[k] = catmull(at(i - 1)[k], at(i)[k], at(i + 1)[k], at(i + 2)[k], t);
      const poly = profile(prm);
      const pts: [number, number][] = [];
      for (let e = 0; e < poly.length; e++) {
        const a = poly[e], b = poly[(e + 1) % poly.length];
        for (let q = 0; q < edgeSub; q++) {
          const u = q / edgeSub;
          pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
        }
      }
      rings.push({ z: prm.z, pts });
    }
  }
  const R = rings[0].pts.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) for (let j = 0; j <= R; j++) {
    const [x, y] = r.pts[j % R];
    pos.push(x, y, r.z);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < R; j++) {
    const a = r * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  for (const [r, end] of [[0, false], [rings.length - 1, true]] as const) {
    const ring = rings[r];
    let cx = 0, cy = 0;
    ring.pts.forEach(([x, y]) => { cx += x / R; cy += y / R; });
    const ci = pos.length / 3;
    pos.push(cx, cy, ring.z);
    for (let j = 0; j < R; j++) {
      const a = r * (R + 1) + j, b = a + 1;
      if (end) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g0.setIndex(idx);
  const g = toCreasedNormals(g0, crease);
  paintGeo(g, paint);
  return g;
}
const mirrorPoly = (pts: [number, number][], xc: number): [number, number][] =>
  pts.map(([x, y]) => [2 * xc - x, y] as [number, number]).reverse();

function pipe(pts: V3[], r: number, segs = 24, radial = 12, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, segs, r, radial, closed);
}


// ----------------------------------------------------------------------------------- livery
/**
 * Livery decals are drawn into a canvas atlas and projected from the side (u = z, v = y),
 * so stripe edges stay razor-sharp regardless of mesh density. Vertex colours multiply on top
 * (white = show decal, black = inner faces / undersides / centre spines).
 */
type Cell = 'pod' | 'nose' | 'tank' | 'tail';
const ATLAS = { W: 2048, H: 1024 };
const CELLS: Record<Cell, { cx: number; cy: number; z0: number; z1: number; y0: number; y1: number }> = {
  pod: { cx: 0, cy: 0, z0: -0.96, z1: 0.04, y0: 0.06, y1: 0.92 },
  nose: { cx: 1024, cy: 0, z0: -0.96, z1: -0.28, y0: 0.64, y1: 1.0 },
  tank: { cx: 0, cy: 512, z0: -0.38, z1: 0.24, y0: 0.76, y1: 1.04 },
  tail: { cx: 1024, cy: 512, z0: 0.36, z1: 0.94, y0: 0.72, y1: 1.04 },
};
const cellPx = (c: Cell, z: number, y: number): [number, number] => {
  const k = CELLS[c];
  return [k.cx + ((z - k.z0) / (k.z1 - k.z0)) * 1024, k.cy + (1 - (y - k.y0) / (k.y1 - k.y0)) * 512];
};
function setSideUV(g: THREE.BufferGeometry, c: Cell) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const [px, py] = cellPx(c, p.getZ(i), p.getY(i));
    const k = CELLS[c];
    uv[i * 2] = Math.min(k.cx + 1023, Math.max(k.cx + 1, px)) / ATLAS.W;
    uv[i * 2 + 1] = 1 - Math.min(k.cy + 511, Math.max(k.cy + 1, py)) / ATLAS.H;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
let liveryTex: THREE.CanvasTexture | null = null;
export function getLiveryTexture(): THREE.CanvasTexture {
  if (liveryTex) return liveryTex;
  const cv = document.createElement('canvas');
  cv.width = ATLAS.W;
  cv.height = ATLAS.H;
  const g = cv.getContext('2d')!;
  const SILVER = '#c6ccd5', SILVER_HI = '#dde1e7', BLUE = '#1d56f2', BLACK = '#101216', LINE = '#3a404a';
  const poly = (c: Cell, pts: [number, number][], fill: string, stroke?: string) => {
    g.beginPath();
    pts.forEach(([z, y], i) => {
      const [x, yy] = cellPx(c, z, y);
      if (i) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    });
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 3;
      g.stroke();
    }
  };
  for (const c of Object.keys(CELLS) as Cell[]) {
    const k = CELLS[c];
    g.save();
    g.beginPath();
    g.rect(k.cx, k.cy, 1024, 512);
    g.clip();
    const grd = g.createLinearGradient(0, k.cy, 0, k.cy + 512);
    grd.addColorStop(0, SILVER_HI);
    grd.addColorStop(1, SILVER);
    g.fillStyle = grd;
    g.fillRect(k.cx, k.cy, 1024, 512);
    if (c === 'pod') {
      // main side panel (measured, z/y in metres): blue arrow + black vent inside the silver "V"
      poly(c, [[-0.625, 0.728], [-0.49, 0.728], [-0.51, 0.664], [-0.612, 0.668]], BLUE, LINE); // upper blue tab
      poly(c, [[-0.505, 0.664], [-0.44, 0.664], [-0.37, 0.43], [-0.425, 0.405]], BLUE, LINE); // blue slash
      poly(c, [[-0.43, 0.664], [-0.33, 0.68], [-0.3, 0.52], [-0.36, 0.44]], BLACK, LINE); // vent cavity
      poly(c, [[-0.7, 0.6], [-0.66, 0.6], [-0.6, 0.38], [-0.63, 0.37]], LINE); // panel seam
    } else if (c === 'nose') {
      poly(c, [[-1, 0.6], [-0.2, 0.6], [-0.2, 0.705], [-0.78, 0.715], [-1, 0.73]], BLACK); // lower black band under the lamps
      poly(c, [[-0.74, 0.8], [-0.5, 0.86], [-0.5, 0.875], [-0.74, 0.815]], LINE); // upper seam
    } else if (c === 'tank') {
      poly(c, [[-0.32, 0.9], [-0.14, 0.93], [-0.1, 0.99], [-0.3, 0.97]], BLUE, LINE); // front blue scoop
      poly(c, [[-0.5, 0.6], [0.3, 0.6], [0.3, 0.82], [-0.5, 0.82]], BLACK);
    } else if (c === 'tail') {
      poly(c, [[0.58, 0.84], [0.7, 0.87], [0.74, 0.93], [0.62, 0.9]], BLUE, LINE); // blue flash under the lamps
      poly(c, [[0.3, 0.6], [1.0, 0.6], [1.0, 0.86], [0.3, 0.8]], BLACK);
    }
    g.restore();
  }
  liveryTex = new THREE.CanvasTexture(cv);
  liveryTex.colorSpace = THREE.SRGBColorSpace;
  liveryTex.anisotropy = 8;
  return liveryTex;
}

/** Collects parts per material and turns them into one mesh per material. */
class Parts {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(g: THREE.BufferGeometry, m: THREE.Material) {
    const mm = m as THREE.MeshStandardMaterial;
    const keep = ['position', 'normal'];
    if (mm.vertexColors) keep.push('color');
    if (mm.map) keep.push('uv');
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    if (keep.includes('color') && !g.attributes.color) paintGeo(g, solid(K.silver));
    if (keep.includes('uv') && !g.attributes.uv) setSideUV(g, 'pod');
    if (!g.index) {
      const n = g.attributes.position.count;
      g.setIndex([...Array(n).keys()]);
    }
    if (!this.map.has(m)) this.map.set(m, []);
    this.map.get(m)!.push(g);
    return g;
  }
  into(group: THREE.Group, prefix: string) {
    for (const [m, list] of this.map) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), m);
      mesh.name = `${prefix}_${m.name}`;
      group.add(mesh);
    }
    this.map.clear();
  }
}


// ----------------------------------------------------------------------------------- detail helpers
/** Flat part drawn as a 2D shape in the wheel plane (Y up, Z forward) and extruded along X. */
function plate(shape: THREE.Shape, depth: number, x: number, segs = 32): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: Math.min(segs, 1) });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}
const circlePath = (r: number, cx = 0, cy = 0, n = 8) => {
  const h = new THREE.Path();
  for (let i = 0; i <= n; i++) {
    const a = -(i / n) * Math.PI * 2;
    if (i === 0) h.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else h.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return h;
};
/** Wave/petal brake rotor with two rings of drilled holes and a floating carrier. */
function rotorShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  const N = 12;
  for (let i = 0; i <= N * 8; i++) {
    const a = (i / (N * 8)) * Math.PI * 2;
    const rr = r * (1 - 0.035 * (0.5 + 0.5 * Math.cos(a * N)));
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.holes.push(circlePath(r * 0.66, 0, 0, 48));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    s.holes.push(circlePath(r * 0.028, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 6));
    const b = a + Math.PI / 18;
    s.holes.push(circlePath(r * 0.026, Math.cos(b) * r * 0.76, Math.sin(b) * r * 0.76, 6));
  }
  return s;
}
function carrierShape(r: number, arms = 6): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.holes.push(circlePath(r * 0.38, 0, 0, 20));
  for (let i = 0; i < arms; i++) {
    const a = ((i + 0.5) / arms) * Math.PI * 2;
    s.holes.push(circlePath(r * 0.22, Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, 12));
  }
  return s;
}
function sprocketShape(r: number, teeth: number, holes: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 4;
    const rr = k === 0 || k === 3 ? r * 0.94 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.holes.push(circlePath(r * 0.2, 0, 0, 16));
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    s.holes.push(circlePath(r * 0.2, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, 10));
  }
  return s;
}
let tyreTex: THREE.CanvasTexture | null = null;
/** Tread + sidewall texture for the lathe tyre (u = around, v = across the profile). */
function getTyreTexture(): THREE.CanvasTexture {
  if (tyreTex) return tyreTex;
  const cv = document.createElement('canvas');
  cv.width = 2048;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 2048, 256);
  // sidewall bands (dark gloss ring + thin rim line)
  g.fillStyle = '#d0d0d0';
  g.fillRect(0, 0, 2048, 40);
  g.fillRect(0, 216, 2048, 40);
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 10, 2048, 3);
  g.fillRect(0, 243, 2048, 3);
  // directional sport tread: swept grooves on the crown shoulders
  g.strokeStyle = '#3c3c3c';
  g.lineCap = 'round';
  const N = 36;
  for (let i = 0; i < N; i++) {
    const x = (i / N) * 2048;
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(x, 60); g.quadraticCurveTo(x + 20, 95, x + 52, 112); g.stroke();
    g.beginPath(); g.moveTo(x + 28, 196); g.quadraticCurveTo(x + 48, 161, x + 80, 144); g.stroke();
  }
  tyreTex = new THREE.CanvasTexture(cv);
  tyreTex.colorSpace = THREE.SRGBColorSpace;
  tyreTex.wrapS = THREE.RepeatWrapping;
  tyreTex.anisotropy = 8;
  return tyreTex;
}


// ----------------------------------------------------------------------------------- plates
/**
 * Hard-surface panel: a 2D outline in the side plane (z, y) given real thickness, wrapped onto
 * x = xOf(z, y) for side `sx`. Outer face shows the livery, edges/inner face are black.
 */
function sidePlate(
  outline: [number, number][], xOf: (z: number, y: number) => number, t: number, sx: number,
  paint: Painter, densify = 0.035,
): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / densify));
    for (let q = 0; q < n; q++) pts.push([a[0] + ((b[0] - a[0]) * q) / n, a[1] + ((b[1] - a[1]) * q) / n]);
  }
  const v2 = pts.map(([z, y]) => new THREE.Vector2(z, y));
  if (THREE.ShapeUtils.isClockWise(v2)) { pts.reverse(); v2.reverse(); }
  const tris = THREE.ShapeUtils.triangulateShape(v2, []);
  const pos: number[] = [];
  const P3 = (k: number, off: number) => { const [z, y] = pts[k]; return [sx * (xOf(z, y) + off), y, z]; };
  const push = (...v: number[][]) => v.forEach((q) => pos.push(q[0], q[1], q[2]));
  for (const [a, b, c] of tris) {
    // CCW in (z, y) faces -X: outer face for sx>0 needs reversed winding
    if (sx > 0) { push(P3(a, t / 2), P3(c, t / 2), P3(b, t / 2)); push(P3(a, -t / 2), P3(b, -t / 2), P3(c, -t / 2)); }
    else { push(P3(a, t / 2), P3(b, t / 2), P3(c, t / 2)); push(P3(a, -t / 2), P3(c, -t / 2), P3(b, -t / 2)); }
  }
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const o1 = P3(i, t / 2), o2 = P3(j, t / 2), n1 = P3(i, -t / 2), n2 = P3(j, -t / 2);
    // outward edge normal in (z, y) for a CCW loop: (dy, -dz)
    const dz = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
    const A = new THREE.Vector3(...o1), B = new THREE.Vector3(...o2), Cc = new THREE.Vector3(...n2);
    const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(Cc, A));
    if (nrm.y * -dz + nrm.z * dy < 0) { push(o1, n2, o2); push(o1, n1, n2); }
    else { push(o1, o2, n2); push(o1, n2, n1); }
  }
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const g = toCreasedNormals(g0, 0.7);
  paintGeo(g, paint);
  return g;
}

/**
 * Rider ergonomics shared with BikeRiderAsset (IK targets + pelvis): measured on the reference
 * sheet (clip-ons high and back, rear-set pegs, seat at ~0.85 m).
 */
export const BIKE_ERGO = {
  /** grip half-width and offset behind the steering pivot (pivot z = -0.52), grip height */
  gripX: 0.27, gripLocalZ: 0.165, gripY: 0.925,
  /** footpegs */
  pegX: 0.2, pegY: 0.47, pegZ: 0.32,
  /** pelvis rest position on the seat (overlay-aligned to the reference LEFT view: upright sport seat) */
  pelvisY: 0.97, pelvisZ: 0.425,
};

// ----------------------------------------------------------------------------------- wheels
function buildWheel(R: number, W: number, rear: boolean, M: BikeRiderMaterials, lod = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = rear ? 'RearWheelSpin' : 'FrontWheelSpin';
  const P = new Parts();

  // tyre: round crown, upright sidewalls (lathe around Y, then axis → X)
  const prof: THREE.Vector2[] = [];
  const N = 18;
  prof.push(new THREE.Vector2(R - 0.075, -W * 0.4));
  for (let i = 0; i <= N; i++) {
    const t = -1 + (2 * i) / N;
    const a = (t * Math.PI) / 2;
    prof.push(new THREE.Vector2(R - 0.066 * Math.pow(1 - Math.cos(a), 0.85), (W / 2) * Math.sin(a)));
  }
  prof.push(new THREE.Vector2(R - 0.075, W * 0.4));
  const tyre = new THREE.LatheGeometry(prof, lod === 0 ? 64 : lod === 1 ? 40 : 28);
  tyre.rotateZ(-Math.PI / 2);
  if (!M.bikeTyre.map) {
    M.bikeTyre.map = getTyreTexture();
    M.bikeTyre.color.setHex(0x26292f);
    M.bikeTyre.needsUpdate = true;
  }
  P.add(tyre, M.bikeTyre);

  // rim barrel + lips + cobalt stripe
  const rr = R - 0.074;
  const barrel = new THREE.CylinderGeometry(rr - 0.004, rr - 0.004, W * 0.8, 48, 1, true);
  barrel.rotateZ(Math.PI / 2);
  P.add(barrel, M.bikeGloss);
  for (const sx of [-1, 1]) {
    const lip = new THREE.TorusGeometry(rr, 0.011, 8, 56);
    lip.rotateY(Math.PI / 2);
    lip.translate(sx * W * 0.4, 0, 0);
    P.add(lip, M.bikeGloss);
    const stripe = new THREE.TorusGeometry(rr - 0.004, 0.0065, 6, 56);
    stripe.rotateY(Math.PI / 2);
    stripe.translate(sx * (W * 0.4 + 0.007), 0, 0);
    P.add(stripe, M.bikeBlue);
  }
  // hub
  const hub = new THREE.CylinderGeometry(0.045, 0.045, W * 0.72, 20);
  hub.rotateZ(Math.PI / 2);
  P.add(hub, M.bikeGloss);
  const axle = new THREE.CylinderGeometry(0.018, 0.018, W * 0.95, 12);
  axle.rotateZ(Math.PI / 2);
  P.add(axle, M.bikeAlu);
  // 10 thin straight spokes (reference rims)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const p0 = new THREE.Vector3(0, Math.sin(a) * 0.05, Math.cos(a) * 0.05);
    const p1 = new THREE.Vector3(0, Math.sin(a + 0.06) * (rr - 0.01), Math.cos(a + 0.06) * (rr - 0.01));
    const len = p0.distanceTo(p1);
    const sp = new THREE.CylinderGeometry(0.008, 0.012, len, lod > 1 ? 5 : 8);
    sp.scale(1.6, 1, 1);
    sp.translate(0, len / 2, 0);
    sp.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()));
    sp.translate(p0.x, p0.y, p0.z);
    P.add(sp, M.bikeGloss);
  }
  // brake rotors (front: twin, rear: single right) + rear sprocket (left)
  const rotor = (x: number, r: number) => {
    if (lod === 0) P.add(plate(rotorShape(r), 0.005, x, 48), M.bikeSteel);
    else {
      const d = new THREE.CylinderGeometry(r, r, 0.005, 32);
      d.rotateZ(Math.PI / 2);
      d.translate(x, 0, 0);
      P.add(d, M.bikeSteel);
    }
    P.add(plate(carrierShape(r * 0.62, rear ? 5 : 6), 0.008, x + Math.sign(x) * 0.003), M.bikeGloss);
    // floating-disc buttons
    for (let i = 0; i < (lod > 0 ? 0 : 10); i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.0075, 0.0075, 0.011, 8);
      b.rotateZ(Math.PI / 2);
      b.translate(x, Math.sin(a) * r * 0.64, Math.cos(a) * r * 0.64);
      P.add(b, M.bikeGold);
    }
  };
  if (rear) {
    rotor(0.095, 0.11);
    P.add(plate(sprocketShape(0.1, 42, 6), 0.008, -0.11, 8), M.bikeGloss);
  } else {
    rotor(-0.072, 0.155);
    rotor(0.072, 0.155);
  }
  P.into(g, rear ? 'Bike_RearWheel' : 'Bike_FrontWheel');
  return g;
}

// ----------------------------------------------------------------------------------- body
export function buildSportBike(M: BikeRiderMaterials, lod = 0) {
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ChassisGroup';
  const P = new Parts();
  const paint = M.bikePaint;
  if (!paint.map) {
    paint.map = getLiveryTexture();
    paint.needsUpdate = true;
  }
  const hi = lod === 0, lo = lod === 2;
  const sub = (n: number) => Math.max(2, Math.round(n * (lod === 0 ? 1 : lod === 1 ? 0.7 : 0.45)));
  const E = BIKE_ERGO;

  // ===== NOSE (measured: tip at z -0.935 y 0.735, rises to the screen base, black lower band)
  const noseKeys: FKey[] = [
    { z: -0.935, yb: 0.724, yt: 0.746, yw: 0.735, hw: 0.018, topW: 0.006, ridge: 0 },
    { z: -0.9, yb: 0.702, yt: 0.792, yw: 0.737, hw: 0.088, topW: 0.03, ridge: 0.006 },
    { z: -0.84, yb: 0.688, yt: 0.848, yw: 0.748, hw: 0.148, topW: 0.05, ridge: 0.01 },
    { z: -0.74, yb: 0.68, yt: 0.888, yw: 0.762, hw: 0.196, topW: 0.07, ridge: 0.012 },
    { z: -0.62, yb: 0.69, yt: 0.926, yw: 0.782, hw: 0.222, topW: 0.085, ridge: 0.012 },
    { z: -0.5, yb: 0.712, yt: 0.955, yw: 0.8, hw: 0.232, topW: 0.09, ridge: 0.01 },
    { z: -0.4, yb: 0.745, yt: 0.968, yw: 0.82, hw: 0.222, topW: 0.09, ridge: 0.006 },
    { z: -0.34, yb: 0.8, yt: 0.95, yw: 0.85, hw: 0.196, topW: 0.08, ridge: 0.002 },
    { z: -0.31, yb: 0.86, yt: 0.92, yw: 0.88, hw: 0.1, topW: 0.05, ridge: 0 },
  ];
  const lerpKey = (keys: FKey[], k: string, z: number) => {
    if (z <= keys[0].z) return keys[0][k];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (z <= b.z) return a[k] + ((b[k] - a[k]) * (z - a.z)) / (b.z - a.z);
    }
    return keys[keys.length - 1][k];
  };
  const noseX = (z: number, y: number) => {
    const hw = lerpKey(noseKeys, 'hw', z), yw = lerpKey(noseKeys, 'yw', z);
    const yt = lerpKey(noseKeys, 'yt', z), yb = lerpKey(noseKeys, 'yb', z);
    const f = y >= yw ? 1 - 0.55 * ((y - yw) / Math.max(0.01, yt - yw)) : 1 - 0.28 * ((yw - y) / Math.max(0.01, yw - yb));
    return hw * Math.max(0.3, f);
  };
  const nosePaint: Painter = (_p, n) => (n.y < -0.35 ? K.black : WHITE);
  const noseProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.45, upY = k.yt - (k.yt - k.yw) * 0.32;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [0, k.yt + k.ridge], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.72, k.yb], [k.hw * 0.72, k.yb]];
  };
  P.add(setSideUV(facetShell(noseKeys, noseProfile, nosePaint, sub(6), 3), 'nose'), paint);

  for (const sx of [-1, 1]) {
    // triangular lamp: dark recessed housing, cyan lens, separate DRL strip along the top edge
    const lamp: [number, number][] = [[-0.928, 0.73], [-0.742, 0.826], [-0.79, 0.716]];
    const housing: [number, number][] = [[-0.934, 0.729], [-0.73, 0.836], [-0.786, 0.708]];
    P.add(sidePlate(housing, (z, y) => noseX(z, y) + 0.008, 0.01, sx, solid(K.black)), M.bikeGloss);
    P.add(sidePlate(lamp, (z, y) => noseX(z, y) + 0.015, 0.006, sx, solid(K.black)), M.bikeLens);
    P.add(sidePlate([[-0.905, 0.746], [-0.744, 0.829], [-0.75, 0.818], [-0.9, 0.738]], (z, y) => noseX(z, y) + 0.02, 0.004, sx, solid(K.black)), M.riderGlow);
  }
  // centre intake + tiny red element between the lamps
  P.add(ellipsoid([0, 0.71, -0.918], [0.03, 0.012, 0.03], solid(K.black), { w: 14, h: 8 }), M.bikeGloss);
  { const r = new THREE.BoxGeometry(0.03, 0.006, 0.01); r.translate(0, 0.703, -0.928); P.add(r, M.bikeRed); }

  // ===== WINDSCREEN (overlay-aligned to the reference: rises steeply, peak at z ~-0.39 y ~1.14)
  {
    const keys = [
      { z: -0.8, w: 0.075, y: 0.86, h: 0.0 },
      { z: -0.7, w: 0.115, y: 0.885, h: 0.07 },
      { z: -0.59, w: 0.136, y: 0.91, h: 0.15 },
      { z: -0.49, w: 0.13, y: 0.93, h: 0.205 },
      { z: -0.41, w: 0.106, y: 0.945, h: 0.2 },
      { z: -0.37, w: 0.08, y: 0.952, h: 0.16 },
    ];
    const pos: number[] = [], idx: number[] = [];
    const RS = sub(24), ZS = sub(24);
    for (let i = 0; i <= ZS; i++) {
      const u = (i / ZS) * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(u)), t = u - k;
      const a = keys[Math.max(0, k - 1)], b = keys[k], c = keys[k + 1], d = keys[Math.min(keys.length - 1, k + 2)];
      const z = catmull(a.z, b.z, c.z, d.z, t), w = catmull(a.w, b.w, c.w, d.w, t);
      const y = catmull(a.y, b.y, c.y, d.y, t), h = Math.max(0, catmull(a.h, b.h, c.h, d.h, t));
      for (let j = 0; j <= RS; j++) {
        const th = Math.PI * (0.05 + 0.9 * (j / RS));
        pos.push(Math.cos(th) * w, y + Math.sin(th) * (h + 0.012), z + Math.sin(th) * h * 0.12);
      }
    }
    for (let i = 0; i < ZS; i++) for (let j = 0; j < RS; j++) {
      const a = i * (RS + 1) + j, b = a + 1, c = a + RS + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setIndex(idx);
    sg.computeVertexNormals();
    P.add(sg, M.bikeScreen);
  }

  // ===== SIDE FAIRINGS: layered hard-surface plates with real thickness
  const panelX = (z: number, y: number) =>
    0.19 + 0.034 * Math.max(0, 1 - Math.abs(y - 0.56) / 0.42) - 0.05 * Math.max(0, (-0.66 - z) / 0.16) - 0.02 * Math.max(0, (0.3 - y) / 0.2);
  const outerWhite = (sx: number): Painter => (_p, n) => (n.x * sx < 0.2 ? K.black : WHITE);
  for (const sx of [-1, 1]) {
    // black inner / lower fairing layer (gives the dark cavities and negative space)
    P.add(sidePlate([[-0.8, 0.705], [-0.24, 0.8], [-0.12, 0.62], [-0.06, 0.24], [-0.4, 0.13], [-0.56, 0.36], [-0.7, 0.58]],
      (z, y) => panelX(z, y) - 0.03, 0.01, sx, solid(K.black)), M.bikeGloss);
    // main silver "V" panel with the blue arrow (livery)
    P.add(setSideUV(sidePlate([
      [-0.805, 0.716], [-0.5, 0.766], [-0.33, 0.8], [-0.225, 0.828], [-0.238, 0.772], [-0.33, 0.736],
      [-0.44, 0.664], [-0.37, 0.43], [-0.405, 0.12], [-0.468, 0.1], [-0.54, 0.38], [-0.64, 0.58], [-0.82, 0.684],
    ], panelX, 0.014, sx, outerWhite(sx)), 'pod'), paint);
    // rear upper panel beside the tank ("<" piece)
    P.add(setSideUV(sidePlate([[-0.31, 0.83], [-0.14, 0.868], [-0.12, 0.79], [-0.2, 0.64], [-0.26, 0.64]],
      (z, y) => panelX(z, y) - 0.012, 0.012, sx, outerWhite(sx)), 'pod'), paint);
    // belly pan side with the blue flash (lower rear)
    P.add(sidePlate([[-0.12, 0.27], [0.1, 0.25], [0.13, 0.19], [-0.06, 0.18]], () => 0.16, 0.01, sx, solid(K.blue)), M.bikeBlue);

    // mirrors: stalk from the fairing, trapezoid housing with indicator strip and glass facing back
    P.add(pipe([[sx * 0.205, 0.955, -0.52], [sx * 0.26, 1.0, -0.5], [sx * 0.285, 1.03, -0.49]], 0.007, 8, 6), M.bikeBlack);
    P.add(facetShell([
      { z: -0.53, cx: sx * 0.31, cy: 1.05, w: 0.055, h: 0.018 },
      { z: -0.49, cx: sx * 0.31, cy: 1.05, w: 0.07, h: 0.025 },
      { z: -0.47, cx: sx * 0.31, cy: 1.05, w: 0.068, h: 0.024 },
    ], (k) => [[k.cx + k.w, k.cy - k.h * 0.3], [k.cx + k.w * 0.8, k.cy + k.h], [k.cx - k.w * 0.9, k.cy + k.h * 0.7], [k.cx - k.w, k.cy - k.h * 0.6], [k.cx - k.w * 0.6, k.cy - k.h], [k.cx + k.w * 0.7, k.cy - k.h]],
      solid(K.black), 2, 2, 0.4), M.bikeGloss);
    { const gl = new THREE.BoxGeometry(0.12, 0.034, 0.004); gl.translate(sx * 0.31, 1.05, -0.466); P.add(gl, M.mirror); }
    { const ind = new THREE.BoxGeometry(0.05, 0.006, 0.006); ind.translate(sx * 0.335, 1.04, -0.533); P.add(ind, M.riderGlow); }
  }

  // ===== BELLY, ENGINE, RADIATOR
  P.add(shell([
    { z: -0.34, yb: 0.2, yt: 0.26, hwB: 0.09, hwM: 0.11, hwT: 0.09 },
    { z: -0.26, yb: 0.17, yt: 0.3, hwB: 0.13, hwM: 0.15, hwT: 0.13, p: 3 },
    { z: -0.06, yb: 0.165, yt: 0.3, hwB: 0.14, hwM: 0.155, hwT: 0.14, p: 3 },
    { z: 0.08, yb: 0.19, yt: 0.29, hwB: 0.11, hwM: 0.12, hwT: 0.1, p: 3 },
    { z: 0.12, yb: 0.22, yt: 0.27, hwB: 0.04, hwM: 0.05, hwT: 0.04 },
  ], solid(K.black), sub(24), 3), M.bikeGloss);
  P.add(shell([
    { z: -0.32, yb: 0.27, yt: 0.56, hwB: 0.1, hwM: 0.12, hwT: 0.1, p: 3.2 },
    { z: -0.24, yb: 0.22, yt: 0.66, hwB: 0.135, hwM: 0.145, hwT: 0.125, p: 3.6 },
    { z: -0.02, yb: 0.2, yt: 0.62, hwB: 0.145, hwM: 0.155, hwT: 0.125, p: 3.6 },
    { z: 0.12, yb: 0.24, yt: 0.54, hwB: 0.12, hwM: 0.13, hwT: 0.1, p: 3.2 },
    { z: 0.17, yb: 0.3, yt: 0.48, hwB: 0.06, hwM: 0.07, hwT: 0.05 },
  ], solid(K.grey), sub(18), 3), M.bikeBlack);
  for (const sx of [-1, 1]) {
    const cov = new THREE.CylinderGeometry(0.085, 0.092, 0.03, sub(40));
    cov.rotateZ(Math.PI / 2);
    cov.translate(sx * 0.165, 0.42, -0.06);
    P.add(cov, M.bikeGloss);
    const ring = new THREE.TorusGeometry(0.072, 0.006, 6, sub(40));
    ring.rotateY(Math.PI / 2);
    ring.translate(sx * 0.181, 0.42, -0.06);
    P.add(ring, M.bikeAlu);
    if (hi) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bolt = new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 6);
      bolt.rotateZ(Math.PI / 2);
      bolt.translate(sx * 0.184, 0.42 + Math.sin(a) * 0.08, -0.06 + Math.cos(a) * 0.08);
      P.add(bolt, M.bikeAlu);
    }
    const cov2 = new THREE.CylinderGeometry(0.05, 0.055, 0.025, sub(24));
    cov2.rotateZ(Math.PI / 2);
    cov2.translate(sx * 0.155, 0.28, -0.2);
    P.add(cov2, M.bikeGloss);
  }
  if (!lo) for (let i = 0; i < 7; i++) {
    const fin = new THREE.BoxGeometry(0.27 - i * 0.004, 0.006, 0.16);
    fin.rotateX(0.35);
    fin.translate(0, 0.5 + i * 0.022, -0.22 + i * 0.006);
    P.add(fin, M.bikeAlu);
  }
  {
    const rad = new THREE.BoxGeometry(0.32, 0.3, 0.035);
    rad.rotateX(-0.25);
    rad.translate(0, 0.53, -0.36);
    P.add(rad, M.bikeBlack);
  }
  if (!lo) P.add(plate(sprocketShape(0.045, 16, 0), 0.008, -0.115, 8).translate(0, 0.33, 0.12), M.bikeGloss);

  // ===== FRAME: black twin spars + rear frame plates (visible between tank and engine)
  for (const sx of [-1, 1]) {
    P.add(sidePlate([[-0.24, 0.86], [0.08, 0.84], [0.2, 0.66], [0.24, 0.42], [0.12, 0.38], [0.06, 0.6], [-0.12, 0.74], [-0.26, 0.76]],
      () => 0.163, 0.03, sx, solid(K.grey)), M.bikeGloss);
    // silver rear-subframe strut under the seat
    P.add(sidePlate([[0.2, 0.64], [0.26, 0.64], [0.6, 0.86], [0.54, 0.885]], () => 0.12, 0.016, sx, solid(K.silver)), M.bikeAlu);
    // black side cover under the seat
    P.add(sidePlate([[0.12, 0.84], [0.5, 0.86], [0.46, 0.76], [0.22, 0.66], [0.1, 0.7]], () => 0.115, 0.014, sx, solid(K.black)), M.bikeBlack);
  }

  // ===== TANK (top ~1.0 m around z 0) + black knee pads with blue border
  const tankPaint: Painter = (p, n) => (n.y > 0.55 && Math.abs(p.x) < 0.055 ? K.black : n.y < -0.3 ? K.black : WHITE);
  const tankProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.32, upY = k.yt - (k.yt - k.yw) * 0.28;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.85, k.yb], [k.hw * 0.85, k.yb]];
  };
  const tankKeys: FKey[] = [
    { z: -0.34, yb: 0.83, yt: 0.935, yw: 0.875, hw: 0.165, topW: 0.07 },
    { z: -0.24, yb: 0.8, yt: 0.985, yw: 0.88, hw: 0.195, topW: 0.09 },
    { z: -0.08, yb: 0.79, yt: 1.005, yw: 0.88, hw: 0.198, topW: 0.095 },
    { z: 0.04, yb: 0.79, yt: 0.985, yw: 0.87, hw: 0.185, topW: 0.09 },
    { z: 0.14, yb: 0.8, yt: 0.905, yw: 0.85, hw: 0.15, topW: 0.07 },
    { z: 0.2, yb: 0.82, yt: 0.865, yw: 0.84, hw: 0.09, topW: 0.04 },
  ];
  P.add(setSideUV(facetShell(tankKeys, tankProfile, tankPaint, sub(5), 3), 'tank'), paint);
  for (const sx of [-1, 1]) {
    const tx = (z: number) => lerpKey(tankKeys, 'hw', z) * 0.97;
    P.add(sidePlate([[-0.11, 0.955], [0.13, 0.935], [0.16, 0.85], [-0.06, 0.835]], (z) => tx(z) + 0.004, 0.006, sx, solid(K.blue)), M.bikeBlue);
    P.add(sidePlate([[-0.09, 0.945], [0.12, 0.927], [0.145, 0.858], [-0.05, 0.846]], (z) => tx(z) + 0.009, 0.006, sx, solid(K.black)), M.bikeBlack);
  }
  { const cap = new THREE.CylinderGeometry(0.036, 0.036, 0.008, sub(24)); cap.translate(0, 1.007, -0.15); P.add(cap, M.bikeAlu); }

  // ===== SEAT (flat, ~0.85 m) and slim pointed TAIL rising to ~1.0 m at z 0.9
  P.add(shell([
    { z: 0.16, yb: 0.79, yt: 0.84, hwB: 0.09, hwM: 0.1, hwT: 0.08 },
    { z: 0.24, yb: 0.77, yt: 0.856, hwB: 0.12, hwM: 0.132, hwT: 0.11, p: 2.8 },
    { z: 0.42, yb: 0.78, yt: 0.862, hwB: 0.118, hwM: 0.128, hwT: 0.1, p: 2.8 },
    { z: 0.54, yb: 0.81, yt: 0.888, hwB: 0.09, hwM: 0.1, hwT: 0.075 },
    { z: 0.6, yb: 0.85, yt: 0.9, hwB: 0.04, hwM: 0.05, hwT: 0.035 },
  ], solid(K.black), sub(26), 4), M.bikeSeat);
  const tailKeys: FKey[] = [
    { z: 0.4, yb: 0.75, yt: 0.86, yw: 0.8, hw: 0.135, topW: 0.07 },
    { z: 0.55, yb: 0.82, yt: 0.932, yw: 0.865, hw: 0.118, topW: 0.055 },
    { z: 0.66, yb: 0.865, yt: 0.99, yw: 0.91, hw: 0.098, topW: 0.045 },
    { z: 0.78, yb: 0.9, yt: 1.012, yw: 0.94, hw: 0.09, topW: 0.045 },
    { z: 0.87, yb: 0.925, yt: 1.008, yw: 0.958, hw: 0.084, topW: 0.045 },
    { z: 0.905, yb: 0.938, yt: 0.996, yw: 0.964, hw: 0.072, topW: 0.04 },
  ];
  const tailPaint: Painter = (_p, n) => (n.y > 0.6 || n.y < -0.3 ? K.black : WHITE);
  const tailProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.35, upY = k.yt - (k.yt - k.yw) * 0.3;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.7, k.yb], [k.hw * 0.7, k.yb]];
  };
  P.add(setSideUV(facetShell(tailKeys, tailProfile, tailPaint, sub(5), 3), 'tail'), paint);
  const tailX = (z: number) => lerpKey(tailKeys, 'hw', z);
  for (const sx of [-1, 1]) {
    // V-shaped cyan tail lamp on each flank (dark housing + lens)
    P.add(sidePlate([[0.73, 0.97], [0.895, 0.99], [0.87, 0.945], [0.76, 0.95]], (z) => tailX(z) + 0.002, 0.005, sx, solid(K.black)), M.bikeGloss);
    P.add(sidePlate([[0.745, 0.968], [0.885, 0.985], [0.862, 0.952], [0.77, 0.955]], (z) => tailX(z) + 0.005, 0.004, sx, solid(K.black)), M.riderGlow);
  }
  for (const sx of [-1, 1]) {
    // rear-face V lamps (seen from behind) + dark surround
    const hb = new THREE.BoxGeometry(0.07, 0.026, 0.01);
    hb.rotateZ(sx * 0.38);
    hb.translate(sx * 0.038, 0.97, 0.904);
    P.add(hb, M.bikeGloss);
    const lens = new THREE.BoxGeometry(0.062, 0.012, 0.01);
    lens.rotateZ(sx * 0.38);
    lens.translate(sx * 0.038, 0.972, 0.909);
    P.add(lens, M.riderGlow);
  }
  { const r = new THREE.BoxGeometry(0.03, 0.007, 0.01); r.translate(0, 0.946, 0.908); P.add(r, M.bikeRed); }
  // license flap "beak" under the lamps
  P.add(facetShell([
    { z: 0.74, cx: 0, cy: 0.905, w: 0.04, h: 0.012 },
    { z: 0.86, cx: 0, cy: 0.9, w: 0.055, h: 0.01 },
    { z: 0.9, cx: 0, cy: 0.905, w: 0.05, h: 0.008 },
  ], (k) => [[k.cx + k.w, k.cy], [k.cx + k.w * 0.8, k.cy + k.h], [k.cx - k.w * 0.8, k.cy + k.h], [k.cx - k.w, k.cy], [k.cx - k.w * 0.8, k.cy - k.h], [k.cx + k.w * 0.8, k.cy - k.h]],
    solid(K.black), 2, 1, 0.4), M.bikeBlack);

  // ===== EXHAUST: headers -> collector box under the engine -> round right-side silencer angled up
  if (!lo) for (const [i, hx] of [-0.09, -0.03, 0.03, 0.09].entries()) {
    P.add(pipe([[hx, 0.5, -0.33], [hx * 1.05, 0.42, -0.4], [hx * 0.8, 0.27, -0.39], [0.02 + hx * 0.4, 0.19 + i * 0.004, -0.28], [0.05, 0.17, -0.14]], 0.016, sub(28), 8), M.bikeChrome);
  }
  P.add(facetShell([
    { z: -0.16, cx: 0.05, cy: 0.19, w: 0.06, h: 0.03 },
    { z: 0.05, cx: 0.06, cy: 0.2, w: 0.1, h: 0.05 },
    { z: 0.3, cx: 0.08, cy: 0.225, w: 0.1, h: 0.05 },
    { z: 0.38, cx: 0.09, cy: 0.24, w: 0.06, h: 0.03 },
  ], (k) => [[k.cx + k.w, k.cy], [k.cx + k.w * 0.8, k.cy + k.h], [k.cx - k.w * 0.8, k.cy + k.h], [k.cx - k.w, k.cy], [k.cx - k.w * 0.8, k.cy - k.h], [k.cx + k.w * 0.8, k.cy - k.h]],
    solid(K.silverDark), 3, 2, 0.4), M.bikeChrome);
  P.add(pipe([[0.12, 0.23, 0.24], [0.15, 0.27, 0.27], [0.165, 0.3, 0.29]], 0.03, 10, 10), M.bikeChrome);
  {
    // round silencer: z 0.28 -> 0.46, rising from y 0.3 to 0.52, radius 0.07
    const can = new THREE.CylinderGeometry(0.068, 0.072, 0.27, sub(28), 1, false);
    const cap = new THREE.CylinderGeometry(0.066, 0.06, 0.04, sub(28));
    cap.translate(0, 0.155, 0);
    const tip = new THREE.CylinderGeometry(0.026, 0.026, 0.03, 14);
    tip.translate(0, 0.18, 0);
    const shield = new THREE.CylinderGeometry(0.073, 0.073, 0.12, sub(16), 1, true, -0.5, 1.6);
    shield.translate(0, -0.02, 0);
    for (const g of [can, cap, tip, shield]) {
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.05, 0.62, 0.78).normalize()));
      g.translate(0.2, 0.41, 0.37);
    }
    P.add(can, M.bikeChrome);
    P.add(cap, M.bikeGloss);
    P.add(tip, M.bikeChrome);
    P.add(shield, M.bikeGloss);
  }

  // ===== REARSETS (CNC plates + pegs at the measured position)
  for (const sx of [-1, 1]) {
    P.add(sidePlate([[0.16, 0.56], [0.22, 0.56], [0.34, 0.47], [0.3, 0.4], [0.24, 0.42]], () => 0.18, 0.012, sx, solid(K.silver)), M.bikeAlu);
    const peg = new THREE.CylinderGeometry(0.011, 0.011, 0.07, 10);
    peg.rotateZ(Math.PI / 2);
    peg.translate(sx * (E.pegX + 0.02), E.pegY, E.pegZ);
    P.add(peg, M.bikeAlu);
  }

  // ===== CHAIN (left) wrapped round both sprockets + guard
  {
    const pts: V3[] = [];
    const arc = (cz: number, cy: number, r: number, a0: number, a1: number, n: number) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push([-0.115, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
      }
    };
    arc(0.71, 0.33, 0.102, Math.PI * 0.53, -Math.PI * 0.55, 14);
    arc(0.12, 0.33, 0.047, -Math.PI * 0.45, -Math.PI * 1.47, 8);
    P.add(pipe(pts, 0.0065, sub(110), 5, true), M.bikeGloss);
  }

  P.into(chassisGroup, 'Bike');

  // ===== SWINGARM: big aluminium box arms with dark inset, adjusters, monoshock, hugger
  const swingarmGroup = new THREE.Group();
  swingarmGroup.name = 'SwingarmGroup';
  const armProfile = (k: Record<string, number>): [number, number][] => [
    [k.cx + k.w, k.cy - k.h * 0.6], [k.cx + k.w, k.cy + k.h * 0.6], [k.cx + k.w * 0.6, k.cy + k.h], [k.cx - k.w, k.cy + k.h],
    [k.cx - k.w, k.cy - k.h], [k.cx + k.w * 0.6, k.cy - k.h],
  ];
  for (const sx of [-1, 1]) {
    const keys: FKey[] = [
      { z: 0.16, cx: 0.15, cy: 0.455, w: 0.022, h: 0.045 },
      { z: 0.24, cx: 0.155, cy: 0.45, w: 0.026, h: 0.07 },
      { z: 0.5, cx: 0.16, cy: 0.395, w: 0.025, h: 0.06 },
      { z: 0.66, cx: 0.162, cy: 0.345, w: 0.022, h: 0.04 },
      { z: 0.75, cx: 0.162, cy: 0.33, w: 0.018, h: 0.03 },
    ].map((k) => ({ ...k, cx: k.cx * sx }));
    const prof = sx > 0 ? armProfile : (k: Record<string, number>) => mirrorPoly(armProfile(k), k.cx);
    P.add(facetShell(keys, prof, solid(K.silver), sub(4), 2, 0.4), M.bikeAlu);
    P.add(sidePlate([[0.3, 0.462], [0.55, 0.412], [0.56, 0.37], [0.31, 0.41]], () => 0.188, 0.006, sx, solid(K.black)), M.bikeGloss);
    const adj = new THREE.BoxGeometry(0.03, 0.05, 0.06);
    adj.translate(sx * 0.165, 0.335, 0.715);
    P.add(adj, M.bikeGloss);
  }
  {
    const cross = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12);
    cross.rotateZ(Math.PI / 2);
    cross.translate(0, 0.45, 0.18);
    P.add(cross, M.bikeAlu);
    // rear hugger over the tyre
    const hug = new THREE.TorusGeometry(0.37, 0.016, 6, sub(24), 1.0);
    hug.rotateZ(1.6);
    hug.rotateY(-Math.PI / 2);
    hug.scale(6, 1, 1);
    hug.translate(0, 0.33, 0.71);
    P.add(hug, M.bikeGloss);
  }
  P.into(swingarmGroup, 'Bike_Swingarm');
  chassisGroup.add(swingarmGroup);
  {
    // monoshock (frame-mounted, visible under the seat)
    const S2 = new Parts();
    const body = new THREE.CylinderGeometry(0.018, 0.018, 0.2, 12);
    body.translate(0, 0.1, 0);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * Math.PI * 2 * 6; pts.push(new THREE.Vector3(Math.cos(a) * 0.03, 0.02 + t * 0.14, Math.sin(a) * 0.03)); }
    const spring = lo ? new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10).translate(0, 0.09, 0) : new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), sub(90), 0.006, 5, false);
    for (const g of [body, spring]) { g.rotateX(-0.5); g.translate(0, 0.44, 0.24); }
    S2.add(body, M.bikeGold);
    S2.add(spring, M.bikeCaliper);
    S2.into(chassisGroup, 'Bike_Shock');
  }

  // ===== STEERING: gold USD forks (top at ~(-0.47, 0.96)), clip-ons at the measured grips, red calipers
  const steeringPivot = new THREE.Group();
  steeringPivot.name = 'SteeringPivot';
  steeringPivot.position.set(0, 0.74, -0.52);
  const gripLY = E.gripY - 0.74;
  for (const sx of [-1, 1]) {
    P.add(pipe([[sx * 0.105, 0.225, 0.05], [sx * 0.105, -0.17, -0.095]], 0.031, 2, 18), M.bikeGold);
    P.add(pipe([[sx * 0.105, -0.16, -0.09], [sx * 0.105, -0.43, -0.19]], 0.024, 2, 14), M.bikeChrome);
    P.add(pipe([[sx * 0.105, -0.36, -0.165], [sx * 0.105, -0.45, -0.2]], 0.03, 2, 12), M.bikeGloss);
    // clip-on bar + grip + lever
    P.add(pipe([[sx * 0.1, gripLY + 0.01, 0.07], [sx * 0.2, gripLY, E.gripLocalZ - 0.03], [sx * (E.gripX - 0.04), gripLY, E.gripLocalZ - 0.01]], 0.011, 10, 8), M.bikeGloss);
    P.add(pipe([[sx * (E.gripX - 0.045), gripLY, E.gripLocalZ - 0.012], [sx * (E.gripX + 0.04), gripLY, E.gripLocalZ + 0.012]], 0.017, 2, 10), M.bikeBlack);
    P.add(pipe([[sx * (E.gripX - 0.06), gripLY + 0.01, E.gripLocalZ - 0.04], [sx * (E.gripX + 0.03), gripLY + 0.005, E.gripLocalZ - 0.06]], 0.005, 2, 6), M.bikeAlu);
    // radial caliper: red body with silver face
    const cal = ellipsoid([0, 0, 0], [0.02, 0.06, 0.028], solid(K.silver), { w: 14, h: 10 });
    cal.rotateX(-0.75);
    cal.translate(sx * 0.076, -0.33, -0.1);
    P.add(cal, M.bikeCaliper);
    if (!lo) P.add(pipe([[sx * 0.087, -0.29, -0.065], [sx * 0.13, -0.08, 0.0], [sx * 0.13, 0.12, 0.06], [sx * 0.2, gripLY + 0.02, E.gripLocalZ - 0.04]], 0.004, 16, 5), M.bikeGloss);
  }
  { const clamp = new THREE.BoxGeometry(0.26, 0.024, 0.08); clamp.translate(0, 0.215, 0.05); P.add(clamp, M.bikeAlu); }
  {
    const top = new THREE.BoxGeometry(0.12, 0.05, 0.08); top.rotateX(-0.5); top.translate(0, 0.27, 0.0); P.add(top, M.bikeBlack); // dash
    const fen = new THREE.TorusGeometry(0.335, 0.022, 8, sub(28), 1.5);
    fen.rotateZ(0.55);
    fen.rotateY(Math.PI / 2);
    fen.scale(2.6, 1, 1);
    fen.translate(0, -0.43, -0.19);
    P.add(fen, M.bikeGloss);
  }
  P.into(steeringPivot, 'Bike_Steering');
  const frontPivot = new THREE.Group();
  frontPivot.name = 'FrontWheelPivot';
  frontPivot.position.set(0, -0.43, -0.19);
  const frontWheelSpin = buildWheel(0.31, 0.14, false, M, lod);
  frontPivot.add(frontWheelSpin);
  steeringPivot.add(frontPivot);
  chassisGroup.add(steeringPivot);

  const rearPivot = new THREE.Group();
  rearPivot.name = 'RearWheelPivot';
  rearPivot.position.set(0, 0.33, 0.71);
  const rearWheelSpin = buildWheel(0.33, 0.24, true, M, lod);
  rearPivot.add(rearWheelSpin);
  chassisGroup.add(rearPivot);

  return { chassisGroup, steeringPivot, frontWheelSpin, rearWheelSpin, swingarmGroup };
}

export const BIKE_COLORS = K;
export { mix, band };
