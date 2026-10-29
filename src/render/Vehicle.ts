import * as THREE from 'three';
import { Spring, clamp, clamp01, lerp } from '../core/math.ts';
import { HEIGHT } from '../config.ts';
import { glowTexture } from './textures.ts';
import type { Player } from '../gameplay/Player.ts';
import vegaBack from '../assets/images/car/vega-back.webp';
import { buildBikeRiderAsset, type BikeRiderRig } from './BikeRiderAsset.ts';

export type CarShape = 'gt' | 'wedge' | 'muscle' | 'bubble' | 'cyber';

export interface VehicleSkin {
  id: string;
  name: string;
  /** body style (silhouette); colourways share a shape */
  shape: CarShape;
  /** short class label shown in the garage */
  cls: string;
  body: number;
  trim: number;
  glass: number;
  glow: number;
  accent: number;
  /** coins to unlock (after reaching `need`) */
  price: number;
  rarity?: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
  /** rank class required before the car can be bought */
  need?: string;
  /** score bonus in % while driving this car */
  bonus?: number;
  /** how strongly the X1 render's body paint is recoloured (0 = original pearl) */
  tintAmt?: number;
  /** speed / acceleration / handling / energy, out of 10 (display) */
  stats?: [number, number, number, number];
  skills?: { name: string; desc: string }[];
  /** own rear render (instead of the tinted X1): no tread layer / boost art (they are aligned to the X1) */
  rear?: string;
}

export const SKINS: VehicleSkin[] = [
  { id: 'zenith', name: 'Blue White', shape: 'gt', cls: 'Common · Balanced Sky Sportbike', rarity: 'Common', need: 'D', price: 0, bonus: 0, tintAmt: 0,
    body: 0xeef3fc, trim: 0x181c26, glass: 0x0a0d16, glow: 0x2ef2ff, accent: 0x1c64ff, stats: [7, 7, 8, 7],
    skills: [{ name: 'Aero Nitro', desc: 'High-velocity slipstream burst.' }, { name: 'Gyro Stabilizer', desc: 'Precision cornering and air control.' }] },
  { id: 'vega', name: 'Red Force', shape: 'gt', cls: 'Rare · Crimson Apex Sportbike', rarity: 'Rare', need: 'C', price: 0, bonus: 0, tintAmt: 0.88, rear: vegaBack,
    body: 0xe01e2b, trim: 0x181a20, glass: 0x0a0d16, glow: 0xff3b4e, accent: 0xff2a3c, stats: [8, 8, 8, 7],
    skills: [{ name: 'Crimson Surge', desc: 'Rapid acceleration out of lane shifts.' }, { name: 'Apex Grip', desc: 'Razor-sharp lean response.' }] },
  { id: 'volt', name: 'Purple Shadow', shape: 'gt', cls: 'Rare · Ion Slipstream Bike', rarity: 'Rare', need: 'B', price: 0, bonus: 0, tintAmt: 0.92,
    body: 0x7a3cff, trim: 0x141222, glass: 0x05060a, glow: 0xb46bff, accent: 0x8a4dff, stats: [9, 9, 8, 8],
    skills: [{ name: 'Ion Burst', desc: 'Massive speed boost for 5 seconds.' }, { name: 'Shockwave', desc: 'Pushes nearby obstacles out of the way.' }] },
  { id: 'phantom', name: 'Gold Legend', shape: 'gt', cls: 'Epic · Championship Gold Edition', rarity: 'Epic', need: 'A', price: 0, bonus: 0, tintAmt: 0.88,
    body: 0xe5b546, trim: 0x1d1912, glass: 0x140c00, glow: 0xffd23d, accent: 0xffc21a, stats: [9, 8, 9, 9],
    skills: [{ name: 'Phase Shift', desc: 'Turns semi-invisible for 3 seconds.' }, { name: 'Flux Magnet', desc: 'Automatically pulls nearby coins.' }] },
  { id: 'inferno', name: 'Green Emerald', shape: 'gt', cls: 'Legendary · Cyber Emerald Interceptor', rarity: 'Legendary', need: 'AA', price: 0, bonus: 0, tintAmt: 0.92,
    body: 0x24d64a, trim: 0x141c16, glass: 0x041208, glow: 0x3dff78, accent: 0x1ee05a, stats: [10, 9, 9, 8],
    skills: [{ name: 'Emerald Trail', desc: 'Shatters road barriers on contact.' }, { name: 'Overdrive Rush', desc: 'Extreme speed boost for 8 seconds.' }] },
  { id: 'nexus', name: 'Silver Frost', shape: 'gt', cls: 'Mythic · Titanium Pearl Hyperbike', rarity: 'Mythic', need: 'AAA', price: 0, bonus: 0, tintAmt: 0.35,
    body: 0xf4f8ff, trim: 0xb8c4d8, glass: 0x0b1830, glow: 0x5ceeff, accent: 0x3cf2ff, stats: [10, 10, 10, 9],
    skills: [{ name: 'Sky Glide', desc: 'Extended air-dash trajectory across sky gaps.' }, { name: 'Cryo Shield', desc: 'Reinforced energy barrier.' }] },
  { id: 'stealth', name: 'Black Stealth', shape: 'gt', cls: 'Mythic · Matte Carbon Phantom', rarity: 'Mythic', need: 'AAA', price: 0, bonus: 0, tintAmt: 0.95,
    body: 0x1c202a, trim: 0x2d3446, glass: 0x050811, glow: 0x00d8ff, accent: 0x1a8cff, stats: [10, 10, 10, 10],
    skills: [{ name: 'Shadow Cloak', desc: 'Slips past laser gates undetected.' }, { name: 'Silent Afterburner', desc: 'Zero-drag maximum top speed.' }] },
  { id: 'blaze', name: 'Orange Blaze', shape: 'gt', cls: 'Mythic · Solar Plasma Superbike', rarity: 'Mythic', need: 'AAA', price: 0, bonus: 0, tintAmt: 0.92,
    body: 0xff6e1a, trim: 0x1c1816, glass: 0x140802, glow: 0xff9a2e, accent: 0xff7a1a, stats: [10, 10, 10, 10],
    skills: [{ name: 'Solar Nova', desc: 'Explosive launch and double coin aura.' }, { name: 'Hyper Ignition', desc: 'Full-power plasma thruster overdrive.' }] },
];

/**
 * Garage visibility: owned cars and the NEXT car to earn are shown in full colour (the next one
 * stays locked, to make players curious); every car after that is a black silhouette.
 */
export function carVisibility(unlocked: string[], id: string): 'own' | 'next' | 'dark' {
  if (unlocked.includes(id)) return 'own';
  const next = SKINS.find((k) => !unlocked.includes(k.id));
  return next?.id === id && next.need === 'C' ? 'next' : 'dark';
}

const CYAN = new THREE.Color(0x2ef2ff);
const ORANGE = new THREE.Color(0xff8a1f);

/**
 * Main 3D Player Asset: Futuristic Motorcycle with Rider.
 * Replaces the previous car visual representation while preserving all gameplay mechanics,
 * hitboxes, camera rig, and particle/effect attachment hooks.
 */
export class Vehicle {
  root = new THREE.Group();
  private bank = new THREE.Group();
  private pitch = new THREE.Group();
  private squashG = new THREE.Group();

  /** Complete 3D motorcycle and skinned rider asset */
  readonly bikeRig: BikeRiderRig;

  private leanSpring = new Spring(0, 135, 18);
  private yawSpring = new Spring(0, 120, 18);
  private pitchSpring = new Spring(0, 95, 16);
  private downSpring = new Spring(0, 180, 22);

  private time = 0;
  private lastY = 1;
  private skin: VehicleSkin = SKINS[0];
  private celebrate = 0;
  private celebrateTotal = Math.PI * 2;
  private celebrateDir = 1;
  private celebrateSpeed = 9;
  private lastAir = 0;
  private wheelAngle = 0;
  private flameColor = new THREE.Color();

  private underglow: THREE.Mesh;
  private contactShadow: THREE.Mesh;
  private nozzleAnchors: THREE.Object3D[] = [];
  private wheelAnchors: THREE.Object3D[] = [];

  visibleBlink = true;
  locked = false;
  camera: THREE.Camera | null = null;
  rearOnly = true;

  shieldTarget = 0;
  private shieldK = 0;
  private shieldHitK = 0;

  boostTarget = 0;
  private boostK = 0;
  private boostHold = 0;

  auraTarget = 0;
  private auraK = 0;

  showcase: { kind: 'ghost' | 'wall' | 'rail' | 'tunnel'; e: number } | null = null;
  private ghostHid = false;

  private origMatState = new Map<
    THREE.Material,
    {
      colorHex: number;
      emissiveHex: number;
      emissiveIntensity: number;
      roughness: number;
      metalness: number;
      envMapIntensity: number;
      clearcoat?: number;
    }
  >();

  constructor() {
    this.root.add(this.bank);
    this.bank.add(this.pitch);
    this.pitch.add(this.squashG);

    // Build complete 3D futuristic motorcycle and articulated rider
    // LOD 1 = gameplay detail (~41k tris); 0 = garage/close-up, 2 = low-end phones
    this.bikeRig = buildBikeRiderAsset(512, 1);
    this.squashG.add(this.bikeRig.root);

    // Record original material properties for skin tinting and locked silhouette mode
    this.bikeRig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial && !this.origMatState.has(m)) {
          this.origMatState.set(m, {
            colorHex: m.color.getHex(),
            emissiveHex: m.emissive.getHex(),
            emissiveIntensity: m.emissiveIntensity,
            roughness: m.roughness,
            metalness: m.metalness,
            envMapIntensity: m.envMapIntensity,
            clearcoat: m instanceof THREE.MeshPhysicalMaterial ? m.clearcoat : undefined,
          });
        }
      }
    });

    // Subtle ground contact shadow + controlled cyan underglow on the asphalt
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 256;
    const sg = shadowCanvas.getContext('2d')!;
    const rad = sg.createRadialGradient(64, 128, 6, 64, 128, 60);
    rad.addColorStop(0, 'rgba(0,0,0,0.78)');
    rad.addColorStop(0.55, 'rgba(0,0,0,0.36)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = rad;
    sg.fillRect(0, 0, 128, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowGeo = new THREE.PlaneGeometry(0.95, 2.35);
    shadowGeo.rotateX(-Math.PI / 2);
    this.contactShadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    );
    this.contactShadow.position.set(0, -0.49, 0.02);
    this.root.add(this.contactShadow);

    const ugGeo = new THREE.PlaneGeometry(1.15, 2.45);
    ugGeo.rotateX(-Math.PI / 2);
    this.underglow = new THREE.Mesh(
      ugGeo,
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: 0x2ef2ff,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.underglow.position.set(0, -0.485, 0.04);
    this.root.add(this.underglow);

    // Attachment anchors for existing game particle trails / tyre spray
    // 0, 1: front/rear left; 2, 3: front/rear right / exhaust
    const anchorPositions: [number, number, number][] = [
      [-0.14, 0.34, 0.56],  // left rear tail / swingarm
      [0.21, 0.52, 0.51],   // right-side round silencer outlet (+X) — BikeBody.ts
      [-0.038, 0.97, 0.91], // left V tail lamp (rear face) — BikeBody.ts
      [0.038, 0.97, 0.91],  // right V tail lamp (rear face) — BikeBody.ts
    ];
    for (const [ax, ay, az] of anchorPositions) {
      const a = new THREE.Object3D();
      a.position.set(ax, ay, az);
      this.bikeRig.chassisGroup.add(a);
      this.nozzleAnchors.push(a);
    }

    const wheelContactPositions: [number, number, number][] = [
      [0, 0.03, -0.72], // front tyre contact
      [0, 0.03, 0.70],  // rear tyre contact
      [-0.11, 0.03, 0.70], // rear left edge
      [0.11, 0.03, 0.70],  // rear right edge
    ];
    for (const [wx, wy, wz] of wheelContactPositions) {
      const w = new THREE.Object3D();
      w.position.set(wx, wy, wz);
      this.bikeRig.root.add(w);
      this.wheelAnchors.push(w);
    }
  }

  resetFx() {
    this.auraTarget = 0;
    this.auraK = 0;
    this.shieldTarget = 0;
    this.shieldK = 0;
    this.shieldHitK = 0;
    this.boostTarget = 0;
    this.boostK = 0;
    this.boostHold = 0;
  }

  shieldHit() {
    this.shieldHitK = 1;
  }

  boostKick(k = 1) {
    this.boostHold = Math.max(this.boostHold, 0.55 * k);
  }

  /** Returns null so crashes use the 3D shatter debris system instead of a 2D billboard shatter */
  shatterSource(): { tex: THREE.Texture; tint: THREE.Color; tintAmt: number; matrix: THREE.Matrix4 } | null {
    return null;
  }

  /** Always false — the main player vehicle is a real 3D motorcycle and rider */
  get usesSprite() {
    return false;
  }

  jetWorld(i: number, out: THREE.Vector3) {
    const a = this.nozzleAnchors[i % this.nozzleAnchors.length];
    out.set(0, 0, 0);
    return a.localToWorld(out);
  }

  private applyMaterialState() {
    for (const [mat, orig] of this.origMatState) {
      const std = mat as THREE.MeshStandardMaterial;
      std.color.setHex(orig.colorHex);
      std.emissive.setHex(orig.emissiveHex);
      std.emissiveIntensity = orig.emissiveIntensity;
      std.roughness = orig.roughness;
      std.metalness = orig.metalness;
      std.envMapIntensity = orig.envMapIntensity;
      if (std instanceof THREE.MeshPhysicalMaterial && orig.clearcoat !== undefined) {
        std.clearcoat = orig.clearcoat;
      }

      if (this.locked) {
        std.color.multiplyScalar(0.07);
        std.emissiveIntensity = orig.emissiveIntensity * 0.04;
        std.envMapIntensity = 0.08;
        std.roughness = 0.85;
        std.metalness = 0.1;
        if (std instanceof THREE.MeshPhysicalMaterial) {
          std.clearcoat = 0;
        }
      }
    }
  }

  setSkin(skin: VehicleSkin, locked = false) {
    this.skin = skin;
    this.locked = locked;
    this.applyMaterialState();
    (this.underglow.material as THREE.MeshBasicMaterial).color.setHex(skin.id === 'zenith' ? 0x2ef2ff : skin.glow);
    this.underglow.visible = !locked;
    this.contactShadow.visible = true;
  }

  /**
   * Optional replacement hook for external GLB models loaded via AssetLoader.
   * When bike_rider.glb or the procedural BikeRiderAsset is active, keeps the rigged motorcycle.
   */
  useModel(_obj: THREE.Object3D) {
    // The built-in BikeRiderAsset provides the complete articulated skeleton and procedural IK/animations;
    // keep it active so runtime pose blending (StraightRide, LeanLeft/Right, AirborneJump, DownSlide, LowTuck)
    // operates seamlessly across all game states.
  }

  barrelRoll(turns = 1, dir: 1 | -1 = 1, speed = 9) {
    if (this.lastAir < 0.5) return;
    this.celebrateDir = dir;
    this.celebrateSpeed = speed;
    this.celebrateTotal = Math.PI * 2 * turns;
    this.celebrate = this.celebrateTotal;
  }

  resetPose() {
    this.leanSpring.snap(0);
    this.yawSpring.snap(0);
    this.pitchSpring.snap(0);
    this.downSpring.snap(0);
    this.celebrate = 0;
    this.bank.rotation.set(0, 0, 0);
    this.pitch.rotation.set(0, 0, 0);
    this.squashG.scale.set(1, 1, 1);
    this.bikeRig.applyPose({
      lean: 0,
      air: 0,
      downSlide: 0,
      lowTuck: 0,
      pitch: 0,
      wheelSpin: this.wheelAngle,
      time: this.time,
    });
  }

  update(p: Player, dt: number, speed: number, turbo: number) {
    this.time += dt;
    const t = this.time;

    // Gameplay height -> visual root height
    const vy =
      p.y <= HEIGHT.NORMAL
        ? lerp(0.3, 0.51, clamp01((p.y - HEIGHT.LOW) / (HEIGHT.NORMAL - HEIGHT.LOW)))
        : p.y <= HEIGHT.HIGH
          ? lerp(0.51, 3.35, clamp01((p.y - HEIGHT.NORMAL) / (HEIGHT.HIGH - HEIGHT.NORMAL)))
          : 3.35 + (p.y - HEIGHT.HIGH);
    this.root.position.set(p.x, vy, 0);

    // Keep tyres planted at world Y = 0 while on the road or in DownSlide, and lift smoothly when airborne
    const groundOffset = vy <= 0.51 ? -vy : -0.51;
    this.bikeRig.root.position.y = groundOffset;

    // v2 Bonus showcase specials (wall run / sky rail / tunnel roof / phase ghost)
    const sc = this.showcase;
    let scRoll = 0;
    if (this.ghostHid) {
      this.root.visible = true;
      this.ghostHid = false;
    }
    if (sc && sc.e > 0) {
      const e = sc.e;
      const side = p.x >= 0 ? 1 : -1;
      if (sc.kind === 'wall') {
        this.root.position.x = lerp(p.x, side * 3.1, e);
        this.root.position.y += 0.75 * e;
        scRoll = -side * 0.85 * e;
      } else if (sc.kind === 'rail') {
        this.root.position.y += 2.3 * e + Math.sin(this.time * 2.4) * 0.15 * e;
      } else if (sc.kind === 'tunnel') {
        this.root.position.y += 1.9 * e;
        scRoll = Math.PI * e;
      }
    }

    // Lateral velocity -> normalized lean (-1 left .. +1 right)
    const laneSpeed = 2.6 / 0.19;
    const lat = clamp(p.vx / laneSpeed, -1.25, 1.25);
    this.leanSpring.target = lat;
    this.yawSpring.target = -lat * 0.045;

    const vVel = dt > 0 ? (p.y - this.lastY) / dt : 0;
    this.lastY = p.y;
    this.pitchSpring.target = clamp(vVel * 0.026, -0.16, 0.22) - turbo * 0.035;

    // DownSlide state driven by p.retract (0 = normal riding, 1 = diving under barrier)
    this.downSpring.target = clamp01(p.retract);

    this.leanSpring.update(dt);
    this.yawSpring.update(dt);
    this.pitchSpring.update(dt);
    this.downSpring.update(dt);

    let extraRoll = 0;
    if (this.celebrate > 0) {
      const step = Math.min(this.celebrate, dt * this.celebrateSpeed);
      this.celebrate -= step;
      extraRoll = (this.celebrateTotal - this.celebrate) * this.celebrateDir;
    }

    // Apply celebration or showcase roll on bank group; bike's own lean & DownSlide bank happen inside bikeRig
    this.bank.rotation.set(0, this.yawSpring.value, extraRoll + scRoll);
    this.pitch.rotation.set(0, 0, 0);

    // Fine high-frequency road vibration when riding on asphalt
    const roadVib =
      (Math.sin(t * 43) * 0.5 + Math.sin(t * 67.3) * 0.35 + Math.sin(t * 13.1) * 0.15) *
      0.009 *
      clamp01(speed / 28) *
      (1 - p.air) *
      (1 - this.downSpring.value * 0.5);
    this.pitch.position.y = roadVib + Math.sin(t * 3.2) * 0.03 * p.air;

    // IMPORTANT: Never shrink/squash the model to fake reduced height. Keep scale strictly 1, 1, 1.
    this.squashG.scale.set(1, 1, 1);

    const air = clamp01(p.air);
    this.lastAir = air;

    // Wheel spin angle (forward travel rotates wheels around -X)
    const wheelRate = Math.min(speed / 0.31, 28) * lerp(1, 0.35, air);
    this.wheelAngle = (this.wheelAngle + wheelRate * dt) % (Math.PI * 200);

    // Compute pose weights:
    // - downSlide: extreme low slide (Image 3) when diving under overhead barriers
    // - lowTuck: upright aerodynamic tuck (Image 7) during transition into/out of slide or during ground turbo
    const rawDown = clamp01(this.downSpring.value);
    const downSlide = clamp01((rawDown - 0.12) / 0.88);
    const transitionTuck = Math.sin(clamp01(rawDown / 0.45) * Math.PI) * (1 - downSlide) * 0.65;
    const turboTuck = clamp01(turbo) * (1 - air) * (1 - downSlide) * 0.75;
    const lowTuck = clamp01(Math.max(transitionTuck, turboTuck));

    this.bikeRig.applyPose({
      lean: clamp(this.leanSpring.value, -1, 1),
      air,
      downSlide,
      lowTuck,
      pitch: this.pitchSpring.value,
      wheelSpin: this.wheelAngle,
      time: t,
    });

    // Controlled cyan & red tail light intensity modulation on boost / braking
    this.boostHold = Math.max(0, this.boostHold - dt);
    const bTarget = Math.max(this.boostTarget, this.boostHold > 0 ? 1 : 0, turbo);
    this.boostK += (bTarget - this.boostK) * (1 - Math.exp(-8 * dt));
    this.shieldK += (this.shieldTarget - this.shieldK) * (1 - Math.exp(-7 * dt));
    this.shieldHitK = Math.max(0, this.shieldHitK - dt * 2.5);
    this.auraK += (this.auraTarget - this.auraK) * (1 - Math.exp(-6 * dt));

    if (!this.locked) {
      this.bikeRig.materials.cyanGlow.emissiveIntensity = 2.2 + this.boostK * 0.9 + p.engine * 0.3;
      this.bikeRig.materials.redGlow.emissiveIntensity = 2.0 + downSlide * 1.1;
    }

    // Underglow & contact shadow stay on the road plane (world Y ≈ 0.025)
    this.flameColor.copy(CYAN).lerp(ORANGE, p.orange);
    if (this.skin.id !== 'zenith') {
      this.flameColor.lerp(new THREE.Color(this.skin.glow), 0.35 * (1 - p.orange));
    }
    this.underglow.position.y = -vy + 0.03;
    const ugMat = this.underglow.material as THREE.MeshBasicMaterial;
    ugMat.opacity = clamp(0.32 - (vy - 0.5) * 0.14, 0.06, 0.42) * (this.locked ? 0 : 1);
    ugMat.color.copy(this.flameColor);
    this.underglow.scale.setScalar(1 + Math.max(0, vy - 0.5) * 0.12);

    this.contactShadow.position.y = -vy + 0.022;
    const shMat = this.contactShadow.material as THREE.MeshBasicMaterial;
    shMat.opacity = clamp(0.62 - (vy - 0.51) * 0.24, 0.12, 0.62);
    this.contactShadow.scale.set(
      1 + downSlide * 0.35 + Math.max(0, vy - 0.51) * 0.12,
      1 + Math.max(0, vy - 0.51) * 0.1,
      1,
    );

    this.root.visible = this.visibleBlink;
  }

  nozzleWorld(i: number, out: THREE.Vector3) {
    const a = this.nozzleAnchors[i % this.nozzleAnchors.length];
    out.set(0, 0, 0);
    return a.localToWorld(out);
  }

  rearTyreWorld(side: -1 | 1, out: THREE.Vector3) {
    const a = side < 0 ? this.wheelAnchors[2] : this.wheelAnchors[3];
    a.getWorldPosition(out);
    out.y = 0.05;
    return out;
  }

  contactWorld(i: number, out: THREE.Vector3) {
    const a = this.wheelAnchors[i % this.wheelAnchors.length];
    a.getWorldPosition(out);
    out.y = 0.03;
    return out;
  }

  get podCount() {
    return this.nozzleAnchors.length;
  }
}
