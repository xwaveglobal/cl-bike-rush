import * as THREE from 'three';
import type { BikeRiderMaterials } from './BikeRiderAsset.ts';

/**
 * Detailed full-face race helmet for the Bike Rush rider, matched to the reference sheet
 * (crops 21 + LEFT/REAR/RIGHT views):
 *  - smooth round shell with a protruding chin bar and an open bottom with a neck roll
 *  - real visor (separate glossy smoked surface) with a silver top trim and side pivot plates
 *  - graphics painted into a canvas texture on the shell's spherical UVs: silver crown stripe
 *    with thin blue edge lines, silver side swoosh from the chin up to the back with a blue band,
 *    blue lower-rear panels
 *  - cyan brow light + side marks at the visor, two cyan light bars on the back, silver/black rear
 *    spoiler, top vents, chin vent
 *
 * Everything is authored in Head-bone local space (+Y up, -Z forward) and returned as
 * geometry + material pairs; RiderHuman skins them rigidly to the Head bone.
 */

/** helmet centre and radii in Head-local space (sized to the rider's body proportions) */
const C = new THREE.Vector3(0, 0.082, -0.014);
// real race-helmet proportions: ~23 cm wide, ~25 cm tall (more with the chin bar), ~30 cm long
const RAD = new THREE.Vector3(0.11, 0.118, 0.145);
const FRONT = Math.PI * 1.5; // SphereGeometry phi that faces -Z
const BACK = Math.PI * 0.5;
/** UV v of the shell spans polar angle 0..SHELL_THETA (the deepest point of the bottom edge) */
const SHELL_THETA = 2.6;
/**
 * Bottom edge of the shell (polar angle where it ends) as a function of phi, like a real full-face
 * helmet: deep at the chin bar, rising over the jaw to the ear, dropping again over the nape.
 * d = angular distance from the front (0 = chin, PI = back of the neck).
 */
const CUT_TABLE: [number, number][] = [[0, 2.56], [0.5, 2.46], [1.0, 2.2], [1.5, 2.04], [2.05, 2.16], [2.6, 2.4], [Math.PI, 2.5]];
function cut(phi: number) {
  let d = Math.abs(((phi - FRONT) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  d = Math.min(Math.PI, d);
  for (let k = 0; k < CUT_TABLE.length - 1; k++) {
    const [d0, c0] = CUT_TABLE[k], [d1, c1] = CUT_TABLE[k + 1];
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0), s = t * t * (3 - 2 * t);
      return c0 + (c1 - c0) * s;
    }
  }
  return CUT_TABLE[CUT_TABLE.length - 1][1];
}

/** chin bar: push the lower front of the unit sphere forward and down */
function chin(v: THREE.Vector3) {
  // chin bar: the lower front pushed forward and squared off a little
  const f = Math.max(0, -v.y) * Math.max(0, -v.z);
  v.z -= 0.5 * f;
  v.y -= 0.1 * f;
  v.x *= 1 - 0.18 * f;
  // slightly flatter crown and a fuller back of the skull, like a race helmet
  if (v.y > 0) v.y *= 0.97;
  if (v.z > 0 && v.y < 0.2) v.z *= 1.03;
  return v;
}

function withColor(g: THREE.BufferGeometry, hex = 0xffffff) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ------------------------------------------------------------------------------- graphics texture
/** visor port in sphere angles (phi around Y, theta from the top) */
const VISOR = { half: 0.9, top: 1.1, bottom: 1.76 };

/**
 * The livery is evaluated per texel in 3D (unit-sphere direction) instead of drawing 2D polygons in
 * phi/theta space: no seam artefacts, constant physical stripe widths, and shapes defined the way the
 * reference reads them (front / side / back views).
 */
let tex: THREE.DataTexture | null = null;
function helmetTexture(): THREE.DataTexture {
  if (tex) return tex;
  // plain RGBA buffer -> DataTexture: no 2D canvas needed (the TikTok native canvas may not provide ImageData)
  const W = 1024, H = 512;
  const data = new Uint8Array(W * H * 4);
  const BLACK = [16, 19, 24], GLOSS = [26, 30, 37], SILVER = [205, 211, 220], SILVER_D = [140, 148, 160],
    BLUE = [28, 86, 255], RUBBER = [34, 36, 40];
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // side swoosh centre line in side projection (z back, y up), chin -> temple -> rear
  // rises steeply from the chin along the visor's lower edge, sweeps back over the ear, droops at the rear
  const SW: [number, number][] = [[-1.0, -0.78], [-0.82, -0.52], [-0.58, -0.24], [-0.25, -0.02], [0.15, 0.08], [0.55, 0.05], [0.98, -0.08]];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const swY = (z: number) => {
    if (z <= SW[0][0]) return SW[0][1];
    for (let k = 0; k < SW.length - 1; k++) {
      const [z0, y1] = SW[k], [z1, y2] = SW[k + 1];
      if (z <= z1) {
        const y0 = SW[Math.max(0, k - 1)][1], y3 = SW[Math.min(SW.length - 1, k + 2)][1];
        return cr(y0, y1, y2, y3, (z - z0) / (z1 - z0));
      }
    }
    return SW[SW.length - 1][1];
  };
  const COS = new Float32Array(W), SIN = new Float32Array(W), CUT = new Float32Array(W);
  for (let px = 0; px < W; px++) { const phi = ((px + 0.5) / W) * Math.PI * 2; COS[px] = Math.cos(phi); SIN[px] = Math.sin(phi); CUT[px] = cut(phi); }
  for (let py = 0; py < H; py++) {
    const th = ((py + 0.5) / H) * SHELL_THETA;
    const st = Math.sin(th), y = Math.cos(th);
    for (let px = 0; px < W; px++) {
      const phi = ((px + 0.5) / W) * Math.PI * 2;
      const x = -COS[px] * st, z = SIN[px] * st;
      const ax = Math.abs(x), f = -z;
      let c = BLACK;
      // subtle two-tone: glossier black on the upper half
      if (y > 0.1) c = GLOSS;
      // --- side swoosh (silver band, blue underline, thin blue top line); fades out towards the face
      const side = smooth(0.18, 0.4, ax);
      if (side > 0.5 && z > -0.97 && z < 0.97) {
        const dy = y - swY(z);
        const k = 0.55 + 0.45 * Math.sin(((z + 0.97) / 1.94) * Math.PI); // fat in the middle, tapered ends
        if (dy > -0.13 * k && dy < 0.12 * k) c = dy > -0.02 * k && dy < 0.0 ? SILVER_D : SILVER;
        else if (dy <= -0.13 * k && dy > -0.23 * k) c = BLUE;
        else if (dy >= 0.12 * k && dy < 0.15 * k) c = BLUE;
      }
      // --- lower rear blue panels
      if (z > 0.3 && y < -0.22 && y > -0.62 && ax > 0.16 && ax < 0.62) c = BLUE;
      // --- crown: wide silver forehead panel narrowing over the top to the back, blue edges + outer V lines
      const a = Math.atan2(f, y); // 0 top, +th at the front meridian, -th at the back
      if (a > -1.4 && a < VISOR.top - 0.06 && y > -0.2) {
        const front = smooth(-0.2, 0.8, a);
        const hw = 0.15 + 0.17 * front;
        const d = ax - hw;
        if (d < 0) c = ax < 0.007 ? SILVER_D : SILVER;
        else if (d < 0.035) c = BLUE;
        else if (d > 0.07 && d < 0.105 && a > 0.15) c = BLUE;
      }
      // --- blue rim around the visor sides and bottom (front half only)
      if (f > 0.2) {
        let dphi = Math.abs(phi - FRONT);
        if (dphi > Math.PI) dphi = Math.PI * 2 - dphi;
        const u = Math.min(0.5, dphi / (2 * VISOR.half));
        const tb = VISOR.top + (VISOR.bottom - VISOR.top) * (1 - 0.55 * u * u);
        if (th > VISOR.top && th < tb + 0.07 && dphi > VISOR.half * 0.97 && dphi < VISOR.half + 0.09) c = BLUE;
        if (dphi < VISOR.half + 0.09 && th > tb - 0.01 && th < tb + 0.07) c = BLUE;
      }
      // --- chin vent silver mark
      if (f > 0.85 && y < -0.62 && y > -0.74 && ax < 0.12) c = SILVER_D;
      // --- bottom rubber edge
      // rubber edge trim following the shell's bottom edge
      if (th > CUT[px] - 0.06) c = RUBBER;
      const o = ((H - 1 - py) * W + px) * 4; // DataTexture row 0 = v 0 = bottom of the shell
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

let shellMat: THREE.MeshPhysicalMaterial | null = null;
function helmetMaterial() {
  if (!shellMat) {
    shellMat = new THREE.MeshPhysicalMaterial({
      name: 'Mat_Rider_HelmetShell',
      map: helmetTexture(),
      roughness: 0.26,
      metalness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
  }
  return shellMat;
}

// ------------------------------------------------------------------------------- geometry
export function buildHelmetParts(mats: BikeRiderMaterials, detail = 1): { geo: THREE.BufferGeometry; mat: THREE.Material }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  const seg = (n: number) => Math.max(8, Math.round(n * detail));

  // shell (open at the bottom)
  {
    // rows are re-spaced per column so the bottom edge follows cut(phi); uv v keeps the true angle
    const g = new THREE.SphereGeometry(1, seg(64), seg(44), 0, Math.PI * 2, 0, SHELL_THETA);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const phi = uv.getX(i) * Math.PI * 2;
      const th = (1 - uv.getY(i)) * cut(phi);
      v.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      chin(v);
      p.setXYZ(i, C.x + v.x * RAD.x, C.y + v.y * RAD.y, C.z + v.z * RAD.z);
      uv.setY(i, 1 - th / SHELL_THETA);
    }
    g.computeVertexNormals();
    out.push({ geo: withColor(g), mat: helmetMaterial() });
  }
  /** point on the (chin-deformed) shell at sphere angles, lifted radially by `lift` (1 = surface) */
  const onShell = (phi: number, theta: number, lift: number) => {
    const v = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    chin(v);
    return new THREE.Vector3(C.x + v.x * RAD.x * lift, C.y + v.y * RAD.y * lift, C.z + v.z * RAD.z * lift);
  };
  /**
   * a solid block that hugs the shell: box x -> phi span, z -> theta span, y -> radial thickness.
   * `shape(u, t)` returns [phi, theta] for box coords u in [-.5,.5] (across) and t in [0,1] (along),
   * `thick(t)` the radial thickness profile. Flat-shaded so the edges read as crisp parts.
   */
  const shellBlock = (shape: (u: number, t: number) => [number, number], thick: (t: number) => number, base = 1.004, nu = 2, nt = 8, flat = true) => {
    const b = new THREE.BoxGeometry(1, 1, 1, nu, 1, nt);
    const p = b.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), h = p.getY(i) + 0.5, t = p.getZ(i) + 0.5;
      const [phi, theta] = shape(u, t);
      const q = onShell(phi, theta, base + h * thick(t));
      p.setXYZ(i, q.x, q.y, q.z);
    }
    const g = flat ? b.toNonIndexed() : b;
    g.computeVertexNormals();
    return g;
  };

  // visor: a thick smoked shield over the eye port (separate part with visible edges)
  out.push({
    geo: withColor(shellBlock((u, t) => [FRONT + u * 2 * VISOR.half * (0.9 + 0.1 * Math.sin(Math.PI * t)), VISOR.top + t * (VISOR.bottom - VISOR.top) * (1 - 0.55 * u * u)], () => 0.012, 1.003, seg(28), seg(10), false)),
    mat: mats.visor,
  });
  // silver trim along the visor top edge
  out.push({
    geo: withColor(shellBlock((u, t) => [FRONT + u * 2 * (VISOR.half + 0.04), VISOR.top - 0.035 + t * 0.04], () => 0.014, 1.004, seg(28), 1), 0xc9cfd8),
    mat: mats.riderArmor,
  });
  // cyan brow light (centre, just above the visor) + angled side marks at the upper corners
  out.push({ geo: withColor(shellBlock((u, t) => [FRONT + u * 0.4, VISOR.top + 0.015 + t * 0.05], () => 0.008, 1.018, 8, 1)), mat: mats.riderGlow });
  for (const s of [-1, 1]) {
    // angled "eyebrow" marks inside the visor's upper corners
    out.push({
      geo: withColor(shellBlock((u, t) => [FRONT + s * (0.42 + t * 0.2) + u * 0.06, VISOR.top + 0.02 + t * 0.13], () => 0.008, 1.018, 1, 3)),
      mat: mats.riderGlow,
    });
  }
  // two cyan light bars on the back
  out.push({ geo: withColor(shellBlock((u, t) => [BACK + u * 0.62, 1.32 + t * 0.045], () => 0.007, 1.004, 10, 1)), mat: mats.riderGlow });
  out.push({ geo: withColor(shellBlock((u, t) => [BACK + u * 0.8, 1.72 + t * 0.04], () => 0.007, 1.004, 12, 1)), mat: mats.riderGlow });
  // visor pivot: small dark disc with a silver ring, tucked at the visor's side edge
  for (const s of [-1, 1]) {
    const c = onShell(FRONT + s * (VISOR.half + 0.14), VISOR.top + 0.12, 1.008);
    const n = c.clone().sub(C).normalize();
    for (const [r, h, col, mat] of [[0.009, 0.003, 0x6d7480, mats.riderArmor], [0.005, 0.005, 0x15171c, mats.riderSuit]] as const) {
      const d = new THREE.CylinderGeometry(r, r, h, 18);
      d.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
      d.translate(c.x, c.y, c.z);
      out.push({ geo: withColor(d, col), mat });
    }
  }
  // rear spoiler: follows the crown, thin at the front, raised trailing lip over the back
  out.push({
    geo: withColor(
      shellBlock((u, t) => [BACK + u * (0.42 + 0.3 * t), 0.42 + t * 0.62], (t) => 0.014 + 0.045 * t * t, 1.002, 4, seg(10)),
      0x15181e,
    ),
    mat: mats.riderSuit,
  });
  // silver strakes on the spoiler
  for (const s of [-1, 1]) {
    out.push({
      geo: withColor(shellBlock((u, t) => [BACK + s * (0.24 + 0.17 * t) + u * 0.035, 0.5 + t * 0.54], (t) => 0.018 + 0.048 * t * t, 1.004, 1, 8), 0xaab2be),
      mat: mats.riderArmor,
    });
  }
  // top intake vents (dark scoops either side of the silver panel)
  for (const s of [-1, 1]) {
    out.push({
      geo: withColor(shellBlock((u, t) => [FRONT + s * (0.62 + u * 0.18), 0.42 + t * 0.2], (t) => 0.026 * (1 - t) + 0.008, 1.0, 2, 3), 0x2b313c),
      mat: mats.riderHelmet,
    });
  }
  // chin vent
  out.push({ geo: withColor(shellBlock((u, t) => [FRONT + u * 0.42, 2.02 + t * 0.12], () => 0.03, 1.0, 4, 2), 0x2b313c), mat: mats.riderHelmet });
  // padded rubber trim rolled round the bottom edge + dark liner closing the opening (no see-through shell)
  {
    const n = seg(48);
    const edge: THREE.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      const phi = (k / n) * Math.PI * 2;
      edge.push(onShell(phi, cut(phi) - 0.03, 0.975));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), n * 2, 0.0125, 8, true);
    out.push({ geo: withColor(tube, 0x15171c), mat: mats.riderSuit });
    const centre = new THREE.Vector3(C.x, C.y - RAD.y * 0.35, C.z + 0.01);
    const pos: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = edge[k], b = edge[(k + 1) % n];
      pos.push(centre.x, centre.y, centre.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const liner = new THREE.BufferGeometry();
    liner.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    liner.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    liner.computeVertexNormals();
    // face downwards / outwards: flip winding if the first normal points up
    if ((liner.attributes.normal as THREE.BufferAttribute).getY(0) > 0) {
      for (let k = 0; k < pos.length; k += 9) for (let j = 0; j < 3; j++) { const t = pos[k + 3 + j]; pos[k + 3 + j] = pos[k + 6 + j]; pos[k + 6 + j] = t; }
      liner.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      liner.computeVertexNormals();
    }
    out.push({ geo: withColor(liner, 0x0b0c10), mat: mats.riderSuit });
  }
  // visor lift tab at the lower left corner of the visor
  out.push({
    geo: withColor(shellBlock((u, t) => [FRONT - 0.5 + u * 0.12, VISOR.bottom - 0.12 + t * 0.07], () => 0.012, 1.016, 1, 1), 0x2b313c),
    mat: mats.riderHelmet,
  });
  return out;
}
