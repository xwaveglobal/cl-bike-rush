import * as THREE from 'three';
import type { WorldId } from '../gameplay/Spawner.ts';
import { damp } from '../core/math.ts';
import { Rng } from '../core/Rng.ts';
import { billboardTexture, cloudSeaTexture, cloudTexture, glowTexture, groundTexture, groundTexture2, logoTexture, starfieldTexture, windowsTexture } from './textures.ts';
import type { BonusWorld, LadderWorld } from '../gameplay/Spawner.ts';
import { wrapZ } from './Track.ts';
import { bakeVertexColors } from './merge.ts';

const NEAR = 40;

export interface ThemeLook {
  skyTop: number;
  skyMid: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunI: number;
  accent: number;
  stars: number;
  cloudSea: number; // opacity
  cloudTint: number;
  openAir: boolean;
}

export const LOOKS: Record<WorldId, ThemeLook> = {
  city: {
    skyTop: 0x1a6be0, skyMid: 0x70bbf8, skyBottom: 0xe6f5ff, fog: 0xb8def8, fogNear: 70, fogFar: 360,
    hemiSky: 0xffffff, hemiGround: 0x6a90b8, hemi: 1.2, sun: 0xfff8ea, sunI: 2.3, accent: 0x2ef2ff, stars: 0, cloudSea: 0.95, cloudTint: 0xf4faff, openAir: true,
  },
  tunnel: {
    skyTop: 0x05020f, skyMid: 0x1a0638, skyBottom: 0x2a0a52, fog: 0x1a0838, fogNear: 30, fogFar: 190,
    hemiSky: 0x9a7bff, hemiGround: 0x220a44, hemi: 0.9, sun: 0xd28bff, sunI: 1.4, accent: 0xc45bff, stars: 0, cloudSea: 0, cloudTint: 0x6a3d92, openAir: false,
  },
  cloud: {
    skyTop: 0x1f5bc4, skyMid: 0x6fa8f0, skyBottom: 0xcfe2ff, fog: 0x9cc2f0, fogNear: 80, fogFar: 380,
    hemiSky: 0xe6f0ff, hemiGround: 0x5a7aa8, hemi: 1.05, sun: 0xfff0d8, sunI: 1.9, accent: 0x2f8cff, stars: 0, cloudSea: 0.95, cloudTint: 0xf4f8ff, openAir: true,
  },
  space: {
    skyTop: 0x000005, skyMid: 0x050a22, skyBottom: 0x101a4a, fog: 0x070c26, fogNear: 80, fogFar: 380,
    hemiSky: 0x8fb4ff, hemiGround: 0x101530, hemi: 0.9, sun: 0xc8dcff, sunI: 2.0, accent: 0x5ad1ff, stars: 1, cloudSea: 0, cloudTint: 0x2a3a7a, openAir: false,
  },
  // ---- v2.1 Endless ladder worlds
  harbor: {
    skyTop: 0x0a0a2a, skyMid: 0x3a1a5a, skyBottom: 0xff6a8a, fog: 0x3a2a6a, fogNear: 60, fogFar: 340,
    hemiSky: 0xb0b8ff, hemiGround: 0x1a2040, hemi: 1.0, sun: 0xff9ab0, sunI: 1.8, accent: 0xff4fd8, stars: 0.4, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  solar: {
    skyTop: 0x2a7ae0, skyMid: 0x8ac8f4, skyBottom: 0xfff2c8, fog: 0xd8ecf0, fogNear: 90, fogFar: 430,
    hemiSky: 0xffffff, hemiGround: 0x6a8a4a, hemi: 1.2, sun: 0xfff6d8, sunI: 2.5, accent: 0x2fd3ff, stars: 0, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  canyon: {
    skyTop: 0x1a0a3a, skyMid: 0x7a2a7a, skyBottom: 0xff9a6a, fog: 0x7a3a6a, fogNear: 60, fogFar: 320,
    hemiSky: 0xffc8f0, hemiGround: 0x3a1a3a, hemi: 1.1, sun: 0xffb08a, sunI: 2.0, accent: 0x5ee6ff, stars: 0.2, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  belt: {
    skyTop: 0x02020a, skyMid: 0x140a30, skyBottom: 0x3a1a5a, fog: 0x0a0820, fogNear: 80, fogFar: 380,
    hemiSky: 0xb0a0ff, hemiGround: 0x101030, hemi: 0.9, sun: 0xffd0b0, sunI: 2.0, accent: 0xff9a3c, stars: 1, cloudSea: 0, cloudTint: 0x2a3a7a, openAir: false,
  },
  storm: {
    skyTop: 0x101418, skyMid: 0x3a4250, skyBottom: 0x6a7480, fog: 0x4a525e, fogNear: 40, fogFar: 260,
    hemiSky: 0xc8d4e8, hemiGround: 0x202830, hemi: 1.0, sun: 0xd8e4ff, sunI: 1.6, accent: 0xffd23d, stars: 0, cloudSea: 0.6, cloudTint: 0x5a6270, openAir: true,
  },
  volcano: {
    skyTop: 0x100404, skyMid: 0x4a0e08, skyBottom: 0xff5a1a, fog: 0x5a1a0a, fogNear: 50, fogFar: 300,
    hemiSky: 0xffb08a, hemiGround: 0x2a0a04, hemi: 1.0, sun: 0xff7a2a, sunI: 2.2, accent: 0xff5a1a, stars: 0.1, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  ice: {
    skyTop: 0x020a1a, skyMid: 0x0a2a4a, skyBottom: 0x3ad6a0, fog: 0x2a5a6a, fogNear: 70, fogFar: 380,
    hemiSky: 0xd8f4ff, hemiGround: 0x3a6a8a, hemi: 1.15, sun: 0xc8fff0, sunI: 1.9, accent: 0x5effc8, stars: 0.8, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  // ---- v2 Bonus roads: daylight, everyday places
  desert: {
    skyTop: 0x2f78d6, skyMid: 0x8fc4f0, skyBottom: 0xffe0b0, fog: 0xf0d2a8, fogNear: 90, fogFar: 420,
    hemiSky: 0xfff2dc, hemiGround: 0xc08850, hemi: 1.25, sun: 0xfff0d0, sunI: 2.6, accent: 0xff8a2a, stars: 0, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  forest: {
    skyTop: 0x2a6ac8, skyMid: 0x86b8e8, skyBottom: 0xd8ecf0, fog: 0xa8c8c0, fogNear: 60, fogFar: 330,
    hemiSky: 0xe6f6ff, hemiGround: 0x3a6a3a, hemi: 1.15, sun: 0xfff4d8, sunI: 2.2, accent: 0x3dff8b, stars: 0, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  country: {
    skyTop: 0x3a86e0, skyMid: 0x9fd0f6, skyBottom: 0xf6f0d0, fog: 0xd6e6d8, fogNear: 90, fogFar: 420,
    hemiSky: 0xffffff, hemiGround: 0x7a9a4a, hemi: 1.2, sun: 0xfff6dc, sunI: 2.4, accent: 0xffc21a, stars: 0, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  sea: {
    skyTop: 0x1a6ad8, skyMid: 0x7ac0f4, skyBottom: 0xe8f6ff, fog: 0xb8dcf0, fogNear: 100, fogFar: 460,
    hemiSky: 0xf0faff, hemiGround: 0x2a6a9a, hemi: 1.2, sun: 0xfff8e8, sunI: 2.5, accent: 0x2fd3ff, stars: 0, cloudSea: 0, cloudTint: 0xffffff, openAir: true,
  },
  mega: {
    skyTop: 0x0b1440, skyMid: 0x3a3c9a, skyBottom: 0xff9a7a, fog: 0x5a5aa8, fogNear: 60, fogFar: 330,
    hemiSky: 0xd8e4ff, hemiGround: 0x3a3060, hemi: 1.2, sun: 0xffd29a, sunI: 2.3, accent: 0xffc21a, stars: 0.25, cloudSea: 0.8, cloudTint: 0xe6d6ff, openAir: true,
  },
};

/** Instanced scrolling buildings with world-scaled lit windows (1 draw call). */
class BuildingField {
  mesh: THREE.InstancedMesh;
  private slots: { x: number; w: number; d: number; h: number; base: number; y: number; prevZ: number }[] = [];
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  constructor(
    private n: number,
    private range: number,
    private xMin: number,
    private xMax: number,
    private hMin: number,
    private hMax: number,
    private palette: number[],
    private rng: Rng,
    winSeed: number,
    private yBase = -24,
  ) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.6,
      emissive: 0xffffff,
      emissiveMap: windowsTexture(winSeed),
      emissiveIntensity: 0.62, // calm: windows glow softly, no neon wall of light
    });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWinUv;\nvarying float vSide;')
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec3 lp = position * sc;
          vWinUv = vec2(abs(normal.x) > 0.5 ? lp.z : lp.x, lp.y) / vec2(9.0, 13.0);
          vSide = 1.0 - abs(normal.y);`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWinUv;\nvarying float vSide;')
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= texture2D( emissiveMap, vWinUv ).rgb * vSide;');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      const s = { x: 0, w: 0, d: 0, h: 0, base: (i / n) * range, y: 0, prevZ: 0 };
      this.roll(s, i);
      this.slots.push(s);
      this.mesh.setColorAt(i, this.c.setHex(this.rng.pick(this.palette)));
    }
  }
  private roll(s: { x: number; w: number; d: number; h: number; y: number }, i: number) {
    const side = i % 2 === 0 ? -1 : 1;
    s.x = side * this.rng.range(this.xMin, this.xMax);
    s.w = this.rng.range(6, 16);
    s.d = this.rng.range(6, 16);
    s.h = this.rng.range(this.hMin, this.hMax);
    s.y = this.yBase - this.rng.range(0, 8);
  }
  update(dist: number) {
    for (let i = 0; i < this.n; i++) {
      const s = this.slots[i];
      const z = wrapZ(s.base, dist, this.range, NEAR);
      if (z < s.prevZ - this.range / 2) {
        this.roll(s, i);
        this.mesh.setColorAt(i, this.c.setHex(this.rng.pick(this.palette)));
        this.mesh.instanceColor!.needsUpdate = true;
      }
      s.prevZ = z;
      this.m.makeScale(s.w, s.h, s.d).setPosition(s.x, s.y, z);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Objects re-positioned by modulo distance (no spawning). */
class Scroller {
  items: { o: THREE.Object3D; base: number; speed: number }[] = [];
  constructor(public range: number) {}
  add(o: THREE.Object3D, base: number, speed = 0) {
    this.items.push({ o, base, speed });
  }
  update(dist: number, t: number) {
    for (const it of this.items) it.o.position.z = wrapZ(it.base, dist + it.speed * t, this.range, NEAR);
  }
}

interface Theme {
  group: THREE.Group;
  update(dist: number, t: number, dt: number): void;
}

function makeBillboard(variant: number, w = 9, h = 4.5) {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: billboardTexture(variant), color: 0xa8a8a8 }));
  g.add(panel);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1f2e, metalness: 0.8, roughness: 0.4 }));
  frame.position.z = -0.2;
  g.add(frame);
  return g;
}

/** Background hover-car traffic: instanced capsules + glow points. */
class SkyTraffic {
  mesh: THREE.InstancedMesh;
  glows: THREE.Points;
  private cars: { x: number; y: number; base: number; v: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();
  constructor(rng: Rng, n: number) {
    const geo = new THREE.CapsuleGeometry(0.6, 1.6, 4, 10);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5 }), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const tColors = [0xf2f4fa, 0xff4d6d, 0x5ad1ff, 0xffc21a];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      this.cars.push({ x: side * rng.range(18, 60), y: rng.range(10, 40), base: rng.range(0, 500), v: rng.chance(0.5) ? 25 : -15 });
      this.mesh.setColorAt(i, c.setHex(rng.pick(tColors)));
    }
    const gp = new THREE.BufferGeometry();
    gp.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.glows = new THREE.Points(
      gp,
      new THREE.PointsMaterial({ map: glowTexture(), color: 0x6fd2ff, size: 3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.glows.frustumCulled = false;
  }
  update(dist: number, t: number) {
    const gp = this.glows.geometry.attributes.position as THREE.BufferAttribute;
    this.cars.forEach((car, i) => {
      const z = wrapZ(car.base, dist + car.v * t, 500, NEAR);
      this.p.set(car.x, car.y, z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      gp.setXYZ(i, car.x, car.y, z);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    gp.needsUpdate = true;
  }
}

let _islandMat: THREE.MeshStandardMaterial | null = null;
const islandMat = () => (_islandMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15, flatShading: true }));

function island(rng: Rng, scale = 1) {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(6, 9, 8, 1),
    new THREE.MeshStandardMaterial({ color: 0x5b6378, roughness: 0.9, flatShading: true }),
  );
  rock.rotation.x = Math.PI;
  rock.position.y = -4.5;
  g.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 8), new THREE.MeshStandardMaterial({ color: 0x4caf6a, roughness: 0.8, flatShading: true }));
  g.add(top);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f9e5b, roughness: 0.7, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.9, 1.6), 0), treeMat);
    tr.position.set(rng.range(-4, 4), 1.4, rng.range(-4, 4));
    g.add(tr);
  }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, rng.range(5, 12), 8), new THREE.MeshStandardMaterial({ color: 0xdfe7f5, metalness: 0.5, roughness: 0.3 }));
  tower.position.set(rng.range(-2, 2), 3, rng.range(-2, 2));
  g.add(tower);
  const solid = new THREE.Mesh(bakeVertexColors(g)!, islandMat());
  g.clear();
  g.add(solid);
  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 14),
    new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  fall.position.set(5.8, -7, 0);
  fall.rotation.y = Math.PI / 2;
  g.add(fall);
  g.scale.setScalar(scale);
  return g;
}

// ------------------------------------------------------------------ themes
function buildCity(mega: boolean): Theme {
  const rng = new Rng(mega ? 77 : 11);
  const group = new THREE.Group();
  const pal = mega ? [0x2b3260, 0x3b3f78, 0x5a4a2a, 0x23284a, 0x8a7a50] : [0xf4f8ff, 0xe2ecfc, 0xd0e2fa, 0xbad6f8, 0xffffff];
  const near = new BuildingField(mega ? 54 : 40, 340, 14, 34, mega ? 30 : 18, mega ? 110 : 70, pal, rng, mega ? 3 : 1);
  const far = new BuildingField(mega ? 60 : 50, 420, 40, 140, mega ? 60 : 30, mega ? 200 : 140, pal, rng, 2, -40);
  group.add(near.mesh, far.mesh);

  const sc = new Scroller(320);
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const bb = makeBillboard(mega ? (i % 3 === 0 ? 0 : i % 4) : i % 4);
    bb.position.set(side * rng.range(11, 15), rng.range(7, 18), 0);
    bb.rotation.y = side * -0.95;
    group.add(bb);
    sc.add(bb, i * 32 + rng.range(0, 10));
  }
  // flying traffic lanes in the background (instanced: 1 mesh + 1 Points)
  const traffic = new SkyTraffic(rng, 22);
  group.add(traffic.mesh, traffic.glows);
  // floating garden platforms
  const islands = new Scroller(480);
  for (let i = 0; i < 5; i++) {
    const is = island(rng, rng.range(0.6, 1.1));
    is.position.set((i % 2 ? 1 : -1) * rng.range(28, 55), rng.range(-6, 8), 0);
    group.add(is);
    islands.add(is, i * 96);
  }
  // elevated side highways with light trails
  const hwMat = new THREE.MeshStandardMaterial({ color: mega ? 0x3a4460 : 0xdce6f5, metalness: 0.6, roughness: 0.45 });
  const trailMat = new THREE.MeshBasicMaterial({ color: mega ? 0xffc21a : 0x2ef2ff, toneMapped: false });
  for (const [x, y] of [[-34, 14], [42, -4], [-70, 30]]) {
    const hw = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 700), hwMat);
    hw.position.set(x, y, -250);
    group.add(hw);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 700), trailMat);
    tr.position.set(x + 3.4, y + 0.5, -250);
    group.add(tr);
    const tr2 = tr.clone();
    tr2.position.x = x - 3.4;
    group.add(tr2);
  }
  // XWAVE megacity arches over the road
  const arches = new Scroller(200);
  if (mega) {
    for (let i = 0; i < 2; i++) {
      const a = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0x1d2236, metalness: 0.8, roughness: 0.35 });
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 1.2), m);
        leg.position.set(7 * s, 7, 0);
        a.add(leg);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(16, 2.6, 1.4), m);
      top.position.y = 14;
      a.add(top);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.05), new THREE.MeshBasicMaterial({ map: logoTexture(null, '#ffc21a'), transparent: true, toneMapped: false }));
      logo.position.set(0, 14, 0.75);
      a.add(logo);
      const gold = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.18, 1.5), new THREE.MeshBasicMaterial({ color: 0xffc21a, toneMapped: false }));
      gold.position.y = 12.6;
      a.add(gold);
      group.add(a);
      arches.add(a, i * 100 + 40);
    }
  }
  return {
    group,
    update(dist, t) {
      near.update(dist);
      far.update(dist * 0.85);
      sc.update(dist, t);
      traffic.update(dist, t);
      islands.update(dist * 0.7, t);
      arches.update(dist, t);
    },
  };
}

function buildTunnel(): Theme {
  const group = new THREE.Group();
  const sc = new Scroller(240);
  const ringGeo = new THREE.TorusGeometry(9, 0.35, 6, 8);
  ringGeo.rotateZ(Math.PI / 8);
  const mats = [0xc45bff, 0x39b6ff, 0xff4fd8].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: 0.8, roughness: 0.4 });
  const frameGeo = new THREE.TorusGeometry(9.6, 0.9, 4, 8);
  frameGeo.rotateZ(Math.PI / 8);
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group();
    g.position.y = 3;
    g.add(new THREE.Mesh(frameGeo, frameMat));
    g.add(new THREE.Mesh(ringGeo, mats[i % 3]));
    group.add(g);
    sc.add(g, i * 10);
  }
  // tunnel shell with scrolling light stripes
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const gx = c.getContext('2d')!;
  gx.fillStyle = '#0c0820';
  gx.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 8; i++) {
    gx.fillStyle = i % 2 ? '#7a3dff' : '#2a8cff';
    gx.fillRect(i * 32 + 14, 0, 3, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 30);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(10.5, 10.5, 300, 8, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, toneMapped: false }),
  );
  shell.geometry.rotateY(Math.PI / 8);
  shell.rotation.x = Math.PI / 2;
  shell.position.set(0, 3, -110);
  group.add(shell);
  // speed panels on the walls
  const panels = new Scroller(180);
  const pMat = new THREE.MeshBasicMaterial({ color: 0x8a3a7e });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 6), pMat);
    const s = i % 2 ? 1 : -1;
    p.position.set(7.4 * s, 4 + (i % 3), 0);
    group.add(p);
    panels.add(p, i * 15);
  }
  return {
    group,
    update(dist, t) {
      sc.update(dist, t);
      panels.update(dist, t);
      tex.offset.y = (dist / 10) % 1;
      // static, muted ring colours (no colour cycling / flashing)
      for (let i = 0; i < 3; i++) mats[i].color.setHSL((0.72 + i * 0.06) % 1, 0.45, 0.42);
    },
  };
}

function buildCloud(): Theme {
  const rng = new Rng(33);
  const group = new THREE.Group();
  const islands = new Scroller(520);
  for (let i = 0; i < 9; i++) {
    const is = island(rng, rng.range(0.8, 1.6));
    is.position.set((i % 2 ? 1 : -1) * rng.range(18, 60), rng.range(-14, 14), 0);
    group.add(is);
    islands.add(is, i * 58);
  }
  const clouds = new Scroller(420);
  const cm = new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, fog: true });
  for (let i = 0; i < 36; i++) {
    const s = new THREE.Sprite(cm);
    const side = i % 2 ? 1 : -1;
    s.position.set(side * rng.range(9, 80), rng.range(-18, 22), 0);
    s.scale.setScalar(rng.range(14, 34));
    group.add(s);
    clouds.add(s, rng.range(0, 420));
  }
  // sky bridges
  const bridges = new Scroller(300);
  const bm = new THREE.MeshStandardMaterial({ color: 0xe6edf8, metalness: 0.4, roughness: 0.35 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x39b6ff, toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(80, 1.2, 4), bm);
    deck.position.y = 22 + i * 6;
    b.add(deck);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(80, 0.15, 4.1), glow);
    strip.position.y = 21.4 + i * 6;
    b.add(strip);
    group.add(b);
    bridges.add(b, i * 100 + 30);
  }
  return {
    group,
    update(dist, t) {
      islands.update(dist * 0.8, t);
      clouds.update(dist * 0.9, t);
      bridges.update(dist, t);
    },
  };
}

function buildSpace(): Theme {
  const rng = new Rng(55);
  const group = new THREE.Group();
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a66ff, emissive: 0x0a1a66, roughness: 0.8, fog: false }),
  );
  planet.position.set(-160, 40, -520);
  group.add(planet);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(150, 210, 64),
    new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }),
  );
  ring.position.copy(planet.position);
  ring.rotation.set(1.2, 0.3, 0.2);
  group.add(ring);
  const rocks = new Scroller(460);
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a423c, roughness: 0.95, flatShading: true, emissive: 0x401000, emissiveIntensity: 0.4 });
  const spin: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const r = new THREE.Mesh(rockGeo, rockMat);
    const side = i % 2 ? 1 : -1;
    r.position.set(side * rng.range(10, 90), rng.range(-30, 40), 0);
    r.scale.setScalar(rng.range(1, 6));
    group.add(r);
    rocks.add(r, rng.range(0, 460));
    spin.push(r);
  }
  // orbital structures
  const orbit = new Scroller(400);
  const om = new THREE.MeshStandardMaterial({ color: 0xc9d2e3, metalness: 0.8, roughness: 0.3 });
  const ob = new THREE.MeshBasicMaterial({ color: 0x5ad1ff, toneMapped: false });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 8, 12), om);
    s.add(hub);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(10, 0.5, 8, 40), ob);
    halo.rotation.x = Math.PI / 2;
    s.add(halo);
    for (const d of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x1a3a8a, metalness: 0.9, roughness: 0.2 }));
      panel.position.x = 11 * d;
      s.add(panel);
    }
    s.position.set((i % 2 ? 1 : -1) * rng.range(30, 70), rng.range(10, 35), 0);
    group.add(s);
    orbit.add(s, i * 100);
  }
  return {
    group,
    update(dist, t, dt) {
      rocks.update(dist, t);
      orbit.update(dist * 0.6, t);
      for (const r of spin) {
        r.rotation.x += dt * 0.3;
        r.rotation.y += dt * 0.2;
      }
    },
  };
}

// ------------------------------------------------------------------ v2.1 Endless ladder worlds
/** the seven new Endless places (two per rank with the original five) — props scroll on both sides */
function buildLadder(id: LadderWorld): Theme {
  const rng = new Rng(id.length * 313 + 11);
  const group = new THREE.Group();
  const near = new Scroller(480);
  const far = new Scroller(640);
  const anim: ((t: number) => void)[] = [];
  const side = (i: number) => (i % 2 ? 1 : -1);
  const put = (o: THREE.Object3D, i: number, x0: number, x1: number, y: number, sc: Scroller, range: number) => {
    o.position.set(side(i) * rng.range(x0, x1), y, 0);
    group.add(o);
    sc.add(o, rng.range(0, range));
  };
  const std2 = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, flatShading: true, ...extra });
  const glowM = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  let ground: { tex: THREE.Texture; tile: number } | null = null;
  const addGround = (tex: THREE.Texture, y: number, tile: number, color = 0xffffff) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(600 / tile, 900 / tile);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, -420);
    group.add(m);
    ground = { tex: t, tile };
  };
  switch (id) {
    case 'harbor': {
      addGround(groundTexture('sea'), -8, 26, 0x4a3a8a);
      const cols = [0xff4f6a, 0x2fb6ff, 0xffc21a, 0x3dd16b, 0xb46bff];
      for (let i = 0; i < 18; i++) {
        const st = new THREE.Group();
        const h = rng.int(1, 4);
        for (let k = 0; k < h; k++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 2.4), std2(rng.pick(cols)));
          c.position.y = 1.2 + k * 2.45;
          st.add(c);
        }
        put(st, i, 12, 40, -6, near, 480);
      }
      for (let i = 0; i < 6; i++) {
        const cr = new THREE.Group();
        const legM = std2(0xffb02e);
        for (const sx of [-2, 2]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 26, 0.6), legM);
          leg.position.set(sx, 13, 0);
          cr.add(leg);
        }
        const boom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 22), legM);
        boom.position.set(0, 26, -4);
        cr.add(boom);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), glowM(0xff3b4e));
        lamp.position.set(0, 27, 6);
        cr.add(lamp);
        put(cr, i, 30, 60, -8, far, 640);
      }
      break;
    }
    case 'solar': {
      addGround(groundTexture('country'), -5, 60, 0xb8d88a);
      const panelM = std2(0x1a3a8a, { metalness: 0.7, roughness: 0.25 });
      const frameM = std2(0xc8d0dc);
      for (let i = 0; i < 26; i++) {
        const row = new THREE.Group();
        for (let k = 0; k < 4; k++) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 2), panelM);
          p.rotation.x = -0.5;
          p.position.set(k * 3.4 - 5, 1.4, 0);
          row.add(p);
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), frameM);
          leg.position.set(k * 3.4 - 5, 0.6, 0);
          row.add(leg);
        }
        put(row, i, 10, 45, -5, near, 480);
      }
      const whiteM = std2(0xf2f4f8);
      for (let i = 0; i < 6; i++) {
        const w = new THREE.Group();
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 30, 8), whiteM);
        tower.position.y = 15;
        w.add(tower);
        const hub = new THREE.Group();
        hub.position.set(0, 30, 1);
        for (let k = 0; k < 3; k++) {
          const arm = new THREE.Group();
          arm.rotation.z = (k * Math.PI * 2) / 3;
          const bl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12, 0.2), whiteM);
          bl.position.y = 6;
          arm.add(bl);
          hub.add(arm);
        }
        w.add(hub);
        anim.push((t) => (hub.rotation.z = t * 0.8 + i));
        put(w, i, 45, 110, -5, far, 640);
      }
      break;
    }
    case 'canyon': {
      addGround(groundTexture2('rockv'), -6, 24);
      const rockM = std2(0x6a3a6a);
      const cryM = new THREE.MeshStandardMaterial({ color: 0x5ee6ff, emissive: 0x2a9aff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3, flatShading: true });
      const cryM2 = new THREE.MeshStandardMaterial({ color: 0xff7ae8, emissive: 0xc83ab0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3, flatShading: true });
      for (let i = 0; i < 16; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(rng.range(12, 22), rng.range(18, 40), rng.range(14, 26)), rockM);
        w.rotation.y = rng.range(-0.3, 0.3);
        put(w, i, 20, 45, 4, near, 480);
      }
      for (let i = 0; i < 30; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(rng.range(0.8, 2.4), 0), i % 3 ? cryM : cryM2);
        c.scale.y = rng.range(1.8, 3);
        c.rotation.z = rng.range(-0.4, 0.4);
        put(c, i, 8, 22, -4, near, 480);
      }
      break;
    }
    case 'belt': {
      const rockM = new THREE.MeshStandardMaterial({ color: 0x5a4a44, roughness: 0.95, flatShading: true, emissive: 0x401a00, emissiveIntensity: 0.5 });
      const geo = new THREE.IcosahedronGeometry(1, 0);
      for (let i = 0; i < 70; i++) {
        const r = new THREE.Mesh(geo, rockM);
        r.scale.set(rng.range(1, 7), rng.range(1, 6), rng.range(1, 7));
        r.position.set(side(i) * rng.range(9, 100), rng.range(-30, 40), 0);
        group.add(r);
        near.add(r, rng.range(0, 480));
        const sp = rng.range(0.1, 0.5);
        anim.push((t) => {
          r.rotation.x = t * sp;
          r.rotation.y = t * sp * 0.7;
        });
      }
      const neb = new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xb04dff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 10; i++) {
        const n = new THREE.Sprite(neb);
        n.scale.setScalar(rng.range(80, 160));
        n.position.set(side(i) * rng.range(60, 200), rng.range(20, 90), 0);
        group.add(n);
        far.add(n, rng.range(0, 640));
      }
      break;
    }
    case 'storm': {
      const towerM = std2(0x2a3038, { metalness: 0.6 });
      const winM = glowM(0xffd23d);
      for (let i = 0; i < 20; i++) {
        const b = new THREE.Group();
        const h = rng.range(20, 60);
        const body = new THREE.Mesh(new THREE.BoxGeometry(rng.range(8, 14), h, rng.range(8, 14)), towerM);
        body.position.y = h / 2 - 20;
        b.add(body);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), winM);
        lamp.position.y = h - 19;
        b.add(lamp);
        put(b, i, 18, 70, 0, near, 480);
      }
      // rain streaks + lightning flash
      const rainGeo = new THREE.BufferGeometry();
      const N = 500;
      const pos = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) {
        const x = (rng.next() - 0.5) * 80, y = rng.range(-5, 40), z = -rng.range(0, 200);
        pos.set([x, y, z, x + 0.3, y - 2.4, z], i * 6);
      }
      rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaac4e0, transparent: true, opacity: 0.35 }));
      group.add(rain);
      anim.push((t) => (rain.position.y = -((t * 40) % 30)));
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe8f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      flash.scale.setScalar(500);
      flash.position.set(80, 120, -500);
      group.add(flash);
      anim.push((t) => {
        const k = (t * 0.37) % 1;
        (flash.material as THREE.SpriteMaterial).opacity = k < 0.04 ? 0.8 * (1 - k / 0.04) : 0;
      });
      break;
    }
    case 'volcano': {
      addGround(groundTexture2('lava'), -7, 26, 0xffffff);
      const coneM = std2(0x2a1410);
      const lavaM = glowM(0xff6a1a);
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Group();
        const h = rng.range(40, 80);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.7, h, 9), coneM);
        cone.position.y = h / 2 - 8;
        v.add(cone);
        const crater = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.12, h * 0.14, 2, 9), lavaM);
        crater.position.y = h - 8.5;
        v.add(crater);
        put(v, i, 70, 160, 0, far, 640);
      }
      const rockM = std2(0x3a1a12);
      for (let i = 0; i < 26; i++) {
        const r = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(1.5, 4), 0), rockM);
        put(r, i, 8, 40, -6, near, 480);
      }
      const ember = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff8a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 40; i++) {
        const e = new THREE.Sprite(ember);
        e.scale.setScalar(rng.range(0.6, 1.4));
        const x = side(i) * rng.range(6, 50);
        const ph = rng.range(0, 10);
        e.position.set(x, 0, 0);
        group.add(e);
        near.add(e, rng.range(0, 480));
        anim.push((t) => (e.position.y = ((t * 3 + ph) % 18) - 4));
      }
      break;
    }
    case 'ice': {
      addGround(groundTexture2('ice'), -5, 30);
      const iceM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
      for (let i = 0; i < 34; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(rng.range(1, 3), rng.range(5, 16), 6), iceM);
        c.position.y = 0;
        put(c, i, 8, 50, 0, near, 480);
      }
      // aurora ribbons
      for (let k = 0; k < 3; k++) {
        const geo = new THREE.PlaneGeometry(500, 60, 60, 1);
        const m = new THREE.MeshBasicMaterial({ color: k === 1 ? 0x7a5aff : 0x3dffb0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const rib = new THREE.Mesh(geo, m);
        rib.position.set(0, 110 + k * 25, -520 - k * 40);
        group.add(rib);
        const base = (geo.attributes.position as THREE.BufferAttribute).array.slice();
        anim.push((t) => {
          const a = geo.attributes.position as THREE.BufferAttribute;
          for (let v = 0; v < a.count; v++) a.setY(v, base[v * 3 + 1] + Math.sin(base[v * 3] * 0.02 + t * 0.6 + k) * 14);
          a.needsUpdate = true;
        });
      }
      break;
    }
  }
  return {
    group,
    update(dist, t) {
      if (ground) (ground as { tex: THREE.Texture; tile: number }).tex.offset.y = (dist / (ground as { tex: THREE.Texture; tile: number }).tile) % 1;
      near.update(dist, t);
      far.update(dist * 0.5, t);
      for (const f of anim) f(t);
    },
  };
}

// ------------------------------------------------------------------ v2 Bonus roads
const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

/** low causeway world: a scrolling textured ground just under the road + props on both sides */
function buildBonus(id: BonusWorld): Theme {
  const rng = new Rng(id.length * 101 + 7);
  const group = new THREE.Group();
  const GROUND_Y = -5;
  const tex = groundTexture(id).clone();
  tex.needsUpdate = true;
  const tile = id === 'country' ? 60 : 24;
  tex.repeat.set(600 / tile, 900 / tile);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, -420);
  group.add(ground);
  // road embankment: a dark strip under the deck so the road reads as a causeway
  const bank = new THREE.Mesh(new THREE.BoxGeometry(12, 4.6, 900), std(id === 'sea' ? 0x8a8f99 : 0x6a5a48));
  bank.position.set(0, GROUND_Y + 2.1, -420);
  group.add(bank);

  const near = new Scroller(480);
  const far = new Scroller(620);
  const spin: THREE.Object3D[] = [];
  const side = (i: number) => (i % 2 ? 1 : -1);
  const place = (o: THREE.Object3D, i: number, x0: number, x1: number, sc: Scroller, range: number, y = GROUND_Y) => {
    o.position.set(side(i) * rng.range(x0, x1), y, 0);
    o.rotation.y = rng.range(0, Math.PI * 2);
    group.add(o);
    sc.add(o, rng.range(0, range));
  };

  if (id === 'desert') {
    const cactusM = std(0x3f8f4a);
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      const h = rng.range(2.5, 5);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, h, 7), cactusM);
      trunk.position.y = h / 2;
      c.add(trunk);
      for (const s of [-1, 1]) {
        if (rng.chance(0.3)) continue;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 6), cactusM);
        arm.position.set(s * 0.7, h * rng.range(0.45, 0.7), 0);
        c.add(arm);
        const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 6), cactusM);
        elbow.rotation.z = Math.PI / 2;
        elbow.position.set(s * 0.45, arm.position.y - 0.7, 0);
        c.add(elbow);
      }
      place(c, i, 8, 40, near, 480);
    }
    const duneM = std(0xe2ad6a);
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), duneM);
      d.scale.set(rng.range(10, 22), rng.range(2, 5), rng.range(8, 16));
      place(d, i, 22, 90, near, 480);
    }
    const mesaM = std(0xc0683a);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rng.range(14, 24), rng.range(20, 30), rng.range(18, 36), 7), mesaM);
      place(m, i, 110, 220, far, 620, GROUND_Y + 8);
    }
  } else if (id === 'forest') {
    const leaf = [std(0x2f6b34), std(0x3d8040), std(0x24572b)];
    const trunkM = std(0x6a4a2e);
    const cone = new THREE.ConeGeometry(1, 1, 7);
    for (let i = 0; i < 70; i++) {
      const t = new THREE.Group();
      const h = rng.range(6, 13);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h * 0.3, 6), trunkM);
      tr.position.y = h * 0.15;
      t.add(tr);
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(cone, leaf[(i + k) % 3]);
        c.scale.set(h * (0.32 - k * 0.07), h * 0.42, h * (0.32 - k * 0.07));
        c.position.y = h * (0.42 + k * 0.2);
        t.add(c);
      }
      place(t, i, 7.5, 55, near, 480);
    }
    const hillM = std(0x3a7040);
    for (let i = 0; i < 8; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hillM);
      h.scale.set(rng.range(50, 90), rng.range(20, 40), rng.range(40, 70));
      place(h, i, 120, 220, far, 620, GROUND_Y - 6);
    }
  } else if (id === 'country') {
    const barnM = std(0xb8342a);
    const roofM = std(0x4a3a36);
    const whiteM = std(0xf2efe6);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), barnM);
      body.position.y = 2.5;
      b.add(body);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 6.2, 3, 1, false), roofM);
      roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      roof.scale.set(1, 1, 0.55);
      roof.position.y = 6;
      b.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), whiteM);
      door.position.set(0, 1.6, 3.01);
      b.add(door);
      place(b, i, 20, 60, near, 480);
    }
    const hayM = std(0xe0c060);
    for (let i = 0; i < 22; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 12), hayM);
      h.rotation.z = Math.PI / 2;
      place(h, i, 8, 45, near, 480, GROUND_Y + 1);
    }
    const leafM = std(0x4f8f3a);
    for (let i = 0; i < 20; i++) {
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), std(0x6a4a2e));
      tr.position.y = 1.5;
      t.add(tr);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), leafM);
      crown.position.y = 4.4;
      t.add(crown);
      place(t, i, 9, 60, near, 480);
    }
    // windmills (blades turn)
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 22, 8), whiteM);
      tower.position.y = 11;
      w.add(tower);
      const hub = new THREE.Group();
      hub.position.set(0, 22, 0.9);
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.15), whiteM);
        blade.position.y = 4.5;
        const arm = new THREE.Group();
        arm.rotation.z = (k * Math.PI * 2) / 3;
        arm.add(blade);
        hub.add(arm);
      }
      w.add(hub);
      spin.push(hub);
      place(w, i, 50, 110, far, 620);
      w.rotation.y = 0;
    }
  } else {
    // sea: palm islets, boats, a lighthouse
    const sandM = std(0xf0d8a0);
    const palmM = std(0x3a9a4a);
    const trunkM = std(0x8a6a44);
    for (let i = 0; i < 12; i++) {
      const is = new THREE.Group();
      const sand = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), sandM);
      sand.scale.set(rng.range(6, 12), 1.6, rng.range(6, 10));
      is.add(sand);
      for (let k = 0; k < 2; k++) {
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 6, 6), trunkM);
        tr.position.set(k * 2 - 1, 3, 0);
        tr.rotation.z = (k ? -1 : 1) * 0.2;
        is.add(tr);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 7), palmM);
        crown.position.set(k * 2 - 1 + (k ? -0.6 : 0.6), 6.2, 0);
        is.add(crown);
      }
      place(is, i, 18, 80, near, 480, GROUND_Y + 0.2);
    }
    const hullM = std(0xf4f4f4);
    const sailM = std(0xfff6e0, { side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 6), hullM);
      hull.position.y = 0.5;
      b.add(hull);
      const sail = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 3), sailM);
      sail.position.y = 4;
      b.add(sail);
      place(b, i, 14, 70, near, 480, GROUND_Y + 0.1);
      spin.push(b);
    }
    const lh = new THREE.Group();
    const towerM = std(0xffffff);
    const stripeM = std(0xe0302a);
    for (let k = 0; k < 4; k++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.6 - k * 0.2, 1.8 - k * 0.2, 4, 10), k % 2 ? stripeM : towerM);
      seg.position.y = 2 + k * 4;
      lh.add(seg);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff3a0, toneMapped: false }));
    lamp.position.y = 17.5;
    lh.add(lamp);
    place(lh, 1, 40, 60, far, 620);
  }

  // a few fluffy clouds everywhere
  const clouds = new Scroller(520);
  const cm = new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: true });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Sprite(cm);
    c.position.set(side(i) * rng.range(30, 160), rng.range(30, 70), 0);
    c.scale.setScalar(rng.range(30, 60));
    group.add(c);
    clouds.add(c, rng.range(0, 520));
  }

  return {
    group,
    update(dist, t) {
      tex.offset.y = (dist / tile) % 1;
      near.update(dist, t);
      far.update(dist * 0.5, t);
      clouds.update(dist * 0.2, t);
      for (const s of spin) {
        if (id === 'country') s.rotation.z = t * 0.9;
        else s.position.y = GROUND_Y + 0.1 + Math.sin(t * 1.3 + s.position.x) * 0.15;
      }
    },
  };
}

/**
 * Sky dome, cloud sea, lights and the five themed scenery sets. Themes are
 * built lazily the first time they're needed; transitions blend sky/fog/light.
 */
export class Scenery {
  group = new THREE.Group();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fog: THREE.Fog;
  private skyMat: THREE.ShaderMaterial;
  private sea: THREE.Mesh;
  private seaTex: THREE.Texture;
  private sunSprite: THREE.Sprite;
  private themes = new Map<WorldId, Theme>();
  current: WorldId = 'city';
  private look: ThemeLook = { ...LOOKS.city };
  private target: ThemeLook = LOOKS.city;
  /** current world id (readability profile key) */
  world: WorldId = 'city';
  private tmpA = new THREE.Color();
  private tmpB = new THREE.Color();
  accent = new THREE.Color(LOOKS.city.accent);

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.Fog(LOOKS.city.fog, LOOKS.city.fogNear, LOOKS.city.fogFar);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(LOOKS.city.hemiSky, LOOKS.city.hemiGround, LOOKS.city.hemi);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(LOOKS.city.sun, LOOKS.city.sunI);
    this.sun.position.set(-6, 12, -10);
    this.group.add(this.sun);
    const rim = new THREE.DirectionalLight(0x9fdcff, 1.0);
    rim.position.set(4, 6, 10);
    this.group.add(rim);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(LOOKS.city.skyTop) },
        mid: { value: new THREE.Color(LOOKS.city.skyMid) },
        bottom: { value: new THREE.Color(LOOKS.city.skyBottom) },
        stars: { value: starfieldTexture() },
        starMix: { value: LOOKS.city.stars },
        time: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; varying vec2 vUv; void main(){ vDir = normalize(position); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform sampler2D stars; uniform float starMix; uniform float time;
        varying vec3 vDir; varying vec2 vUv;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.7, h)) : mix(bottom, mid, smoothstep(-0.25, 0.08, h));
          float s = texture2D(stars, vUv * vec2(4.0, 2.0)).r;
          c += vec3(s) * starMix * smoothstep(-0.1, 0.4, h) * 0.8;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.group.add(sky);

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.sunSprite.scale.setScalar(260);
    this.sunSprite.position.set(-60, 40, -620);
    this.group.add(this.sunSprite);

    this.seaTex = cloudSeaTexture();
    this.seaTex.repeat.set(6, 6);
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ color: 0xf3d6ff, alphaMap: this.seaTex, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.set(0, -26, -300);
    this.group.add(this.sea);
    const seaBase = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: 0xcfa8e8 }));
    seaBase.rotation.x = -Math.PI / 2;
    seaBase.position.set(0, -34, -300);
    this.sea.userData.base = seaBase;
    this.group.add(seaBase);

    this.ensure('city');
    this.applyLook(1);
  }

  private ensure(id: WorldId) {
    let t = this.themes.get(id);
    if (!t) {
      t =
        id === 'city' ? buildCity(false)
        : id === 'mega' ? buildCity(true)
        : id === 'tunnel' ? buildTunnel()
        : id === 'cloud' ? buildCloud()
        : id === 'space' ? buildSpace()
        : id === 'desert' || id === 'forest' || id === 'country' || id === 'sea' ? buildBonus(id)
        : buildLadder(id);
      t.group.visible = false;
      this.group.add(t.group);
      this.themes.set(id, t);
    }
    return t;
  }

  /** Build a theme ahead of time to avoid a hitch at the world boundary. */
  preload(id: WorldId) {
    this.ensure(id);
  }

  setWorld(id: WorldId, instant = false) {
    for (const [k, t] of this.themes) t.group.visible = k === id;
    this.ensure(id).group.visible = true;
    this.current = id;
    this.target = LOOKS[id];
    this.world = id;
    if (instant) this.applyLook(1);
  }

  get openAir() {
    return LOOKS[this.current].openAir;
  }

  private applyLook(k: number) {
    const L = this.look;
    const T = this.target;
    const lc = (a: number, b: number) => this.tmpA.setHex(a).lerp(this.tmpB.setHex(b), k).getHex();
    L.skyTop = lc(L.skyTop, T.skyTop);
    L.skyMid = lc(L.skyMid, T.skyMid);
    L.skyBottom = lc(L.skyBottom, T.skyBottom);
    L.fog = lc(L.fog, T.fog);
    L.hemiSky = lc(L.hemiSky, T.hemiSky);
    L.hemiGround = lc(L.hemiGround, T.hemiGround);
    L.sun = lc(L.sun, T.sun);
    L.accent = lc(L.accent, T.accent);
    L.cloudTint = lc(L.cloudTint, T.cloudTint);
    const ln = (a: number, b: number) => a + (b - a) * k;
    L.fogNear = ln(L.fogNear, T.fogNear);
    L.fogFar = ln(L.fogFar, T.fogFar);
    L.hemi = ln(L.hemi, T.hemi);
    L.sunI = ln(L.sunI, T.sunI);
    L.stars = ln(L.stars, T.stars);
    L.cloudSea = ln(L.cloudSea, T.cloudSea);

    const u = this.skyMat.uniforms;
    (u.top.value as THREE.Color).setHex(L.skyTop);
    (u.mid.value as THREE.Color).setHex(L.skyMid);
    (u.bottom.value as THREE.Color).setHex(L.skyBottom);
    u.starMix.value = L.stars;
    this.fog.color.setHex(L.fog);
    this.fog.near = L.fogNear;
    this.fog.far = L.fogFar;
    this.hemi.color.setHex(L.hemiSky);
    this.hemi.groundColor.setHex(L.hemiGround);
    this.hemi.intensity = L.hemi;
    this.sun.color.setHex(L.sun);
    this.sun.intensity = L.sunI;
    this.accent.setHex(L.accent);
    const sm = this.sea.material as THREE.MeshBasicMaterial;
    sm.opacity = L.cloudSea;
    sm.color.setHex(L.cloudTint);
    this.sea.visible = L.cloudSea > 0.02;
    (this.sea.userData.base as THREE.Mesh).visible = L.cloudSea > 0.5;
    ((this.sea.userData.base as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(L.skyBottom).lerp(this.tmpA.setHex(L.cloudTint), 0.5);
    (this.sunSprite.material as THREE.SpriteMaterial).color.setHex(L.sun);
    this.sunSprite.visible = this.current !== 'tunnel';
  }

  update(dist: number, t: number, dt: number) {
    this.applyLook(damp(2.2, dt));
    this.skyMat.uniforms.time.value = t;
    this.seaTex.offset.y = (dist / 230) % 1;
    for (const [, th] of this.themes) if (th.group.visible) th.update(dist, t, dt);
  }
}
