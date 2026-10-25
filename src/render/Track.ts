import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glowTexture, roadTexture } from './textures.ts';

const ROAD_LEN = 300;
const ROAD_NEAR = 30;
const TILE = 12; // metres per road texture tile
/** side wall: post spacing (m) and height (m) */
const WALL_RIB = 4;
const WALL_H = 1.25;
const tmpWhite = new THREE.Color(0xffffff);

/** Wrap a scrolling object into [near - range, near). */
export const wrapZ = (base: number, dist: number, range: number, near: number) => {
  const z = (((base + dist) % range) + range) % range; // 0..range
  return near - range + z;
};

/**
 * Elevated sky-highway. The road never moves — its textures scroll, and props
 * (rails, lamps, pylons) are repositioned by modulo, so there is zero spawning.
 */
export class Track {
  group = new THREE.Group();
  private roadTex: THREE.Texture;
  private railTex: THREE.CanvasTexture;
  private lampSlots: { side: number; base: number }[] = [];
  private lampBodies!: THREE.InstancedMesh;
  private lampHeads!: THREE.InstancedMesh;
  private lampGlows!: THREE.Points;
  private pylonBodies!: THREE.InstancedMesh;
  private pylonRings!: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private rotY = new THREE.Matrix4().makeRotationY(Math.PI);
  private lampSpacing = 24;
  private pylonSpacing = 48;
  roadMat: THREE.MeshStandardMaterial;
  railGlowMat: THREE.MeshBasicMaterial;
  accent = new THREE.Color(0x39b6ff);
  private wallTexL!: THREE.Texture;
  private wallTexR!: THREE.Texture;
  private wallMats: THREE.MeshBasicMaterial[] = [];

  constructor() {
    this.roadTex = roadTexture().clone();
    this.roadTex.needsUpdate = true;
    this.roadTex.repeat.set(1, ROAD_LEN / TILE);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex,
      emissive: 0xffffff,
      emissiveMap: this.roadTex,
      emissiveIntensity: 0.6,
      roughness: 0.42,
      metalness: 0.5,
      envMapIntensity: 0.25,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8.6, ROAD_LEN), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = ROAD_NEAR - ROAD_LEN / 2;
    this.group.add(road);

    // deck underside / thickness
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x2a3146, roughness: 0.6, metalness: 0.6 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.9, ROAD_LEN), deckMat);
    deck.position.set(0, -0.47, ROAD_NEAR - ROAD_LEN / 2);
    this.group.add(deck);

    // rails with scrolling light dashes
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a1a33';
    g.fillRect(0, 0, 16, 256);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 16, 150);
    this.railTex = new THREE.CanvasTexture(c);
    this.railTex.wrapS = this.railTex.wrapT = THREE.RepeatWrapping;
    this.railTex.repeat.set(1, ROAD_LEN / 8);
    this.railGlowMat = new THREE.MeshBasicMaterial({ color: 0x39b6ff, map: this.railTex, toneMapped: false });
    this.sideGlowMat = new THREE.MeshBasicMaterial({ color: 0x39b6ff, toneMapped: false });
    const railBody = new THREE.MeshStandardMaterial({ color: 0xc9d2e3, roughness: 0.3, metalness: 0.8 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, ROAD_LEN), railBody);
      rail.position.set(4.45 * s, 0.27, ROAD_NEAR - ROAD_LEN / 2);
      this.group.add(rail);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, ROAD_LEN), this.railGlowMat);
      strip.rotation.set(-Math.PI / 2, 0, 0);
      strip.position.set(4.45 * s, 0.56, ROAD_NEAR - ROAD_LEN / 2);
      this.group.add(strip);
      const side = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, 0.12), this.sideGlowMat);
      side.rotation.y = (Math.PI / 2) * -s;
      side.position.set(4.63 * s, 0.3, ROAD_NEAR - ROAD_LEN / 2);
      this.group.add(side);
      const under = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, 0.1), this.sideGlowMat);
      under.rotation.y = (Math.PI / 2) * -s;
      under.position.set(4.71 * s, -0.6, ROAD_NEAR - ROAD_LEN / 2);
      this.group.add(under);
    }

    // SIDE WALLS: tinted glass barrier panels on top of the rails with steel posts every
    // WALL_RIB metres and a light strip. They scroll with the road: the posts flashing past at the
    // edge of the screen are the strongest cue of speed (like a highway sound wall).
    {
      const wc = document.createElement('canvas');
      wc.width = 128;
      wc.height = 64;
      const w = wc.getContext('2d')!;
      const grd = w.createLinearGradient(0, 0, 0, 64);
      grd.addColorStop(0, 'rgba(40,70,120,0.55)');
      grd.addColorStop(1, 'rgba(8,14,30,0.78)');
      w.fillStyle = grd;
      w.fillRect(0, 0, 128, 64);
      w.fillStyle = 'rgba(255,255,255,0.95)'; // top light strip
      w.fillRect(0, 2, 128, 4);
      w.fillStyle = 'rgba(255,255,255,0.35)'; // mid dashed strip
      w.fillRect(18, 34, 90, 2);
      w.fillStyle = '#1b2234'; // steel post
      w.fillRect(0, 0, 12, 64);
      w.fillStyle = '#8a97b3';
      w.fillRect(2, 0, 3, 64);
      const wallTex = new THREE.CanvasTexture(wc);
      wallTex.colorSpace = THREE.SRGBColorSpace;
      wallTex.wrapS = THREE.RepeatWrapping;
      wallTex.anisotropy = 8;
      this.wallTexL = wallTex;
      this.wallTexR = wallTex.clone();
      this.wallTexR.needsUpdate = true;
      for (const [s2, tex] of [[-1, this.wallTexL], [1, this.wallTexR]] as const) {
        tex.repeat.set(ROAD_LEN / WALL_RIB, 1);
        const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        this.wallMats.push(mat);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, WALL_H), mat);
        wall.rotation.y = (Math.PI / 2) * -s2;
        wall.position.set(4.5 * s2, 0.55 + WALL_H / 2, ROAD_NEAR - ROAD_LEN / 2);
        wall.renderOrder = 1;
        this.group.add(wall);
      }
    }

    // lamp posts — instanced (2 meshes + 1 Points for the glows, whatever the count)
    const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8);
    postGeo.translate(0, 1.8, 0);
    const armGeo = new THREE.BoxGeometry(0.9, 0.08, 0.14);
    armGeo.translate(-0.4, 3.55, 0);
    const bodyGeo = mergeGeometries([postGeo.toNonIndexed(), armGeo.toNonIndexed()])!;
    const headGeo = new RoundedBoxGeometry(0.5, 0.1, 0.24, 2, 0.04);
    headGeo.translate(-0.75, 3.5, 0);
    // lamp heads: soft, tone-mapped (no glare strobing past the camera)
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x7f93a6 });
    const n = Math.ceil(ROAD_LEN / this.lampSpacing) * 2;
    this.lampBodies = new THREE.InstancedMesh(bodyGeo, railBody, n);
    this.lampHeads = new THREE.InstancedMesh(headGeo, lampMat, n);
    for (const im of [this.lampBodies, this.lampHeads]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      this.group.add(im);
    }
    for (let i = 0; i < n; i++) {
      const s = i % 2 === 0 ? -1 : 1;
      this.lampSlots.push({ side: s, base: Math.floor(i / 2) * this.lampSpacing + (s > 0 ? this.lampSpacing / 2 : 0) });
    }
    const glowPos = new Float32Array(n * 3);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lampGlows = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({ map: glowTexture(), color: 0x9fdcff, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.lampGlows.frustumCulled = false;
    this.group.add(this.lampGlows);

    // support pylons dropping into the cloud sea — instanced
    const pylonGeo = new THREE.CylinderGeometry(1.1, 1.6, 40, 10);
    pylonGeo.translate(0, -21, 0);
    const capGeo = new THREE.BoxGeometry(6, 1.2, 2.4);
    capGeo.translate(0, -1.4, 0);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x3a4460, roughness: 0.5, metalness: 0.6 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x39b6ff, toneMapped: false });
    const r1 = new THREE.TorusGeometry(1.25, 0.08, 6, 24);
    r1.rotateX(Math.PI / 2);
    const r2 = r1.clone();
    r1.translate(0, -4, 0);
    r2.translate(0, -9, 0);
    const pn = Math.ceil(ROAD_LEN / this.pylonSpacing);
    this.pylonBodies = new THREE.InstancedMesh(mergeGeometries([pylonGeo.toNonIndexed(), capGeo.toNonIndexed()])!, pylonMat, pn);
    this.pylonRings = new THREE.InstancedMesh(mergeGeometries([r1, r2])!, ringMat, pn);
    for (const im of [this.pylonBodies, this.pylonRings]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.ringMat = ringMat;
  }
  private ringMat: THREE.MeshBasicMaterial;
  private sideGlowMat: THREE.MeshBasicMaterial;

  setAccent(c: THREE.Color) {
    this.accent.copy(c);
    this.railGlowMat.color.copy(c);
    this.ringMat.color.copy(c);
    this.sideGlowMat.color.copy(c);
    // walls take a light tint of the world's accent (strip + glass)
    for (const m of this.wallMats) m.color.copy(c).lerp(tmpWhite, 0.55);
  }

  /** Apply a world's readability profile (lane glow, road tone, reflections, rail glow). */
  applyReadability(r: { roadGlow: number; roadTone: number; roadEnv: number; rails: number }) {
    this.roadMat.emissiveIntensity = r.roadGlow;
    this.roadMat.color.setScalar(r.roadTone);
    this.roadMat.envMapIntensity = r.roadEnv;
    this.railGlowMat.color.copy(this.accent).multiplyScalar(r.rails);
    this.sideGlowMat.color.copy(this.accent).multiplyScalar(r.rails);
  }

  /** Show/hide props that only make sense on the open sky highway. */
  setOpenAir(on: boolean) {
    this.lampBodies.visible = this.lampHeads.visible = on;
    this.lampGlows.visible = false; // glow halos removed (eye comfort)
    this.pylonBodies.visible = this.pylonRings.visible = on;
  }

  update(dist: number) {
    this.roadTex.offset.y = (dist / TILE) % 1;
    this.railTex.offset.y = (dist / 8) % 1;
    // walls: the two planes face opposite ways, so their texture runs in opposite directions
    this.wallTexL.offset.x = -((dist / WALL_RIB) % 1);
    this.wallTexR.offset.x = (dist / WALL_RIB) % 1;
    const lampRange = Math.ceil(ROAD_LEN / this.lampSpacing) * this.lampSpacing;
    const gp = this.lampGlows.geometry.attributes.position as THREE.BufferAttribute;
    this.lampSlots.forEach((l, i) => {
      const z = wrapZ(l.base, dist, lampRange, ROAD_NEAR);
      // lamps on the left are the right-hand lamp rotated 180° (arm points at the road)
      if (l.side > 0) this.m4.makeTranslation(4.75, 0, z);
      else this.m4.copy(this.rotY).setPosition(-4.75, 0, z);
      this.lampBodies.setMatrixAt(i, this.m4);
      this.lampHeads.setMatrixAt(i, this.m4);
      gp.setXYZ(i, l.side * (4.75 - 0.75), 3.4, z);
    });
    gp.needsUpdate = true;
    this.lampBodies.instanceMatrix.needsUpdate = true;
    this.lampHeads.instanceMatrix.needsUpdate = true;
    const pn = this.pylonBodies.count;
    const pr = pn * this.pylonSpacing;
    for (let i = 0; i < pn; i++) {
      this.m4.makeTranslation(0, 0, wrapZ(i * this.pylonSpacing, dist, pr, ROAD_NEAR));
      this.pylonBodies.setMatrixAt(i, this.m4);
      this.pylonRings.setMatrixAt(i, this.m4);
    }
    this.pylonBodies.instanceMatrix.needsUpdate = true;
    this.pylonRings.instanceMatrix.needsUpdate = true;
  }
}
