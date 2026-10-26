import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BikeRiderMaterials } from './BikeRiderAsset.ts';

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

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const prev = rings[Math.max(0, r - 1)].c, next = rings[Math.min(rings.length - 1, r + 1)].c;
    T.subVectors(next, prev).normalize();
    u.copy(U0).addScaledVector(T, -U0.dot(T)).normalize();
    v.crossVectors(u, T).normalize();
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
  return g;
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
  const torsoPaint: Painter = (p, n) => {
    // cobalt side panels (ribs → hips), cobalt chest yoke, graphite back, cobalt collar
    // reference suit: black leathers, silver V-yoke down the back flanked by cobalt panels,
    // silver chest plate, cobalt side stripe and collar
    const backN = n.z * 0.9 + n.y * 0.3;
    const frontN = -n.z * 0.9 - n.y * 0.4;
    const vEdge = 0.03 + (p.y - 0.96) * 0.85;
    const ax = Math.abs(p.x);
    let c = COL.graphite;
    if (backN > 0.1 && p.y > 0.96 && ax < vEdge) c = COL.silver;
    else if (backN > 0.0 && p.y > 0.93 && ax >= vEdge && ax < vEdge + 0.055) c = COL.cobalt;
    if (band(Math.abs(n.x), 0.95, 0.03) * (p.y > 0.86 && p.y < 1.14 ? 1 : 0) > 0.5) c = COL.cobalt;
    if (frontN > 0.35 && p.y > 1.1) c = COL.silver;
    if (p.y > 1.29 && p.y < 1.33) c = COL.cobalt;
    return c;
  };
  add(
    loft(
      [
        { c: [0, 0.69, 0.25], ru: 0.08, rv: 0.05, rvN: 0.05 },
        { c: [0, 0.74, 0.24], ru: 0.158, rv: 0.11, rvN: 0.09, p: 2.3 },
        { c: [0, 0.83, 0.21], ru: 0.163, rv: 0.105, rvN: 0.092, p: 2.3 },
        { c: [0, 0.93, 0.165], ru: 0.142, rv: 0.085, rvN: 0.084, p: 2.2 },
        { c: [0, 1.04, 0.11], ru: 0.156, rv: 0.09, rvN: 0.096, p: 2.2 },
        { c: [0, 1.14, 0.06], ru: 0.178, rv: 0.098, rvN: 0.106, p: 2.3 },
        { c: [0, 1.212, 0.035], ru: 0.2, rv: 0.092, rvN: 0.094, p: 2.6 },
        { c: [0, 1.262, 0.02], ru: 0.158, rv: 0.074, rvN: 0.074, p: 2.4 },
        { c: [0, 1.302, 0.008], ru: 0.07, rv: 0.06, rvN: 0.058 },
        { c: [0, 1.37, -0.01], ru: 0.056, rv: 0.052, rvN: 0.05 },
        { c: [0, 1.41, -0.015], ru: 0.02, rv: 0.02 },
      ],
      torsoPaint, 24, 3,
    ),
    suit, null, ['Pelvis', 'Spine_1', 'Spine_2', 'Chest', 'Neck', 'Head'], 5,
  );

  // ---- AERO HUMP (pearl, like a race suit's back protector), smooth not segmented
  add(
    ellipsoid([0, 0.06, 0.07], [0.098, 0.11, 0.058], (p) =>
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
      if (p.z > -0.06 && top > 0.2) return COL.silver; // shoulder cap
      if (p.z > -0.19 && top > 0.62) return COL.silver; // upper-arm plate
      if (p.z < -0.31 && p.z > -0.46 && top > 0.6) return COL.silver; // forearm guard
      if (n.y > 0.8 && p.z < -0.05) return COL.cobalt; // outer stripe
      if (p.z < -0.24 && p.z > -0.3 && top > 0.0) return COL.cobalt; // elbow band
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
    add(ellipsoid([sx * 0.01, 0.026, -0.085], [0.046, 0.024, 0.04], solid(COL.silverHi), { w: 18, h: 10 }),
      mats.riderArmor, upper, [`UpperArm_${sfx}`]);
    add(ellipsoid([inSign * 0.046, 0, -0.15], [0.012, 0.036, 0.055], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, upper, [`UpperArm_${sfx}`]);
    for (const [k, z] of [-0.335, -0.385, -0.435].entries()) {
      add(ellipsoid([inSign * (0.041 - k * 0.003), 0, z], [0.011, 0.031 - k * 0.003, 0.032], solid(k === 1 ? COL.cobalt : COL.silverHi), { w: 12, h: 8 }),
        mats.riderArmor, upper, [`Forearm_${sfx}`]);
    }
    // shoulder slider (titanium cap)
    add(ellipsoid([sx * 0.012, 0.04, -0.035], [0.052, 0.03, 0.062], solid(COL.silverHi), { w: 22, h: 14 }),
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
    add(ellipsoid([inSign * 0.03, 0.006, -0.055], [0.012, 0.03, 0.036], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, hand, [`Hand_${sfx}`]);
  }

  for (const [sfx, sx, thigh, shin, foot] of [
    ['L', -1, thighL, shinL, footL],
    ['R', 1, thighR, shinR, footR],
  ] as const) {
    // ---- LEG: hip → ankle in one piece (Thigh local, runs along -Z; +v becomes the knee front)
    const legPaint: Painter = (p, n) => {
      const out = n.x * sx;
      if (p.z > -0.32 && p.z < -0.02 && out > 0.45) return COL.cobalt; // outer thigh panel
      if (p.z < -0.42 && p.z > -0.62 && n.y > 0.35) return COL.silver; // shin guard
      if (p.z < -0.45 && p.z > -0.6 && out > 0.55 && n.y < 0.35) return COL.cobalt; // calf flash
      return COL.graphite;
    };
    add(
      loft(
        [
          { c: [0, 0, 0.07], ru: 0.04, rv: 0.04 },
          { c: [0, 0, 0.035], ru: 0.08, rv: 0.08, rvN: 0.076 },
          { c: [sx * 0.004, 0, -0.06], ru: 0.088, rv: 0.082, rvN: 0.08 },
          { c: [0, 0, -0.18], ru: 0.077, rv: 0.07, rvN: 0.07 },
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
    add(ellipsoid([0, 0.05, -0.37], [0.042, 0.022, 0.052], solid(COL.silverHi), { w: 20, h: 12 }),
      mats.riderArmor, thigh, [`Thigh_${sfx}`, `Shin_${sfx}`], 6);
    add(ellipsoid([sx * 0.058, 0.005, -0.38], [0.012, 0.034, 0.046], solid(COL.cobaltDeep), { w: 16, h: 10 }),
      mats.riderArmor, thigh, [`Thigh_${sfx}`, `Shin_${sfx}`], 6);
    // shin guard (two plates) over the shin
    add(ellipsoid([0, 0.05, -0.5], [0.034, 0.014, 0.07], solid(COL.silverHi), { w: 14, h: 10 }),
      mats.riderArmor, thigh, [`Shin_${sfx}`]);
    add(ellipsoid([0, 0.046, -0.6], [0.03, 0.013, 0.05], solid(COL.cobalt), { w: 14, h: 10 }),
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
        (p, n) => mix(COL.black, COL.cobalt, band(n.x * sx, 0.65, 0.12) * band(p.z, -0.32, 0.04) * (1 - band(p.z, -0.22, 0.03))),
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
    add(ellipsoid([0, 0.05, -0.27], [0.03, 0.012, 0.06], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, shin, [`Shin_${sfx}`]);
    add(ellipsoid([0, 0.0, 0.03], [0.04, 0.03, 0.02], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, foot, [`Foot_${sfx}`]);
    add(ellipsoid([sx * 0.04, -0.012, -0.11], [0.012, 0.018, 0.04], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, foot, [`Foot_${sfx}`]);
  }

  // ---- HELMET (Head local: +Y up, -Z forward). Angular shell like the reference: 10-sided sections with
  // creased normals; the big dark visor and the silver/blue graphics are painted onto the shell.
  const hc: V3 = [0, 0.115, -0.015];
  const helmetPaint: Painter = (p, n) => {
    const ly = p.y - hc[1], lz = p.z - hc[2], ax = Math.abs(p.x);
    if (lz < -0.04 && ly > -0.05 && ly < 0.052 && n.z < -0.1) return COL.visor; // wrap-around visor
    if (ax < 0.028 && ly > 0.052) return lz < 0.1 ? COL.silver : COL.black; // crown panel
    if (ax >= 0.028 && ax < 0.04 && ly > 0.052 && lz < 0.07) return COL.cobalt; // crown accent lines
    if (Math.abs(n.x) > 0.55 && ly > -0.02 && ly < 0.05 && lz > -0.03) return COL.silver; // side blade
    if (Math.abs(n.x) > 0.55 && ly >= 0.05 && ly < 0.066 && lz > -0.01) return COL.cobalt;
    return COL.black;
  };
  {
    const hg = loft([
      { c: [0, 0.06, -0.188], ru: 0.03, rv: 0.02, rvN: 0.02 },
      { c: [0, 0.075, -0.168], ru: 0.075, rv: 0.05, rvN: 0.062 },
      { c: [0, 0.105, -0.13], ru: 0.105, rv: 0.086, rvN: 0.1 },
      { c: [0, 0.115, -0.06], ru: 0.119, rv: 0.11, rvN: 0.124 },
      { c: [0, 0.12, 0.03], ru: 0.121, rv: 0.105, rvN: 0.128 },
      { c: [0, 0.126, 0.11], ru: 0.107, rv: 0.09, rvN: 0.114 },
      { c: [0, 0.135, 0.16], ru: 0.074, rv: 0.06, rvN: 0.078 },
      { c: [0, 0.14, 0.186], ru: 0.024, rv: 0.02, rvN: 0.024 },
    ], helmetPaint, 10, 2);
    const g = toCreasedNormals(hg, 0.42);
    g.setIndex([...Array(g.attributes.position.count).keys()]);
    add(g, shell, head, ['Head']);
  }
  // cyan forehead light bar + rear light bar, small rear spoiler, top vents
  for (const [y, z, rx, w] of [[0.18, -0.143, 0.62, 0.06], [0.172, 0.158, -0.6, 0.064]]) {
    const bar = new THREE.BoxGeometry(w, 0.011, 0.012);
    bar.rotateX(rx);
    bar.translate(0, y, z);
    bar.computeVertexNormals();
    paintGeo(bar, solid(COL.cobalt));
    add(bar, mats.riderGlow, head, ['Head']);
  }
  add(ellipsoid([0, 0.236, 0.12], [0.05, 0.012, 0.055], solid(COL.black), { w: 16, h: 8 }), shell, head, ['Head']);
  for (const sx of [-1, 1]) {
    const vent = ellipsoid([0, 0, 0], [0.012, 0.006, 0.03], solid(COL.graphite), { w: 10, h: 6 });
    vent.rotateX(0.35);
    vent.translate(sx * 0.03, 0.238, -0.06);
    add(vent, shell, head, ['Head']);
  }

  // ------------------------------------------------------------------ merge by material
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const { geo, mat } of parts) {
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
