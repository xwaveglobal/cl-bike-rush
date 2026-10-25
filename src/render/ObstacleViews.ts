import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LANES } from '../config.ts';
import { Pool } from '../core/Pool.ts';
import type { LiveObstacle } from '../gameplay/World.ts';
import type { ObstacleType } from '../gameplay/types.ts';
import { crateTexture, glowTexture, hazardTexture } from './textures.ts';
import { mergeByMaterial } from './merge.ts';
import { Guides } from './Guides.ts';

/** crisp bright outline so silhouettes read at speed */
const EDGE = new THREE.LineBasicMaterial({ color: 0xc8582a, transparent: true, opacity: 0.6 });
function outline(mesh: THREE.Mesh, color?: number) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), color === undefined ? EDGE : new THREE.LineBasicMaterial({ color }));
  l.position.copy(mesh.position);
  l.rotation.copy(mesh.rotation);
  l.scale.copy(mesh.scale);
  return l;
}

const CRATE_GLOW = [0xff2a3d, 0xff8a1f, 0x39b6ff, 0xffd23d];

/** Shared materials (created once — keeps program/texture count low). */
const M = (() => {
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4256, roughness: 0.45, metalness: 0.8 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1d2230, roughness: 0.5, metalness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8edf6, roughness: 0.3, metalness: 0.3 });
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0.2 });
  const red = new THREE.MeshBasicMaterial({ color: 0xc8202f });
  const redHot = new THREE.MeshBasicMaterial({ color: 0xd8303c });
  const orange = new THREE.MeshBasicMaterial({ color: 0xe0761a });
  const blue = new THREE.MeshBasicMaterial({ color: 0x2f8ad0 });
  const green = new THREE.MeshBasicMaterial({ color: 0x2fc46c });
  const yellow = new THREE.MeshBasicMaterial({ color: 0xe0b030 });
  const field = new THREE.MeshBasicMaterial({
    color: 0xe06a2a,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glowCache = new Map<string, THREE.SpriteMaterial>();
  const glow = (color: number, opacity = 0.8) => {
    const key = color + ':' + opacity;
    let m = glowCache.get(key);
    if (!m) glowCache.set(key, (m = makeGlow(color, opacity)));
    return m;
  };
  const makeGlow = (color: number, opacity: number) =>
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  const crate = [0xff2a3d, 0xff8a1f, 0x39b6ff, 0xffd23d].map((c) => {
    const hex = '#' + c.toString(16).padStart(6, '0');
    return new THREE.MeshStandardMaterial({
      map: crateTexture(hex),
      emissive: 0xffffff,
      emissiveMap: crateTexture(hex),
      emissiveIntensity: 0.12,
      roughness: 0.5,
      metalness: 0.5,
    });
  });
  const rock = new THREE.MeshStandardMaterial({ color: 0x5a4c44, roughness: 0.95, metalness: 0.05, flatShading: true, emissive: 0xff5a10, emissiveIntensity: 0.0 });
  const traffic = [0xd8dde8, 0xff4d6d, 0x2b3a67, 0xffb02e].map(
    (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, metalness: 0.4, clearcoat: 1 }),
  );
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.1, metalness: 0.7 });
  return { metal, darkMetal, white, hazard, red, redHot, orange, blue, green, yellow, field, glow, crate, rock, traffic, glass };
})();

/** world readability: hazard outline colour/opacity and dark-metal lift */
export function setObstacleContrast(edge: number, opacity: number, lift: number) {
  EDGE.color.setHex(edge);
  EDGE.opacity = opacity;
  for (const m of [M.metal, M.darkMetal]) {
    m.emissive.setHex(0x4a5266);
    m.emissiveIntensity = lift * 0.6;
  }
  M.rock.emissive.setHex(0x3a2a20);
  M.rock.emissiveIntensity = 0.2 + lift;
}

/** comfort: soften flicker/pulse animations */
export const OBSTACLE_FX = { pulse: 1 };

export interface ObstacleView {
  type: ObstacleType;
  /** pool key (type, or theme:type for Bonus-road props) */
  key?: string;
  group: THREE.Group;
  update(o: LiveObstacle, t: number, dt: number): void;
  setup(o: LiveObstacle): void;
}

const G = {
  crate: new RoundedBoxGeometry(1.7, 1.7, 1.7, 2, 0.08),
  post: new THREE.BoxGeometry(0.22, 1.5, 0.3),
  bar: new THREE.BoxGeometry(2.7, 0.12, 0.12),
  laserBeam: new THREE.CylinderGeometry(0.045, 0.045, 2.6, 8),
  laserPylon: new THREE.BoxGeometry(0.3, 6.2, 0.4),
  ring: new THREE.TorusGeometry(1.3, 0.15, 14, 48),
  ringOuter: new THREE.TorusGeometry(1.55, 0.06, 6, 48, Math.PI * 0.5),
};

function build(type: ObstacleType): ObstacleView {
  const group = new THREE.Group();
  let update: ObstacleView['update'] = () => {};
  let setup: ObstacleView['setup'] = () => {};
  /** animated / toggled parts that must stay separate; null = don't merge */
  let keep: THREE.Object3D[] | null = null;

  switch (type) {
    case 'crate': {
      const mesh = new THREE.Mesh(G.crate, M.crate[0]);
      mesh.position.y = 0.85;
      group.add(mesh);
      const edges = outline(mesh);
      group.add(edges);
      const g = new THREE.Sprite(M.glow(0xff3344, 0.35).clone());
      g.scale.set(3.2, 1.2, 1);
      g.position.y = 0.1;
      group.add(g);
      setup = (o) => {
        mesh.material = M.crate[(o.spec.variant ?? 0) % M.crate.length];
        mesh.rotation.y = ((o.spec.variant ?? 0) - 1.5) * 0.06;
        edges.rotation.y = mesh.rotation.y;
        (g.material as THREE.SpriteMaterial).color.setHex(CRATE_GLOW[(o.spec.variant ?? 0) % CRATE_GLOW.length]);
      };
      break;
    }
    case 'barrier': {
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(G.post, M.hazard);
        post.position.set(1.22 * s, 0.75, 0);
        group.add(post);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M.orange);
        cap.position.set(1.22 * s, 1.55, 0);
        group.add(cap);
      }
      const top = new THREE.Mesh(G.bar, M.orange);
      top.position.y = 1.32;
      group.add(top);
      const topGlow = new THREE.Sprite(M.glow(0xffa23a, 0.7));
      topGlow.scale.set(3.6, 0.6, 1);
      topGlow.position.y = 1.32;
      group.add(topGlow);
      const bottom = new THREE.Mesh(G.bar, M.metal);
      bottom.position.y = 0.08;
      group.add(bottom);
      const fieldMat = M.field.clone();
      const field = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2, 1, 1), fieldMat);
      field.position.y = 0.7;
      group.add(field);
      const glow = new THREE.Sprite(M.glow(0xff6a2a, 0.5));
      glow.scale.set(4, 2, 1);
      glow.position.y = 0.7;
      group.add(glow);
      keep = [field];
      update = () => {
        fieldMat.opacity = 0.26; // steady, no flicker
      };
      break;
    }
    case 'beam': {
      // gantry + heavy hanging block with a glowing red underside: "go under"
      for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.4, 0.5), M.darkMetal);
        pillar.position.set(1.38 * s, 3.2, 0);
        group.add(pillar);
      }
      const block = new THREE.Mesh(new RoundedBoxGeometry(2.5, 4.4, 0.9, 2, 0.08), M.metal);
      block.position.y = 3.55 + 0.4;
      group.add(block);
      group.add(outline(block, 0xff6a7a));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.38, 0.92), M.hazard);
      stripe.position.y = 1.32;
      group.add(stripe);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.0), M.redHot);
      edge.position.y = 1.0;
      group.add(edge);
      const under = new THREE.Sprite(M.glow(0xff2a3d, 0.75));
      under.scale.set(4.2, 1.4, 1);
      under.position.y = 0.9;
      group.add(under);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 0.6), M.darkMetal);
      top.position.y = 6.4;
      group.add(top);
      // down-arrow sign
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 3), M.red);
      arrow.rotation.z = Math.PI;
      arrow.position.set(0, 2.2, 0.47);
      group.add(arrow);
      keep = [arrow];
      update = (_o, t) => {
        arrow.position.y = 2.2 + Math.sin(t * 6) * 0.12;
      };
      break;
    }
    case 'drone': {
      // big, high-contrast hunter drone sized to its hitbox: white shell, red warning ring,
      // spinning cyan rotors, red searchlight and a red spot on the road under it
      const shell = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.25, metalness: 0.3, emissive: 0x7088b0, emissiveIntensity: 0.35 });
      const body = new THREE.Group();
      body.position.y = 1.2;
      group.add(body);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), shell);
      core.scale.set(1.25, 0.75, 1.1);
      body.add(core);
      body.add(outline(core, 0x1a2440));
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 40), M.red);
      band.rotation.x = Math.PI / 2;
      body.add(band);
      const bandGlow = new THREE.Sprite(M.glow(0xff2a3d, 0.55));
      bandGlow.scale.set(3.4, 1.4, 1);
      body.add(bandGlow);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), M.redHot);
      eye.position.set(0, -0.02, 0.6);
      body.add(eye);
      const eyeGlow = new THREE.Sprite(M.glow(0xff2a3d, 1));
      eyeGlow.scale.setScalar(1.6);
      eyeGlow.position.copy(eye.position);
      body.add(eyeGlow);
      const rotors: THREE.Mesh[] = [];
      for (const [x, z] of [[-0.85, -0.62], [0.85, -0.62], [-0.85, 0.62], [0.85, 0.62]]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.1), M.darkMetal);
        arm.position.set(x / 2, 0.12, z / 2);
        arm.rotation.y = -Math.atan2(z, x);
        body.add(arm);
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 6, 24), M.blue);
        r.rotation.x = Math.PI / 2;
        r.position.set(x, 0.18, z);
        body.add(r);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, 0.2, z);
        body.add(disc);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.08), M.darkMetal);
        blade.position.set(x, 0.21, z);
        body.add(blade);
        rotors.push(blade);
      }
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.redHot);
      beacon.position.y = 0.48;
      body.add(beacon);
      const scan = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 1.05, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff2a3d, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      scan.position.y = 0.55;
      group.add(scan);
      const spot = new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 28).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xff2a3d, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }),
      );
      spot.position.y = 0.04;
      group.add(spot);
      keep = [body, scan, spot];
      update = (_o, t, dt) => {
        for (const b of rotors) b.rotation.y += dt * 40;
        body.position.y = 1.2 + Math.sin(t * 5) * 0.06;
        beacon.visible = Math.sin(t * 16) > 0;
        (spot.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 10) * 0.12;
      };
      break;
    }
    case 'platform': {
      const slab = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.9, 3.2, 2, 0.1), M.metal);
      slab.position.y = 0.6;
      group.add(slab);
      const slabEdge = outline(slab, 0xffd23d);
      group.add(slabEdge);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 3.1), M.hazard);
      deck.position.y = 1.07;
      group.add(deck);
      for (const s of [-1, 1]) {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 2.9), M.yellow);
        light.position.set(1.21 * s, 0.75, 0);
        group.add(light);
      }
      const thr = new THREE.Sprite(M.glow(0x39b6ff, 0.7));
      thr.scale.set(3.4, 0.9, 1);
      thr.position.y = 0.12;
      group.add(thr);
      // directional arrows show which way it slides
      keep = [slab, slabEdge];
      update = (_o, t) => {
        slab.position.y = slabEdge.position.y = 0.6 + Math.sin(t * 4) * 0.04;
      };
      break;
    }
    case 'traffic': {
      const carG = new THREE.Group();
      group.add(carG);
      const bodyMesh = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.9, 3.6, 3, 0.35), M.traffic[0]);
      bodyMesh.position.y = 1.55;
      carG.add(bodyMesh);
      // red LED bar across the nose: reads as "oncoming" from far away
      const led = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.06), M.redHot);
      led.position.set(0, 1.42, 1.82);
      carG.add(led);
      const ledGlow = new THREE.Sprite(M.glow(0xff2a3d, 0.7));
      ledGlow.scale.set(3.2, 0.9, 1);
      ledGlow.position.set(0, 1.42, 1.95);
      carG.add(ledGlow);
      const wind = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.7, 0.1, 2, 0.05), M.glass);
      wind.position.set(0, 2.05, 1.78);
      wind.rotation.x = -0.25;
      carG.add(wind);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
      for (const s of [-1, 1]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.05), headMat);
        hl.position.set(0.5 * s, 1.15, 1.81);
        carG.add(hl);
        const glow = new THREE.Sprite(M.glow(0xfff2c0, 0.9));
        glow.scale.setScalar(1.6);
        glow.position.set(0.5 * s, 1.15, 1.95);
        carG.add(glow);
        for (const z of [-1.1, 1.1]) {
          const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.18, 16), M.darkMetal);
          pod.position.set(0.95 * s, 0.55, z);
          carG.add(pod);
          const pg = new THREE.Sprite(M.glow(0xff8a1f, 0.7));
          pg.scale.setScalar(0.9);
          pg.position.set(0.95 * s, 0.38, z);
          carG.add(pg);
        }
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 3.4), M.orange);
      stripe.position.y = 0.95;
      carG.add(stripe);
      // warning beacon on the roof
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.orange);
      beacon.position.y = 2.55;
      carG.add(beacon);
      const bodyEdge = outline(bodyMesh);
      carG.add(bodyEdge);
      mergeByMaterial(carG, new Set([bodyMesh, beacon, bodyEdge]));
      // white semi truck (variant 4+): box trailer + cab, same footprint as the hitbox
      const truck = new THREE.Group();
      const truckWhite = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.35, metalness: 0.2 });
      const cargo = new THREE.Mesh(new RoundedBoxGeometry(1.76, 2.15, 2.5, 2, 0.08), truckWhite);
      cargo.position.set(0, 1.78, -0.55);
      truck.add(cargo);
      const cab = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.75, 1.15, 3, 0.25), truckWhite);
      cab.position.set(0, 1.45, 1.22);
      truck.add(cab);
      const tw = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.6, 0.08, 2, 0.04), M.glass);
      tw.position.set(0, 1.95, 1.8);
      tw.rotation.x = -0.2;
      truck.add(tw);
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 3.5), M.darkMetal);
      chassis.position.set(0, 0.5, 0);
      truck.add(chassis);
      for (const sx of [-1, 1]) {
        for (const z of [-1.3, -0.4, 1.25]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16), M.darkMetal);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(0.78 * sx, 0.36, z);
          truck.add(wheel);
        }
        const hlT = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.05), headMat);
        hlT.position.set(0.55 * sx, 0.95, 1.81);
        truck.add(hlT);
        const gT = new THREE.Sprite(M.glow(0xfff2c0, 0.9));
        gT.scale.setScalar(1.7);
        gT.position.set(0.55 * sx, 0.95, 1.95);
        truck.add(gT);
      }
      const ledT = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.05), M.redHot);
      ledT.position.set(0, 2.3, 1.83);
      truck.add(ledT);
      truck.add(outline(cargo));
      truck.add(outline(cab));
      mergeByMaterial(truck);
      group.add(truck);
      keep = [carG, truck];
      setup = (o) => {
        const v = o.spec.variant ?? 0;
        const isTruck = v >= 4;
        carG.visible = !isTruck;
        truck.visible = isTruck;
        bodyMesh.material = M.traffic[v % M.traffic.length];
      };
      update = (_o, t) => {
        bodyMesh.position.y = bodyEdge.position.y = 1.55 + Math.sin(t * 3 + 1) * 0.05;
        beacon.visible = true; // steady (no blinking lights while racing)
      };
      break;
    }
    case 'ring': {
      const mat = new THREE.MeshBasicMaterial({ color: 0x2f8ad0 });
      const ring = new THREE.Mesh(G.ring, mat);
      ring.position.y = 1.25;
      group.add(ring);
      const outer = new THREE.Group();
      outer.position.y = 1.25;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Mesh(G.ringOuter, M.white);
        seg.rotation.z = (i * Math.PI * 2) / 3;
        outer.add(seg);
      }
      group.add(outer);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 32),
        new THREE.MeshBasicMaterial({ color: 0x39b6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      disc.position.y = 1.25;
      group.add(disc);
      const glow = new THREE.Sprite(M.glow(0x39b6ff, 0.5));
      glow.scale.setScalar(4.4);
      glow.position.y = 1.25;
      group.add(glow);
      keep = [outer, ring];
      update = (_o, _t, dt) => {
        outer.rotation.z += dt * 2.2;
        mat.color.setHSL(0.56, 0.6, 0.45);
      };
      break;
    }
    case 'asteroid': {
      const geo = new THREE.IcosahedronGeometry(1.25, 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = 0.82 + 0.3 * Math.abs(Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7));
        v.multiplyScalar(n);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, M.rock);
      rock.position.y = 1.3;
      group.add(rock);
      // hazard rim so a dark rock never melts into the starfield
      rock.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), EDGE));
      const lava = new THREE.Sprite(M.glow(0xff6a1a, 0.55));
      lava.scale.setScalar(3.2);
      lava.position.y = 1.3;
      group.add(lava);
      update = (_o, _t, dt) => {
        rock.rotation.x += dt * 0.9;
        rock.rotation.y += dt * 0.6;
      };
      break;
    }
    case 'laser': {
      // pylons at the lane boundaries + per-lane beam sets toggled per config
      for (const x of [-3.95, -1.3, 1.3, 3.95]) {
        const p = new THREE.Mesh(G.laserPylon, M.darkMetal);
        p.position.set(x, 3.1, 0);
        group.add(p);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.44), M.red);
        tip.position.set(x, 6.2, 0);
        group.add(tip);
      }
      const sets: Record<string, THREE.Group>[] = [];
      // each lane set = 1 merged beam mesh + 1 stretched glow (2 draw calls)
      const beamSet = (ys: number[]) => {
        const g = new THREE.Group();
        for (const y of ys) {
          const b = new THREE.Mesh(G.laserBeam, M.redHot);
          b.rotation.z = Math.PI / 2;
          b.position.y = y;
          g.add(b);
        }
        mergeByMaterial(g);
        const lo = Math.min(...ys);
        const hi = Math.max(...ys);
        const gl = new THREE.Sprite(M.glow(0xff2a3d, 0.4));
        gl.scale.set(3.4, hi - lo + 1.2, 1);
        gl.position.y = (lo + hi) / 2;
        g.add(gl);
        return g;
      };
      for (let i = 0; i < 3; i++) {
        const low = beamSet([0.3, 0.75, 1.2]);
        const high = beamSet([1.05, 1.55, 2.1, 2.7, 3.4, 4.2, 5.1]);
        const block = beamSet([0.3, 0.75, 1.2, 1.7, 2.3, 3.0, 3.8, 4.7, 5.6]);
        const open = new THREE.Group();
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 3), M.green);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(0, 0.05, -1);
        arrow.scale.y = 0.3;
        open.add(arrow);
        const og = new THREE.Sprite(M.glow(0x3dff8b, 0.5));
        og.scale.set(2.4, 2.4, 1);
        og.position.y = 0.5;
        open.add(og);
        for (const g of [low, high, block, open]) {
          g.position.x = LANES[i];
          group.add(g);
        }
        sets.push({ low, high, block, open });
      }
      keep = sets.flatMap((s) => Object.values(s));
      setup = (o) => {
        for (let i = 0; i < 3; i++) {
          const m = o.spec.laser![i];
          for (const k of Object.keys(sets[i])) sets[i][k].visible = k === m;
        }
      };
      update = () => {
        M.redHot.color.setRGB(0.85, 0.2, 0.24);
      };
      break;
    }
    case 'gate': {
      // a fortress wall across the whole road with one opening (green frame)
      const panels: THREE.Mesh[] = [];
      const doors: { l: THREE.Mesh; r: THREE.Mesh }[] = [];
      const frames: THREE.Group[] = [];
      for (let i = 0; i < 3; i++) {
        const x = LANES[i];
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7, 0.8), M.metal);
        wall.position.set(x, 3.5, 0);
        group.add(wall);
        panels.push(wall);
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.6, 0.8), M.metal);
        lintel.position.set(x, 4.7, 0);
        group.add(lintel);
        // sliding door leaves (open as the gate approaches)
        const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.5), M.hazard);
        const r = l.clone();
        l.position.set(x - 0.65, 1.2, 0);
        r.position.set(x + 0.65, 1.2, 0);
        group.add(l, r);
        doors.push({ l, r });
        const frame = new THREE.Group();
        for (const [w, h, fx, fy] of [[2.5, 0.12, 0, 2.4], [0.12, 2.4, -1.25, 1.2], [0.12, 2.4, 1.25, 1.2]]) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.9), M.green);
          f.position.set(fx, fy, 0);
          frame.add(f);
        }
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 3), M.green);
        arrow.rotation.z = Math.PI;
        arrow.position.set(0, 3.4, 0.45);
        frame.add(arrow);
        frame.position.x = x;
        group.add(frame);
        frames.push(frame);
        (lintel as THREE.Mesh).userData.lane = i;
        panels.push(lintel);
      }
      for (const s of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), M.darkMetal);
        tower.position.set(4.8 * s, 4.5, 0);
        group.add(tower);
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7, 0.2), M.blue);
        light.position.set(4.0 * s, 4.5, 0.85);
        group.add(light);
      }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 0.9), M.darkMetal);
      banner.position.y = 7.25;
      group.add(banner);
      const bannerGlow = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.12, 0.95), M.blue);
      bannerGlow.position.y = 7.1;
      group.add(bannerGlow);
      keep = [...panels, ...frames, ...doors.flatMap((d) => [d.l, d.r])];
      setup = (o) => {
        for (let i = 0; i < 3; i++) {
          const isDoor = i === o.spec.door;
          panels[i * 2].visible = !isDoor; // full wall
          panels[i * 2 + 1].visible = isDoor; // lintel above the opening
          frames[i].visible = isDoor;
          doors[i].l.visible = doors[i].r.visible = isDoor;
        }
      };
      update = (o) => {
        const d = o.spec.door ?? 1;
        const open = Math.min(1, Math.max(0, (-o.z - 45) / -40 + 1)); // opens between 85 m and 45 m out
        const x = LANES[d];
        doors[d].l.position.x = x - 0.65 - open * 1.3;
        doors[d].r.position.x = x + 0.65 + open * 1.3;
      };
      break;
    }
  }
  // no neon halos on obstacles: drop glow sprites (solid, matte silhouettes read better)
  const sprites: THREE.Object3D[] = [];
  group.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) sprites.push(o);
  });
  for (const sp of sprites) sp.parent?.remove(sp);
  if (keep) mergeByMaterial(group, new Set(keep));
  return { type, group, update, setup };
}

// ------------------------------------------------------------------ v2 Bonus-road props
/** Bonus places get everyday props with the SAME silhouettes / hitboxes as the neon ones:
 *  crate = lane block (hop over) · barrier = low (hop over) · beam = overhead (duck) · traffic = vehicle (switch lane) */
export type PropTheme = 'desert' | 'forest' | 'country' | 'sea' | 'harbor' | 'solar' | 'canyon' | 'belt' | 'storm' | 'volcano' | 'ice';
export const PROP_THEMES: PropTheme[] = ['desert', 'forest', 'country', 'sea', 'harbor', 'solar', 'canyon', 'belt', 'storm', 'volcano', 'ice'];
const BONUS_PROPS: PropTheme[] = ['desert', 'forest', 'country', 'sea'];
/** which obstacle types get a themed look in a place (Endless ladder worlds keep the neon traffic) */
const themedTypes = (th: PropTheme): ObstacleType[] => (BONUS_PROPS.includes(th) ? ['crate', 'barrier', 'beam', 'traffic'] : ['crate', 'barrier', 'beam']);
const PM = (() => {
  const m = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, flatShading: true, ...extra });
  return {
    rock: m(0xa86a44), rockDark: m(0x7a4a30), barrel: m(0xc0392b, { metalness: 0.4, roughness: 0.5 }), barrelBand: m(0x2a2a2a), cactus: m(0x3f8f4a),
    wood: m(0x8a5a32), woodDark: m(0x5a3a20), leaf: m(0x2f6b34), bark: m(0x6a4a2e), sign: m(0xf2c94c),
    hay: m(0xe0c060), fence: m(0xf2efe6), barnRed: m(0xb8342a), tractorGreen: m(0x3a8a3a), tractorRed: m(0xc0392b),
    buoyRed: m(0xe03a2a), white: m(0xf4f4f4), rope: m(0xc8a870), hullBlue: m(0x2a6ab0), sand: m(0xe2ad6a),
    tyre: m(0x1a1a1a), glass: m(0x203040, { metalness: 0.6, roughness: 0.2 }), truckSand: m(0xd9b27a), truckWhite: m(0xe8e8e8),
    // v2.1 ladder worlds
    contRed: m(0xd8343a, { metalness: 0.5, roughness: 0.45 }), contBlue: m(0x2a6ad8, { metalness: 0.5, roughness: 0.45 }), steel: m(0x8a94a6, { metalness: 0.8, roughness: 0.35 }),
    bollard: m(0x2a2e38, { metalness: 0.7 }), chain: m(0xd0d4dc, { metalness: 0.9, roughness: 0.3 }), panel: m(0x1a3a8a, { metalness: 0.7, roughness: 0.25 }), battery: m(0x2fd36b, { metalness: 0.4 }),
    crystal: new THREE.MeshStandardMaterial({ color: 0x5ee6ff, emissive: 0x2a9aff, emissiveIntensity: 0.8, roughness: 0.2, flatShading: true }),
    crystalPink: new THREE.MeshStandardMaterial({ color: 0xff7ae8, emissive: 0xc83ab0, emissiveIntensity: 0.8, roughness: 0.2, flatShading: true }),
    canyonRock: m(0x6a3a6a), debris: m(0x5a5e6a, { metalness: 0.7, roughness: 0.4 }), sandbag: m(0xb8a070), billboard: m(0x1a1f2e, { metalness: 0.6 }),
    basalt: m(0x2a1a16), lava: new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false }),
    ice: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true }), snow: m(0xf4fbff),
  };
})();

function buildThemed(type: ObstacleType, theme: PropTheme): ObstacleView {
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
    return mesh;
  };
  const edge = (mesh: THREE.Mesh) => group.add(outline(mesh));
  const vehicle = (body: THREE.Material, cab: THREE.Material, load?: (g: THREE.Group) => void) => {
    // simple truck seen from behind/front: chassis, cab, wheels — same footprint as a road car
    const ch = add(new THREE.BoxGeometry(2.0, 0.9, 4.2), body, 0, 0.75);
    edge(ch);
    add(new THREE.BoxGeometry(1.9, 1.0, 1.5), cab, 0, 1.6, 1.2);
    add(new THREE.BoxGeometry(1.7, 0.5, 0.05), PM.glass, 0, 1.75, 1.96);
    for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) add(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12), PM.tyre, sx * 1.0, 0.42, sz, 0, 0, Math.PI / 2);
    if (load) load(group);
  };
  if (!BONUS_PROPS.includes(theme)) {
    buildLadderProp(type, theme, add, edge);
    mergeByMaterial(group, new Set());
    return { type, group, update: () => {}, setup: () => {} };
  }
  switch (type) {
    case 'crate': {
      if (theme === 'desert') {
        const r = add(new THREE.IcosahedronGeometry(1.05, 0), PM.rock, 0, 0.85, 0, 0.3, 0.7, 0);
        r.scale.set(1.2, 0.85, 1.05);
        edge(r);
        add(new THREE.IcosahedronGeometry(0.5, 0), PM.rockDark, 0.8, 0.35, 0.3);
      } else if (theme === 'forest') {
        for (let i = 0; i < 3; i++) {
          const l = add(new THREE.CylinderGeometry(0.42, 0.42, 2.3, 10), PM.wood, 0, 0.42 + (i === 2 ? 0.75 : 0), 0, 0, 0, Math.PI / 2);
          l.position.x = i === 2 ? 0 : (i ? 0.45 : -0.45);
          if (i === 0) edge(l);
        }
        add(new THREE.CylinderGeometry(0.43, 0.43, 0.05, 10), PM.sign, 0, 1.17, 1.16, Math.PI / 2);
      } else if (theme === 'country') {
        const b = add(new THREE.BoxGeometry(1.7, 0.85, 1.2), PM.hay, 0, 0.43);
        edge(b);
        add(new THREE.BoxGeometry(1.5, 0.8, 1.1), PM.hay, 0, 1.25, 0, 0, 0.15);
        add(new THREE.BoxGeometry(1.72, 0.06, 1.22), PM.woodDark, 0, 0.6);
      } else {
        const c = add(new THREE.BoxGeometry(1.7, 1.7, 1.7), PM.wood, 0, 0.85);
        edge(c);
        add(new THREE.TorusGeometry(0.55, 0.12, 8, 18), PM.buoyRed, 0, 1.0, 0.9);
      }
      break;
    }
    case 'barrier': {
      if (theme === 'desert') {
        for (const x of [-0.85, 0, 0.85]) {
          const b = add(new THREE.CylinderGeometry(0.4, 0.4, 1.25, 14), PM.barrel, x, 0.62);
          if (x === 0) edge(b);
          add(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 14), PM.barrelBand, x, 0.9);
        }
      } else if (theme === 'forest') {
        const l = add(new THREE.CylinderGeometry(0.48, 0.55, 2.8, 12), PM.bark, 0, 0.55, 0, 0, 0, Math.PI / 2);
        edge(l);
        add(new THREE.ConeGeometry(0.5, 1.0, 7), PM.leaf, 1.25, 1.0, 0, 0, 0, -0.6);
      } else if (theme === 'country') {
        for (const x of [-1.2, 0, 1.2]) add(new THREE.BoxGeometry(0.16, 1.4, 0.16), PM.fence, x, 0.7);
        for (const y of [0.45, 0.95, 1.3]) {
          const r = add(new THREE.BoxGeometry(2.7, 0.14, 0.08), PM.fence, 0, y);
          if (y === 0.95) edge(r);
        }
      } else {
        const line = add(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6), PM.rope, 0, 0.9, 0, 0, 0, Math.PI / 2);
        edge(line);
        for (const x of [-1.0, 0, 1.0]) {
          add(new THREE.SphereGeometry(0.42, 14, 10), x === 0 ? PM.white : PM.buoyRed, x, 0.75);
          add(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), PM.white, x, 1.35);
        }
      }
      break;
    }
    case 'beam': {
      // overhead block: underside at ~1.0 m (duck under), posts at the lane edges
      const postMat = theme === 'sea' ? PM.white : theme === 'country' ? PM.barnRed : PM.wood;
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3, 6.2, 0.35), postMat, 1.38 * sx, 3.1);
      if (theme === 'desert') {
        const s2 = add(new THREE.BoxGeometry(2.6, 1.2, 0.25), PM.sign, 0, 1.75);
        edge(s2);
        add(new THREE.BoxGeometry(2.8, 0.25, 0.4), PM.woodDark, 0, 1.08);
        add(new THREE.ConeGeometry(0.35, 0.5, 3), PM.barrel, 0, 1.75, 0.15, 0, 0, Math.PI);
      } else if (theme === 'forest') {
        const t = add(new THREE.CylinderGeometry(0.5, 0.6, 3.0, 12), PM.bark, 0, 1.55, 0, 0, 0, Math.PI / 2);
        edge(t);
        add(new THREE.ConeGeometry(1.0, 1.6, 7), PM.leaf, 0.3, 2.6, 0);
      } else if (theme === 'country') {
        const top = add(new THREE.BoxGeometry(2.8, 1.3, 0.5), PM.barnRed, 0, 1.75);
        edge(top);
        add(new THREE.BoxGeometry(2.6, 0.12, 0.52), PM.fence, 0, 1.12);
        add(new THREE.BoxGeometry(1.8, 0.7, 0.4), PM.hay, 0, 2.7);
      } else {
        const deck = add(new THREE.BoxGeometry(2.8, 0.9, 1.2), PM.white, 0, 1.5);
        edge(deck);
        add(new THREE.TorusGeometry(0.4, 0.1, 8, 18), PM.buoyRed, 0, 1.5, 0.62);
      }
      break;
    }
    case 'traffic': {
      if (theme === 'desert') vehicle(PM.truckSand, PM.truckSand, () => add(new THREE.BoxGeometry(1.9, 0.5, 2.4), PM.rockDark, 0, 1.45, -0.8));
      else if (theme === 'forest') vehicle(PM.woodDark, PM.tractorGreen, () => {
        for (const x of [-0.5, 0, 0.5]) add(new THREE.CylinderGeometry(0.28, 0.28, 2.6, 8), PM.wood, x, 1.5, -0.6, Math.PI / 2);
      });
      else if (theme === 'country') {
        const body = add(new THREE.BoxGeometry(1.6, 1.0, 2.4), PM.tractorRed, 0, 1.1);
        edge(body);
        add(new THREE.BoxGeometry(1.4, 1.1, 1.2), PM.glass, 0, 2.1, -0.3);
        for (const sx of [-1, 1]) {
          add(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), PM.tyre, sx * 1.0, 0.9, -0.7, 0, 0, Math.PI / 2);
          add(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14), PM.tyre, sx * 0.9, 0.5, 1.0, 0, 0, Math.PI / 2);
        }
      } else vehicle(PM.truckWhite, PM.hullBlue, () => {
        const hull = add(new THREE.BoxGeometry(1.6, 0.7, 3.2), PM.hullBlue, 0, 1.55, -0.5);
        hull.scale.set(1, 1, 1);
        add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), PM.white, 0, 2.9, -0.5);
      });
      break;
    }
  }
  mergeByMaterial(group, new Set());
  return { type, group, update: () => {}, setup: () => {} };
}

type AddFn = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z?: number, rx?: number, ry?: number, rz?: number) => THREE.Mesh;
/** v2.1 Endless ladder worlds: each place has its own crate / barrier / beam look (same hitboxes) */
function buildLadderProp(type: ObstacleType, theme: PropTheme, add: AddFn, edge: (m: THREE.Mesh) => void) {
  const posts = (mat: THREE.Material) => {
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3, 6.2, 0.35), mat, 1.38 * sx, 3.1);
  };
  if (type === 'crate') {
    if (theme === 'harbor') { edge(add(new THREE.BoxGeometry(2.2, 1.7, 1.7), PM.contRed, 0, 0.85)); for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) add(new THREE.BoxGeometry(0.06, 1.5, 1.72), PM.steel, x, 0.85); }
    else if (theme === 'solar') { edge(add(new THREE.BoxGeometry(1.8, 1.6, 1.5), PM.white, 0, 0.8)); add(new THREE.BoxGeometry(1.2, 0.35, 0.05), PM.battery, 0, 1.0, 0.76); }
    else if (theme === 'canyon') { const c = add(new THREE.OctahedronGeometry(0.9, 0), PM.crystal, 0, 1.0); c.scale.y = 1.9; edge(c); add(new THREE.OctahedronGeometry(0.5, 0), PM.crystalPink, 0.7, 0.55, 0.2).scale.y = 1.6; }
    else if (theme === 'belt') { const d = add(new THREE.DodecahedronGeometry(0.95, 0), PM.debris, 0, 0.9, 0, 0.4, 0.3); edge(d); add(new THREE.BoxGeometry(2.2, 0.15, 0.3), PM.steel, 0, 1.0, 0, 0, 0.4, 0.3); }
    else if (theme === 'storm') { edge(add(new THREE.BoxGeometry(2.0, 1.6, 0.6), PM.billboard, 0, 0.8, 0, 0, 0, 0.08)); add(new THREE.BoxGeometry(1.7, 1.2, 0.05), PM.sign, 0, 0.85, 0.31, 0, 0, 0.08); }
    else if (theme === 'volcano') { const r = add(new THREE.IcosahedronGeometry(1.0, 0), PM.basalt, 0, 0.85, 0, 0.3, 0.5); r.scale.set(1.15, 0.9, 1); edge(r); add(new THREE.IcosahedronGeometry(1.02, 0), PM.lava, 0, 0.85, 0, 0.3, 0.5).scale.set(0.6, 0.45, 1.05); }
    else { edge(add(new THREE.BoxGeometry(1.7, 1.7, 1.7), PM.ice, 0, 0.85)); add(new THREE.BoxGeometry(1.75, 0.25, 1.75), PM.snow, 0, 1.75); }
  } else if (type === 'barrier') {
    if (theme === 'harbor') { for (const x of [-1.1, 0, 1.1]) add(new THREE.CylinderGeometry(0.3, 0.38, 1.2, 10), PM.bollard, x, 0.6); edge(add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), PM.chain, 0, 1.05, 0, 0, 0, Math.PI / 2)); }
    else if (theme === 'solar') { const p = add(new THREE.BoxGeometry(2.6, 0.1, 1.2), PM.panel, 0, 1.2, 0, -0.5); edge(p); for (const x of [-1.1, 1.1]) add(new THREE.BoxGeometry(0.12, 1.2, 0.12), PM.steel, x, 0.6); }
    else if (theme === 'canyon') { const r = add(new THREE.BoxGeometry(2.7, 1.1, 1.2), PM.canyonRock, 0, 0.55, 0, 0.1, 0, 0.05); edge(r); add(new THREE.OctahedronGeometry(0.35, 0), PM.crystal, 0.8, 1.25).scale.y = 1.8; }
    else if (theme === 'belt') { const pipe = add(new THREE.CylinderGeometry(0.45, 0.45, 2.8, 12), PM.steel, 0, 0.6, 0, 0, 0, Math.PI / 2); edge(pipe); add(new THREE.TorusGeometry(0.5, 0.08, 6, 14), PM.lava, 1.0, 0.6, 0, 0, Math.PI / 2); }
    else if (theme === 'storm') { for (const x of [-0.9, 0, 0.9]) for (const y of [0.3, 0.75]) add(new THREE.BoxGeometry(0.85, 0.42, 0.7), PM.sandbag, x + (y > 0.5 ? 0.4 : 0), y); edge(add(new THREE.BoxGeometry(2.7, 0.08, 0.72), PM.sandbag, 0, 1.0)); }
    else if (theme === 'volcano') { const w = add(new THREE.BoxGeometry(2.7, 1.0, 0.7), PM.basalt, 0, 0.5); edge(w); add(new THREE.BoxGeometry(2.4, 0.25, 0.72), PM.lava, 0, 1.05); }
    else { const d = add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), PM.snow, 0, 0); d.scale.set(1.4, 1.2, 0.8); edge(d); add(new THREE.ConeGeometry(0.25, 1.2, 6), PM.ice, 0.9, 1.0); }
  } else if (type === 'beam') {
    const postMat = theme === 'harbor' || theme === 'belt' ? PM.steel : theme === 'solar' ? PM.white : theme === 'canyon' ? PM.canyonRock : theme === 'storm' ? PM.billboard : theme === 'volcano' ? PM.basalt : PM.ice;
    posts(postMat);
    if (theme === 'harbor') { edge(add(new THREE.BoxGeometry(2.6, 1.7, 1.6), PM.contBlue, 0, 1.95)); add(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), PM.chain, 0, 4.3); }
    else if (theme === 'solar') { edge(add(new THREE.BoxGeometry(2.8, 0.9, 0.3), PM.panel, 0, 1.55)); add(new THREE.BoxGeometry(2.9, 0.1, 0.1), PM.steel, 0, 5.8); }
    else if (theme === 'canyon') { edge(add(new THREE.BoxGeometry(3.0, 1.6, 1.4), PM.canyonRock, 0, 1.9)); add(new THREE.OctahedronGeometry(0.4, 0), PM.crystalPink, 0, 1.0).scale.y = 1.7; }
    else if (theme === 'belt') { edge(add(new THREE.BoxGeometry(2.8, 0.5, 0.5), PM.steel, 0, 1.3)); add(new THREE.BoxGeometry(1.4, 1.0, 1.0), PM.debris, 0, 2.1); add(new THREE.BoxGeometry(2.6, 0.05, 1.2), PM.panel, 0, 2.7); }
    else if (theme === 'storm') { edge(add(new THREE.BoxGeometry(2.9, 1.5, 0.4), PM.billboard, 0, 1.85, 0, 0, 0, -0.06)); add(new THREE.BoxGeometry(2.5, 1.1, 0.05), PM.contRed, 0, 1.85, 0.22, 0, 0, -0.06); }
    else if (theme === 'volcano') { edge(add(new THREE.BoxGeometry(3.0, 1.4, 1.0), PM.basalt, 0, 1.8)); for (const x of [-0.8, 0.2, 0.9]) add(new THREE.ConeGeometry(0.12, 0.5, 6), PM.lava, x, 1.0, 0.3, Math.PI); }
    else { edge(add(new THREE.BoxGeometry(3.0, 0.9, 1.0), PM.ice, 0, 1.55)); for (const x of [-1, -0.3, 0.4, 1]) add(new THREE.ConeGeometry(0.16, 0.6, 6), PM.ice, x, 0.85, 0, Math.PI); }
  }
}

/** Pools one view type per obstacle type; attaches/detaches from the scene. */
export class ObstacleViews {
  /** v2 Bonus road: everyday props for the place (null = neon city props) */
  theme: PropTheme | null = null;
  private pools = new Map<string, Pool<ObstacleView>>();
  private active = new Map<number, ObstacleView>();
  guides: Guides;

  constructor(private parent: THREE.Object3D) {
    this.guides = new Guides(parent);
  }

  private pool(type: ObstacleType, theme: PropTheme | null = null) {
    const th = theme && themedTypes(theme).includes(type) ? theme : null;
    const key = th ? `${th}:${type}` : type;
    let p = this.pools.get(key);
    if (!p) {
      p = new Pool(() => {
        const v = th ? buildThemed(type, th) : build(type);
        v.key = key;
        return v;
      });
      this.pools.set(key, p);
    }
    return p;
  }
  private poolOf(v: ObstacleView) {
    const k = v.key ?? v.type;
    const i = k.indexOf(':');
    return i > 0 ? this.pool(v.type, k.slice(0, i) as PropTheme) : this.pool(v.type);
  }

  prewarm() {
    const counts: [ObstacleType, number][] = [
      ['crate', 8], ['barrier', 4], ['beam', 4], ['drone', 3], ['laser', 2], ['traffic', 3], ['ring', 3], ['platform', 2], ['asteroid', 4], ['gate', 1],
    ];
    for (const [t, n] of counts) this.pool(t).prewarm(n);
  }

  spawn(o: LiveObstacle) {
    const v = this.pool(o.spec.type, this.theme).acquire();
    v.setup(o);
    v.group.visible = true;
    this.parent.add(v.group);
    this.active.set(o.id, v);
    this.place(o, v);
    this.guides.spawn(o);
  }

  despawn(o: LiveObstacle) {
    this.guides.despawn(o);
    const v = this.active.get(o.id);
    if (!v) return;
    this.parent.remove(v.group);
    this.active.delete(o.id);
    this.poolOf(v).release(v);
  }

  hide(o: LiveObstacle) {
    const v = this.active.get(o.id);
    if (v) v.group.visible = false;
  }

  private place(o: LiveObstacle, v: ObstacleView) {
    const t = o.spec.type;
    const x = t === 'drone' || t === 'platform' ? o.sx : t === 'laser' || t === 'gate' ? 0 : LANES[o.spec.lane];
    v.group.position.set(x, 0, o.z);
    if (t === 'traffic') v.group.rotation.y = 0;
  }

  update(obstacles: LiveObstacle[], t: number, dt: number) {
    for (const o of obstacles) {
      const v = this.active.get(o.id);
      if (!v) continue;
      if (o.smashed) v.group.visible = false;
      this.place(o, v);
      v.update(o, t, dt);
    }
    this.guides.update(obstacles, t);
  }

  clear() {
    for (const [, v] of this.active) {
      this.parent.remove(v.group);
      this.poolOf(v).release(v);
    }
    this.active.clear();
    this.guides.clear();
  }
}
