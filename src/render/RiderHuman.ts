import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BikeRiderMaterials } from './BikeRiderAsset.ts';
import { buildHelmetParts } from './RiderHelmet.ts';

/**
 * Organic (human-proportioned) rider for the Bike Rush hero bike.
 *
 * Replaces the old segmented "robot" rider: every limb and the torso are single continuous
 * lofted surfaces with round, muscle-shaped cross-sections, skinned with smooth multi-bone
 * weights (closest-bone falloff, up to 4 influences) so elbows, knees, waist and shoulders
 * bend without gaps or hard creases. The skeleton (18 bones, names, bind positions, -Z limb
 * axes) is identical to the original, so applyBikeRiderPose() and the 2-bone IK keep working.
 *
 * Suit graphics (graphite leathers, cobalt panels, pearl helmet) are vertex-painted instead of
 * being built from bolted-on plates; only a few small sliders (shoulders, knees, knuckles, toes)
 * use the titanium material.
 */

export type V3 = [number, number, number];
export interface Sec {
  c: V3;
  /** half-width along +u / -u */
  ru: number;
  ruN?: number;
  /** half-depth along +v / -v (v = u × tangent; for a limb running along -Z, +v is up) */
  rv: number;
  rvN?: number;
  /** superellipse power (2 = ellipse) */
  p?: number;
}
export type Painter = (p: THREE.Vector3, n: THREE.Vector3, t: number) => THREE.Color;

const C = (hex: number) => new THREE.Color(hex);
const COL = {
  graphite: C(0x15171c),
  silver: C(0xa9b1bd),
  silverHi: C(0xc9cfd8),
  graphiteHi: C(0x2b313c),
  cobalt: C(0x1f5cff),
  cobaltDeep: C(0x1440c4),
  pearl: C(0xe9edf4),
  visor: C(0x07090d),
  silverPiping: C(0xb9c2d2),
  black: C(0x0d0f14),
};

export /** detail scale for radial/segment counts (set per build from the LOD level) */
let LOD_SCALE = 1;

export const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Smooth loft through key sections (Catmull-Rom on centres and radii). */
export function loft(keys: Sec[], paint: Painter, radial = 22, sub = 4, uAxis: V3 = [1, 0, 0]): THREE.BufferGeometry {
  radial = Math.max(6, Math.round(radial * LOD_SCALE));
  sub = Math.max(2, Math.round(sub * Math.min(1, LOD_SCALE + 0.2)));
  // ---- resample keys
  type S = { c: THREE.Vector3; ru: number; ruN: number; rv: number; rvN: number; p: number };
  const K = keys.map((k) => ({
    c: new THREE.Vector3(...k.c),
    ru: k.ru,
    ruN: k.ruN ?? k.ru,
    rv: k.rv,
    rvN: k.rvN ?? k.rv,
    p: k.p ?? 2,
  }));
  const at = (i: number) => K[Math.max(0, Math.min(K.length - 1, i))];
  const rings: S[] = [];
  for (let i = 0; i < K.length - 1; i++) {
    const n = i === K.length - 2 ? sub + 1 : sub;
    for (let s = 0; s < n; s++) {
      const t = s / sub;
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      const f = (k: keyof Omit<S, 'c'>) => Math.max(0.0015, catmull(a[k], b[k], c[k], d[k], t));
      rings.push({
        c: new THREE.Vector3(
          catmull(a.c.x, b.c.x, c.c.x, d.c.x, t),
          catmull(a.c.y, b.c.y, c.c.y, d.c.y, t),
          catmull(a.c.z, b.c.z, c.c.z, d.c.z, t),
        ),
        ru: f('ru'), ruN: f('ruN'), rv: f('rv'), rvN: f('rvN'),
        p: b.p + (c.p - b.p) * t,
      });
    }
  }

  const R = radial;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const params: number[] = [];
  const U0 = new THREE.Vector3(...uAxis);
  const T = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Vector3();

  const frames: { u: THREE.Vector3; v: THREE.Vector3 }[] = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const prev = rings[Math.max(0, r - 1)].c, next = rings[Math.min(rings.length - 1, r + 1)].c;
    T.subVectors(next, prev).normalize();
    u.copy(U0).addScaledVector(T, -U0.dot(T)).normalize();
    v.crossVectors(u, T).normalize();
    frames.push({ u: u.clone(), v: v.clone() });
    const e = 2 / ring.p;
    for (let j = 0; j <= R; j++) {
      const ang = (j / R) * Math.PI * 2;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const cu = Math.sign(cs) * Math.pow(Math.abs(cs), e) * (cs >= 0 ? ring.ru : ring.ruN);
      const sv = Math.sign(sn) * Math.pow(Math.abs(sn), e) * (sn >= 0 ? ring.rv : ring.rvN);
      q.copy(ring.c).addScaledVector(u, cu).addScaledVector(v, sv);
      pos.push(q.x, q.y, q.z);
      uv.push(j / R, r / (rings.length - 1));
      params.push(r / (rings.length - 1));
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < R; j++) {
      const a = r * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps (tiny end sections make these read as rounded tips)
  for (const [r, flip] of [[0, true], [rings.length - 1, false]] as const) {
    const ci = pos.length / 3;
    const cc = rings[r].c;
    pos.push(cc.x, cc.y, cc.z);
    uv.push(0.5, r === 0 ? 0 : 1);
    params.push(r === 0 ? 0 : 1);
    for (let j = 0; j < R; j++) {
      const a = r * (R + 1) + j, b = a + 1;
      if (flip) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let r = 0; r < rings.length; r++) {
    const a = r * (R + 1), b = a + R;
    const nx = nrm.getX(a) + nrm.getX(b), ny = nrm.getY(a) + nrm.getY(b), nz = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  paintGeo(g, paint, params);
  // surface evaluator (uv -> point) so the painter can be baked into a crisp texture instead of
  // living only on the sparse vertices
  let len = 0, circ = 0;
  for (let r = 1; r < rings.length; r++) len += rings[r].c.distanceTo(rings[r - 1].c);
  for (const r of rings) circ = Math.max(circ, Math.PI * (r.ru + r.ruN + r.rv + r.rvN) * 0.5);
  const point = (uu: number, vv: number, out: THREE.Vector3) => {
    const f = Math.min(rings.length - 1.0001, Math.max(0, vv * (rings.length - 1)));
    const r0 = Math.floor(f), t = f - r0, A = rings[r0], B = rings[r0 + 1];
    const L = (x: number, y: number) => x + (y - x) * t;
    const fu = frames[r0].u, fu1 = frames[r0 + 1].u, fv = frames[r0].v, fv1 = frames[r0 + 1].v;
    const ang = uu * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang), e = 2 / L(A.p, B.p);
    const pc = e === 1 ? cs : Math.sign(cs) * Math.pow(Math.abs(cs), e);
    const ps = e === 1 ? sn : Math.sign(sn) * Math.pow(Math.abs(sn), e);
    const cu = pc * (cs >= 0 ? L(A.ru, B.ru) : L(A.ruN, B.ruN));
    const sv = ps * (sn >= 0 ? L(A.rv, B.rv) : L(A.rvN, B.rvN));
    out.set(L(A.c.x, B.c.x), L(A.c.y, B.c.y), L(A.c.z, B.c.z));
    const cx = out.x, cy = out.y, cz = out.z;
    out.x += L(fu.x, fu1.x) * cu + L(fv.x, fv1.x) * sv;
    out.y += L(fu.y, fu1.y) * cu + L(fv.y, fv1.y) * sv;
    out.z += L(fu.z, fu1.z) * cu + L(fv.z, fv1.z) * sv;
    return [cx, cy, cz] as const;
  };
  const q1 = new THREE.Vector3(), q2 = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  const surf: Surface = {
    paint, len, circ,
    point,
    evalAt(uu, vv, outP, outN) {
      const c = point(uu, vv, outP);
      point(uu + 0.002, vv, q1);
      point(uu, Math.min(1, vv + 0.002), q2);
      d1.subVectors(q1, outP);
      d2.subVectors(q2, outP);
      if (vv >= 0.998) { point(uu, vv - 0.002, q2); d2.subVectors(outP, q2); }
      outN.crossVectors(d1, d2).normalize();
      if (outN.x * (outP.x - c[0]) + outN.y * (outP.y - c[1]) + outN.z * (outP.z - c[2]) < 0) outN.negate();
    },
  };
  g.userData.surf = surf;
  return g;
}

/** a loft's analytic surface + painter, used to bake the rider livery texture */
export interface Surface {
  paint: Painter;
  len: number;
  circ: number;
  /** surface point at (u, v); returns the ring centre (for outward orientation) */
  point(u: number, v: number, out: THREE.Vector3): readonly [number, number, number];
  evalAt(u: number, v: number, outP: THREE.Vector3, outN: THREE.Vector3): void;
}

/** Ellipsoid (optionally a partial sphere band) */
export function ellipsoid(
  c: V3, r: V3, paint: Painter,
  o: { w?: number; h?: number; phiStart?: number; phiLength?: number; thetaStart?: number; thetaLength?: number } = {},
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, Math.max(6, Math.round((o.w ?? 28) * LOD_SCALE)), Math.max(2, Math.round((o.h ?? 18) * LOD_SCALE)), o.phiStart, o.phiLength, o.thetaStart, o.thetaLength);
  g.scale(r[0], r[1], r[2]);
  g.translate(c[0], c[1], c[2]);
  g.computeVertexNormals();
  paintGeo(g, paint);
  return g;
}

export function paintGeo(g: THREE.BufferGeometry, paint: Painter, params?: number[]) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const vp = new THREE.Vector3(), vn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    vp.fromBufferAttribute(p, i);
    vn.fromBufferAttribute(n, i);
    const c = paint(vp, vn, params ? params[i] : 0);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export const solid = (c: THREE.Color): Painter => () => c;
/** soft blend between two colours: k in 0..1 */
export const mix = (a: THREE.Color, b: THREE.Color, k: number) => a.clone().lerp(b, Math.max(0, Math.min(1, k)));
export const band = (x: number, edge: number, soft = 0.08) => Math.max(0, Math.min(1, (x - edge) / soft + 0.5));

export function buildHumanRider(mats: BikeRiderMaterials, lod = 0) {
  LOD_SCALE = lod === 0 ? 1 : lod === 1 ? 0.7 : 0.5;
  // ------------------------------------------------------------------ skeleton (identical to the original)
  const bones: Record<string, THREE.Bone> = {};
  const makeBone = (name: string, parent: THREE.Bone | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones[name] = b;
    return b;
  };
  const pelvis = makeBone('Pelvis', null, 0, 0.8, 0.22);
  const spine1 = makeBone('Spine_1', pelvis, 0, 0.11, -0.05);
  const spine2 = makeBone('Spine_2', spine1, 0, 0.12, -0.06);
  const chest = makeBone('Chest', spine2, 0, 0.13, -0.06);
  const neck = makeBone('Neck', chest, 0, 0.13, -0.04);
  const head = makeBone('Head', neck, 0, 0.07, -0.02);
  const upperArmL = makeBone('UpperArm_L', chest, -0.195, 0.08, -0.02);
  const forearmL = makeBone('Forearm_L', upperArmL, 0, 0, -0.27);
  const handL = makeBone('Hand_L', forearmL, 0, 0, -0.25);
  const upperArmR = makeBone('UpperArm_R', chest, 0.195, 0.08, -0.02);
  const forearmR = makeBone('Forearm_R', upperArmR, 0, 0, -0.27);
  const handR = makeBone('Hand_R', forearmR, 0, 0, -0.25);
  const thighL = makeBone('Thigh_L', pelvis, -0.135, -0.02, -0.02);
  const shinL = makeBone('Shin_L', thighL, 0, 0, -0.37);
  const footL = makeBone('Foot_L', shinL, 0, 0, -0.36);
  const thighR = makeBone('Thigh_R', pelvis, 0.135, -0.02, -0.02);
  const shinR = makeBone('Shin_R', thighR, 0, 0, -0.37);
  const footR = makeBone('Foot_R', shinR, 0, 0, -0.36);
  const boneList = [pelvis, spine1, spine2, chest, neck, head, upperArmL, forearmL, handL, upperArmR, forearmR, handR, thighL, shinL, footL, thighR, shinR, footR];
  const boneIdx: Record<string, number> = {};
  boneList.forEach((b, i) => (boneIdx[b.name] = i));
  pelvis.updateMatrixWorld(true);

  // bind-pose bone segments (head → tail) for automatic weights
  const wp = (b: THREE.Bone) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  const segs: Record<string, THREE.Line3> = {};
  const tail: Record<string, THREE.Bone> = {
    Pelvis: spine1, Spine_1: spine2, Spine_2: chest, Chest: neck, Neck: head,
    UpperArm_L: forearmL, Forearm_L: handL, UpperArm_R: forearmR, Forearm_R: handR,
    Thigh_L: shinL, Shin_L: footL, Thigh_R: shinR, Shin_R: footR,
  };
  const ext: Record<string, V3> = { Head: [0, 0.22, 0], Hand_L: [0, 0, -0.1], Hand_R: [0, 0, -0.1], Foot_L: [0, 0, -0.15], Foot_R: [0, 0, -0.15] };
  for (const b of boneList) {
    const a = wp(b);
    const t = tail[b.name] ? wp(tail[b.name]) : a.clone().add(new THREE.Vector3(...ext[b.name]));
    segs[b.name] = new THREE.Line3(a, t);
  }

  // ------------------------------------------------------------------ parts
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  const tmp = new THREE.Vector3(), cp = new THREE.Vector3();
  /**
   * Moves a part from `space` bone-local coords into bind space and gives it smooth weights:
   * w ∝ 1 / d^power to each candidate bone segment, top 4 kept and normalised.
   */
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, space: THREE.Bone | null, cands: string[], power = 6) => {
    const g = geo;
    if (space) g.applyMatrix4(space.matrixWorld);
    const p = g.attributes.position as THREE.BufferAttribute;
    const si = new Uint16Array(p.count * 4);
    const sw = new Float32Array(p.count * 4);
    const ws: { i: number; w: number }[] = [];
    for (let v = 0; v < p.count; v++) {
      tmp.fromBufferAttribute(p, v);
      ws.length = 0;
      for (const name of cands) {
        segs[name].closestPointToPoint(tmp, true, cp);
        const d = Math.max(0.004, cp.distanceTo(tmp));
        ws.push({ i: boneIdx[name], w: 1 / Math.pow(d, power) });
      }
      ws.sort((a, b) => b.w - a.w);
      const top = ws.slice(0, 4);
      const sum = top.reduce((s, x) => s + x.w, 0);
      top.forEach((x, k) => {
        si[v * 4 + k] = x.i;
        sw[v * 4 + k] = x.w / sum;
      });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    parts.push({ geo: g, mat });
  };

  const suit = mats.riderSuit;
  const shell = mats.riderHelmet;

  // ---- TORSO: one continuous surface from seat to neck (built directly in bind space).
  // v = u × tangent: with the spine running up/forward, +v points to the BACK, -v to the chest.
  const SEAM = C(0x343b48);
  const torsoPaint: Painter = (p, n) => {
    // reference back (crop 22): silver V plate from the shoulder blades to a point at mid-back,
    // slanted cobalt strips on the ribs, small slanted silver kidney plates, many stitched panel
    // seams on black leather; silver chest plate, cobalt collar
    const backN = n.z * 0.9 + n.y * 0.3;
    const frontN = -n.z * 0.9 - n.y * 0.4;
    const ax = Math.abs(p.x);
    const edge = 0.02 + Math.max(0, p.y - 1.0) * 0.4; // V half-width
    const near = (d: number, w = 0.0022) => Math.abs(d) < w;
    let c = COL.graphite;
    if (backN > 0.05) {
      const rib = ax - (edge + 0.06); // rib strip centre line, parallel to the V edge
      const kid = ax - (0.07 + (0.935 - p.y) * 0.45); // slanted kidney plate centre line
      if (p.y > 1.0 && ax < edge) c = ax < 0.0025 ? COL.silver : COL.silverHi;
      else if (p.y > 0.99 && near(ax - edge - 0.012)) c = SEAM;
      else if (p.y > 0.99 && p.y < 1.002 && ax < edge + 0.012) c = SEAM;
      else if (p.y > 0.97 && p.y < 1.21 && Math.abs(rib) < 0.022) c = COL.cobalt;
      else if (p.y > 0.97 && p.y < 1.21 && near(Math.abs(rib) - 0.03)) c = SEAM;
      else if (p.y > 0.855 && p.y < 0.935 && Math.abs(kid) < 0.02 && backN > 0.3) c = COL.silver;
      // seat sliders: slanted silver panels low on the seat, so the back of the hips is not one black blob
      else if (p.y > 0.74 && p.y < 0.805 && Math.abs(ax - (0.095 - (p.y - 0.74) * 0.3)) < 0.015 && backN > 0.25) c = COL.silver;
      else if (p.y > 0.74 && p.y < 0.805 && near(Math.abs(ax - (0.095 - (p.y - 0.74) * 0.3)) - 0.022) && backN > 0.25) c = SEAM;
      else if ((near(p.y - 0.955) && ax < 0.13) || (p.y < 0.99 && p.y > 0.95 && near(ax))) c = SEAM;
      else if (p.y > 0.96 && p.y < 1.05 && near(ax - 0.05 - (1.05 - p.y) * 0.6)) c = SEAM;
    }
    // cobalt side panel along the ribs (side view), with a seam above it
    const side = Math.abs(n.x);
    if (side > 0.86 && p.y > 0.86 && p.y < 1.12) c = COL.cobalt;
    else if (side > 0.8 && side <= 0.86 && p.y > 0.86 && p.y < 1.12) c = SEAM;
    if (frontN > 0.45 && p.y > 1.13 && ax < 0.12) c = COL.silver;
    // collar: black with a thin cobalt piping line (the old wide blue band read as a ring round the neck)
    if (p.y > 1.296 && p.y < 1.304) c = COL.cobalt;
    return c;
  };
  add(
    loft(
      [
        { c: [0, 0.69, 0.25], ru: 0.08, rv: 0.05, rvN: 0.05 },
        { c: [0, 0.74, 0.24], ru: 0.124, rv: 0.07, rvN: 0.078, p: 2.2 },
        { c: [0, 0.83, 0.21], ru: 0.13, rv: 0.074, rvN: 0.082, p: 2.2 },
        { c: [0, 0.93, 0.165], ru: 0.136, rv: 0.082, rvN: 0.084, p: 2.2 },
        { c: [0, 1.04, 0.11], ru: 0.156, rv: 0.09, rvN: 0.096, p: 2.2 },
        { c: [0, 1.14, 0.06], ru: 0.18, rv: 0.11, rvN: 0.104, p: 2.3 },
        { c: [0, 1.212, 0.035], ru: 0.2, rv: 0.1, rvN: 0.092, p: 2.5 },
        { c: [0, 1.262, 0.02], ru: 0.165, rv: 0.085, rvN: 0.074, p: 2.4 },
        { c: [0, 1.3, 0.008], ru: 0.08, rv: 0.064, rvN: 0.058 },
        { c: [0, 1.345, -0.004], ru: 0.054, rv: 0.05, rvN: 0.047 },
        { c: [0, 1.39, -0.014], ru: 0.046, rv: 0.044, rvN: 0.042 },
        { c: [0, 1.425, -0.02], ru: 0.02, rv: 0.02 },
      ],
      torsoPaint, 34, 5,
    ),
    suit, null, ['Pelvis', 'Spine_1', 'Spine_2', 'Chest', 'Neck', 'Head'], 5,
  );

  // ---- AERO HUMP (pearl, like a race suit's back protector), smooth not segmented
  add(
    ellipsoid([0, 0.058, 0.066], [0.09, 0.1, 0.044], (p) =>
      mix(COL.silverHi, COL.graphite, band(0.016 - Math.abs(p.x), 0, 0.006)), { w: 22, h: 14 }),
    shell, chest, ['Spine_2', 'Chest', 'Neck'], 6,
  );

  for (const [sfx, sx, upper, fore, hand] of [
    ['L', -1, upperArmL, forearmL, handL],
    ['R', 1, upperArmR, forearmR, handR],
  ] as const) {
    // the arm's +X/-X toward the body in bind pose ends up on top of the arm while riding
    const inSign = -sx;
    // ---- ARM: shoulder → wrist in one piece (UpperArm local space, runs along -Z, +v = up)
    const armPaint: Painter = (p, n) => {
      // top of the arm while riding = n.x * inSign > 0 (see IK frame)
      const top = n.x * inSign;
      if (p.z > -0.065 && top > 0.15) return p.z < -0.03 && p.z > -0.045 && top > 0.5 ? COL.cobalt : COL.silver; // shoulder cap
      if (p.z > -0.2 && p.z < -0.08 && top > 0.35) return top > 0.88 ? COL.cobalt : COL.silver; // upper-arm plate
      if (p.z > -0.2 && p.z < -0.08 && top > 0.28) return SEAM;
      if (p.z < -0.305 && p.z > -0.47 && top > 0.1) return p.z < -0.36 && p.z > -0.41 && top > 0.75 ? COL.cobalt : COL.silver; // forearm guard
      if (Math.abs(p.z + 0.3) < 0.003 || Math.abs(p.z + 0.475) < 0.003) return SEAM;
      return COL.graphite;
    };
    add(
      loft(
        [
          { c: [0, 0.0, 0.055], ru: 0.025, rv: 0.025 },
          { c: [0, 0.0, 0.028], ru: 0.056, rv: 0.058, rvN: 0.05 },
          { c: [sx * 0.004, 0.002, -0.03], ru: 0.062, rv: 0.058, rvN: 0.052 },
          { c: [0, 0, -0.12], ru: 0.05, rv: 0.05, rvN: 0.047 },
          { c: [0, 0, -0.22], ru: 0.045, rv: 0.043, rvN: 0.043 },
          { c: [0, 0, -0.27], ru: 0.042, rv: 0.042, rvN: 0.041 },
          { c: [0, 0, -0.325], ru: 0.047, rv: 0.046, rvN: 0.044 },
          { c: [0, 0, -0.42], ru: 0.04, rv: 0.037, rvN: 0.036 },
          { c: [0, 0, -0.495], ru: 0.033, rv: 0.03, rvN: 0.029 },
          { c: [0, 0, -0.53], ru: 0.02, rv: 0.018 },
        ],
        armPaint, 16, 3,
      ),
      suit, upper, ['Chest', `UpperArm_${sfx}`, `Forearm_${sfx}`, `Hand_${sfx}`], 6,
    );
    // layered armour: second shoulder plate, upper-arm plate, three overlapping forearm plates
    add(ellipsoid([inSign * 0.044, 0, -0.15], [0.007, 0.04, 0.06], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, upper, [`UpperArm_${sfx}`]);
    for (const [k, z] of [-0.335, -0.385, -0.435].entries()) {
      add(ellipsoid([inSign * (0.041 - k * 0.003), 0, z], [0.006, 0.033 - k * 0.003, 0.034], solid(k === 1 ? COL.cobalt : COL.silverHi), { w: 12, h: 8 }),
        mats.riderArmor, upper, [`Forearm_${sfx}`]);
    }
    // shoulder slider (titanium cap)
    add(ellipsoid([sx * 0.012, 0.036, -0.035], [0.058, 0.016, 0.068], solid(COL.silverHi), { w: 22, h: 14 }),
      mats.riderArmor, upper, [`UpperArm_${sfx}`]);
    // glove gauntlet over the wrist (Forearm local)
    add(
      loft(
        [
          { c: [0, 0, -0.165], ru: 0.03, rv: 0.03 },
          { c: [0, 0, -0.18], ru: 0.045, rv: 0.043 },
          { c: [0, 0, -0.215], ru: 0.044, rv: 0.041 },
          { c: [0, 0, -0.255], ru: 0.037, rv: 0.034 },
          { c: [0, 0, -0.275], ru: 0.025, rv: 0.022 },
        ],
        (p, n) => mix(COL.black, COL.cobalt, band(n.x * inSign, 0.6, 0.15) * band(p.z, -0.235, 0.02)),
        14, 2,
      ),
      suit, fore, [`Forearm_${sfx}`, `Hand_${sfx}`], 6,
    );
    // fist wrapped round the grip + knuckle guard
    add(ellipsoid([0, -0.004, -0.048], [0.046, 0.038, 0.064], solid(COL.black), { w: 22, h: 14 }),
      suit, hand, [`Hand_${sfx}`]);
    add(ellipsoid([inSign * 0.03, 0.006, -0.055], [0.007, 0.03, 0.036], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, hand, [`Hand_${sfx}`]);
  }

  for (const [sfx, sx, thigh, shin, foot] of [
    ['L', -1, thighL, shinL, footL],
    ['R', 1, thighR, shinR, footR],
  ] as const) {
    // ---- LEG: hip → ankle in one piece (Thigh local, runs along -Z; +v becomes the knee front)
    const legPaint: Painter = (p, n) => {
      const out = n.x * sx;
      if (p.z > -0.05 && out > 0.45) return COL.silver; // hip slider patch
      if (p.z > -0.3 + (1 - out) * 0.25 && p.z < -0.07 && out > 0.5) return COL.cobalt; // outer thigh panel
      if (p.z < -0.42 && p.z > -0.63 && n.y > 0.2) return n.y > 0.8 && p.z < -0.5 && p.z > -0.56 ? COL.cobalt : COL.silver; // shin guard
      if (p.z < -0.45 && p.z > -0.6 && out > 0.5 && n.y < 0.2) return COL.cobalt; // calf flash
      if (Math.abs(p.z + 0.07) < 0.003 && out > 0.3) return SEAM;
      return COL.graphite;
    };
    add(
      loft(
        [
          { c: [0, 0, 0.07], ru: 0.04, rv: 0.04 },
          { c: [0, 0, 0.035], ru: 0.07, rv: 0.07, rvN: 0.066 },
          { c: [sx * 0.004, 0, -0.06], ru: 0.076, rv: 0.072, rvN: 0.07 },
          { c: [0, 0, -0.18], ru: 0.068, rv: 0.064, rvN: 0.062 },
          { c: [0, 0, -0.3], ru: 0.062, rv: 0.058, rvN: 0.057 },
          { c: [0, 0, -0.37], ru: 0.055, rv: 0.056, rvN: 0.052 },
          { c: [0, 0, -0.45], ru: 0.055, rv: 0.05, rvN: 0.062 },
          { c: [0, 0, -0.55], ru: 0.049, rv: 0.044, rvN: 0.053 },
          { c: [0, 0, -0.66], ru: 0.042, rv: 0.039, rvN: 0.041 },
          { c: [0, 0, -0.725], ru: 0.036, rv: 0.035, rvN: 0.035 },
          { c: [0, 0, -0.75], ru: 0.02, rv: 0.02 },
        ],
        legPaint, 16, 3,
      ),
      suit, thigh, ['Pelvis', `Thigh_${sfx}`, `Shin_${sfx}`, `Foot_${sfx}`], 6,
    );
    // knee cap + outer knee puck
    add(ellipsoid([0, 0.048, -0.37], [0.046, 0.012, 0.058], solid(COL.silverHi), { w: 20, h: 12 }),
      mats.riderArmor, thigh, [`Thigh_${sfx}`, `Shin_${sfx}`], 6);
    add(ellipsoid([sx * 0.056, 0.005, -0.38], [0.007, 0.036, 0.048], solid(COL.cobaltDeep), { w: 16, h: 10 }),
      mats.riderArmor, thigh, [`Thigh_${sfx}`, `Shin_${sfx}`], 6);
    // shin guard (two plates) over the shin
    add(ellipsoid([0, 0.048, -0.5], [0.036, 0.008, 0.072], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, thigh, [`Shin_${sfx}`]);
    add(ellipsoid([0, 0.044, -0.6], [0.032, 0.008, 0.052], solid(COL.cobalt), { w: 14, h: 10 }),
      mats.riderArmor, thigh, [`Shin_${sfx}`]);
    // race boot shaft (Shin local) + foot
    add(
      loft(
        [
          { c: [0, 0, -0.18], ru: 0.03, rv: 0.03 },
          { c: [0, 0, -0.2], ru: 0.054, rv: 0.05, rvN: 0.058 },
          { c: [0, 0, -0.29], ru: 0.048, rv: 0.044, rvN: 0.05 },
          { c: [0, 0, -0.35], ru: 0.044, rv: 0.044, rvN: 0.044 },
          { c: [0, 0, -0.375], ru: 0.03, rv: 0.03 },
        ],
        (p, n) => (p.z < -0.335 ? COL.silver : n.x * sx > 0.1 || n.y > 0.5 ? COL.cobalt : COL.black),
        14, 2,
      ),
      suit, shin, [`Shin_${sfx}`, `Foot_${sfx}`], 6,
    );
    add(
      loft(
        [
          { c: [0, 0, 0.035], ru: 0.03, rv: 0.03 },
          { c: [0, 0, 0.015], ru: 0.046, rv: 0.05, rvN: 0.042 },
          { c: [0, -0.004, -0.06], ru: 0.047, rv: 0.038, rvN: 0.036 },
          { c: [0, -0.01, -0.13], ru: 0.04, rv: 0.026, rvN: 0.03 },
          { c: [0, -0.012, -0.165], ru: 0.022, rv: 0.014, rvN: 0.016 },
        ],
        solid(COL.black), 14, 2,
      ),
      suit, foot, [`Foot_${sfx}`],
    );
    add(ellipsoid([0, 0.048, -0.27], [0.032, 0.007, 0.062], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, shin, [`Shin_${sfx}`]);
    add(ellipsoid([0, 0.0, 0.03], [0.04, 0.03, 0.02], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, foot, [`Foot_${sfx}`]);
    add(ellipsoid([sx * 0.04, -0.012, -0.11], [0.007, 0.018, 0.04], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, foot, [`Foot_${sfx}`]);
  }

  // ---- HELMET: detailed full-face race helmet (RiderHelmet.ts), rigid on the Head bone
  for (const { geo, mat } of buildHelmetParts(mats, LOD_SCALE)) add(geo, mat, head, ['Head']);

  // ------------------------------------------------------------------ bake the suit livery atlas
  bakeSuitAtlas(parts, suit);

  // ------------------------------------------------------------------ merge by material
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const { geo, mat } of parts) {
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    for (const k of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    }
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat)!.push(geo);
  }
  const geos: THREE.BufferGeometry[] = [];
  const matArray: THREE.Material[] = [];
  for (const [mat, list] of groups) {
    geos.push(mergeGeometries(list, false));
    matArray.push(mat);
  }
  const combined = mergeGeometries(geos, true);

  const skeleton = new THREE.Skeleton(boneList);
  const riderMesh = new THREE.SkinnedMesh(combined, matArray);
  riderMesh.name = 'Rider_SkinnedMesh';
  riderMesh.frustumCulled = false;
  riderMesh.bind(skeleton, new THREE.Matrix4());
  LOD_SCALE = 1;
  return { riderMesh, skeleton, bones, pelvis };
}

// ------------------------------------------------------------------------------- suit livery atlas
/**
 * Every lofted suit part gets its own rectangle in one atlas; its painter is evaluated per texel on
 * the analytic surface, so stripes / plates / seams get crisp edges instead of the staircase you get
 * from colouring a few hundred vertices. A second map carries roughness (G) and metalness (B):
 * silver plates read as brushed metal, cobalt as satin, the rest as leather.
 */
const ATLAS = 1024, PAD = 3, DENSITY = 480; // px per metre (~2 mm per texel)
let atlasCache: { color: THREE.DataTexture; orm: THREE.DataTexture; rects: { x: number; y: number; w: number; h: number }[] } | null = null;

function bakeSuitAtlas(parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[], suit: THREE.MeshPhysicalMaterial) {
  const baked = parts.filter((pt) => pt.mat === suit && pt.geo.userData.surf);
  const sizes = baked.map(({ geo }) => {
    const sf = geo.userData.surf as Surface;
    return { w: Math.max(16, Math.min(512, Math.round(sf.circ * DENSITY))), h: Math.max(16, Math.min(512, Math.round(sf.len * DENSITY))) };
  });
  // white texel block (top-left) for suit parts that are not baked
  const WHITE = { x: 0, y: 0, w: 8, h: 8 };
  if (!atlasCache || atlasCache.rects.length !== baked.length) {
    // shelf packing, tallest first
    const order = sizes.map((_, i) => i).sort((a, b) => sizes[b].h - sizes[a].h);
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    let x = WHITE.w + PAD * 2, y = 0, shelf = 0;
    for (const i of order) {
      const { w, h } = sizes[i];
      if (x + w + PAD * 2 > ATLAS) { x = 0; y += shelf; shelf = 0; }
      rects[i] = { x: x + PAD, y: y + PAD, w, h };
      x += w + PAD * 2;
      shelf = Math.max(shelf, h + PAD * 2);
    }
    const H = ATLAS;
    // plain RGBA buffers -> DataTexture (works the same in the browser and the TikTok native build)
    const img = { data: new Uint8Array(ATLAS * H * 4) }, orm = { data: new Uint8Array(ATLAS * H * 4) };
    // painters return a handful of shared colours: encode each one once (sRGB bytes + roughness/metal)
    const enc = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
    const lut = new Map<THREE.Color, Uint8Array>();
    const bytes = (c: THREE.Color) => {
      let e = lut.get(c);
      if (!e) {
        const silver = c.r > 0.25 && c.g > 0.25 && c.b > 0.25;
        const blue = c.b > 0.3 && c.r < 0.12;
        e = Uint8Array.of(enc(c.r), enc(c.g), enc(c.b), Math.round(255 * (silver ? 0.4 : blue ? 0.42 : 0.62)), Math.round(255 * (silver ? 0.32 : blue ? 0.2 : 0.0)));
        if (lut.size < 4096) lut.set(c, e);
      }
      return e;
    };
    const put = (px: number, py: number, c: THREE.Color) => {
      if (px < 0 || py < 0 || px >= ATLAS || py >= H) return;
      const o = (py * ATLAS + px) * 4, e = bytes(c);
      img.data[o] = e[0]; img.data[o + 1] = e[1]; img.data[o + 2] = e[2]; img.data[o + 3] = 255;
      orm.data[o] = 255; orm.data[o + 1] = e[3]; orm.data[o + 2] = e[4]; orm.data[o + 3] = 255;
    };
    const white = new THREE.Color(1, 1, 1);
    for (let py = 0; py < WHITE.h + PAD; py++) for (let px = 0; px < WHITE.w + PAD; px++) put(px, py, white);
    // the white block must read as leather in the ORM map
    for (let py = 0; py < WHITE.h + PAD; py++) for (let px = 0; px < WHITE.w + PAD; px++) { const o = (py * ATLAS + px) * 4; orm.data[o + 1] = 158; orm.data[o + 2] = 0; }
    // one surface evaluation per texel: positions for the rect (+1 row/col) are sampled once and the
    // normal comes from the neighbouring samples (3x cheaper than finite differences per texel)
    const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    baked.forEach(({ geo }, i) => {
      const sf = geo.userData.surf as Surface, R = rects[i];
      const cols = R.w + PAD * 2 + 1, rows = R.h + PAD * 2 + 1;
      const pos = new Float32Array(cols * rows * 3), ctr = new Float32Array(rows * 3), vs = new Float32Array(rows);
      for (let r = 0; r < rows; r++) {
        const py = r - PAD;
        const vv = Math.min(1, Math.max(0, (py + 0.5) / R.h));
        vs[r] = vv;
        for (let c = 0; c < cols; c++) {
          const uu = ((((c - PAD) + 0.5) / R.w) % 1 + 1) % 1;
          const cc = sf.point(uu, vv, Q);
          const o = (r * cols + c) * 3;
          pos[o] = Q.x; pos[o + 1] = Q.y; pos[o + 2] = Q.z;
          if (c === 0) { ctr[r * 3] = cc[0]; ctr[r * 3 + 1] = cc[1]; ctr[r * 3 + 2] = cc[2]; }
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const o = (r * cols + c) * 3;
          P.set(pos[o], pos[o + 1], pos[o + 2]);
          e1.set(pos[o + 3] - P.x, pos[o + 4] - P.y, pos[o + 5] - P.z);
          // along v: next row, or the previous one at a clamped end row
          let o2 = o + cols * 3, sgn = 1;
          if (vs[r + 1] === vs[r]) { o2 = Math.max(0, o - cols * 3); sgn = -1; }
          e2.set((pos[o2] - P.x) * sgn, (pos[o2 + 1] - P.y) * sgn, (pos[o2 + 2] - P.z) * sgn);
          N.crossVectors(e1, e2);
          if (N.lengthSq() < 1e-14) N.set(P.x - ctr[r * 3], P.y - ctr[r * 3 + 1], P.z - ctr[r * 3 + 2]);
          N.normalize();
          if (N.x * (P.x - ctr[r * 3]) + N.y * (P.y - ctr[r * 3 + 1]) + N.z * (P.z - ctr[r * 3 + 2]) < 0) N.negate();
          put(R.x + c - PAD, R.y + r - PAD, sf.paint(P, N, vs[r]));
        }
      }
    });
    const mk = (d: Uint8Array, srgb: boolean) => {
      const t = new THREE.DataTexture(d, ATLAS, H, THREE.RGBAFormat);
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    };
    atlasCache = { color: mk(img.data, true), orm: mk(orm.data, false), rects };
  }
  const { rects } = atlasCache;
  // remap uvs + neutral vertex colour on baked parts; unbaked suit parts sample the white block
  baked.forEach(({ geo }, i) => {
    const R = rects[i], uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, (R.x + uv.getX(k) * R.w) / ATLAS, (R.y + uv.getY(k) * R.h) / ATLAS);
    }
    const col = geo.attributes.color as THREE.BufferAttribute;
    for (let k = 0; k < col.count; k++) col.setXYZ(k, 1, 1, 1);
  });
  for (const pt of parts) {
    if (pt.mat !== suit || pt.geo.userData.surf) continue;
    const n = pt.geo.attributes.position.count;
    const a = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { a[k * 2] = (WHITE.w * 0.5) / ATLAS; a[k * 2 + 1] = (WHITE.h * 0.5) / ATLAS; }
    pt.geo.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  }
  suit.map = atlasCache.color;
  suit.roughnessMap = atlasCache.orm;
  suit.metalnessMap = atlasCache.orm;
  suit.roughness = 1;
  suit.metalness = 1;
  suit.needsUpdate = true;
}
