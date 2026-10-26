import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildHumanRider } from './RiderHuman.ts';
import { buildSportBike, BIKE_ERGO } from './BikeBody.ts';

export type BikePoseName =
  | 'StraightRide'
  | 'LeanLeft'
  | 'LeanRight'
  | 'AirborneJump'
  | 'DownSlide'
  | 'LowTuck';

export interface BikePoseParams {
  /** -1 = full left lean, +1 = full right lean */
  lean: number;
  /** 0..1 airborne jump state */
  air: number;
  /** 0..1 extremely low Down slide beneath barrier (Image 3) */
  downSlide: number;
  /** 0..1 upright low tuck (Image 7 / transitional tuck) */
  lowTuck: number;
  /** -1..+1 slide bank direction (+1 banks right side low with exhaust visible, -1 banks left) */
  slideSide?: 1 | -1;
  /** pitch angle in radians (positive = nose up) */
  pitch?: number;
  /** wheel spin angle in radians */
  wheelSpin?: number;
  /** subtle idle/road time in seconds */
  time?: number;
}

export interface BikeRiderPBRTextures {
  baseColor: THREE.Texture;
  normal: THREE.Texture;
  orm: THREE.Texture;
  emissive: THREE.Texture;
}

export interface BikeRiderMaterials {
  suit: THREE.MeshStandardMaterial;
  armorSilver: THREE.MeshPhysicalMaterial;
  cobalt: THREE.MeshPhysicalMaterial;
  tyre: THREE.MeshStandardMaterial;
  mechDark: THREE.MeshStandardMaterial;
  forkGold: THREE.MeshStandardMaterial;
  visor: THREE.MeshPhysicalMaterial;
  mirror: THREE.MeshPhysicalMaterial;
  cyanGlow: THREE.MeshStandardMaterial;
  redGlow: THREE.MeshStandardMaterial;
  /** organic rider: vertex-painted leathers */
  riderSuit: THREE.MeshPhysicalMaterial;
  /** organic rider: pearl helmet shell + aero hump */
  riderHelmet: THREE.MeshPhysicalMaterial;
  /** organic rider: titanium sliders (shoulders, knees, knuckles, toes) */
  riderArmor: THREE.MeshPhysicalMaterial;
  /** organic rider: helmet light strips */
  riderGlow: THREE.MeshStandardMaterial;
  // ---- sport bike body (reference livery)
  bikePaint: THREE.MeshPhysicalMaterial;
  bikeSeat: THREE.MeshStandardMaterial;
  bikeBlack: THREE.MeshStandardMaterial;
  bikeGloss: THREE.MeshPhysicalMaterial;
  bikeAlu: THREE.MeshStandardMaterial;
  bikeChrome: THREE.MeshStandardMaterial;
  bikeGold: THREE.MeshStandardMaterial;
  bikeTyre: THREE.MeshStandardMaterial;
  bikeSteel: THREE.MeshStandardMaterial;
  bikeBlue: THREE.MeshPhysicalMaterial;
  bikeRed: THREE.MeshStandardMaterial;
  bikeScreen: THREE.MeshPhysicalMaterial;
  bikeLens: THREE.MeshStandardMaterial;
  bikeCaliper: THREE.MeshPhysicalMaterial;
}

export interface BikeRiderRig {
  root: THREE.Group;
  leanPivot: THREE.Group;
  pitchPivot: THREE.Group;
  chassisGroup: THREE.Group;
  steeringPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  swingarmGroup: THREE.Group;
  riderMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  materials: BikeRiderMaterials;
  textures: BikeRiderPBRTextures;
  animations: THREE.AnimationClip[];
  applyPose: (params: BikePoseParams) => void;
}

/**
 * UV Atlas Regions (normalized [u0, v0, u1, v1]):
 *  - SUIT_GRAPHITE: [0.02, 0.02, 0.48, 0.48]
 *  - ARMOR_SILVER:  [0.52, 0.02, 0.98, 0.48]
 *  - COBALT_BLUE:   [0.02, 0.52, 0.48, 0.73]
 *  - TYRE_RUBBER:   [0.52, 0.52, 0.98, 0.73]
 *  - MECH_DARK:     [0.02, 0.77, 0.28, 0.98]
 *  - FORK_GOLD:     [0.30, 0.77, 0.48, 0.98]
 *  - CYAN_EMISSIVE: [0.52, 0.77, 0.74, 0.98]
 *  - RED_EMISSIVE:  [0.76, 0.77, 0.88, 0.98]
 *  - VISOR_GLASS:   [0.89, 0.77, 0.98, 0.98]
 */
export const UV_REGIONS = {
  SUIT_GRAPHITE: [0.04, 0.04, 0.46, 0.46] as const,
  ARMOR_SILVER: [0.54, 0.04, 0.96, 0.46] as const,
  COBALT_BLUE: [0.04, 0.54, 0.46, 0.72] as const,
  TYRE_RUBBER: [0.54, 0.54, 0.96, 0.72] as const,
  MECH_DARK: [0.04, 0.78, 0.26, 0.96] as const,
  FORK_GOLD: [0.31, 0.78, 0.47, 0.96] as const,
  CYAN_EMISSIVE: [0.54, 0.78, 0.72, 0.96] as const,
  RED_EMISSIVE: [0.76, 0.78, 0.87, 0.96] as const,
  VISOR_GLASS: [0.89, 0.78, 0.97, 0.96] as const,
};

/**
 * Generates raw RGBA pixel buffers for all PBR maps (BaseColor, Normal, Roughness, Metallic, AO, ORM, Emissive).
 * Used both at runtime (DataTexture) and by the Node texture/GLB exporter (PNG files).
 */
export function generatePBRBuffers(size = 512) {
  const N = size * size;
  const baseColor = new Uint8Array(N * 4);
  const normal = new Uint8Array(N * 4);
  const roughness = new Uint8Array(N * 4);
  const metallic = new Uint8Array(N * 4);
  const ao = new Uint8Array(N * 4);
  const orm = new Uint8Array(N * 4);
  const emissive = new Uint8Array(N * 4);

  const heightField = new Float32Array(N);

  const setPixel = (
    idx: number,
    r: number,
    g: number,
    b: number,
    rough: number,
    metal: number,
    occ: number,
    h: number,
    er = 0,
    eg = 0,
    eb = 0,
  ) => {
    const i4 = idx * 4;
    baseColor[i4] = Math.max(0, Math.min(255, Math.round(r)));
    baseColor[i4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
    baseColor[i4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
    baseColor[i4 + 3] = 255;

    const rByte = Math.max(0, Math.min(255, Math.round(rough * 255)));
    const mByte = Math.max(0, Math.min(255, Math.round(metal * 255)));
    const aByte = Math.max(0, Math.min(255, Math.round(occ * 255)));

    roughness[i4] = roughness[i4 + 1] = roughness[i4 + 2] = rByte;
    roughness[i4 + 3] = 255;

    metallic[i4] = metallic[i4 + 1] = metallic[i4 + 2] = mByte;
    metallic[i4 + 3] = 255;

    ao[i4] = ao[i4 + 1] = ao[i4 + 2] = aByte;
    ao[i4 + 3] = 255;

    // glTF 2.0 ORM convention: R = Occlusion, G = Roughness, B = Metallic
    orm[i4] = aByte;
    orm[i4 + 1] = rByte;
    orm[i4 + 2] = mByte;
    orm[i4 + 3] = 255;

    emissive[i4] = Math.max(0, Math.min(255, Math.round(er)));
    emissive[i4 + 1] = Math.max(0, Math.min(255, Math.round(eg)));
    emissive[i4 + 2] = Math.max(0, Math.min(255, Math.round(eb)));
    emissive[i4 + 3] = 255;

    heightField[idx] = h;
  };

  for (let py = 0; py < size; py++) {
    // glTF UV v=0 is bottom or top depending on flipY; we make patterns symmetric/tile-clean
    const v = 1 - py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const idx = py * size + px;

      if (v < 0.5 && u < 0.5) {
        // Island 0: SUIT_GRAPHITE — perforated dark charcoal racing leather + carbon weave micro-grain
        const gx = (px % 8) / 8 - 0.5;
        const gy = (py % 8) / 8 - 0.5;
        const dimple = Math.sqrt(gx * gx + gy * gy) < 0.22 ? 1 : 0;
        const weave = ((px + py) % 4 === 0 ? 1 : -1) * 2.5;
        const seam = Math.abs((u - 0.25) * 40) < 0.45 ? 1 : 0;
        const base = 30 + weave - dimple * 8 - seam * 6;
        setPixel(
          idx,
          base,
          base + 4,
          base + 11,
          dimple ? 0.72 : 0.52,
          0.06,
          dimple ? 0.68 : seam ? 0.78 : 0.96,
          dimple ? 0.22 : seam ? 0.35 : 0.6,
        );
      } else if (v < 0.5 && u >= 0.5) {
        // Island 1: ARMOR_SILVER — fine satin-brushed titanium silver
        const brush = Math.sin(py * 1.4) * 1.2 + Math.cos(px * 0.35) * 0.8;
        const r = 212 + brush;
        const g = 220 + brush;
        const b = 234 + brush;
        setPixel(
          idx,
          r,
          g,
          b,
          0.22,
          0.88,
          0.98,
          0.72 + brush * 0.008,
        );
      } else if (v >= 0.5 && v < 0.75 && u < 0.5) {
        // Island 2: COBALT_BLUE — deep metallic cobalt blue racing suit & fairing panels
        const hex = Math.sin(px * 0.65) * Math.sin(py * 0.65) * 5;
        setPixel(
          idx,
          22 + hex,
          96 + hex * 1.2,
          238 + hex,
          0.26,
          0.52,
          0.95,
          0.6 + hex * 0.02,
        );
      } else if (v >= 0.5 && v < 0.75 && u >= 0.5) {
        // Island 3: TYRE_RUBBER — vulcanized sport slick tyre with center groove + angled V-sipes
        const tu = (u - 0.54) / 0.42; // 0..1 across tyre width
        const tv = (v - 0.54) / 0.18; // 0..1 around circumference
        const centerGroove = Math.abs(tu - 0.5) < 0.022 ? 1 : 0;
        const sideDist = Math.abs(tu - 0.5);
        const vPhase = (tv * 6 + sideDist * 2.3 + (tu > 0.5 ? 0.5 : 0)) % 1;
        const vSipe =
          sideDist > 0.06 && sideDist < 0.38 && vPhase < 0.085 ? 1 : 0;
        const groove = centerGroove || vSipe;
        const rub = groove ? 12 : 23 + Math.sin(tu * Math.PI) * 5;
        setPixel(
          idx,
          rub,
          rub + 2,
          rub + 5,
          groove ? 0.92 : 0.78,
          0.03,
          groove ? 0.48 : 0.94,
          groove ? 0.15 : 0.75,
        );
      } else if (v >= 0.75 && u < 0.29) {
        // Island 4a: MECH_DARK — gunmetal engine, frame, chain links, drilled brake rotors
        const hole = (px % 12 < 3 && py % 12 < 3) ? 1 : 0;
        const val = hole ? 28 : 54 + ((px * 3 + py) % 5);
        setPixel(
          idx,
          val,
          val + 3,
          val + 8,
          hole ? 0.65 : 0.34,
          0.88,
          hole ? 0.55 : 0.92,
          hole ? 0.2 : 0.7,
        );
      } else if (v >= 0.75 && u >= 0.29 && u < 0.5) {
        // Island 4b: FORK_GOLD — anodized gold USD front fork stanchions & bronze engine accents
        const shine = Math.sin(py * 0.9) * 6;
        setPixel(
          idx,
          212 + shine,
          168 + shine,
          64 + shine * 0.5,
          0.22,
          0.92,
          0.96,
          0.72,
        );
      } else if (v >= 0.75 && u >= 0.5 && u < 0.745) {
        // Island 5a: CYAN_EMISSIVE — twin angular cyan rear tail lights, helmet cyan strips, headlights
        setPixel(idx, 12, 224, 255, 0.14, 0.08, 1.0, 0.82, 10, 212, 255);
      } else if (v >= 0.75 && u >= 0.745 && u < 0.88) {
        // Island 5b: RED_EMISSIVE — small center red tail light below tail cowl
        setPixel(idx, 255, 24, 48, 0.15, 0.08, 1.0, 0.82, 255, 18, 42);
      } else {
        // Island 5c: VISOR_GLASS — dark smoked polycarbonate windscreen & helmet visor
        setPixel(idx, 14, 20, 32, 0.05, 0.25, 0.98, 0.8);
      }
    }
  }

  // Derive tangent-space Normal map (+Y glTF convention) from heightField via Sobel filter
  const strength = 3.2;
  for (let py = 0; py < size; py++) {
    const ym = Math.max(0, py - 1);
    const yp = Math.min(size - 1, py + 1);
    for (let px = 0; px < size; px++) {
      const xm = Math.max(0, px - 1);
      const xp = Math.min(size - 1, px + 1);
      const hL = heightField[py * size + xm];
      const hR = heightField[py * size + xp];
      const hU = heightField[ym * size + px];
      const hD = heightField[yp * size + px];
      const dx = (hL - hR) * strength;
      // glTF convention: +Y is UP (so brighter height above means +Y normal)
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const idx4 = (py * size + px) * 4;
      normal[idx4] = Math.max(0, Math.min(255, Math.round(((dx / len) * 0.5 + 0.5) * 255)));
      normal[idx4 + 1] = Math.max(0, Math.min(255, Math.round(((dy / len) * 0.5 + 0.5) * 255)));
      normal[idx4 + 2] = Math.max(0, Math.min(255, Math.round(((dz / len) * 0.5 + 0.5) * 255)));
      normal[idx4 + 3] = 255;
    }
  }

  return { size, baseColor, normal, roughness, metallic, ao, orm, emissive };
}

let cachedRuntimeTextures: BikeRiderPBRTextures | null = null;

export function getRuntimePBRTextures(size = 256): BikeRiderPBRTextures {
  if (cachedRuntimeTextures) return cachedRuntimeTextures;
  const bufs = generatePBRBuffers(size);
  const makeTex = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data as unknown as BufferSource, size, size, THREE.RGBAFormat);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.flipY = true;
    tex.needsUpdate = true;
    return tex;
  };
  cachedRuntimeTextures = {
    baseColor: makeTex(bufs.baseColor, true),
    normal: makeTex(bufs.normal, false),
    orm: makeTex(bufs.orm, false),
    emissive: makeTex(bufs.emissive, true),
  };
  return cachedRuntimeTextures;
}

/** Remap a BufferGeometry's UVs into a sub-rectangle [u0, v0, u1, v1] and copy uv -> uv2 for aoMap */
function mapUVRegion(
  geo: THREE.BufferGeometry,
  region: readonly [number, number, number, number],
  tileU = 1,
  tileV = 1,
): THREE.BufferGeometry {
  const g = geo.index ? geo.clone() : mergeGeometries([geo]);
  if (!g.attributes.normal) g.computeVertexNormals();
  let uvAttr = g.attributes.uv as THREE.BufferAttribute | undefined;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const norm = g.attributes.normal as THREE.BufferAttribute;
  if (!uvAttr) {
    const uvArr = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const nz = Math.abs(norm.getZ(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (ny >= nx && ny >= nz) {
        uvArr[i * 2] = x * 0.5 + 0.5;
        uvArr[i * 2 + 1] = z * 0.5 + 0.5;
      } else if (nx >= nz) {
        uvArr[i * 2] = z * 0.5 + 0.5;
        uvArr[i * 2 + 1] = y * 0.5 + 0.5;
      } else {
        uvArr[i * 2] = x * 0.5 + 0.5;
        uvArr[i * 2 + 1] = y * 0.5 + 0.5;
      }
    }
    uvAttr = new THREE.BufferAttribute(uvArr, 2);
    g.setAttribute('uv', uvAttr);
  } else {
    uvAttr = uvAttr.clone();
    g.setAttribute('uv', uvAttr);
  }

  const [u0, v0, u1, v1] = region;
  const du = u1 - u0;
  const dv = v1 - v0;
  for (let i = 0; i < uvAttr.count; i++) {
    const rawU = ((uvAttr.getX(i) * tileU) % 1 + 1) % 1;
    const rawV = ((uvAttr.getY(i) * tileV) % 1 + 1) % 1;
    uvAttr.setXY(i, u0 + rawU * du, v0 + rawV * dv);
  }
  uvAttr.needsUpdate = true;
  g.setAttribute('uv2', uvAttr.clone());
  try {
    g.computeTangents();
  } catch {
    /* fallback if degenerate triangle */
  }
  sanitizeTangents(g);
  return g;
}

/**
 * Ensures every vertex of `g` has a valid, finite, unit-length tangent vector orthogonal to its normal.
 * Prevents NaN tangents on UV poles/caps which would otherwise cause black pixels in WebGL PBR normal mapping.
 */
function sanitizeTangents(g: THREE.BufferGeometry) {
  const norm = g.attributes.normal as THREE.BufferAttribute | undefined;
  if (!norm) return;
  const count = norm.count;
  let tan = g.attributes.tangent as THREE.BufferAttribute | undefined;
  if (!tan) {
    tan = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
    g.setAttribute('tangent', tan);
  }
  for (let i = 0; i < count; i++) {
    const tx = tan.getX(i);
    const ty = tan.getY(i);
    const tz = tan.getZ(i);
    const tw = tan.getW(i);
    const lenSq = tx * tx + ty * ty + tz * tz;
    if (!Number.isFinite(lenSq) || lenSq < 1e-4 || !Number.isFinite(tw)) {
      const nx = norm.getX(i) || 0;
      const ny = norm.getY(i) || 1;
      const nz = norm.getZ(i) || 0;
      // Orthonormal tangent perpendicular to (nx, ny, nz)
      let ux = 0, uy = 1, uz = 0;
      if (Math.abs(ny) > 0.85) {
        ux = 1;
        uy = 0;
      }
      let cx = uy * nz - uz * ny;
      let cy = uz * nx - ux * nz;
      let cz = ux * ny - uy * nx;
      const clen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      cx /= clen;
      cy /= clen;
      cz /= clen;
      tan.setXYZW(i, cx, cy, cz, 1.0);
    } else if (tw !== 1 && tw !== -1) {
      tan.setW(i, 1.0);
    }
  }
  tan.needsUpdate = true;
}

interface LoftSlice {
  z: number;
  x?: number;
  yb: number;
  yt: number;
  hwBot: number;
  hwMid?: number;
  hwTop: number;
  power?: number;
}

/**
 * Multi-station sculpted superellipse loft with outward normals, separate flat end-caps, and clean UVs.
 */
function buildLoftGeo(
  rawSlices: LoftSlice[],
  region: readonly [number, number, number, number],
  seg = 24,
  closedCaps = true,
): THREE.BufferGeometry {
  // Always order slices from smaller Z to larger Z so outward cross-product winding is 100% consistent
  const slices =
    rawSlices.length >= 2 && rawSlices[rawSlices.length - 1].z < rawSlices[0].z
      ? [...rawSlices].reverse()
      : rawSlices;

  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const cols = seg + 1;

  for (let k = 0; k < slices.length; k++) {
    const s = slices[k];
    const v = 0.08 + 0.84 * (k / Math.max(1, slices.length - 1));
    const yc = (s.yb + s.yt) * 0.5;
    const hh = Math.max(0.002, (s.yt - s.yb) * 0.5);
    const p = s.power ?? 2.2;
    const e = 2 / p;
    const cx = s.x ?? 0;

    for (let i = 0; i <= seg; i++) {
      const u = 0.06 + 0.88 * (i / seg);
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const tH = (sn + 1) * 0.5;
      const hwMid = s.hwMid ?? (s.hwBot + s.hwTop) * 0.55;
      const hw =
        tH < 0.5
          ? s.hwBot + (hwMid - s.hwBot) * (tH * 2)
          : hwMid + (s.hwTop - hwMid) * ((tH - 0.5) * 2);
      const x = cx + Math.sign(c) * Math.pow(Math.abs(c), e) * hw;
      const y = yc + Math.sign(sn) * Math.pow(Math.abs(sn), e) * hh;
      pos.push(x, y, s.z);
      uvs.push(u, v);
    }
  }

  for (let k = 0; k < slices.length - 1; k++) {
    for (let i = 0; i < seg; i++) {
      const a = k * cols + i;
      const b = a + 1;
      const c = (k + 1) * cols + i;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  // Separate end-cap vertices with 2D planar UVs so cap normals stay crisp and tangents are never collinear
  if (closedCaps && slices.length >= 2) {
    for (const [k, flip] of [
      [0, true],
      [slices.length - 1, false],
    ] as const) {
      const s = slices[k];
      const yc = (s.yb + s.yt) * 0.5;
      const hh = Math.max(0.002, (s.yt - s.yb) * 0.5);
      const p = s.power ?? 2.2;
      const e = 2 / p;
      const cx = s.x ?? 0;

      const ci = pos.length / 3;
      pos.push(cx, yc, s.z);
      uvs.push(0.5, 0.5);

      const ringStart = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const tH = (sn + 1) * 0.5;
        const hwMid = s.hwMid ?? (s.hwBot + s.hwTop) * 0.55;
        const hw =
          tH < 0.5
            ? s.hwBot + (hwMid - s.hwBot) * (tH * 2)
            : hwMid + (s.hwTop - hwMid) * ((tH - 0.5) * 2);
        const x = cx + Math.sign(c) * Math.pow(Math.abs(c), e) * hw;
        const y = yc + Math.sign(sn) * Math.pow(Math.abs(sn), e) * hh;
        pos.push(x, y, s.z);
        uvs.push(0.5 + 0.42 * c, 0.5 + 0.42 * sn);
      }

      for (let i = 0; i < seg; i++) {
        const a = ringStart + i;
        const b = a + 1;
        if (flip) idx.push(ci, b, a);
        else idx.push(ci, a, b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return mapUVRegion(geo, region);
}

/** Creates a tube along a 3D CatmullRom spline mapped to the given UV region */
function buildTubeGeo(
  pts: [number, number, number][],
  radius: number,
  region: readonly [number, number, number, number],
  tubularSegs = 16,
  radialSegs = 12,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geo = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
  return mapUVRegion(geo, region);
}

/** Creates a custom rounded sport motorcycle tyre with deep curved crown + 5-spoke rim + brake discs */
function buildWheelAssembly(
  radius: number,
  width: number,
  isRear: boolean,
  mats: BikeRiderMaterials,
): THREE.Group {
  const group = new THREE.Group();
  group.name = isRear ? 'RearWheelSpin' : 'FrontWheelSpin';

  // 1. Sport radial tyre (revolved profile around X axis via LatheGeometry then rotated Z=-PI/2)
  const rimR = radius * 0.63;
  const profile: THREE.Vector2[] = [];
  const pSteps = 18;
  for (let i = 0; i <= pSteps; i++) {
    const t = i / pSteps; // 0 = left bead, 0.5 = crown, 1 = right bead
    const u = t * 2 - 1; // -1..+1
    const xHalf = width * 0.5;
    // Deep motorcycle sport crown so the tyre contacts smoothly even at 60° lean angle
    const r =
      Math.abs(u) > 0.86
        ? rimR + ((radius - 0.045 - rimR) * (1 - Math.abs(u))) / 0.14
        : rimR + 0.03 + (radius - rimR - 0.03) * Math.pow(Math.cos(u * Math.PI * 0.48), 0.72);
    const yLathe = u * xHalf * Math.sin(Math.acos(Math.min(1, Math.abs(u) * 0.25)));
    profile.push(new THREE.Vector2(r, yLathe));
  }
  const tyreGeo = new THREE.LatheGeometry(profile, 44);
  tyreGeo.rotateZ(-Math.PI / 2); // Lathe axis is Y; rotate so wheel axle is X
  const mappedTyre = mapUVRegion(tyreGeo, UV_REGIONS.TYRE_RUBBER, 1, 3);
  const tyreMesh = new THREE.Mesh(mappedTyre, mats.tyre);
  tyreMesh.name = isRear ? 'Bike_RearTyre' : 'Bike_FrontTyre';
  group.add(tyreMesh);

  // 2. Alloy rim barrel + 5 Y-split spokes + hub (MECH_DARK) & Cobalt Blue rim pinstripe
  const rimGeos: THREE.BufferGeometry[] = [];
  const cobaltGeos: THREE.BufferGeometry[] = [];
  const silverGeos: THREE.BufferGeometry[] = [];

  const hubGeo = new THREE.CylinderGeometry(rimR * 0.28, rimR * 0.28, width * 0.76, 20);
  hubGeo.rotateZ(Math.PI / 2);
  rimGeos.push(hubGeo);

  const innerLip = new THREE.TorusGeometry(rimR * 0.96, width * 0.09, 10, 36);
  innerLip.rotateY(Math.PI / 2);
  rimGeos.push(innerLip);

  // 5 Y-split spokes
  for (let k = 0; k < 5; k++) {
    const baseAngle = (k / 5) * Math.PI * 2;
    for (const branch of [-0.16, 0.16]) {
      const spoke = new THREE.BoxGeometry(width * 0.34, rimR * 0.78, 0.022);
      spoke.translate(0, rimR * 0.52, 0);
      spoke.rotateX(baseAngle + branch);
      rimGeos.push(spoke);
    }
  }

  // Cobalt blue rim stripes on both sides
  for (const sx of [-1, 1]) {
    const stripe = new THREE.TorusGeometry(rimR * 0.98, 0.011, 8, 36);
    stripe.rotateY(Math.PI / 2);
    stripe.translate(sx * (width * 0.43), 0, 0);
    cobaltGeos.push(stripe);
  }

  // Brake discs & rear sprocket
  if (isRear) {
    // Left side (-X): toothed chain sprocket
    const sprocket = new THREE.CylinderGeometry(rimR * 0.56, rimR * 0.56, 0.014, 28);
    sprocket.rotateZ(Math.PI / 2);
    sprocket.translate(-width * 0.54, 0, 0);
    silverGeos.push(sprocket);

    // Right side (+X): ventilated rear brake rotor
    const rotor = new THREE.CylinderGeometry(rimR * 0.58, rimR * 0.58, 0.012, 28);
    rotor.rotateZ(Math.PI / 2);
    rotor.translate(width * 0.53, 0, 0);
    silverGeos.push(rotor);
  } else {
    // Front wheel: twin drilled brake rotors on both sides
    for (const sx of [-1, 1]) {
      const rotor = new THREE.CylinderGeometry(rimR * 0.76, rimR * 0.76, 0.01, 32);
      rotor.rotateZ(Math.PI / 2);
      rotor.translate(sx * (width * 0.53), 0, 0);
      silverGeos.push(rotor);

      const carrier = new THREE.CylinderGeometry(rimR * 0.44, rimR * 0.44, 0.016, 20);
      carrier.rotateZ(Math.PI / 2);
      carrier.translate(sx * (width * 0.53), 0, 0);
      rimGeos.push(carrier);
    }
  }

  const rimMesh = new THREE.Mesh(
    mapUVRegion(mergeGeometries(rimGeos), UV_REGIONS.MECH_DARK),
    mats.mechDark,
  );
  rimMesh.name = isRear ? 'Bike_RearRim' : 'Bike_FrontRim';
  group.add(rimMesh);

  const stripeMesh = new THREE.Mesh(
    mapUVRegion(mergeGeometries(cobaltGeos), UV_REGIONS.COBALT_BLUE),
    mats.cobalt,
  );
  stripeMesh.name = isRear ? 'Bike_RearRimStripe' : 'Bike_FrontRimStripe';
  group.add(stripeMesh);

  const discMesh = new THREE.Mesh(
    mapUVRegion(mergeGeometries(silverGeos), UV_REGIONS.ARMOR_SILVER),
    mats.armorSilver,
  );
  discMesh.name = isRear ? 'Bike_RearSprocketDisc' : 'Bike_FrontRotors';
  group.add(discMesh);

  return group;
}

/**
 * Builds the complete static & articulated motorcycle chassis (fairing, fuel tank, seat,
 * twin angular cyan tail lights, small red center light, right-side exhaust, swingarm, chain,
 * engine, front forks, handlebars, mirrors, and wheels).
 */
/** Legacy futuristic chassis, kept for reference. */
export function buildMotorcycleChassis(mats: BikeRiderMaterials) {
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'ChassisGroup';

  const silverGeos: THREE.BufferGeometry[] = [];
  const cobaltGeos: THREE.BufferGeometry[] = [];
  const darkGeos: THREE.BufferGeometry[] = [];
  const suitSeatGeos: THREE.BufferGeometry[] = [];
  const cyanGeos: THREE.BufferGeometry[] = [];
  const redGeos: THREE.BufferGeometry[] = [];
  const visorGeos: THREE.BufferGeometry[] = [];
  const mirrorGeos: THREE.BufferGeometry[] = [];

  // 1. ENGINE BLOCK, RADIATOR & BELLY PAN
  silverGeos.push(
    // Brushed aluminum twin-spar main frame beams
    buildTubeGeo(
      [
        [-0.08, 0.82, -0.44],
        [-0.19, 0.66, -0.18],
        [-0.17, 0.42, 0.14],
      ],
      0.036,
      UV_REGIONS.ARMOR_SILVER,
    ),
    buildTubeGeo(
      [
        [0.08, 0.82, -0.44],
        [0.19, 0.66, -0.18],
        [0.17, 0.42, 0.14],
      ],
      0.036,
      UV_REGIONS.ARMOR_SILVER,
    ),
  );

  // Sculpted Engine Block & Crankcase
  darkGeos.push(
    buildLoftGeo(
      [
        { z: -0.42, yb: 0.25, yt: 0.62, hwBot: 0.13, hwMid: 0.18, hwTop: 0.16, power: 3.2 },
        { z: -0.22, yb: 0.21, yt: 0.64, hwBot: 0.17, hwMid: 0.21, hwTop: 0.18, power: 3.0 },
        { z: 0.02, yb: 0.22, yt: 0.58, hwBot: 0.16, hwMid: 0.20, hwTop: 0.16, power: 3.0 },
        { z: 0.16, yb: 0.28, yt: 0.50, hwBot: 0.13, hwMid: 0.15, hwTop: 0.13, power: 2.8 },
      ],
      UV_REGIONS.MECH_DARK,
      20,
    ),
  );

  // Clutch & Stator side covers on engine
  for (const sx of [-1, 1]) {
    const cover = new THREE.CylinderGeometry(0.105, 0.115, 0.05, 20);
    cover.rotateZ(Math.PI / 2);
    cover.translate(sx * 0.195, 0.36, -0.06);
    darkGeos.push(mapUVRegion(cover, UV_REGIONS.MECH_DARK));
  }

  // Lower Aerodynamic Belly Pan (Dark graphite + Cobalt Blue lower accent fin)
  darkGeos.push(
    buildLoftGeo(
      [
        { z: -0.48, yb: 0.18, yt: 0.30, hwBot: 0.08, hwMid: 0.15, hwTop: 0.17, power: 2.8 },
        { z: -0.20, yb: 0.15, yt: 0.28, hwBot: 0.14, hwMid: 0.20, hwTop: 0.21, power: 2.8 },
        { z: 0.12, yb: 0.16, yt: 0.27, hwBot: 0.13, hwMid: 0.18, hwTop: 0.18, power: 2.8 },
        { z: 0.28, yb: 0.19, yt: 0.26, hwBot: 0.09, hwMid: 0.12, hwTop: 0.12, power: 2.8 },
      ],
      UV_REGIONS.MECH_DARK,
      18,
    ),
  );
  for (const sx of [-1, 1]) {
    cobaltGeos.push(
      buildLoftGeo(
        [
          { z: -0.28, x: sx * 0.185, yb: 0.19, yt: 0.29, hwBot: 0.018, hwTop: 0.024, power: 2.5 },
          { z: -0.04, x: sx * 0.195, yb: 0.16, yt: 0.25, hwBot: 0.022, hwTop: 0.026, power: 2.5 },
          { z: 0.14, x: sx * 0.175, yb: 0.17, yt: 0.22, hwBot: 0.015, hwTop: 0.018, power: 2.5 },
        ],
        UV_REGIONS.COBALT_BLUE,
        12,
      ),
    );
  }

  // 2. SCULPTED FUEL TANK (Titanium Silver + Cobalt Blue Side Knee Recesses + Alloy Cap)
  silverGeos.push(
    buildLoftGeo(
      [
        { z: -0.46, yb: 0.72, yt: 0.88, hwBot: 0.14, hwMid: 0.19, hwTop: 0.11, power: 2.4 },
        { z: -0.32, yb: 0.70, yt: 0.98, hwBot: 0.19, hwMid: 0.26, hwTop: 0.15, power: 2.3 },
        { z: -0.18, yb: 0.69, yt: 1.00, hwBot: 0.18, hwMid: 0.25, hwTop: 0.14, power: 2.3 },
        { z: -0.04, yb: 0.70, yt: 0.94, hwBot: 0.15, hwMid: 0.19, hwTop: 0.11, power: 2.3 },
        { z: 0.09, yb: 0.72, yt: 0.83, hwBot: 0.12, hwMid: 0.14, hwTop: 0.09, power: 2.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      24,
    ),
  );
  // Cobalt blue tank side knee-grip panels
  for (const sx of [-1, 1]) {
    cobaltGeos.push(
      buildLoftGeo(
        [
          { z: -0.36, x: sx * 0.21, yb: 0.76, yt: 0.94, hwBot: 0.032, hwTop: 0.042, power: 2.2 },
          { z: -0.20, x: sx * 0.215, yb: 0.73, yt: 0.93, hwBot: 0.035, hwTop: 0.04, power: 2.2 },
          { z: -0.04, x: sx * 0.165, yb: 0.73, yt: 0.87, hwBot: 0.028, hwTop: 0.03, power: 2.2 },
        ],
        UV_REGIONS.COBALT_BLUE,
        14,
      ),
    );
  }
  // Fuel cap
  const fuelCap = new THREE.CylinderGeometry(0.042, 0.045, 0.012, 18);
  fuelCap.rotateX(-0.12);
  fuelCap.translate(0, 0.995, -0.24);
  darkGeos.push(mapUVRegion(fuelCap, UV_REGIONS.MECH_DARK));

  // 3. FRONT NOSE COWLING, SIDE BOOMERANG FAIRINGS, TWIN CYAN HEADLIGHTS & WINDSCREEN
  silverGeos.push(
    buildLoftGeo(
      [
        { z: -0.95, yb: 0.66, yt: 0.75, hwBot: 0.05, hwMid: 0.12, hwTop: 0.08, power: 2.6 },
        { z: -0.82, yb: 0.62, yt: 0.84, hwBot: 0.16, hwMid: 0.24, hwTop: 0.18, power: 2.6 },
        { z: -0.64, yb: 0.60, yt: 0.90, hwBot: 0.22, hwMid: 0.27, hwTop: 0.22, power: 2.6 },
        { z: -0.46, yb: 0.56, yt: 0.86, hwBot: 0.21, hwMid: 0.26, hwTop: 0.20, power: 2.6 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      24,
    ),
  );
  // Sculpted Left & Right Side Fairing Wings (Silver + Cobalt Blue slash)
  for (const sx of [-1, 1]) {
    silverGeos.push(
      buildLoftGeo(
        [
          { z: -0.68, x: sx * 0.22, yb: 0.42, yt: 0.72, hwBot: 0.025, hwMid: 0.045, hwTop: 0.035, power: 2.6 },
          { z: -0.42, x: sx * 0.245, yb: 0.28, yt: 0.68, hwBot: 0.03, hwMid: 0.05, hwTop: 0.04, power: 2.6 },
          { z: -0.16, x: sx * 0.22, yb: 0.44, yt: 0.66, hwBot: 0.025, hwMid: 0.038, hwTop: 0.03, power: 2.6 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        16,
      ),
    );
    cobaltGeos.push(
      buildLoftGeo(
        [
          { z: -0.64, x: sx * 0.242, yb: 0.52, yt: 0.70, hwBot: 0.022, hwTop: 0.028, power: 2.4 },
          { z: -0.44, x: sx * 0.258, yb: 0.36, yt: 0.60, hwBot: 0.024, hwTop: 0.028, power: 2.4 },
          { z: -0.28, x: sx * 0.24, yb: 0.32, yt: 0.46, hwBot: 0.018, hwTop: 0.022, power: 2.4 },
        ],
        UV_REGIONS.COBALT_BLUE,
        12,
      ),
    );
    // Twin Angular Cyan V-Headlights on the nose
    const hl = new THREE.BoxGeometry(0.11, 0.026, 0.04);
    hl.rotateZ(sx * 0.32);
    hl.rotateY(sx * -0.38);
    hl.translate(sx * 0.125, 0.73, -0.89);
    cyanGeos.push(mapUVRegion(hl, UV_REGIONS.CYAN_EMISSIVE));
  }

  // Dark Smoked Double-Bubble Windscreen
  visorGeos.push(
    buildLoftGeo(
      [
        { z: -0.84, yb: 0.78, yt: 0.83, hwBot: 0.09, hwMid: 0.11, hwTop: 0.07, power: 2.2 },
        { z: -0.68, yb: 0.85, yt: 0.98, hwBot: 0.15, hwMid: 0.16, hwTop: 0.11, power: 2.2 },
        { z: -0.50, yb: 0.90, yt: 1.09, hwBot: 0.16, hwMid: 0.15, hwTop: 0.09, power: 2.2 },
        { z: -0.42, yb: 0.94, yt: 1.11, hwBot: 0.13, hwMid: 0.12, hwTop: 0.06, power: 2.2 },
      ],
      UV_REGIONS.VISOR_GLASS,
      18,
    ),
  );

  // Polygonal Fairing Mirrors (Stalks + Angular Housings + Reflective Mirror Glass)
  for (const sx of [-1, 1]) {
    darkGeos.push(
      buildTubeGeo(
        [
          [sx * 0.21, 0.86, -0.56],
          [sx * 0.31, 0.90, -0.52],
          [sx * 0.37, 0.91, -0.49],
        ],
        0.012,
        UV_REGIONS.MECH_DARK,
        8,
        8,
      ),
    );
    // Mirror housing
    const mh = buildLoftGeo(
      [
        { z: -0.52, x: sx * 0.41, yb: 0.885, yt: 0.945, hwBot: 0.055, hwMid: 0.072, hwTop: 0.05, power: 3.2 },
        { z: -0.47, x: sx * 0.415, yb: 0.88, yt: 0.95, hwBot: 0.06, hwMid: 0.076, hwTop: 0.055, power: 3.2 },
      ],
      UV_REGIONS.MECH_DARK,
      12,
    );
    darkGeos.push(mh);
    // Reflective glass face facing +Z (toward rider/camera)
    const mg = new THREE.BoxGeometry(0.115, 0.048, 0.008);
    mg.rotateZ(sx * 0.12);
    mg.rotateY(sx * -0.16);
    mg.translate(sx * 0.415, 0.915, -0.466);
    mirrorGeos.push(mapUVRegion(mg, UV_REGIONS.VISOR_GLASS));
  }

  // 4. STEPPED RACING SADDLE & PILLION BOLSTER
  suitSeatGeos.push(
    buildLoftGeo(
      [
        { z: 0.02, yb: 0.72, yt: 0.79, hwBot: 0.12, hwMid: 0.14, hwTop: 0.11, power: 2.6 },
        { z: 0.22, yb: 0.71, yt: 0.79, hwBot: 0.15, hwMid: 0.17, hwTop: 0.14, power: 2.6 },
        { z: 0.38, yb: 0.73, yt: 0.84, hwBot: 0.16, hwMid: 0.18, hwTop: 0.15, power: 2.8 },
        { z: 0.56, yb: 0.80, yt: 0.92, hwBot: 0.14, hwMid: 0.16, hwTop: 0.12, power: 3.0 },
      ],
      UV_REGIONS.SUIT_GRAPHITE,
      18,
    ),
  );

  // 5. REAR TAIL COWL, TWIN ANGULAR CYAN REAR LIGHTS & SMALL RED CENTER LIGHT (Image 2 signature!)
  // Sculpted wide faceted tail cowl
  silverGeos.push(
    buildLoftGeo(
      [
        { z: 0.36, yb: 0.68, yt: 0.84, hwBot: 0.14, hwMid: 0.19, hwTop: 0.15, power: 3.2 },
        { z: 0.56, yb: 0.74, yt: 0.94, hwBot: 0.16, hwMid: 0.22, hwTop: 0.15, power: 3.4 },
        { z: 0.74, yb: 0.76, yt: 0.93, hwBot: 0.15, hwMid: 0.225, hwTop: 0.13, power: 3.6 },
        { z: 0.88, yb: 0.77, yt: 0.90, hwBot: 0.13, hwMid: 0.195, hwTop: 0.11, power: 3.8 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      24,
    ),
  );
  // Dark recessed rear tail fascia bezel & central spine divider
  darkGeos.push(
    buildLoftGeo(
      [
        { z: 0.82, yb: 0.76, yt: 0.89, hwBot: 0.12, hwMid: 0.185, hwTop: 0.105, power: 3.6 },
        { z: 0.895, yb: 0.765, yt: 0.88, hwBot: 0.115, hwMid: 0.175, hwTop: 0.095, power: 3.6 },
      ],
      UV_REGIONS.MECH_DARK,
      20,
    ),
  );

  // TWIN ANGULAR CYAN REAR TAIL LIGHTS (\  / trapezoid rings + inner bars matching Image 2)
  for (const sx of [-1, 1]) {
    // Custom 4-corner angled trapezoid loop for each rear cyan light
    const outerTop: [number, number, number] = [sx * 0.158, 0.848, 0.892];
    const outerBot: [number, number, number] = [sx * 0.126, 0.792, 0.896];
    const innerBot: [number, number, number] = [sx * 0.036, 0.776, 0.902];
    const innerTop: [number, number, number] = [sx * 0.062, 0.836, 0.898];
    const corners = [outerTop, outerBot, innerBot, innerTop, outerTop];
    for (let c = 0; c < 4; c++) {
      cyanGeos.push(buildTubeGeo([corners[c], corners[c + 1]], 0.0085, UV_REGIONS.CYAN_EMISSIVE, 6, 8));
    }
    // Bright inner cyan blade inside the trapezoid
    cyanGeos.push(
      buildTubeGeo(
        [
          [sx * 0.138, 0.822, 0.896],
          [sx * 0.056, 0.806, 0.901],
        ],
        0.0095,
        UV_REGIONS.CYAN_EMISSIVE,
        6,
        8,
      ),
    );
    // Side tail accent fin in cobalt blue
    const sideFin = new THREE.BoxGeometry(0.018, 0.035, 0.24);
    sideFin.rotateX(0.24);
    sideFin.translate(sx * 0.205, 0.85, 0.66);
    cobaltGeos.push(mapUVRegion(sideFin, UV_REGIONS.COBALT_BLUE));
  }

  // SMALL RED LIGHT BELOW THE CENTER OF THE TAIL (Image 2 signature!)
  const redBezel = new THREE.BoxGeometry(0.082, 0.028, 0.036);
  redBezel.translate(0, 0.742, 0.892);
  darkGeos.push(mapUVRegion(redBezel, UV_REGIONS.MECH_DARK));

  const redLens = new THREE.BoxGeometry(0.068, 0.018, 0.022);
  redLens.translate(0, 0.742, 0.908);
  redGeos.push(mapUVRegion(redLens, UV_REGIONS.RED_EMISSIVE));

  // Twin Tubular Subframe Struts under the tail cowl (framing the rear wheel in Image 2)
  for (const sx of [-1, 1]) {
    silverGeos.push(
      buildTubeGeo(
        [
          [sx * 0.145, 0.56, 0.34],
          [sx * 0.14, 0.68, 0.62],
          [sx * 0.105, 0.75, 0.82],
        ],
        0.016,
        UV_REGIONS.ARMOR_SILVER,
        12,
        10,
      ),
      buildTubeGeo(
        [
          [sx * 0.155, 0.48, 0.28],
          [sx * 0.135, 0.66, 0.70],
        ],
        0.013,
        UV_REGIONS.ARMOR_SILVER,
        10,
        8,
      ),
    );
  }

  // 6. REARSET FOOTPEGS & BRACKETS
  for (const sx of [-1, 1]) {
    silverGeos.push(
      buildTubeGeo(
        [
          [sx * 0.165, 0.46, 0.08],
          [sx * 0.20, 0.43, 0.16],
          [sx * 0.17, 0.50, 0.22],
        ],
        0.012,
        UV_REGIONS.ARMOR_SILVER,
        8,
        8,
      ),
    );
    const peg = new THREE.CylinderGeometry(0.013, 0.013, 0.075, 12);
    peg.rotateZ(Math.PI / 2);
    peg.translate(sx * 0.225, 0.43, 0.16);
    silverGeos.push(mapUVRegion(peg, UV_REGIONS.ARMOR_SILVER));
  }

  // 7. SHORT EXHAUST ON THE RIDER'S RIGHT SIDE (+X ONLY — never mirrored to the left!)
  // Header collector pipe routing from engine underside to right side
  silverGeos.push(
    buildTubeGeo(
      [
        [0.08, 0.22, 0.06],
        [0.145, 0.27, 0.26],
        [0.178, 0.36, 0.44],
      ],
      0.026,
      UV_REGIONS.ARMOR_SILVER,
      14,
      12,
    ),
  );
  // Sculpted Titanium Silver Cylindrical Muffler Canister on Right Side (+X)
  const exhaustSlices: LoftSlice[] = [
    { z: 0.40, x: 0.178, yb: 0.32, yt: 0.40, hwBot: 0.032, hwMid: 0.04, hwTop: 0.032, power: 2.0 },
    { z: 0.46, x: 0.184, yb: 0.35, yt: 0.46, hwBot: 0.048, hwMid: 0.056, hwTop: 0.048, power: 2.0 },
    { z: 0.63, x: 0.192, yb: 0.41, yt: 0.525, hwBot: 0.05, hwMid: 0.058, hwTop: 0.05, power: 2.0 },
  ];
  silverGeos.push(buildLoftGeo(exhaustSlices, UV_REGIONS.ARMOR_SILVER, 24));
  // Carbon end-cap + deep recessed dark inner bore on Right Side (+X)
  darkGeos.push(
    buildLoftGeo(
      [
        { z: 0.63, x: 0.192, yb: 0.41, yt: 0.525, hwBot: 0.05, hwMid: 0.058, hwTop: 0.05, power: 2.0 },
        { z: 0.695, x: 0.195, yb: 0.435, yt: 0.535, hwBot: 0.042, hwMid: 0.05, hwTop: 0.042, power: 2.0 },
        { z: 0.65, x: 0.193, yb: 0.45, yt: 0.52, hwBot: 0.032, hwMid: 0.036, hwTop: 0.032, power: 2.0 },
      ],
      UV_REGIONS.MECH_DARK,
      24,
    ),
  );
  // Exhaust hanger bracket from right subframe
  silverGeos.push(
    buildTubeGeo(
      [
        [0.145, 0.62, 0.54],
        [0.192, 0.49, 0.56],
      ],
      0.009,
      UV_REGIONS.ARMOR_SILVER,
      6,
      8,
    ),
  );

  // Add merged chassis static meshes by material
  const addChassisMesh = (geos: THREE.BufferGeometry[], mat: THREE.Material, name: string) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.name = name;
    chassisGroup.add(m);
  };
  addChassisMesh(silverGeos, mats.armorSilver, 'Bike_Fairing_Silver');
  addChassisMesh(cobaltGeos, mats.cobalt, 'Bike_Fairing_Cobalt');
  addChassisMesh(darkGeos, mats.mechDark, 'Bike_Chassis_Dark');
  addChassisMesh(suitSeatGeos, mats.suit, 'Bike_Seat_Pad');
  addChassisMesh(cyanGeos, mats.cyanGlow, 'Bike_Lights_Cyan');
  addChassisMesh(redGeos, mats.redGlow, 'Bike_Light_Red');
  addChassisMesh(visorGeos, mats.visor, 'Bike_Windscreen');
  addChassisMesh(mirrorGeos, mats.mirror, 'Bike_MirrorGlass');

  // 8. SWINGARM, CHAIN DRIVE & REAR HUGGER GROUP
  const swingarmGroup = new THREE.Group();
  swingarmGroup.name = 'SwingarmGroup';
  const swSilver: THREE.BufferGeometry[] = [];
  const swDark: THREE.BufferGeometry[] = [];

  for (const sx of [-1, 1]) {
    swSilver.push(
      buildLoftGeo(
        [
          { z: 0.14, x: sx * 0.16, yb: 0.34, yt: 0.43, hwBot: 0.022, hwMid: 0.028, hwTop: 0.022, power: 3.2 },
          { z: 0.44, x: sx * 0.165, yb: 0.31, yt: 0.42, hwBot: 0.024, hwMid: 0.03, hwTop: 0.024, power: 3.2 },
          { z: 0.74, x: sx * 0.162, yb: 0.30, yt: 0.37, hwBot: 0.02, hwMid: 0.024, hwTop: 0.02, power: 3.2 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        14,
      ),
    );
  }
  // Left-side (-X) Drive Chain upper & lower runs
  swDark.push(
    buildTubeGeo(
      [
        [-0.145, 0.40, 0.14],
        [-0.145, 0.445, 0.71],
      ],
      0.011,
      UV_REGIONS.MECH_DARK,
      10,
      8,
    ),
    buildTubeGeo(
      [
        [-0.145, 0.31, 0.14],
        [-0.145, 0.215, 0.71],
      ],
      0.011,
      UV_REGIONS.MECH_DARK,
      10,
      8,
    ),
    // Rear tyre hugger fender
    buildLoftGeo(
      [
        { z: 0.36, yb: 0.46, yt: 0.48, hwBot: 0.11, hwMid: 0.135, hwTop: 0.11, power: 2.2 },
        { z: 0.48, yb: 0.62, yt: 0.64, hwBot: 0.12, hwMid: 0.14, hwTop: 0.11, power: 2.2 },
        { z: 0.64, yb: 0.66, yt: 0.68, hwBot: 0.11, hwMid: 0.13, hwTop: 0.09, power: 2.2 },
      ],
      UV_REGIONS.MECH_DARK,
      16,
    ),
  );
  const swSilverMesh = new THREE.Mesh(mergeGeometries(swSilver), mats.armorSilver);
  swSilverMesh.name = 'Bike_Swingarm_Silver';
  const swDarkMesh = new THREE.Mesh(mergeGeometries(swDark), mats.mechDark);
  swDarkMesh.name = 'Bike_Chain_Hugger';
  swingarmGroup.add(swSilverMesh, swDarkMesh);
  chassisGroup.add(swingarmGroup);

  // 9. STEERING PIVOT (Gold USD Forks, Clip-On Handlebars, Front Fender & Front Wheel)
  const steeringPivot = new THREE.Group();
  steeringPivot.name = 'SteeringPivot';
  steeringPivot.position.set(0, 0.74, -0.52);

  const forkGoldGeos: THREE.BufferGeometry[] = [];
  const forkDarkGeos: THREE.BufferGeometry[] = [];
  const forkSilverGeos: THREE.BufferGeometry[] = [];

  for (const sx of [-1, 1]) {
    // Upper gold anodized fork tube (from triple clamp down toward front axle)
    forkGoldGeos.push(
      buildTubeGeo(
        [
          [sx * 0.105, 0.06, 0.02],
          [sx * 0.105, -0.24, -0.11],
        ],
        0.024,
        UV_REGIONS.FORK_GOLD,
        8,
        12,
      ),
    );
    // Lower dark stanchion + radial brake caliper mount
    forkDarkGeos.push(
      buildTubeGeo(
        [
          [sx * 0.105, -0.22, -0.10],
          [sx * 0.105, -0.43, -0.19],
        ],
        0.02,
        UV_REGIONS.MECH_DARK,
        8,
        12,
      ),
    );
    // Clip-on handlebar tube & grip (world/chassis pos ≈ (sx * 0.275, 0.805, -0.435))
    forkDarkGeos.push(
      buildTubeGeo(
        [
          [sx * 0.105, 0.065, 0.02],
          [sx * 0.295, 0.06, 0.095],
        ],
        0.015,
        UV_REGIONS.MECH_DARK,
        8,
        10,
      ),
    );
    // Brake / Clutch lever
    forkSilverGeos.push(
      buildTubeGeo(
        [
          [sx * 0.19, 0.062, 0.04],
          [sx * 0.285, 0.055, 0.03],
        ],
        0.006,
        UV_REGIONS.ARMOR_SILVER,
        6,
        6,
      ),
    );
  }
  // Front mudguard / fender
  forkSilverGeos.push(
    buildLoftGeo(
      [
        { z: -0.32, yb: -0.16, yt: -0.12, hwBot: 0.075, hwMid: 0.088, hwTop: 0.065, power: 2.2 },
        { z: -0.19, yb: -0.11, yt: -0.09, hwBot: 0.08, hwMid: 0.092, hwTop: 0.07, power: 2.2 },
        { z: -0.06, yb: -0.22, yt: -0.18, hwBot: 0.078, hwMid: 0.088, hwTop: 0.065, power: 2.2 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    ),
  );

  const fGoldMesh = new THREE.Mesh(mergeGeometries(forkGoldGeos), mats.forkGold);
  fGoldMesh.name = 'Bike_Forks_Gold';
  const fDarkMesh = new THREE.Mesh(mergeGeometries(forkDarkGeos), mats.mechDark);
  fDarkMesh.name = 'Bike_Handlebars_ForkLugs';
  const fSilverMesh = new THREE.Mesh(mergeGeometries(forkSilverGeos), mats.armorSilver);
  fSilverMesh.name = 'Bike_FrontFender';
  steeringPivot.add(fGoldMesh, fDarkMesh, fSilverMesh);

  // Front Wheel centered at axle (0, -0.43, -0.19) inside SteeringPivot => (0, 0.31, -0.71) in chassis space
  const frontWheelPivot = new THREE.Group();
  frontWheelPivot.name = 'FrontWheelPivot';
  frontWheelPivot.position.set(0, -0.43, -0.19);
  const frontWheelSpin = buildWheelAssembly(0.31, 0.145, false, mats);
  frontWheelPivot.add(frontWheelSpin);
  steeringPivot.add(frontWheelPivot);
  chassisGroup.add(steeringPivot);

  // Rear Wheel centered at axle (0, 0.33, 0.71) in chassis space
  const rearWheelPivot = new THREE.Group();
  rearWheelPivot.name = 'RearWheelPivot';
  rearWheelPivot.position.set(0, 0.33, 0.71);
  const rearWheelSpin = buildWheelAssembly(0.33, 0.255, true, mats);
  rearWheelPivot.add(rearWheelSpin);
  chassisGroup.add(rearWheelPivot);

  return {
    chassisGroup,
    steeringPivot,
    frontWheelSpin,
    rearWheelSpin,
    swingarmGroup,
  };
}

/**
 * Builds the Rider Skeleton (19 bones) and the Multi-Material SkinnedMesh
 * where rigid armor plates (segmented silver Y-spine protector, helmet, shoulder/elbow/hip/knee/shin armor)
 * are 100% single-bone weighted so they NEVER deform like rubber, while suit joints blend smoothly.
 */
/** Legacy segmented (robot-style) rider, kept for reference. */
export function buildRiderSkinnedMesh(mats: BikeRiderMaterials) {
  const bones: Record<string, THREE.Bone> = {};
  const makeBone = (name: string, parent: THREE.Bone | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones[name] = b;
    return b;
  };

  // Bind-pose skeleton (seated upright sport-riding reference frame in chassis space)
  const pelvis = makeBone('Pelvis', null, 0, 0.80, 0.22);
  const spine1 = makeBone('Spine_1', pelvis, 0, 0.11, -0.05);
  const spine2 = makeBone('Spine_2', spine1, 0, 0.12, -0.06);
  const chest = makeBone('Chest', spine2, 0, 0.13, -0.06);
  const neck = makeBone('Neck', chest, 0, 0.13, -0.04);
  const head = makeBone('Head', neck, 0, 0.07, -0.02);

  // Arms (bind pose extending along +X/-X or directly to shoulders; we use local limb axis -Z for IK simplicity)
  const upperArmL = makeBone('UpperArm_L', chest, -0.195, 0.08, -0.02);
  const forearmL = makeBone('Forearm_L', upperArmL, 0, 0, -0.27);
  const handL = makeBone('Hand_L', forearmL, 0, 0, -0.25);

  const upperArmR = makeBone('UpperArm_R', chest, 0.195, 0.08, -0.02);
  const forearmR = makeBone('Forearm_R', upperArmR, 0, 0, -0.27);
  const handR = makeBone('Hand_R', forearmR, 0, 0, -0.25);

  // Legs (local limb axis -Z so lookAt / 2-bone IK aims -Z from Hip -> Knee -> Footpeg)
  const thighL = makeBone('Thigh_L', pelvis, -0.135, -0.02, -0.02);
  const shinL = makeBone('Shin_L', thighL, 0, 0, -0.37);
  const footL = makeBone('Foot_L', shinL, 0, 0, -0.36);

  const thighR = makeBone('Thigh_R', pelvis, 0.135, -0.02, -0.02);
  const shinR = makeBone('Shin_R', thighR, 0, 0, -0.37);
  const footR = makeBone('Foot_R', shinR, 0, 0, -0.36);

  const boneList = [
    pelvis,
    spine1,
    spine2,
    chest,
    neck,
    head,
    upperArmL,
    forearmL,
    handL,
    upperArmR,
    forearmR,
    handR,
    thighL,
    shinL,
    footL,
    thighR,
    shinR,
    footR,
  ];
  const boneIdx: Record<string, number> = {};
  boneList.forEach((b, i) => {
    boneIdx[b.name] = i;
  });

  pelvis.updateMatrixWorld(true);

  /**
   * Helper: transforms a geometry authored in a bone's local space into Pelvis/Root bind space
   * and assigns skinIndex / skinWeight.
   *  - When `rigid = true`, 100% weight (`1, 0, 0, 0`) is assigned to `boneName` so armor never stretches!
   *  - When `rigid = false` and `parentBoneName` is provided, vertices near the joint base blend smoothly
   *    with `parentBoneName` so the leather suit bends organically without gaps.
   */
  const partsByMat = {
    suit: [] as THREE.BufferGeometry[],
    silver: [] as THREE.BufferGeometry[],
    cobalt: [] as THREE.BufferGeometry[],
    cyan: [] as THREE.BufferGeometry[],
    visor: [] as THREE.BufferGeometry[],
  };

  const addSkinnedPart = (
    geo: THREE.BufferGeometry,
    matKey: keyof typeof partsByMat,
    boneName: string,
    opts?: { rigid?: boolean; parentBone?: string; blendOrigin?: THREE.Vector3; blendSpan?: number },
  ) => {
    const g = geo.clone();
    const bone = bones[boneName];
    const bIdx = boneIdx[boneName];
    const pIdx = opts?.parentBone ? boneIdx[opts.parentBone] : bIdx;
    const rigid = opts?.rigid ?? true;

    const pos = g.attributes.position as THREE.BufferAttribute;
    const skinIndices = new Uint16Array(pos.count * 4);
    const skinWeights = new Float32Array(pos.count * 4);
    const vTmp = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      vTmp.fromBufferAttribute(pos, i);
      let wMain = 1.0;
      let wParent = 0.0;
      if (!rigid && opts?.parentBone) {
        const dist = opts.blendOrigin ? vTmp.distanceTo(opts.blendOrigin) : Math.abs(vTmp.y) + Math.abs(vTmp.z);
        const span = opts.blendSpan ?? 0.09;
        if (dist < span) {
          const t = dist / span;
          wMain = 0.5 + 0.5 * t;
          wParent = 1.0 - wMain;
        }
      }
      skinIndices[i * 4] = bIdx;
      skinIndices[i * 4 + 1] = pIdx;
      skinIndices[i * 4 + 2] = 0;
      skinIndices[i * 4 + 3] = 0;

      skinWeights[i * 4] = wMain;
      skinWeights[i * 4 + 1] = wParent;
      skinWeights[i * 4 + 2] = 0;
      skinWeights[i * 4 + 3] = 0;
    }

    // Transform geometry from bone-local coordinates into world/bind coordinates
    g.applyMatrix4(bone.matrixWorld);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    partsByMat[matKey].push(g);
  };

  // ---- 1. PELVIS & HIPS (Suit + Silver Hip Armor Plates + Cobalt Side Wrap)
  const pelvisSuit = buildLoftGeo(
    [
      { z: 0.09, yb: -0.06, yt: 0.06, hwBot: 0.14, hwMid: 0.165, hwTop: 0.145, power: 2.4 },
      { z: 0.0, yb: -0.07, yt: 0.08, hwBot: 0.155, hwMid: 0.18, hwTop: 0.155, power: 2.3 },
      { z: -0.09, yb: -0.06, yt: 0.07, hwBot: 0.135, hwMid: 0.16, hwTop: 0.14, power: 2.3 },
    ],
    UV_REGIONS.SUIT_GRAPHITE,
    22,
  );
  addSkinnedPart(pelvisSuit, 'suit', 'Pelvis', { rigid: true });

  // Silver Hip / Iliac Armor Plates flanking the waist (prominent in Image 2!)
  for (const sx of [-1, 1]) {
    const hipPlate = buildLoftGeo(
      [
        { z: 0.06, x: sx * 0.152, yb: -0.02, yt: 0.075, hwBot: 0.022, hwMid: 0.032, hwTop: 0.025, power: 2.6 },
        { z: -0.02, x: sx * 0.165, yb: -0.03, yt: 0.065, hwBot: 0.024, hwMid: 0.034, hwTop: 0.026, power: 2.6 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    );
    addSkinnedPart(hipPlate, 'silver', 'Pelvis', { rigid: true });
  }

  // ---- 2. SPINE_1, SPINE_2 & CHEST (Graphite Suit + Cobalt Blue Lat Panels + Segmented Silver Y-Spine Armor)
  const makeTorsoSegment = (
    yb: number,
    yt: number,
    zBack: number,
    zFront: number,
    hwB: number,
    hwT: number,
  ) => {
    const g = buildLoftGeo(
      [
        { z: zBack, yb, yt, hwBot: hwB * 0.78, hwMid: hwB * 0.92, hwTop: hwT * 0.85, power: 2.4 },
        { z: (zBack + zFront) * 0.5, yb, yt, hwBot: hwB, hwMid: (hwB + hwT) * 0.52, hwTop: hwT, power: 2.2 },
        { z: zFront, yb: yb + 0.01, yt: yt - 0.01, hwBot: hwB * 0.72, hwMid: hwB * 0.85, hwTop: hwT * 0.78, power: 2.3 },
      ],
      UV_REGIONS.SUIT_GRAPHITE,
      22,
    );
    return g;
  };

  addSkinnedPart(makeTorsoSegment(-0.03, 0.13, 0.075, -0.085, 0.145, 0.155), 'suit', 'Spine_1', {
    rigid: false,
    parentBone: 'Pelvis',
    blendSpan: 0.07,
  });
  addSkinnedPart(makeTorsoSegment(-0.02, 0.14, 0.08, -0.09, 0.155, 0.175), 'suit', 'Spine_2', {
    rigid: false,
    parentBone: 'Spine_1',
    blendSpan: 0.07,
  });
  addSkinnedPart(makeTorsoSegment(-0.02, 0.15, 0.085, -0.10, 0.175, 0.205), 'suit', 'Chest', {
    rigid: false,
    parentBone: 'Spine_2',
    blendSpan: 0.07,
  });

  // Cobalt Blue Diagonal Rib / Lat Panels on both sides of the rider's back (Image 2 signature!)
  for (const sx of [-1, 1]) {
    const latLower = buildLoftGeo(
      [
        { z: 0.068, x: sx * 0.105, yb: 0.01, yt: 0.11, hwBot: 0.036, hwMid: 0.044, hwTop: 0.048, power: 2.5 },
        { z: 0.02, x: sx * 0.145, yb: 0.02, yt: 0.12, hwBot: 0.028, hwMid: 0.035, hwTop: 0.038, power: 2.5 },
      ],
      UV_REGIONS.COBALT_BLUE,
      12,
    );
    addSkinnedPart(latLower, 'cobalt', 'Spine_1', { rigid: true });

    const latUpper = buildLoftGeo(
      [
        { z: 0.076, x: sx * 0.125, yb: -0.01, yt: 0.12, hwBot: 0.045, hwMid: 0.055, hwTop: 0.058, power: 2.5 },
        { z: 0.015, x: sx * 0.168, yb: 0.01, yt: 0.13, hwBot: 0.032, hwMid: 0.04, hwTop: 0.042, power: 2.5 },
      ],
      UV_REGIONS.COBALT_BLUE,
      12,
    );
    addSkinnedPart(latUpper, 'cobalt', 'Spine_2', { rigid: true });

    const shoulderTrim = buildLoftGeo(
      [
        { z: 0.075, x: sx * 0.145, yb: 0.04, yt: 0.145, hwBot: 0.04, hwMid: 0.052, hwTop: 0.048, power: 2.5 },
        { z: -0.02, x: sx * 0.16, yb: 0.06, yt: 0.148, hwBot: 0.036, hwMid: 0.045, hwTop: 0.04, power: 2.5 },
      ],
      UV_REGIONS.COBALT_BLUE,
      12,
    );
    addSkinnedPart(shoulderTrim, 'cobalt', 'Chest', { rigid: true });
  }

  // SEGMENTED SILVER SPINE ARMOR (100% rigid per spine bone so segments articulate cleanly without rubber stretching!)
  // Segment 5 (Lumbar tailpiece on Spine_1)
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.065, yb: -0.02, yt: 0.05, hwBot: 0.034, hwMid: 0.044, hwTop: 0.052, power: 3.4 },
        { z: 0.092, yb: -0.015, yt: 0.055, hwBot: 0.028, hwMid: 0.038, hwTop: 0.046, power: 3.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    ),
    'silver',
    'Spine_1',
    { rigid: true },
  );
  // Segment 4 (Lower thoracic plate on Spine_1)
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.062, yb: 0.052, yt: 0.125, hwBot: 0.052, hwMid: 0.064, hwTop: 0.072, power: 3.4 },
        { z: 0.094, yb: 0.056, yt: 0.122, hwBot: 0.044, hwMid: 0.055, hwTop: 0.062, power: 3.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    ),
    'silver',
    'Spine_1',
    { rigid: true },
  );
  // Segment 3 (Middle thoracic chevron plate on Spine_2)
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.068, yb: 0.0, yt: 0.075, hwBot: 0.07, hwMid: 0.082, hwTop: 0.092, power: 3.4 },
        { z: 0.102, yb: 0.005, yt: 0.072, hwBot: 0.058, hwMid: 0.07, hwTop: 0.078, power: 3.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    ),
    'silver',
    'Spine_2',
    { rigid: true },
  );
  // Segment 2 (Upper thoracic plate on Spine_2)
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.068, yb: 0.076, yt: 0.142, hwBot: 0.09, hwMid: 0.104, hwTop: 0.115, power: 3.4 },
        { z: 0.104, yb: 0.08, yt: 0.138, hwBot: 0.076, hwMid: 0.088, hwTop: 0.098, power: 3.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      14,
    ),
    'silver',
    'Spine_2',
    { rigid: true },
  );
  // Segment 1 (Broad Y-shaped scapular yoke + central dorsal ridge on Chest)
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.068, yb: -0.005, yt: 0.135, hwBot: 0.112, hwMid: 0.138, hwTop: 0.155, power: 3.4 },
        { z: 0.108, yb: 0.0, yt: 0.128, hwBot: 0.085, hwMid: 0.108, hwTop: 0.118, power: 3.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      16,
    ),
    'silver',
    'Chest',
    { rigid: true },
  );
  // Central raised dorsal spine fin on Chest & Spine_2
  addSkinnedPart(
    buildLoftGeo(
      [
        { z: 0.095, yb: 0.01, yt: 0.135, hwBot: 0.022, hwMid: 0.026, hwTop: 0.032, power: 3.6 },
        { z: 0.124, yb: 0.02, yt: 0.128, hwBot: 0.014, hwMid: 0.018, hwTop: 0.022, power: 3.6 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      12,
    ),
    'silver',
    'Chest',
    { rigid: true },
  );

  // ---- 3. NECK & FULL-FACE HELMET WITH REAR CYAN STRIPS (Head bone, 100% rigid)
  const neckGeo = new THREE.CylinderGeometry(0.058, 0.068, 0.09, 16);
  neckGeo.translate(0, 0.03, 0);
  addSkinnedPart(mapUVRegion(neckGeo, UV_REGIONS.SUIT_GRAPHITE), 'suit', 'Neck', {
    rigid: false,
    parentBone: 'Chest',
    blendSpan: 0.05,
  });

  // Sculpted Aerodynamic Full-Face Helmet Shell
  const helmetShell = buildLoftGeo(
    [
      { z: 0.145, yb: 0.01, yt: 0.19, hwBot: 0.085, hwMid: 0.112, hwTop: 0.082, power: 2.2 },
      { z: 0.06, yb: -0.01, yt: 0.235, hwBot: 0.105, hwMid: 0.126, hwTop: 0.102, power: 2.1 },
      { z: -0.04, yb: -0.02, yt: 0.23, hwBot: 0.102, hwMid: 0.122, hwTop: 0.095, power: 2.1 },
      { z: -0.145, yb: -0.01, yt: 0.16, hwBot: 0.072, hwMid: 0.095, hwTop: 0.068, power: 2.3 },
    ],
    UV_REGIONS.SUIT_GRAPHITE,
    24,
  );
  addSkinnedPart(helmetShell, 'suit', 'Head', { rigid: true });

  // Silver & Cobalt Helmet Side Plates and Top Crest
  for (const sx of [-1, 1]) {
    const cheekSilver = buildLoftGeo(
      [
        { z: 0.11, x: sx * 0.108, yb: 0.03, yt: 0.17, hwBot: 0.015, hwMid: 0.022, hwTop: 0.016, power: 2.4 },
        { z: -0.02, x: sx * 0.114, yb: 0.01, yt: 0.14, hwBot: 0.016, hwMid: 0.022, hwTop: 0.015, power: 2.4 },
      ],
      UV_REGIONS.ARMOR_SILVER,
      12,
    );
    addSkinnedPart(cheekSilver, 'silver', 'Head', { rigid: true });

    const sideCobalt = buildLoftGeo(
      [
        { z: 0.12, x: sx * 0.095, yb: 0.06, yt: 0.19, hwBot: 0.016, hwMid: 0.022, hwTop: 0.018, power: 2.4 },
        { z: 0.02, x: sx * 0.105, yb: 0.08, yt: 0.20, hwBot: 0.015, hwMid: 0.02, hwTop: 0.016, power: 2.4 },
      ],
      UV_REGIONS.COBALT_BLUE,
      12,
    );
    addSkinnedPart(sideCobalt, 'cobalt', 'Head', { rigid: true });
  }

  // Smoked Front Visor on Helmet
  const helmetVisor = buildLoftGeo(
    [
      { z: -0.05, yb: 0.04, yt: 0.15, hwBot: 0.106, hwMid: 0.124, hwTop: 0.102, power: 2.0 },
      { z: -0.152, yb: 0.035, yt: 0.135, hwBot: 0.075, hwMid: 0.098, hwTop: 0.072, power: 2.1 },
    ],
    UV_REGIONS.VISOR_GLASS,
    18,
  );
  addSkinnedPart(helmetVisor, 'visor', 'Head', { rigid: true });

  // REAR HELMET CYAN LED STRIPS (Upper thin cyan slit + Lower bright cyan bar — Image 2!)
  const helmetCyanUpper = new THREE.BoxGeometry(0.068, 0.010, 0.018);
  helmetCyanUpper.translate(0, 0.132, 0.144);
  addSkinnedPart(mapUVRegion(helmetCyanUpper, UV_REGIONS.CYAN_EMISSIVE), 'cyan', 'Head', { rigid: true });

  const helmetCyanLower = new THREE.BoxGeometry(0.076, 0.018, 0.022);
  helmetCyanLower.translate(0, 0.048, 0.142);
  addSkinnedPart(mapUVRegion(helmetCyanLower, UV_REGIONS.CYAN_EMISSIVE), 'cyan', 'Head', { rigid: true });

  // ---- 4. ARMS (UpperArm_L/R, Forearm_L/R, Hand_L/R — extending along -Z in bone space)
  for (const [side, sx] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    // UpperArm suit sleeve (z: 0 -> -0.27)
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.02, yb: -0.055, yt: 0.055, hwBot: 0.052, hwMid: 0.058, hwTop: 0.052, power: 2.0 },
          { z: -0.14, yb: -0.048, yt: 0.048, hwBot: 0.046, hwMid: 0.052, hwTop: 0.046, power: 2.0 },
          { z: -0.27, yb: -0.042, yt: 0.042, hwBot: 0.042, hwMid: 0.046, hwTop: 0.042, power: 2.0 },
        ],
        UV_REGIONS.SUIT_GRAPHITE,
        16,
      ),
      'suit',
      `UpperArm_${side}`,
      { rigid: false, parentBone: 'Chest', blendSpan: 0.06 },
    );

    // Rigid Silver + Cobalt Shoulder Pauldron Armor
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.03, x: sx * 0.022, yb: -0.02, yt: 0.068, hwBot: 0.048, hwMid: 0.06, hwTop: 0.048, power: 2.4 },
          { z: -0.11, x: sx * 0.024, yb: -0.02, yt: 0.058, hwBot: 0.044, hwMid: 0.054, hwTop: 0.042, power: 2.4 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        14,
      ),
      'silver',
      `UpperArm_${side}`,
      { rigid: true },
    );
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.01, x: sx * 0.028, yb: 0.01, yt: 0.072, hwBot: 0.038, hwMid: 0.048, hwTop: 0.038, power: 2.4 },
          { z: -0.08, x: sx * 0.028, yb: 0.01, yt: 0.064, hwBot: 0.034, hwMid: 0.042, hwTop: 0.032, power: 2.4 },
        ],
        UV_REGIONS.COBALT_BLUE,
        12,
      ),
      'cobalt',
      `UpperArm_${side}`,
      { rigid: true },
    );

    // Forearm suit + Rigid Silver Forearm Armor & Dark Elbow Cup (z: 0 -> -0.25)
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.02, yb: -0.044, yt: 0.044, hwBot: 0.042, hwMid: 0.046, hwTop: 0.042, power: 2.0 },
          { z: -0.13, yb: -0.038, yt: 0.038, hwBot: 0.038, hwMid: 0.042, hwTop: 0.038, power: 2.0 },
          { z: -0.25, yb: -0.032, yt: 0.032, hwBot: 0.034, hwMid: 0.036, hwTop: 0.034, power: 2.0 },
        ],
        UV_REGIONS.SUIT_GRAPHITE,
        16,
      ),
      'suit',
      `Forearm_${side}`,
      { rigid: false, parentBone: `UpperArm_${side}`, blendSpan: 0.05 },
    );
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.01, x: sx * 0.016, yb: -0.025, yt: 0.048, hwBot: 0.036, hwMid: 0.044, hwTop: 0.036, power: 2.6 },
          { z: -0.18, x: sx * 0.014, yb: -0.02, yt: 0.04, hwBot: 0.032, hwMid: 0.038, hwTop: 0.03, power: 2.6 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        12,
      ),
      'silver',
      `Forearm_${side}`,
      { rigid: true },
    );

    // Hand / Armored Racing Glove gripping handlebar
    const glove = buildLoftGeo(
      [
        { z: 0.01, yb: -0.026, yt: 0.028, hwBot: 0.034, hwMid: 0.04, hwTop: 0.034, power: 2.4 },
        { z: -0.08, yb: -0.028, yt: 0.026, hwBot: 0.036, hwMid: 0.042, hwTop: 0.036, power: 2.4 },
      ],
      UV_REGIONS.SUIT_GRAPHITE,
      12,
    );
    addSkinnedPart(glove, 'suit', `Hand_${side}`, { rigid: true });
  }

  // ---- 5. LEGS (Thigh_L/R, Shin_L/R, Foot_L/R — extending along -Z in bone space)
  for (const [side, sx] of [
    ['L', -1],
    ['R', 1],
  ] as const) {
    // Thigh (z: 0 -> -0.37)
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.03, yb: -0.078, yt: 0.078, hwBot: 0.068, hwMid: 0.078, hwTop: 0.068, power: 2.1 },
          { z: -0.18, yb: -0.068, yt: 0.068, hwBot: 0.06, hwMid: 0.068, hwTop: 0.06, power: 2.1 },
          { z: -0.37, yb: -0.056, yt: 0.056, hwBot: 0.052, hwMid: 0.058, hwTop: 0.052, power: 2.1 },
        ],
        UV_REGIONS.SUIT_GRAPHITE,
        18,
      ),
      'suit',
      `Thigh_${side}`,
      { rigid: false, parentBone: 'Pelvis', blendSpan: 0.07 },
    );

    // Cobalt Blue Outer Thigh Panel + Knee Slider
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: -0.04, x: sx * 0.032, yb: -0.045, yt: 0.065, hwBot: 0.042, hwMid: 0.052, hwTop: 0.042, power: 2.4 },
          { z: -0.34, x: sx * 0.028, yb: -0.04, yt: 0.055, hwBot: 0.038, hwMid: 0.046, hwTop: 0.038, power: 2.4 },
        ],
        UV_REGIONS.COBALT_BLUE,
        14,
      ),
      'cobalt',
      `Thigh_${side}`,
      { rigid: true },
    );

    // Shin / Calf (z: 0 -> -0.36) + Prominent Silver Calf/Shin Armor & Cobalt Knee Cap (Image 2!)
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.02, yb: -0.056, yt: 0.056, hwBot: 0.05, hwMid: 0.056, hwTop: 0.05, power: 2.1 },
          { z: -0.18, yb: -0.052, yt: 0.052, hwBot: 0.046, hwMid: 0.054, hwTop: 0.046, power: 2.1 },
          { z: -0.36, yb: -0.042, yt: 0.042, hwBot: 0.038, hwMid: 0.044, hwTop: 0.038, power: 2.1 },
        ],
        UV_REGIONS.SUIT_GRAPHITE,
        16,
      ),
      'suit',
      `Shin_${side}`,
      { rigid: false, parentBone: `Thigh_${side}`, blendSpan: 0.05 },
    );

    // Rigid Silver Calf / Lower-Leg Armor Shell (clearly visible from behind in Image 2!)
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: -0.10, x: sx * 0.01, yb: -0.048, yt: 0.058, hwBot: 0.048, hwMid: 0.056, hwTop: 0.048, power: 2.6 },
          { z: -0.32, x: sx * 0.008, yb: -0.042, yt: 0.048, hwBot: 0.042, hwMid: 0.048, hwTop: 0.042, power: 2.6 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        14,
      ),
      'silver',
      `Shin_${side}`,
      { rigid: true },
    );

    // Cobalt Blue Knee Slider & Ankle Trim on Shin
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.02, x: sx * 0.026, yb: -0.035, yt: 0.055, hwBot: 0.036, hwMid: 0.044, hwTop: 0.036, power: 2.5 },
          { z: -0.10, x: sx * 0.024, yb: -0.03, yt: 0.05, hwBot: 0.034, hwMid: 0.04, hwTop: 0.034, power: 2.5 },
        ],
        UV_REGIONS.COBALT_BLUE,
        12,
      ),
      'cobalt',
      `Shin_${side}`,
      { rigid: true },
    );

    // Armored Racing Boot on Foot bone
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.04, yb: -0.042, yt: 0.045, hwBot: 0.044, hwMid: 0.05, hwTop: 0.042, power: 2.6 },
          { z: -0.14, yb: -0.042, yt: 0.025, hwBot: 0.04, hwMid: 0.044, hwTop: 0.035, power: 2.6 },
        ],
        UV_REGIONS.SUIT_GRAPHITE,
        14,
      ),
      'suit',
      `Foot_${side}`,
      { rigid: true },
    );
    // Silver Heel Cup on Boot
    addSkinnedPart(
      buildLoftGeo(
        [
          { z: 0.05, yb: -0.038, yt: 0.035, hwBot: 0.044, hwMid: 0.052, hwTop: 0.044, power: 2.8 },
          { z: -0.01, yb: -0.038, yt: 0.028, hwBot: 0.042, hwMid: 0.048, hwTop: 0.04, power: 2.8 },
        ],
        UV_REGIONS.ARMOR_SILVER,
        12,
      ),
      'silver',
      `Foot_${side}`,
      { rigid: true },
    );
  }

  // Merge all rider sub-geometries into a single multi-material BufferGeometry with material groups
  const matOrder: { key: keyof typeof partsByMat; mat: THREE.Material }[] = [
    { key: 'suit', mat: mats.suit },
    { key: 'silver', mat: mats.armorSilver },
    { key: 'cobalt', mat: mats.cobalt },
    { key: 'cyan', mat: mats.cyanGlow },
    { key: 'visor', mat: mats.visor },
  ];

  const groupGeos: THREE.BufferGeometry[] = [];
  const matArray: THREE.Material[] = [];
  for (const { key, mat } of matOrder) {
    if (!partsByMat[key].length) continue;
    groupGeos.push(mergeGeometries(partsByMat[key], false));
    matArray.push(mat);
  }
  const combinedRiderGeo = mergeGeometries(groupGeos, true);
  try {
    combinedRiderGeo.computeTangents();
  } catch {
    /* ignore */
  }
  sanitizeTangents(combinedRiderGeo);

  const skeleton = new THREE.Skeleton(boneList);
  const riderMesh = new THREE.SkinnedMesh(combinedRiderGeo, matArray);
  riderMesh.name = 'Rider_SkinnedMesh';
  riderMesh.frustumCulled = false;
  riderMesh.bind(skeleton, new THREE.Matrix4());

  return { riderMesh, skeleton, bones, pelvis };
}

// Reusable math objects for zero-GC runtime pose & 2-bone IK solving
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();

/**
 * Analytical 2-Bone Inverse Kinematics solver where each bone extends by `len1` / `len2` along its local `-Z` axis.
 * Guarantees hands stay locked to handlebar grips and feet stay locked to footpegs in every pose!
 */
function solveTwoBoneIK(
  bone1: THREE.Bone,
  bone2: THREE.Bone,
  endBone: THREE.Bone,
  len1: number,
  len2: number,
  targetChassisPos: THREE.Vector3,
  poleChassisOffset: THREE.Vector3,
  endEulerOffset: [number, number, number],
) {
  bone1.parent?.updateMatrixWorld(true);
  bone1.updateMatrixWorld(true);
  const rootPos = _vA.setFromMatrixPosition(bone1.matrixWorld);
  const diff = _vB.copy(targetChassisPos).sub(rootPos);
  const dist = Math.max(0.04, Math.min(len1 + len2 - 0.004, diff.length()));
  const dir = diff.normalize();

  // Law of cosines for the interior angle at bone1 (alpha)
  const cosAlpha = Math.max(
    -1,
    Math.min(1, (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist)),
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Orthogonalize pole direction perpendicular to dir
  const pole = _vPole.copy(poleChassisOffset).addScaledVector(dir, -poleChassisOffset.dot(dir));
  if (pole.lengthSq() < 1e-6) pole.set(0, 1, 0);
  pole.normalize();

  // Exact joint2 (elbow / knee) position in chassis space
  const joint2Pos = _vC
    .copy(rootPos)
    .addScaledVector(dir, len1 * cosAlpha)
    .addScaledVector(pole, len1 * sinAlpha);

  // Orient bone1 so its local -Z points from rootPos to joint2Pos, and local +Y aligns toward pole
  const aim1 = _zAxis.copy(rootPos).sub(joint2Pos).normalize(); // +Z = -forward
  const right1 = _xAxis.crossVectors(pole, aim1).normalize();
  const up1 = _yAxis.crossVectors(aim1, right1).normalize();
  _m4.makeBasis(right1, up1, aim1);
  _qWorld.setFromRotationMatrix(_m4);

  if (bone1.parent) {
    bone1.parent.getWorldQuaternion(_qParent);
    bone1.quaternion.copy(_qParent).invert().multiply(_qWorld);
  } else {
    bone1.quaternion.copy(_qWorld);
  }
  bone1.updateMatrixWorld(true);

  // Orient bone2 so its local -Z points from joint2Pos to targetChassisPos
  const aim2 = _zAxis.copy(joint2Pos).sub(targetChassisPos).normalize();
  const right2 = _xAxis.crossVectors(pole, aim2).normalize();
  const up2 = _yAxis.crossVectors(aim2, right2).normalize();
  _m4.makeBasis(right2, up2, aim2);
  _qWorld.setFromRotationMatrix(_m4);

  bone1.getWorldQuaternion(_qParent);
  bone2.quaternion.copy(_qParent).invert().multiply(_qWorld);
  bone2.updateMatrixWorld(true);

  endBone.rotation.set(endEulerOffset[0], endEulerOffset[1], endEulerOffset[2]);
  endBone.updateMatrixWorld(true);
}

const _gripTargetL = new THREE.Vector3();
const _gripTargetR = new THREE.Vector3();
const _pegTargetL = new THREE.Vector3();
const _pegTargetR = new THREE.Vector3();
const _poleL = new THREE.Vector3();
const _poleR = new THREE.Vector3();

/**
 * Evaluates and applies the complete Motorcycle + Rider pose from normalized state parameters.
 *  - StraightRide: upright bike, athletic sport riding posture (Image 1 & Image 2).
 *  - LeanLeft / LeanRight: bike banks ±28°, rider shifts torso/head inside turn, inside knee opens (Image 4 & Image 6).
 *  - AirborneJump: bike pitches nose-up slightly, suspension extends, rider rises slightly on pegs (Image 5).
 *  - DownSlide: motorcycle banks nearly horizontal (~60° roll around low road contact pivot) while rider
 *    presses chest flat against tank, lowers head/shoulders, and tucks limbs tightly to reduce true height (Image 3).
 *  - LowTuck: motorcycle upright while rider is tucked low against the tank (Image 7 / transitional state).
 */
export function applyBikeRiderPose(rig: {
  leanPivot: THREE.Group;
  pitchPivot: THREE.Group;
  steeringPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  bones: Record<string, THREE.Bone>;
}, p: BikePoseParams) {
  const lean = Math.max(-1.2, Math.min(1.2, p.lean));
  const air = Math.max(0, Math.min(1, p.air));
  const downSlide = Math.max(0, Math.min(1, p.downSlide));
  const lowTuck = Math.max(0, Math.min(1, Math.max(p.lowTuck, downSlide)));
  const slideSide = p.slideSide ?? -1; // -1 banks left side down so right-side exhaust & armor face up/camera clearly (Image 3)
  const pitch = p.pitch ?? 0;
  const t = p.time ?? 0;

  // 1. Motorcycle Lean & DownSlide Banking (around LeanPivot at y = 0.08 m)
  // In -Z forward, +Y up, +X right: positive Z rotation banks LEFT (-X), negative Z rotation banks RIGHT (+X).
  const turnBankZ = -lean * 0.49; // ~28° bank on lane changes (Images 4 & 6)
  // Image 3 DOWN SLIDE: motorcycle banks nearly horizontal (~68° = 1.18 rad) so bike & rider drop below 0.95 m barrier
  const slideBankZ = -slideSide * 1.18 * downSlide;
  const totalBankZ = turnBankZ * (1 - downSlide * 0.7) + slideBankZ;

  // Keep the tyre edge grounded on the road (y = 0) during deep DownSlide banking, and center the mass in the lane
  rig.leanPivot.position.set(
    -slideSide * 0.28 * downSlide + lean * 0.06 * (1 - downSlide),
    0.08 + 0.02 * downSlide,
    0,
  );
  rig.leanPivot.rotation.set(0, -lean * 0.05 * (1 - downSlide), totalBankZ);

  // 2. Pitch & Airborne Suspension Extension
  const airPitch = air * 0.14 + pitch;
  const roadBuzz = Math.sin(t * 36) * 0.004 * (1 - air);
  rig.pitchPivot.position.set(0, 0.25 + air * 0.03 + roadBuzz, 0);
  rig.pitchPivot.rotation.set(airPitch, 0, 0);

  // 3. Steering Handlebar counter-steer / turn
  const steerYaw = -lean * 0.12 * (1 - downSlide) + slideSide * 0.08 * downSlide;
  rig.steeringPivot.rotation.set(0, steerYaw, 0);

  // 4. Wheel Spin
  if (p.wheelSpin !== undefined) {
    rig.frontWheelSpin.rotation.x = -p.wheelSpin;
    rig.rearWheelSpin.rotation.x = -p.wheelSpin;
  }

  // 5. Rider Pelvis & Spine Posture (in Chassis space)
  const b = rig.bones;
  // Secondary motion so the rider never looks frozen: slow breathing, road buzz through the shoulders,
  // small head glances down the road (all fade out in the air / slide where the body is braced).
  const calm = (1 - air) * (1 - downSlide);
  const breathe = Math.sin(t * 1.9) * 0.012 + Math.sin(t * 3.2) * 0.004;
  const buzz = Math.sin(t * 11.3) * 0.004 * calm;
  const glanceYaw = (Math.sin(t * 0.61) * 0.05 + Math.sin(t * 1.73) * 0.015) * calm;
  const glancePitch = Math.sin(t * 1.07) * 0.02 * calm;

  // Pelvis shifts slightly inside the turn during LeanLeft/LeanRight, rises on pegs in AirborneJump,
  // and slides back/low in LowTuck / DownSlide so the chest lies flat against the fuel tank!
  const pelvisX =
    lean * 0.09 * (1 - downSlide) + -slideSide * 0.065 * downSlide;
  const pelvisY =
    BIKE_ERGO.pelvisY + air * 0.048 - lowTuck * 0.035 - downSlide * 0.06;
  const pelvisZ =
    BIKE_ERGO.pelvisZ + lowTuck * 0.05 + downSlide * 0.02 - air * 0.02;

  b.Pelvis.position.set(pelvisX, pelvisY, pelvisZ);
  // Forward pelvis tilt: ~0.34 rad in normal riding, ~0.88 rad in DownSlide
  const pelvisPitch = -0.56 - lowTuck * 0.2 - downSlide * 0.1 - air * 0.08 + breathe;
  const pelvisRoll = -lean * 0.10 * (1 - downSlide) + slideSide * 0.12 * downSlide;
  const pelvisYaw = -lean * 0.08 * (1 - downSlide) - slideSide * 0.06 * downSlide;
  b.Pelvis.rotation.set(pelvisPitch, pelvisYaw, pelvisRoll);

  // Spine segments flex forward in LowTuck & DownSlide so chest presses flat against the fuel tank
  const spineFlex = -0.22 - lowTuck * 0.08 - downSlide * 0.05;
  // hang off into the turn: the upper body leans further than the bike
  const spineLeanRoll = -lean * 0.13 * (1 - downSlide) + slideSide * 0.06 * downSlide + buzz;
  b.Spine_1.rotation.set(spineFlex, 0, spineLeanRoll);
  b.Spine_2.rotation.set(spineFlex * 1.05, 0, spineLeanRoll);
  b.Chest.rotation.set(spineFlex * 0.95 - breathe, -lean * 0.05, spineLeanRoll);

  // Neck & Head counter-pitch upward so the helmet stays tucked right behind the windscreen looking down the road!
  // Auto-level the helmet: neck + head cancel the whole torso pitch so the rider always looks down the road
  // (chin just above the tank in LowTuck instead of the head folding into the bodywork).
  const torsoPitch = pelvisPitch + spineFlex * 3.0;
  const neckPitch = Math.max(0.35, (-torsoPitch - 0.12) / 1.07) + air * 0.04;
  b.Neck.rotation.set(neckPitch * 0.55, 0, 0);
  // keep the eyes level with the horizon while the bike banks
  const headCounterRoll = lean * 0.38 * (1 - downSlide) - slideSide * 0.14 * downSlide;
  b.Head.rotation.set(neckPitch * 0.52 + glancePitch, -lean * 0.12 + glanceYaw, headCounterRoll);

  // Update full world transform hierarchy from LeanPivot down through ChassisOffset and Spine before solving IK!
  rig.leanPivot.updateMatrixWorld(true);
  const chassisMatWorld = b.Pelvis.parent ? b.Pelvis.parent.matrixWorld : rig.leanPivot.matrixWorld;

  // 6. Analytical 2-Bone IK for Arms -> Handlebar Grips (Hands stay attached to handlebars in banked chassis frame!)
  const cosS = Math.cos(steerYaw);
  const sinS = Math.sin(steerYaw);
  const gripLocalZ = BIKE_ERGO.gripLocalZ;
  const gripLocalX = BIKE_ERGO.gripX;
  _gripTargetL
    .set(
      -gripLocalX * cosS + gripLocalZ * sinS,
      BIKE_ERGO.gripY,
      -0.52 + gripLocalX * sinS + gripLocalZ * cosS,
    )
    .applyMatrix4(chassisMatWorld);
  _gripTargetR
    .set(
      gripLocalX * cosS + gripLocalZ * sinS,
      BIKE_ERGO.gripY,
      -0.52 - gripLocalX * sinS + gripLocalZ * cosS,
    )
    .applyMatrix4(chassisMatWorld);

  // Elbow pole vectors in chassis frame, transformed to world direction
  const elbowTuck = lowTuck * 0.45 + downSlide * 0.25;
  _poleL
    .set(-0.9 + elbowTuck * 0.5, -0.12 - elbowTuck * 0.3, 0.32)
    .transformDirection(chassisMatWorld);
  _poleR
    .set(0.9 - elbowTuck * 0.5, -0.12 - elbowTuck * 0.3, 0.32)
    .transformDirection(chassisMatWorld);

  solveTwoBoneIK(
    b.UpperArm_L,
    b.Forearm_L,
    b.Hand_L,
    0.27,
    0.25,
    _gripTargetL,
    _poleL,
    [0.15, 0.1, -0.2],
  );
  solveTwoBoneIK(
    b.UpperArm_R,
    b.Forearm_R,
    b.Hand_R,
    0.27,
    0.25,
    _gripTargetR,
    _poleR,
    [0.15, -0.1, 0.2],
  );

  // 7. Analytical 2-Bone IK for Legs -> Footpegs (Feet remain on footpegs in banked chassis frame!)
  _pegTargetL.set(-BIKE_ERGO.pegX, BIKE_ERGO.pegY, BIKE_ERGO.pegZ).applyMatrix4(chassisMatWorld);
  _pegTargetR.set(BIKE_ERGO.pegX, BIKE_ERGO.pegY, BIKE_ERGO.pegZ).applyMatrix4(chassisMatWorld);

  // Knee pole vectors in chassis frame, transformed to world direction
  const openLeftKnee = Math.max(0, -lean) * 0.38 * (1 - downSlide);
  const openRightKnee = Math.max(0, lean) * 0.38 * (1 - downSlide);
  const tightKnee = lowTuck * 0.12 + downSlide * 0.18;

  _poleL
    .set(-0.22 - openLeftKnee + tightKnee, 0.35 - lowTuck * 0.18, -0.92)
    .transformDirection(chassisMatWorld);
  _poleR
    .set(0.22 + openRightKnee - tightKnee, 0.35 - lowTuck * 0.18, -0.92)
    .transformDirection(chassisMatWorld);

  solveTwoBoneIK(
    b.Thigh_L,
    b.Shin_L,
    b.Foot_L,
    0.37,
    0.36,
    _pegTargetL,
    _poleL,
    [-0.95, 0, 0],
  );
  solveTwoBoneIK(
    b.Thigh_R,
    b.Shin_R,
    b.Foot_R,
    0.37,
    0.36,
    _pegTargetR,
    _poleR,
    [-0.95, 0, 0],
  );
}

/**
 * Generates all 6 required in-place AnimationClips for `models/bike_rider.glb` and runtime playback:
 *  1. StraightRide
 *  2. LeanLeft
 *  3. LeanRight
 *  4. AirborneJump
 *  5. DownSlide (primary Down pose — Image 3)
 *  6. LowTuck (upright low tuck — Image 7, transitional/optional clip)
 */
export function buildBikeRiderAnimations(rig: {
  leanPivot: THREE.Group;
  pitchPivot: THREE.Group;
  steeringPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  bones: Record<string, THREE.Bone>;
}): THREE.AnimationClip[] {
  const clips: THREE.AnimationClip[] = [];
  const animatedNodes: THREE.Object3D[] = [
    rig.leanPivot,
    rig.pitchPivot,
    rig.steeringPivot,
    rig.frontWheelSpin,
    rig.rearWheelSpin,
    ...Object.values(rig.bones),
  ];

  const bakeClip = (
    name: BikePoseName,
    duration: number,
    steps: number,
    poseAt: (u: number) => BikePoseParams,
  ) => {
    const times = new Float32Array(steps);
    const posTracks = new Map<string, Float32Array>();
    const quatTracks = new Map<string, Float32Array>();

    for (const node of animatedNodes) {
      posTracks.set(node.name, new Float32Array(steps * 3));
      quatTracks.set(node.name, new Float32Array(steps * 4));
    }

    for (let s = 0; s < steps; s++) {
      const u = steps > 1 ? s / (steps - 1) : 0;
      times[s] = u * duration;
      applyBikeRiderPose(rig, poseAt(u));
      for (const node of animatedNodes) {
        const pArr = posTracks.get(node.name)!;
        pArr[s * 3] = node.position.x;
        pArr[s * 3 + 1] = node.position.y;
        pArr[s * 3 + 2] = node.position.z;

        const qArr = quatTracks.get(node.name)!;
        qArr[s * 4] = node.quaternion.x;
        qArr[s * 4 + 1] = node.quaternion.y;
        qArr[s * 4 + 2] = node.quaternion.z;
        qArr[s * 4 + 3] = node.quaternion.w;
      }
    }

    const tracks: THREE.KeyframeTrack[] = [];
    for (const node of animatedNodes) {
      tracks.push(
        new THREE.VectorKeyframeTrack(`${node.name}.position`, times, posTracks.get(node.name)!),
        new THREE.QuaternionKeyframeTrack(
          `${node.name}.quaternion`,
          times,
          quatTracks.get(node.name)!,
        ),
      );
    }
    clips.push(new THREE.AnimationClip(name, duration, tracks));
  };

  // 1. StraightRide (Image 1 & Image 2)
  bakeClip('StraightRide', 1.0, 16, (u) => ({
    lean: 0,
    air: 0,
    downSlide: 0,
    lowTuck: 0,
    wheelSpin: u * Math.PI * 4,
    time: u * 1.0,
  }));

  // 2. LeanLeft (Image 6)
  bakeClip('LeanLeft', 1.0, 16, (u) => ({
    lean: -1.0,
    air: 0,
    downSlide: 0,
    lowTuck: 0.15,
    wheelSpin: u * Math.PI * 4,
    time: u * 1.0,
  }));

  // 3. LeanRight (Image 4)
  bakeClip('LeanRight', 1.0, 16, (u) => ({
    lean: 1.0,
    air: 0,
    downSlide: 0,
    lowTuck: 0.15,
    wheelSpin: u * Math.PI * 4,
    time: u * 1.0,
  }));

  // 4. AirborneJump (Image 5 — conventional two-wheel motorcycle in mid-air, no wings/flight engines)
  bakeClip('AirborneJump', 1.0, 16, (u) => ({
    lean: 0,
    air: 1.0,
    downSlide: 0,
    lowTuck: 0.2,
    pitch: 0.08 * Math.cos(u * Math.PI),
    wheelSpin: u * Math.PI * 2,
    time: u * 1.0,
  }));

  // 5. DownSlide (Image 3 — extremely low slide beneath overhead barrier, motorcycle banked ~60° horizontal, rider tucked flat)
  bakeClip('DownSlide', 1.0, 16, (u) => ({
    lean: 0,
    air: 0,
    downSlide: 1.0,
    lowTuck: 1.0,
    slideSide: -1,
    wheelSpin: u * Math.PI * 4,
    time: u * 1.0,
  }));

  // 6. LowTuck (Image 7 — low tuck with the motorcycle upright; transitional / separate clip)
  bakeClip('LowTuck', 1.0, 16, (u) => ({
    lean: 0,
    air: 0,
    downSlide: 0,
    lowTuck: 1.0,
    wheelSpin: u * Math.PI * 4,
    time: u * 1.0,
  }));

  // Restore default StraightRide bind pose after baking
  applyBikeRiderPose(rig, { lean: 0, air: 0, downSlide: 0, lowTuck: 0, wheelSpin: 0, time: 0 });
  return clips;
}

export function createBikeRiderMaterials(textures?: BikeRiderPBRTextures | number): {
  materials: BikeRiderMaterials;
  textures: BikeRiderPBRTextures;
} {
  const tex =
    typeof textures === 'number' || !textures
      ? getRuntimePBRTextures(typeof textures === 'number' ? textures : 256)
      : textures;
  const commonMaps = {
    map: tex.baseColor,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: tex.orm,
    metalnessMap: tex.orm,
    aoMap: tex.orm,
    aoMapIntensity: 0.75,
  };

  const suit = new THREE.MeshStandardMaterial({
    name: 'Mat_RiderSuit_Graphite',
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.15,
    ...commonMaps,
  });

  const armorSilver = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Titanium_Silver',
    color: 0xffffff,
    roughness: 0.30,
    metalness: 0.90,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
    ...commonMaps,
  });

  const cobalt = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Cobalt_Blue',
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.62,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
    ...commonMaps,
  });

  const tyre = new THREE.MeshStandardMaterial({
    name: 'Mat_Sport_Tyre',
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.05,
    ...commonMaps,
  });

  const mechDark = new THREE.MeshStandardMaterial({
    name: 'Mat_Mechanical_Gunmetal',
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.88,
    ...commonMaps,
  });

  const forkGold = new THREE.MeshStandardMaterial({
    name: 'Mat_Fork_Gold',
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.95,
    ...commonMaps,
  });

  const visor = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Smoked_Visor',
    color: 0x101828,
    roughness: 0.06,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });

  const mirror = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Mirror_Glass',
    color: 0xbce6ff,
    roughness: 0.03,
    metalness: 0.98,
    emissive: new THREE.Color(0x1b4568),
    emissiveIntensity: 0.35,
  });

  const cyanGlow = new THREE.MeshStandardMaterial({
    name: 'Mat_Cyan_Emissive',
    color: 0x12e0ff,
    emissive: new THREE.Color(0x0ad4ff),
    emissiveMap: tex.emissive,
    emissiveIntensity: 1.15,
    roughness: 0.18,
    metalness: 0.08,
  });

  const redGlow = new THREE.MeshStandardMaterial({
    name: 'Mat_Red_Emissive',
    color: 0xff1e38,
    emissive: new THREE.Color(0xff142e),
    emissiveMap: tex.emissive,
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.08,
  });

  const riderSuit = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Rider_Leather',
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  });
  const riderHelmet = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Rider_HelmetPearl',
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const riderArmor = new THREE.MeshPhysicalMaterial({
    name: 'Mat_Rider_Titanium',
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
  });
  const riderGlow = new THREE.MeshStandardMaterial({
    name: 'Mat_Rider_CyanGlow',
    color: 0x12e0ff,
    emissive: new THREE.Color(0x0ad4ff),
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.0,
  });

  const bikePaint = new THREE.MeshPhysicalMaterial({ name: 'Mat_Bike_Paint', vertexColors: true, roughness: 0.32, metalness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.12, iridescence: 0.18, iridescenceIOR: 1.4 });
  const bikeSeat = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Seat', color: 0x15171b, roughness: 0.78, metalness: 0.0 });
  const bikeBlack = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_MattePlastic', color: 0x1a1d22, roughness: 0.62, metalness: 0.15 });
  const bikeGloss = new THREE.MeshPhysicalMaterial({ name: 'Mat_Bike_GlossBlack', color: 0x0d0f13, roughness: 0.32, metalness: 0.6, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const bikeAlu = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Aluminium', color: 0xb6bcc6, roughness: 0.34, metalness: 0.92 });
  const bikeChrome = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Exhaust', color: 0xc9ced6, roughness: 0.22, metalness: 1.0 });
  const bikeGold = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Gold', color: 0xd9a441, roughness: 0.28, metalness: 1.0 });
  const bikeTyre = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Tyre', color: 0x17191d, roughness: 0.88, metalness: 0.0 });
  const bikeSteel = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_Rotor', color: 0xa9afb8, roughness: 0.38, metalness: 0.95 });
  const bikeBlue = new THREE.MeshPhysicalMaterial({ name: 'Mat_Bike_RimBlue', color: 0x1d56f2, roughness: 0.3, metalness: 0.4, clearcoat: 1.0 });
  const bikeRed = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_BrakeLight', color: 0xff2238, emissive: new THREE.Color(0xff1a30), emissiveIntensity: 1.6, roughness: 0.3 });
  const bikeScreen = new THREE.MeshPhysicalMaterial({ name: 'Mat_Bike_Screen', color: 0x2a3444, roughness: 0.04, metalness: 0.0, clearcoat: 1.0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

  const bikeLens = new THREE.MeshStandardMaterial({ name: 'Mat_Bike_LampLens', color: 0x1aa7c4, emissive: new THREE.Color(0x19d2ff), emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.1 });
  const bikeCaliper = new THREE.MeshPhysicalMaterial({ name: 'Mat_Bike_Caliper', color: 0xb3121f, roughness: 0.32, metalness: 0.45, clearcoat: 0.8 });

  return {
    textures: tex,
    materials: {
      bikeLens, bikeCaliper,
      bikePaint, bikeSeat, bikeBlack, bikeGloss, bikeAlu, bikeChrome, bikeGold, bikeTyre, bikeSteel, bikeBlue, bikeRed, bikeScreen,
      riderSuit,
      riderHelmet,
      riderArmor,
      riderGlow,
      suit,
      armorSilver,
      cobalt,
      tyre,
      mechDark,
      forkGold,
      visor,
      mirror,
      cyanGlow,
      redGlow,
    },
  };
}

/**
 * Builds the complete hierarchical 3D Futuristic Motorcycle & Rider asset.
 */
/**
 * @param lod 0 = full detail (garage / close camera), 1 = gameplay, 2 = low-end phones
 */
export function buildBikeRiderAsset(customTextures?: BikeRiderPBRTextures | number, lod = 0): BikeRiderRig {
  const { materials, textures } = createBikeRiderMaterials(customTextures);

  const root = new THREE.Group();
  root.name = 'BikeRiderRoot';

  const leanPivot = new THREE.Group();
  leanPivot.name = 'LeanPivot';
  leanPivot.position.set(0, 0.08, 0);
  root.add(leanPivot);

  const pitchPivot = new THREE.Group();
  pitchPivot.name = 'PitchPivot';
  pitchPivot.position.set(0, 0.25, 0);
  leanPivot.add(pitchPivot);

  // Chassis & Rider live inside PitchPivot; their coordinates are authored in ground-zero chassis space,
  // so we offset chassisWrapper by (0, -0.33, 0) to align ground=0 with LeanPivot(0.08) + PitchPivot(0.25) = 0.33 m
  const chassisOffset = new THREE.Group();
  chassisOffset.name = 'ChassisOffset';
  chassisOffset.position.set(0, -0.33, 0);
  pitchPivot.add(chassisOffset);

  const { chassisGroup, steeringPivot, frontWheelSpin, rearWheelSpin, swingarmGroup } =
    buildSportBike(materials, lod);
  chassisOffset.add(chassisGroup);

  const { riderMesh, skeleton, bones, pelvis } = buildHumanRider(materials, lod);
  chassisOffset.add(pelvis);
  chassisOffset.add(riderMesh);

  const rigCore = {
    leanPivot,
    pitchPivot,
    steeringPivot,
    frontWheelSpin,
    rearWheelSpin,
    bones,
  };

  const animations = buildBikeRiderAnimations(rigCore);

  return {
    root,
    leanPivot,
    pitchPivot,
    chassisGroup,
    steeringPivot,
    frontWheelSpin,
    rearWheelSpin,
    swingarmGroup,
    riderMesh,
    skeleton,
    bones,
    materials,
    textures,
    animations,
    applyPose: (params: BikePoseParams) => applyBikeRiderPose(rigCore, params),
  };
}
