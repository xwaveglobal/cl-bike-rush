import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BikeRiderMaterials } from './BikeRiderAsset.ts';
import { catmull, ellipsoid, loft, paintGeo, band, mix, solid, type Painter, type V3 } from './RiderHuman.ts';

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
  pod: { cx: 0, cy: 0, z0: -0.9, z1: 0.08, y0: 0.18, y1: 0.84 },
  nose: { cx: 1024, cy: 0, z0: -1.05, z1: -0.28, y0: 0.6, y1: 0.95 },
  tank: { cx: 0, cy: 512, z0: -0.46, z1: 0.12, y0: 0.7, y1: 1.03 },
  tail: { cx: 1024, cy: 512, z0: 0.22, z1: 1.0, y0: 0.56, y1: 0.98 },
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
      // s = z + (y - 0.5): steep slanted bands like the reference side panel
      const band = (s0: number, s1: number, y0: number, y1: number, fill: string, stroke?: string) =>
        poly(c, [[s0 - (y0 - 0.5), y0], [s1 - (y0 - 0.5), y0], [s1 - (y1 - 0.5), y1], [s0 - (y1 - 0.5), y1]], fill, stroke);
      band(-0.06, 0.9, -0.2, 1.2, BLACK); // rear edge black trim
      poly(c, [[-1, 0.0], [0.2, 0.0], [0.2, 0.33], [-1, 0.33]], BLACK); // bottom
      poly(c, [[-0.38 + 0.14, 0.36], [-0.24 + 0.14, 0.36], [-0.38 - 0.16, 0.66]], BLACK, LINE); // vent (triangle)
      band(-0.6, -0.46, 0.36, 0.77, BLUE, LINE); // main slash
      band(-0.2, -0.15, 0.0, 0.33, BLUE); // lower flash
    } else if (c === 'nose') {
      poly(c, [[-1.1, 0.55], [-0.78, 0.55], [-0.78, 0.69], [-0.86, 0.745], [-1.1, 0.745]], BLUE, LINE);
      poly(c, [[-1.1, 0.55], [-0.2, 0.55], [-0.2, 0.672], [-1.1, 0.672]], BLACK);
    } else if (c === 'tank') {
      poly(c, [[-0.5, 0.835], [-0.25, 0.835], [-0.31, 1.05], [-0.5, 1.05]], BLUE, LINE);
      poly(c, [[-0.5, 0.6], [0.2, 0.6], [0.2, 0.775], [-0.5, 0.775]], BLACK);
    } else if (c === 'tail') {
      const s = (s0: number, y: number) => s0 + 1.1 * (y - 0.8);
      poly(c, [[s(0.6, 0.5), 0.5], [s(0.67, 0.5), 0.5], [s(0.67, 1.0), 1.0], [s(0.6, 1.0), 1.0]], BLUE, LINE);
      poly(c, [[0.1, 0.5], [1.1, 0.5], [1.1, 0.665], [0.1, 0.665]], BLACK);
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

// ----------------------------------------------------------------------------------- wheels
function buildWheel(R: number, W: number, rear: boolean, M: BikeRiderMaterials): THREE.Group {
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
  const tyre = new THREE.LatheGeometry(prof, 64);
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
  // 5 split (Y) spokes
  for (let k = 0; k < 5; k++) {
    const base = (k / 5) * Math.PI * 2;
    for (const off of [-0.13, 0.13]) {
      const a0 = base, a1 = base + off;
      const p0 = new THREE.Vector3(0, Math.sin(a0) * 0.05, Math.cos(a0) * 0.05);
      const p1 = new THREE.Vector3(0, Math.sin(a1) * (rr - 0.01), Math.cos(a1) * (rr - 0.01));
      const len = p0.distanceTo(p1);
      const sp = new THREE.CylinderGeometry(0.014, 0.021, len, 8);
      sp.scale(1.4, 1, 1);
      sp.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      sp.applyQuaternion(q);
      sp.translate(p0.x, p0.y, p0.z);
      P.add(sp, M.bikeGloss);
    }
  }
  // brake rotors (front: twin, rear: single right) + rear sprocket (left)
  const rotor = (x: number, r: number) => {
    P.add(plate(rotorShape(r), 0.005, x, 48), M.bikeSteel);
    P.add(plate(carrierShape(r * 0.62, rear ? 5 : 6), 0.008, x + Math.sign(x) * 0.003), M.bikeGloss);
    // floating-disc buttons
    for (let i = 0; i < 10; i++) {
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
export function buildSportBike(M: BikeRiderMaterials) {
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ChassisGroup';
  const P = new Parts();
  const paint = M.bikePaint;
  if (!paint.map) {
    paint.map = getLiveryTexture();
    paint.needsUpdate = true;
  }

  // ---- upper fairing / nose (sits above the front tyre: bottom ≥ 0.645)
  const nosePaint: Painter = (p, n) => {
    if (n.y < -0.35) return K.black; // underside
    if (n.y > 0.45 && Math.abs(p.x) < 0.05) return K.black; // centre spine
    return WHITE;
  };
  const noseProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.45, upY = k.yt - (k.yt - k.yw) * 0.32;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [0, k.yt + k.ridge], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.72, k.yb], [k.hw * 0.72, k.yb]];
  };
  P.add(setSideUV(facetShell([
    { z: -1.035, yb: 0.665, yt: 0.7, yw: 0.685, hw: 0.026, topW: 0.008, ridge: 0.0 },
    { z: -0.98, yb: 0.645, yt: 0.765, yw: 0.7, hw: 0.105, topW: 0.035, ridge: 0.006 },
    { z: -0.9, yb: 0.65, yt: 0.82, yw: 0.722, hw: 0.172, topW: 0.065, ridge: 0.012 },
    { z: -0.78, yb: 0.66, yt: 0.865, yw: 0.748, hw: 0.222, topW: 0.085, ridge: 0.014 },
    { z: -0.64, yb: 0.67, yt: 0.9, yw: 0.768, hw: 0.245, topW: 0.1, ridge: 0.014 },
    { z: -0.52, yb: 0.68, yt: 0.915, yw: 0.78, hw: 0.25, topW: 0.11, ridge: 0.012 },
    { z: -0.42, yb: 0.7, yt: 0.905, yw: 0.79, hw: 0.242, topW: 0.1, ridge: 0.008 },
    { z: -0.35, yb: 0.74, yt: 0.86, yw: 0.8, hw: 0.21, topW: 0.09, ridge: 0.004 },
    { z: -0.31, yb: 0.78, yt: 0.82, yw: 0.8, hw: 0.1, topW: 0.05, ridge: 0.0 },
  ], noseProfile, nosePaint, 6, 3), 'nose'), paint);

  // headlights: twin angular cyan "eyes"
  for (const sx of [-1, 1]) {
    const h = new THREE.BoxGeometry(0.11, 0.028, 0.07);
    h.rotateZ(sx * 0.32);
    h.rotateY(sx * -0.62);
    h.translate(sx * 0.072, 0.735, -0.958);
    P.add(h, M.riderGlow);
  }
  // ram-air intake
  P.add(ellipsoid([0, 0.68, -0.995], [0.04, 0.018, 0.04], solid(K.black), { w: 16, h: 8 }), M.bikeBlack);

  // windscreen: open curved sheet over the nose
  {
    const keys = [
      { z: -0.9, w: 0.1, y: 0.805, h: 0.0 },
      { z: -0.8, w: 0.135, y: 0.84, h: 0.06 },
      { z: -0.68, w: 0.15, y: 0.87, h: 0.16 },
      { z: -0.56, w: 0.145, y: 0.895, h: 0.215 },
      { z: -0.5, w: 0.13, y: 0.9, h: 0.22 },
    ];
    const pos: number[] = [], idx: number[] = [];
    const RS = 24, ZS = 24;
    for (let i = 0; i <= ZS; i++) {
      const u = (i / ZS) * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(u)), t = u - k;
      const a = keys[Math.max(0, k - 1)], b = keys[k], c = keys[k + 1], d = keys[Math.min(keys.length - 1, k + 2)];
      const z = catmull(a.z, b.z, c.z, d.z, t), w = catmull(a.w, b.w, c.w, d.w, t);
      const y = catmull(a.y, b.y, c.y, d.y, t), h = Math.max(0, catmull(a.h, b.h, c.h, d.h, t));
      for (let j = 0; j <= RS; j++) {
        const th = Math.PI * (0.06 + 0.88 * (j / RS));
        pos.push(Math.cos(th) * w, y + Math.sin(th) * h * 0.55 + Math.sin(th) * 0.02, z + Math.sin(th) * h * 0.25);
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

  // ---- side fairing pods (flank the front wheel, wedge back to the engine)
  for (const sx of [-1, 1]) {
    const podPaint: Painter = (_p, n) => {
      if (n.x * sx < -0.25 || n.y < -0.5) return K.black; // inner faces / underside
      return WHITE;
    };
    const podProfile = (k: Record<string, number>): [number, number][] => {
      const x = k.xc; // built for the right side, mirrored for the left
      const pts: [number, number][] = [
        [x + k.t + k.b, k.yc], // character line (outermost)
        [x + k.t * 0.45, k.yt - (k.yt - k.yc) * 0.1],
        [x + k.t * 0.1, k.yt],
        [x - k.t, k.yt - 0.006],
        [x - k.t, k.yb + 0.006],
        [x + k.t * 0.15, k.yb],
        [x + k.t * 0.5, k.yb + (k.yc - k.yb) * 0.15],
      ];
      return sx > 0 ? pts : mirrorPoly(pts.map(([px, py]) => [px, py] as [number, number]), x);
    };
    const podKeys: FKey[] = [
      { z: -0.86, xc: 0.16, yb: 0.635, yt: 0.7, yc: 0.67, t: 0.018, b: 0.008 },
      { z: -0.76, xc: 0.185, yb: 0.52, yt: 0.755, yc: 0.62, t: 0.03, b: 0.021 },
      { z: -0.62, xc: 0.2, yb: 0.4, yt: 0.765, yc: 0.56, t: 0.036, b: 0.029 },
      { z: -0.48, xc: 0.208, yb: 0.3, yt: 0.77, yc: 0.5, t: 0.038, b: 0.034 },
      { z: -0.34, xc: 0.208, yb: 0.27, yt: 0.7, yc: 0.45, t: 0.038, b: 0.034 },
      { z: -0.24, xc: 0.204, yb: 0.31, yt: 0.6, yc: 0.42, t: 0.034, b: 0.029 },
      { z: -0.16, xc: 0.198, yb: 0.36, yt: 0.5, yc: 0.41, t: 0.026, b: 0.02 },
      { z: -0.11, xc: 0.192, yb: 0.4, yt: 0.44, yc: 0.415, t: 0.012, b: 0.006 },
    ].map((k) => ({ ...k, xc: k.xc * sx }));
    P.add(setSideUV(facetShell(podKeys, podProfile, podPaint, 5, 3), 'pod'), paint);

    // black inner shroud between tank and side panel (reference: dark layer under the silver panel)
    P.add(shell([
      { z: -0.5, x: sx * 0.17, yb: 0.7, yt: 0.78, hwB: 0.008, hwM: 0.012, hwT: 0.008 },
      { z: -0.42, x: sx * 0.178, yb: 0.62, yt: 0.84, hwB: 0.016, hwM: 0.02, hwT: 0.016, p: 3 },
      { z: -0.26, x: sx * 0.175, yb: 0.5, yt: 0.82, hwB: 0.016, hwM: 0.02, hwT: 0.016, p: 3 },
      { z: -0.12, x: sx * 0.165, yb: 0.52, yt: 0.76, hwB: 0.012, hwM: 0.016, hwT: 0.012 },
      { z: -0.06, x: sx * 0.16, yb: 0.6, yt: 0.7, hwB: 0.006, hwM: 0.008, hwT: 0.006 },
    ], solid(K.black), 14, 4), M.bikeGloss);
    // headlight housing behind each cyan eye
    {
      const hb = new THREE.BoxGeometry(0.135, 0.048, 0.06);
      hb.rotateZ(sx * 0.32);
      hb.rotateY(sx * -0.62);
      hb.translate(sx * 0.074, 0.737, -0.951);
      P.add(hb, M.bikeGloss);
      const drl = new THREE.BoxGeometry(0.06, 0.006, 0.07);
      drl.rotateZ(sx * 0.32);
      drl.rotateY(sx * -0.62);
      drl.translate(sx * 0.085, 0.762, -0.952);
      P.add(drl, M.riderGlow);
    }
    // mirrors on the fairing (+ indicator strip)
    {
      const ind = new THREE.BoxGeometry(0.045, 0.007, 0.008);
      ind.translate(sx * 0.35, 0.935, -0.661);
      P.add(ind, M.riderGlow);
    }
    P.add(pipe([[sx * 0.235, 0.875, -0.665], [sx * 0.29, 0.915, -0.655], [sx * 0.31, 0.93, -0.645]], 0.007, 8, 6), M.bikeBlack);
    P.add(ellipsoid([sx * 0.335, 0.94, -0.635], [0.058, 0.03, 0.026], solid(K.black), { w: 18, h: 10 }), M.bikeGloss);
    P.add(ellipsoid([sx * 0.335, 0.94, -0.61], [0.05, 0.024, 0.004], solid(K.black), { w: 16, h: 8 }), M.mirror);
  }

  // belly pan
  P.add(shell([
    { z: -0.36, yb: 0.2, yt: 0.26, hwB: 0.1, hwM: 0.12, hwT: 0.1 },
    { z: -0.28, yb: 0.165, yt: 0.3, hwB: 0.15, hwM: 0.18, hwT: 0.16, p: 3 },
    { z: -0.08, yb: 0.16, yt: 0.3, hwB: 0.16, hwM: 0.19, hwT: 0.17, p: 3 },
    { z: 0.06, yb: 0.18, yt: 0.29, hwB: 0.12, hwM: 0.14, hwT: 0.12, p: 3 },
    { z: 0.1, yb: 0.21, yt: 0.27, hwB: 0.05, hwM: 0.06, hwT: 0.05 },
  ], solid(K.black), 28, 4), paint);

  // engine block + covers (matte black / dark metal)
  P.add(shell([
    { z: -0.38, yb: 0.26, yt: 0.56, hwB: 0.1, hwM: 0.12, hwT: 0.1, p: 3.2 },
    { z: -0.28, yb: 0.22, yt: 0.64, hwB: 0.14, hwM: 0.15, hwT: 0.13, p: 3.6 },
    { z: -0.05, yb: 0.2, yt: 0.6, hwB: 0.15, hwM: 0.16, hwT: 0.13, p: 3.6 },
    { z: 0.1, yb: 0.24, yt: 0.52, hwB: 0.12, hwM: 0.13, hwT: 0.1, p: 3.2 },
    { z: 0.15, yb: 0.3, yt: 0.46, hwB: 0.06, hwM: 0.07, hwT: 0.05 },
  ], solid(K.grey), 18, 3), M.bikeBlack);
  for (const sx of [-1, 1]) {
    // clutch (right) / alternator (left) covers: dished cover + ring + bolt circle
    const cov = new THREE.CylinderGeometry(0.08, 0.09, 0.03, 40);
    cov.rotateZ(Math.PI / 2);
    cov.translate(sx * 0.165, 0.34, -0.02);
    P.add(cov, M.bikeGloss);
    const ring = new THREE.TorusGeometry(0.068, 0.006, 6, 40);
    ring.rotateY(Math.PI / 2);
    ring.translate(sx * 0.181, 0.34, -0.02);
    P.add(ring, M.bikeAlu);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bolt = new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 6);
      bolt.rotateZ(Math.PI / 2);
      bolt.translate(sx * 0.183, 0.34 + Math.sin(a) * 0.078, -0.02 + Math.cos(a) * 0.078);
      P.add(bolt, M.bikeAlu);
    }
    const cov2 = new THREE.CylinderGeometry(0.05, 0.055, 0.025, 24);
    cov2.rotateZ(Math.PI / 2);
    cov2.translate(sx * 0.155, 0.27, -0.2);
    P.add(cov2, M.bikeGloss);
  }
  // cylinder block cooling fins
  for (let i = 0; i < 7; i++) {
    const fin = new THREE.BoxGeometry(0.29 - i * 0.004, 0.006, 0.17);
    fin.rotateX(0.35);
    fin.translate(0, 0.47 + i * 0.022, -0.27 + i * 0.006);
    P.add(fin, M.bikeAlu);
  }
  // cam cover
  P.add(shell([
    { z: -0.34, yb: 0.62, yt: 0.64, hwB: 0.1, hwM: 0.12, hwT: 0.1 },
    { z: -0.3, yb: 0.62, yt: 0.67, hwB: 0.13, hwM: 0.14, hwT: 0.12, p: 3 },
    { z: -0.16, yb: 0.6, yt: 0.66, hwB: 0.13, hwM: 0.14, hwT: 0.12, p: 3 },
    { z: -0.12, yb: 0.6, yt: 0.63, hwB: 0.1, hwM: 0.11, hwT: 0.09 },
  ], solid(K.black), 16, 2), M.bikeGloss);
  // oil filter + radiator behind the front wheel
  const filt = new THREE.CylinderGeometry(0.035, 0.035, 0.07, 18);
  filt.rotateX(Math.PI / 2 - 0.4);
  filt.translate(0.06, 0.24, -0.33);
  P.add(filt, M.bikeBlue);
  {
    const rad = new THREE.BoxGeometry(0.34, 0.3, 0.035);
    rad.rotateX(-0.2);
    rad.translate(0, 0.53, -0.42);
    P.add(rad, M.bikeBlack);
    for (let i = 0; i < 9; i++) {
      const slat = new THREE.BoxGeometry(0.33, 0.006, 0.012);
      slat.rotateX(-0.2);
      slat.translate(0, 0.41 + i * 0.03, -0.443 + i * 0.006);
      P.add(slat, M.bikeGloss);
    }
  }
  // front sprocket + cover
  P.add(plate(sprocketShape(0.045, 16, 0), 0.008, -0.115, 8).translate(0, 0.36, 0.07), M.bikeGloss);
  P.add(shell([
    { z: 0.0, x: -0.13, yb: 0.32, yt: 0.4, hwB: 0.008, hwM: 0.012, hwT: 0.008 },
    { z: 0.05, x: -0.13, yb: 0.3, yt: 0.43, hwB: 0.012, hwM: 0.016, hwT: 0.012, p: 3 },
    { z: 0.12, x: -0.13, yb: 0.32, yt: 0.42, hwB: 0.008, hwM: 0.012, hwT: 0.008 },
  ], solid(K.black), 12, 3), M.bikeGloss);
  // rear monoshock: red spring around a gold body (visible under the seat)
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * Math.PI * 2 * 7;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.03, t * 0.17, Math.sin(a) * 0.03));
    }
    const spring = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 110, 0.006, 5, false);
    const body = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12);
    body.translate(0, 0.09, 0);
    for (const g of [spring, body]) {
      g.rotateX(-0.75);
      g.translate(0, 0.46, 0.08);
    }
    P.add(spring, M.bikeRed);
    P.add(body, M.bikeGold);
  }

  // aluminium twin-spar frame
  for (const sx of [-1, 1]) {
    P.add(loft([
      { c: [sx * 0.07, 0.84, -0.47], ru: 0.02, rv: 0.04 },
      { c: [sx * 0.12, 0.79, -0.36], ru: 0.022, rv: 0.055 },
      { c: [sx * 0.165, 0.68, -0.2], ru: 0.022, rv: 0.06, p: 3.5 },
      { c: [sx * 0.17, 0.55, 0.0], ru: 0.022, rv: 0.06, p: 3.5 },
      { c: [sx * 0.155, 0.46, 0.13], ru: 0.022, rv: 0.05 },
      { c: [sx * 0.15, 0.44, 0.16], ru: 0.015, rv: 0.03 },
    ], solid(K.silverDark), 14, 4), M.bikeAlu);
  }

  // fuel tank
  const tankPaint: Painter = (p, n) => {
    if (n.y > 0.55 && Math.abs(p.x) < 0.062) return K.black;
    if (n.y < -0.3) return K.black;
    return WHITE;
  };
  const tankProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.32, upY = k.yt - (k.yt - k.yw) * 0.28;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.85, k.yb], [k.hw * 0.85, k.yb]];
  };
  P.add(setSideUV(facetShell([
    { z: -0.44, yb: 0.8, yt: 0.89, yw: 0.84, hw: 0.18, topW: 0.08 },
    { z: -0.36, yb: 0.78, yt: 0.985, yw: 0.86, hw: 0.2, topW: 0.1 },
    { z: -0.22, yb: 0.76, yt: 1.0, yw: 0.85, hw: 0.195, topW: 0.1 },
    { z: -0.08, yb: 0.745, yt: 0.95, yw: 0.82, hw: 0.175, topW: 0.09 },
    { z: 0.04, yb: 0.735, yt: 0.845, yw: 0.79, hw: 0.145, topW: 0.07 },
    { z: 0.1, yb: 0.745, yt: 0.785, yw: 0.765, hw: 0.085, topW: 0.04 },
  ], tankProfile, tankPaint, 5, 3), 'tank'), paint);
  // fuel cap
  const cap = new THREE.CylinderGeometry(0.035, 0.035, 0.008, 24);
  cap.rotateX(-0.15);
  cap.translate(0, 0.998, -0.25);
  P.add(cap, M.bikeAlu);

  // rider seat
  P.add(shell([
    { z: 0.04, yb: 0.72, yt: 0.765, hwB: 0.09, hwM: 0.11, hwT: 0.085 },
    { z: 0.14, yb: 0.7, yt: 0.775, hwB: 0.125, hwM: 0.14, hwT: 0.11, p: 2.8 },
    { z: 0.3, yb: 0.7, yt: 0.785, hwB: 0.125, hwM: 0.138, hwT: 0.1, p: 2.8 },
    { z: 0.44, yb: 0.72, yt: 0.8, hwB: 0.1, hwM: 0.11, hwT: 0.08 },
    { z: 0.5, yb: 0.745, yt: 0.8, hwB: 0.04, hwM: 0.05, hwT: 0.035 },
  ], solid(K.black), 28, 4), M.bikeSeat);

  // tail section rising to the tail-light face
  const tailPaint: Painter = (p, n) => {
    if (n.y > 0.6 || n.y < -0.3 || p.z > 0.868) return K.black; // seat cowl top, underside, light face
    return WHITE;
  };
  const tailProfile = (k: Record<string, number>): [number, number][] => {
    const up = k.topW + (k.hw - k.topW) * 0.35, upY = k.yt - (k.yt - k.yw) * 0.3;
    return [[k.hw, k.yw], [up, upY], [k.topW, k.yt], [-k.topW, k.yt], [-up, upY], [-k.hw, k.yw], [-k.hw * 0.7, k.yb], [k.hw * 0.7, k.yb]];
  };
  P.add(setSideUV(facetShell([
    { z: 0.26, yb: 0.6, yt: 0.73, yw: 0.66, hw: 0.15, topW: 0.08 },
    { z: 0.42, yb: 0.6, yt: 0.8, yw: 0.7, hw: 0.15, topW: 0.075 },
    { z: 0.56, yb: 0.655, yt: 0.865, yw: 0.75, hw: 0.13, topW: 0.06 },
    { z: 0.68, yb: 0.725, yt: 0.92, yw: 0.8, hw: 0.102, topW: 0.045 },
    { z: 0.79, yb: 0.81, yt: 0.965, yw: 0.86, hw: 0.076, topW: 0.035 },
    { z: 0.85, yb: 0.845, yt: 0.975, yw: 0.89, hw: 0.065, topW: 0.03 },
    { z: 0.875, yb: 0.86, yt: 0.968, yw: 0.9, hw: 0.055, topW: 0.025 },
  ], tailProfile, tailPaint, 5, 3), 'tail'), paint);
  // angular cyan tail lights + red brake light
  for (const sx of [-1, 1]) {
    const tl = new THREE.BoxGeometry(0.07, 0.016, 0.016);
    tl.rotateZ(sx * 0.42);
    tl.translate(sx * 0.038, 0.928, 0.876);
    P.add(tl, M.riderGlow);
  }
  // black side covers under the seat (fill between seat, tail and swingarm like the reference)
  for (const sx of [-1, 1]) {
    P.add(shell([
      { z: 0.1, x: sx * 0.13, yb: 0.5, yt: 0.6, hwB: 0.01, hwM: 0.014, hwT: 0.01 },
      { z: 0.18, x: sx * 0.135, yb: 0.48, yt: 0.7, hwB: 0.018, hwM: 0.024, hwT: 0.018, p: 3 },
      { z: 0.34, x: sx * 0.135, yb: 0.52, yt: 0.7, hwB: 0.018, hwM: 0.024, hwT: 0.018, p: 3 },
      { z: 0.48, x: sx * 0.125, yb: 0.6, yt: 0.7, hwB: 0.012, hwM: 0.016, hwT: 0.012 },
    ], solid(K.black), 14, 3), M.bikeBlack);
  }
  // undertail / plate hanger stub
  P.add(shell([
    { z: 0.6, yb: 0.67, yt: 0.72, hwB: 0.05, hwM: 0.06, hwT: 0.05 },
    { z: 0.74, yb: 0.67, yt: 0.8, hwB: 0.06, hwM: 0.07, hwT: 0.06, p: 3 },
    { z: 0.82, yb: 0.7, yt: 0.82, hwB: 0.04, hwM: 0.05, hwT: 0.04 },
  ], solid(K.black), 20, 3), M.bikeBlack);

  // exhaust: four headers out of the cylinder head, collector under the engine, faceted silencer
  for (const [i, hx] of [-0.09, -0.03, 0.03, 0.09].entries()) {
    P.add(pipe([
      [hx, 0.5, -0.36],
      [hx * 1.05, 0.42, -0.43],
      [hx * 0.8, 0.27, -0.42],
      [0.02 + hx * 0.4, 0.19 + i * 0.004, -0.3],
      [0.06, 0.165, -0.14],
    ], 0.016, 28, 10), M.bikeChrome);
  }
  P.add(pipe([[0.06, 0.165, -0.15], [0.11, 0.18, 0.04], [0.16, 0.26, 0.2]], 0.026, 20, 12), M.bikeChrome);
  const canProfile = (k: Record<string, number>): [number, number][] => [
    [k.cx + k.w, k.cy], [k.cx + k.w * 0.7, k.cy + k.h], [k.cx - k.w * 0.7, k.cy + k.h],
    [k.cx - k.w, k.cy], [k.cx - k.w * 0.7, k.cy - k.h], [k.cx + k.w * 0.7, k.cy - k.h],
  ];
  P.add(facetShell([
    { z: 0.19, cx: 0.17, cy: 0.285, w: 0.03, h: 0.03 },
    { z: 0.25, cx: 0.18, cy: 0.315, w: 0.052, h: 0.06 },
    { z: 0.38, cx: 0.197, cy: 0.37, w: 0.058, h: 0.07 },
    { z: 0.465, cx: 0.207, cy: 0.405, w: 0.054, h: 0.064 },
    { z: 0.49, cx: 0.21, cy: 0.412, w: 0.048, h: 0.056 },
  ], canProfile, solid(K.silverDark), 4, 2, 0.4), M.bikeChrome);
  // carbon end cap + twin outlets
  P.add(facetShell([
    { z: 0.488, cx: 0.21, cy: 0.412, w: 0.05, h: 0.058 },
    { z: 0.52, cx: 0.212, cy: 0.42, w: 0.044, h: 0.05 },
  ], canProfile, solid(K.black), 2, 2, 0.4), M.bikeGloss);
  for (const oy of [-0.016, 0.016]) {
    const o = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12);
    o.rotateX(Math.PI / 2);
    o.translate(0.212, 0.42 + oy, 0.525);
    P.add(o, M.bikeChrome);
  }

  // rearsets: hanger plates, pegs, levers
  for (const sx of [-1, 1]) {
    P.add(loft([
      { c: [sx * 0.168, 0.56, 0.1], ru: 0.008, rv: 0.03 },
      { c: [sx * 0.185, 0.5, 0.15], ru: 0.009, rv: 0.035, p: 3 },
      { c: [sx * 0.195, 0.44, 0.2], ru: 0.008, rv: 0.03 },
    ], solid(K.silverDark), 10, 3), M.bikeAlu);
    const peg = new THREE.CylinderGeometry(0.011, 0.011, 0.07, 10);
    peg.rotateZ(Math.PI / 2);
    peg.translate(sx * 0.225, 0.445, 0.16);
    P.add(peg, M.bikeAlu);
  }

  // chain (left side)
  {
    const pts: V3[] = [];
    const arc = (cz: number, cy: number, r: number, a0: number, a1: number, n: number) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push([-0.115, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
      }
    };
    arc(0.71, 0.33, 0.102, Math.PI * 0.53, -Math.PI * 0.55, 14); // rear sprocket (top → back → bottom)
    arc(0.07, 0.36, 0.047, -Math.PI * 0.45, -Math.PI * 1.47, 8); // front sprocket
    const chain = pipe(pts, 0.0065, 110, 5, true);
    P.add(chain, M.bikeGloss);
    // chain guard over the top run
    P.add(shell([
      { z: 0.32, x: -0.115, yb: 0.43, yt: 0.44, hwB: 0.015, hwM: 0.02, hwT: 0.015 },
      { z: 0.4, x: -0.115, yb: 0.43, yt: 0.452, hwB: 0.02, hwM: 0.025, hwT: 0.02, p: 3 },
      { z: 0.62, x: -0.115, yb: 0.445, yt: 0.465, hwB: 0.02, hwM: 0.025, hwT: 0.02, p: 3 },
      { z: 0.68, x: -0.115, yb: 0.45, yt: 0.46, hwB: 0.015, hwM: 0.02, hwT: 0.015 },
    ], solid(K.black), 12, 3), M.bikeBlack);
  }

  P.into(chassisGroup, 'Bike');

  // ---- swingarm
  const swingarmGroup = new THREE.Group();
  swingarmGroup.name = 'SwingarmGroup';
  for (const sx of [-1, 1]) {
    P.add(loft([
      { c: [sx * 0.14, 0.445, 0.12], ru: 0.02, rv: 0.035 },
      { c: [sx * 0.15, 0.43, 0.2], ru: 0.024, rv: 0.055, p: 3.5 },
      { c: [sx * 0.158, 0.38, 0.48], ru: 0.022, rv: 0.045, p: 3.5 },
      { c: [sx * 0.16, 0.335, 0.7], ru: 0.02, rv: 0.032 },
      { c: [sx * 0.16, 0.33, 0.745], ru: 0.012, rv: 0.02 },
    ], solid(K.silver), 14, 4), M.bikeAlu);
  }
  for (const sx of [-1, 1]) {
    const adj = new THREE.BoxGeometry(0.03, 0.05, 0.06);
    adj.translate(sx * 0.165, 0.335, 0.715);
    P.add(adj, M.bikeGloss);
    const nut = new THREE.CylinderGeometry(0.02, 0.02, 0.012, 6);
    nut.rotateZ(Math.PI / 2);
    nut.translate(sx * 0.184, 0.33, 0.71);
    P.add(nut, M.bikeGold);
  }
  P.add(loft([
    { c: [0.15, 0.395, 0.22], ru: 0.012, rv: 0.016 },
    { c: [0.156, 0.335, 0.4], ru: 0.014, rv: 0.02 },
    { c: [0.158, 0.36, 0.56], ru: 0.012, rv: 0.016 },
  ], solid(K.silver), 10, 3), M.bikeAlu);
  const cross = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12);
  cross.rotateZ(Math.PI / 2);
  cross.translate(0, 0.44, 0.15);
  P.add(cross, M.bikeAlu);
  P.into(swingarmGroup, 'Bike_Swingarm');
  chassisGroup.add(swingarmGroup);

  // ---- steering: forks, clamps, clip-ons, fender, calipers, front wheel
  const steeringPivot = new THREE.Group();
  steeringPivot.name = 'SteeringPivot';
  steeringPivot.position.set(0, 0.74, -0.52);
  for (const sx of [-1, 1]) {
    // gold outer tubes (upper) + dark lower legs to the axle
    P.add(pipe([[sx * 0.105, 0.09, 0.03], [sx * 0.105, -0.25, -0.115]], 0.027, 2, 16), M.bikeGold);
    P.add(pipe([[sx * 0.105, -0.24, -0.11], [sx * 0.105, -0.42, -0.186]], 0.021, 2, 14), M.bikeGloss);
    // clip-on bar + grip
    P.add(pipe([[sx * 0.1, 0.06, 0.02], [sx * 0.2, 0.055, 0.06], [sx * 0.24, 0.058, 0.08]], 0.011, 10, 8), M.bikeGloss);
    P.add(pipe([[sx * 0.235, 0.058, 0.078], [sx * 0.3, 0.06, 0.1]], 0.017, 2, 10), M.bikeBlack);
    // radial caliper behind the disc
    const cal = ellipsoid([0, 0, 0], [0.019, 0.058, 0.026], solid(K.silver), { w: 14, h: 10 });
    cal.rotateX(-0.75);
    cal.translate(sx * 0.074, -0.33, -0.1);
    P.add(cal, M.bikeGold);
    P.add(pipe([[sx * 0.085, -0.29, -0.065], [sx * 0.13, -0.12, -0.02], [sx * 0.13, 0.02, 0.04], [sx * 0.2, 0.07, 0.07]], 0.004, 16, 5), M.bikeGloss);
  }
  const clamp = new THREE.BoxGeometry(0.26, 0.022, 0.07);
  clamp.translate(0, 0.085, 0.03);
  P.add(clamp, M.bikeAlu);
  // front fender
  {
    const fen = new THREE.TorusGeometry(0.335, 0.022, 8, 28, 1.5);
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
  const frontWheelSpin = buildWheel(0.31, 0.14, false, M);
  frontPivot.add(frontWheelSpin);
  steeringPivot.add(frontPivot);
  chassisGroup.add(steeringPivot);

  // ---- rear wheel
  const rearPivot = new THREE.Group();
  rearPivot.name = 'RearWheelPivot';
  rearPivot.position.set(0, 0.33, 0.71);
  const rearWheelSpin = buildWheel(0.33, 0.235, true, M);
  rearPivot.add(rearWheelSpin);
  chassisGroup.add(rearPivot);

  return { chassisGroup, steeringPivot, frontWheelSpin, rearWheelSpin, swingarmGroup };
}

export const BIKE_COLORS = K;
export { mix, band };
