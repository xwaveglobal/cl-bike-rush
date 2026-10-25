import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  silverPiping: C(0xb9c2d2),
  black: C(0x0d0f14),
};

export const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Smooth loft through key sections (Catmull-Rom on centres and radii). */
export function loft(keys: Sec[], paint: Painter, radial = 22, sub = 4, uAxis: V3 = [1, 0, 0]): THREE.BufferGeometry {
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
  const g = new THREE.SphereGeometry(1, o.w ?? 28, o.h ?? 18, o.phiStart, o.phiLength, o.thetaStart, o.thetaLength);
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

export function buildHumanRider(mats: BikeRiderMaterials) {
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
    add(ellipsoid([sx * 0.04, -0.012, -0.11], [0.012, 0.018, 0.04], solid(COL.silverHi), { w: 12, h: 8 }),
      mats.riderArmor, foot, [`Foot_${sfx}`]);
  }

  // ---- HELMET (Head local: +Y up, -Z forward). Rounded shell, wrap-around visor, cobalt centre stripe.
  const hc: V3 = [0, 0.115, -0.015];
  // reference helmet: gloss black, silver side blade, cobalt pin line, silver crown stripe
  const helmetPaint: Painter = (p, n) => {
    const ly = p.y - hc[1], lz = p.z - hc[2];
    if (Math.abs(n.x) > 0.5 && ly > -0.035 && ly < 0.03 && lz > -0.06) return COL.silver;
    if (Math.abs(n.x) > 0.5 && ly >= 0.03 && ly < 0.048 && lz > -0.03) return COL.cobalt;
    if (Math.abs(p.x) < 0.014 && ly > 0.03 && lz > -0.09) return COL.silver;
    return COL.black;
  };
  const shellGeo = ellipsoid(hc, [0.12, 0.128, 0.156], helmetPaint, { w: 30, h: 20 });
  {
    // chin bar: push the lower front forward a little, tuck the lower back in
    const p = shellGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) - hc[1], z = p.getZ(i) - hc[2];
      if (y < 0) {
        const k = Math.min(1, -y / 0.128);
        p.setZ(i, hc[2] + z * (z < 0 ? 1 + 0.1 * k : 1 - 0.12 * k));
      }
    }
    shellGeo.computeVertexNormals();
  }
  add(shellGeo, shell, head, ['Head']);
  // chin bar bulge + twin cyan brow lights (reference helmet front)
  add(ellipsoid([0, 0.04, -0.118], [0.088, 0.052, 0.062], solid(COL.black), { w: 20, h: 12 }), shell, head, ['Head']);
  for (const sx of [-1, 1]) {
    const brow = new THREE.BoxGeometry(0.036, 0.008, 0.012);
    brow.rotateZ(sx * 0.35);
    brow.rotateY(sx * -0.5);
    brow.translate(sx * 0.04, 0.2, -0.128);
    brow.computeVertexNormals();
    paintGeo(brow, solid(COL.cobalt));
    add(brow, mats.riderGlow, head, ['Head']);
  }
  // visor: front band of a slightly larger sphere (SphereGeometry: phi = 3π/2 faces -Z)
  add(
    ellipsoid([hc[0], hc[1], hc[2] - 0.004], [0.123, 0.131, 0.161], solid(COL.black), {
      w: 32, h: 12, phiStart: Math.PI * 1.5 - 1.0, phiLength: 2.0, thetaStart: 1.02, thetaLength: 0.7,
    }),
    mats.visor, head, ['Head'],
  );
  // rear cyan light strips + small aero spoiler
  for (const th of [1.2, 1.33]) {
    add(
      ellipsoid(hc, [0.1215, 0.1295, 0.1575], solid(COL.pearl), {
        w: 16, h: 2, phiStart: Math.PI * 0.5 - 0.55, phiLength: 1.1, thetaStart: th, thetaLength: 0.045,
      }),
      mats.riderGlow, head, ['Head'],
    );
  }
  add(ellipsoid([0, 0.19, 0.1], [0.045, 0.016, 0.05], helmetPaint, { w: 20, h: 10 }), shell, head, ['Head']);

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
  return { riderMesh, skeleton, bones, pelvis };
}
