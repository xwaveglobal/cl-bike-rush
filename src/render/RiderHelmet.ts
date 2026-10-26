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
const C = new THREE.Vector3(0, 0.08, -0.008);
const RAD = new THREE.Vector3(0.106, 0.112, 0.13);
const FRONT = Math.PI * 1.5; // SphereGeometry phi that faces -Z
const BACK = Math.PI * 0.5;
/** the shell is a sphere cut at this polar angle (open bottom); its UV v spans 0..SHELL_THETA */
const SHELL_THETA = 2.42;

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
const VISOR = { half: 0.84, top: 1.14, bottom: 1.7 };

/**
 * The livery is evaluated per texel in 3D (unit-sphere direction) instead of drawing 2D polygons in
 * phi/theta space: no seam artefacts, constant physical stripe widths, and shapes defined the way the
 * reference reads them (front / side / back views).
 */
let tex: THREE.CanvasTexture | null = null;
function helmetTexture(): THREE.CanvasTexture {
  if (tex) return tex;
  const W = 1536, H = 768;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H);
  const BLACK = [16, 19, 24], GLOSS = [26, 30, 37], SILVER = [205, 211, 220], SILVER_D = [140, 148, 160],
    BLUE = [28, 86, 255], RUBBER = [34, 36, 40];
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // side swoosh centre line in side projection (z back, y up), chin -> temple -> rear
  const SW: [number, number][] = [[-0.92, -0.62], [-0.62, -0.36], [-0.3, -0.12], [0.1, 0.04], [0.5, 0.12], [0.95, 0.16]];
  const swY = (z: number) => {
    if (z <= SW[0][0]) return SW[0][1];
    for (let k = 0; k < SW.length - 1; k++) {
      const [z0, y0] = SW[k], [z1, y1] = SW[k + 1];
      if (z <= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
    }
    return SW[SW.length - 1][1];
  };
  for (let py = 0; py < H; py++) {
    const th = ((py + 0.5) / H) * SHELL_THETA;
    const st = Math.sin(th), y = Math.cos(th);
    for (let px = 0; px < W; px++) {
      const phi = ((px + 0.5) / W) * Math.PI * 2;
      const x = -Math.cos(phi) * st, z = Math.sin(phi) * st;
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
      if (th > 2.3) c = RUBBER;
      const o = (py * W + px) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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
    const g = new THREE.SphereGeometry(1, seg(64), seg(44), 0, Math.PI * 2, 0, SHELL_THETA);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      chin(v);
      p.setXYZ(i, C.x + v.x * RAD.x, C.y + v.y * RAD.y, C.z + v.z * RAD.z);
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
      shellBlock((u, t) => [BACK + u * (0.42 + 0.3 * t), 0.42 + t * 0.62], (t) => 0.02 + 0.07 * t * t, 1.002, 4, seg(10)),
      0x1c2027,
    ),
    mat: mats.riderSuit,
  });
  // silver strakes on the spoiler
  for (const s of [-1, 1]) {
    out.push({
      geo: withColor(shellBlock((u, t) => [BACK + s * (0.22 + 0.17 * t) + u * 0.06, 0.48 + t * 0.56], (t) => 0.03 + 0.075 * t * t, 1.004, 1, 8), 0xc9cfd8),
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
  // neck roll filling the bottom opening
  {
    const g = new THREE.TorusGeometry(0.066, 0.015, 10, seg(36));
    g.rotateX(Math.PI / 2);
    g.translate(0, C.y - RAD.y * 0.72, C.z + 0.012);
    out.push({ geo: withColor(g, 0x15171c), mat: mats.riderSuit });
  }
  return out;
}
