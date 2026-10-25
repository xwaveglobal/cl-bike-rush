import * as THREE from 'three';
import { Pool } from '../core/Pool.ts';
import type { LivePickup } from '../gameplay/World.ts';
import type { PickupKind } from '../gameplay/types.ts';
import { coinFaceTexture, glowTexture, iconTexture, labelTexture } from './textures.ts';

const MAX_COINS = 220;

function extrude(shape: THREE.Shape, depth = 0.14) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  g.center();
  return g;
}

function shieldShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.bezierCurveTo(0.2, 0.42, 0.38, 0.42, 0.42, 0.38);
  s.bezierCurveTo(0.42, 0.0, 0.3, -0.3, 0, -0.5);
  s.bezierCurveTo(-0.3, -0.3, -0.42, 0.0, -0.42, 0.38);
  s.bezierCurveTo(-0.38, 0.42, -0.2, 0.42, 0, 0.5);
  return s;
}
function boltShape() {
  const s = new THREE.Shape();
  s.moveTo(0.08, 0.55);
  s.lineTo(-0.3, -0.02);
  s.lineTo(-0.02, -0.02);
  s.lineTo(-0.12, -0.55);
  s.lineTo(0.32, 0.1);
  s.lineTo(0.04, 0.1);
  s.closePath();
  return s;
}
/** rocket silhouette for the ROADSTER JUMP pickup */
function rocketShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.bezierCurveTo(0.18, 0.4, 0.22, 0.1, 0.2, -0.2);
  s.lineTo(0.36, -0.42);
  s.lineTo(0.12, -0.36);
  s.lineTo(0.08, -0.5);
  s.lineTo(-0.08, -0.5);
  s.lineTo(-0.12, -0.36);
  s.lineTo(-0.36, -0.42);
  s.lineTo(-0.2, -0.2);
  s.bezierCurveTo(-0.22, 0.1, -0.18, 0.4, 0, 0.55);
  return s;
}

/** double chevron » for AIR DASH */
function dashShape() {
  const s = new THREE.Shape();
  const ch = (ox: number) => {
    s.moveTo(ox - 0.22, 0.42);
    s.lineTo(ox + 0.12, 0);
    s.lineTo(ox - 0.22, -0.42);
    s.lineTo(ox - 0.02, -0.42);
    s.lineTo(ox + 0.32, 0);
    s.lineTo(ox - 0.02, 0.42);
    s.closePath();
  };
  ch(-0.18);
  const s2 = new THREE.Shape();
  s2.moveTo(0.04, 0.42);
  s2.lineTo(0.38, 0);
  s2.lineTo(0.04, -0.42);
  s2.lineTo(0.24, -0.42);
  s2.lineTo(0.58, 0);
  s2.lineTo(0.24, 0.42);
  s2.closePath();
  return [s, s2];
}

/** up arrow for SKY ESCAPE */
function escapeShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.56);
  s.lineTo(0.4, 0.12);
  s.lineTo(0.15, 0.12);
  s.lineTo(0.15, -0.5);
  s.lineTo(-0.15, -0.5);
  s.lineTo(-0.15, 0.12);
  s.lineTo(-0.4, 0.12);
  s.closePath();
  return s;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.45);
  s.bezierCurveTo(-0.1, -0.35, -0.5, -0.05, -0.5, 0.18);
  s.bezierCurveTo(-0.5, 0.42, -0.25, 0.5, 0, 0.3);
  s.bezierCurveTo(0.25, 0.5, 0.5, 0.42, 0.5, 0.18);
  s.bezierCurveTo(0.5, -0.05, 0.1, -0.35, 0, -0.45);
  return s;
}

export const POWER_COLORS: Record<Exclude<PickupKind, 'coin'>, number> = {
  shield: 0x3d9bff,
  magnet: 0xff3b4e,
  turbo: 0xb6ff2e,
  double: 0xffc21a,
  life: 0xff3b6b,
  super: 0x9b6bff,
  dash: 0x2ee6c8,
  escape: 0xff5a3c,
  hyper: 0xffc21a,
  ghost: 0xcfe0ff,
  wall: 0x9b6bff,
  rail: 0xffc21a,
  tunnel: 0x5ee6ff,
  mystery: 0xff4fd8,
};

interface PowerView {
  kind: PickupKind;
  group: THREE.Group;
  icon: THREE.Object3D;
}

function buildPower(kind: Exclude<PickupKind, 'coin'>): PowerView {
  const group = new THREE.Group();
  const color = POWER_COLORS[kind];
  let icon: THREE.Object3D;
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.4 });
  switch (kind) {
    case 'shield': {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(extrude(shieldShape()), mat));
      const inner = new THREE.Mesh(extrude(shieldShape(), 0.05), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, toneMapped: false }));
      inner.scale.setScalar(0.55);
      inner.position.z = 0.1;
      g.add(inner);
      icon = g;
      break;
    }
    case 'magnet': {
      const g = new THREE.Group();
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 12, 24, Math.PI), mat);
      arc.rotation.z = Math.PI;
      g.add(arc);
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xe8edf6, metalness: 0.9, roughness: 0.2 });
      for (const s of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), tipMat);
        tip.position.set(0.3 * s, 0.1, 0);
        g.add(tip);
      }
      icon = g;
      break;
    }
    case 'turbo':
      icon = new THREE.Mesh(extrude(boltShape()), mat);
      break;
    case 'life':
      icon = new THREE.Mesh(extrude(heartShape()), mat);
      break;
    case 'super': {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(extrude(rocketShape()), mat));
      const window_ = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, toneMapped: false }));
      window_.position.set(0, 0.18, 0.1);
      g.add(window_);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 10), new THREE.MeshBasicMaterial({ color: 0x5ad1ff, toneMapped: false }));
      flame.rotation.x = Math.PI;
      flame.position.y = -0.66;
      g.add(flame);
      icon = g;
      break;
    }
    case 'dash': {
      const geo = new THREE.ExtrudeGeometry(dashShape(), { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      geo.center();
      icon = new THREE.Mesh(geo, mat);
      break;
    }
    case 'escape': {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(extrude(escapeShape()), mat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      g.add(ring);
      icon = g;
      break;
    }
    case 'double': {
      icon = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1),
        new THREE.MeshBasicMaterial({ map: iconTexture('2x'), transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
      );
      break;
    }
    case 'hyper': {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(extrude(rocketShape()), mat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: 0xfff3a0, toneMapped: false }));
      g.add(ring);
      icon = g;
      break;
    }
    case 'mystery': {
      // spinning gift cube with a "?" on every face
      const face = new THREE.MeshBasicMaterial({ map: labelTexture('?', color), toneMapped: false });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.78), face));
      const band = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffb300, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.82), band));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.82), band));
      icon = g;
      break;
    }
    default: {
      // Bonus showcase specials: a labelled badge
      const label = { ghost: 'GHOST', wall: 'WALL', rail: 'RAIL', tunnel: 'ROOF' }[kind as 'ghost' | 'wall' | 'rail' | 'tunnel'] ?? '?';
      icon = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ map: labelTexture(label, color), transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
      );
      break;
    }
  }
  icon.scale.setScalar(1.25);
  group.add(icon);
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 24, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(bubble);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glow.scale.setScalar(3);
  group.add(glow);
  return { kind, group, icon };
}

/**
 * Coins are a single InstancedMesh (1 draw call for up to 220 coins).
 * Power-ups are pooled individual meshes.
 */
export class PickupViews {
  private coins: THREE.InstancedMesh;
  private coinGlow: THREE.InstancedMesh;
  private powerPools = new Map<PickupKind, Pool<PowerView>>();
  private activePower = new Map<number, PowerView>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();

  constructor(private parent: THREE.Object3D) {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28);
    geo.rotateX(Math.PI / 2);
    const face = coinFaceTexture();
    const side = new THREE.MeshStandardMaterial({ color: 0xffb81c, metalness: 1, roughness: 0.25, emissive: 0xff9a00, emissiveIntensity: 0.35 });
    const cap = new THREE.MeshStandardMaterial({ map: face, metalness: 0.7, roughness: 0.3, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.45 });
    this.coins = new THREE.InstancedMesh(geo, [side, cap, cap], MAX_COINS);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.count = 0;
    this.coins.frustumCulled = false;
    parent.add(this.coins);
    const glowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    this.coinGlow = new THREE.InstancedMesh(
      glowGeo,
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffb020, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      MAX_COINS,
    );
    this.coinGlow.count = 0;
    this.coinGlow.frustumCulled = false;
    parent.add(this.coinGlow);
  }

  private pool(kind: Exclude<PickupKind, 'coin'>) {
    let p = this.powerPools.get(kind);
    if (!p) {
      p = new Pool(() => buildPower(kind));
      this.powerPools.set(kind, p);
    }
    return p;
  }

  prewarm() {
    for (const k of Object.keys(POWER_COLORS) as Exclude<PickupKind, 'coin'>[]) this.pool(k).prewarm(1);
  }

  spawn(p: LivePickup) {
    if (p.spec.kind === 'coin') return;
    const v = this.pool(p.spec.kind).acquire();
    this.parent.add(v.group);
    this.activePower.set(p.id, v);
  }

  despawn(p: LivePickup) {
    const v = this.activePower.get(p.id);
    if (!v) return;
    this.parent.remove(v.group);
    this.activePower.delete(p.id);
    this.pool(v.kind as Exclude<PickupKind, 'coin'>).release(v);
  }

  update(pickups: LivePickup[], t: number, camQuat: THREE.Quaternion) {
    let n = 0;
    for (const p of pickups) {
      if (p.spec.kind === 'coin') {
        if (n >= MAX_COINS) continue;
        this.e.set(0, t * 4 + p.spec.dist * 0.3, 0);
        this.q.setFromEuler(this.e);
        this.p.set(p.x, p.y + Math.sin(t * 4 + p.spec.dist) * 0.06, p.z);
        this.s.setScalar(p.attracted ? 0.8 : 1);
        this.m.compose(this.p, this.q, this.s);
        this.coins.setMatrixAt(n, this.m);
        this.s.setScalar(1);
        this.m.compose(this.p, camQuat, this.s);
        this.coinGlow.setMatrixAt(n, this.m);
        n++;
      } else {
        const v = this.activePower.get(p.id);
        if (!v) continue;
        v.group.position.set(p.x, p.y + 0.15 + Math.sin(t * 3) * 0.12, p.z);
        v.icon.rotation.y = t * 2.4;
      }
    }
    this.coins.count = n;
    this.coinGlow.count = n;
    this.coins.instanceMatrix.needsUpdate = true;
    this.coinGlow.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const [, v] of this.activePower) {
      this.parent.remove(v.group);
      this.pool(v.kind as Exclude<PickupKind, 'coin'>).release(v);
    }
    this.activePower.clear();
    this.coins.count = 0;
    this.coinGlow.count = 0;
  }
}
