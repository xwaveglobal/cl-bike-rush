import * as THREE from 'three';
import { LANES } from '../config.ts';
import type { LiveObstacle } from '../gameplay/World.ts';
import { PASS_N } from '../gameplay/types.ts';

/**
 * Road guides for MOVING obstacles (drones, sliding platforms, oncoming traffic):
 *  - red hazard strip in every lane the obstacle can occupy, with arrows showing how it moves
 *    (⇄ for sweeping drones/platforms, chevrons toward the car for traffic)
 *  - a green "go here" arrow in each lane that is open at driving height
 * Painted flat on the road ahead of the obstacle so the safe lane is readable at a glance.
 */

const tex = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = tex.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  tex.set(key, t);
  return t;
}

/** red strip, chevrons pointing down the texture (= toward the car once laid on the road) */
const oncomingTex = () =>
  canvasTex('oncoming', 128, 512, (g) => {
    const grd = g.createLinearGradient(0, 0, 128, 0);
    grd.addColorStop(0, 'rgba(255,40,60,0)');
    grd.addColorStop(0.15, 'rgba(255,40,60,.32)');
    grd.addColorStop(0.85, 'rgba(255,40,60,.32)');
    grd.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 512);
    g.fillStyle = 'rgba(255,90,100,.95)';
    for (let y = 30; y < 512; y += 96) {
      g.beginPath();
      g.moveTo(24, y);
      g.lineTo(64, y + 40);
      g.lineTo(104, y);
      g.lineTo(104, y + 22);
      g.lineTo(64, y + 62);
      g.lineTo(24, y + 22);
      g.closePath();
      g.fill();
    }
  });

/** amber strip: something slides across these lanes (no arrows) */
const sweepTex = () =>
  canvasTex('sweep', 512, 256, (g) => {
    g.fillStyle = 'rgba(255,140,30,.22)';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(255,190,60,.9)';
    g.lineWidth = 8;
    g.setLineDash([26, 18]);
    g.strokeRect(6, 6, 500, 244);
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,214,90,.98)';
    const arrow = (y: number, dir: 1 | -1) => {
      const x0 = dir > 0 ? 70 : 442;
      const x1 = dir > 0 ? 400 : 112;
      g.fillRect(Math.min(x0, x1), y - 12, Math.abs(x1 - x0), 24);
      g.beginPath();
      const tip = dir > 0 ? 452 : 60;
      g.moveTo(tip, y);
      g.lineTo(tip - dir * 70, y - 46);
      g.lineTo(tip - dir * 70, y + 46);
      g.closePath();
      g.fill();
    };
    void arrow; // the ⇄ arrows were removed (v1.11): the calm amber zone alone marks the sweep
  });

/** floating "MOVING ⇄" sign above sweeping obstacles */
const signTex = () =>
  canvasTex('sign', 384, 160, (g) => {
    g.fillStyle = 'rgba(20,14,0,.78)';
    g.strokeStyle = '#ffc21a';
    g.lineWidth = 10;
    g.beginPath();
    if (g.roundRect) g.roundRect(8, 8, 368, 144, 34);
    else g.rect(8, 8, 368, 144);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffd24a';
    g.font = '900 italic 86px Arial Black, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('⇠ ⇢', 192, 84);
  });

/** green "go here" arrow pointing up the texture (= away from the car) */
const goTex = () =>
  canvasTex('go', 256, 384, (g) => {
    g.shadowColor = 'rgba(61,255,139,.9)';
    g.shadowBlur = 24;
    g.fillStyle = 'rgba(61,255,139,.95)';
    g.beginPath();
    g.moveTo(128, 20);
    g.lineTo(236, 160);
    g.lineTo(168, 160);
    g.lineTo(168, 360);
    g.lineTo(88, 360);
    g.lineTo(88, 160);
    g.lineTo(20, 160);
    g.closePath();
    g.fill();
  });

/** yellow/black caution bar painted across the road before a hard (tier 3+) row */
const warnTex = () =>
  canvasTex('warn', 512, 64, (g) => {
    g.fillStyle = 'rgba(20,14,0,.55)';
    g.fillRect(0, 0, 512, 64);
    g.fillStyle = 'rgba(255,200,40,.92)';
    for (let x = -64; x < 576; x += 48) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 24, 64);
      g.lineTo(x + 56, 0);
      g.lineTo(x + 32, 0);
      g.closePath();
      g.fill();
    }
  });

/** red hatched "closed" lane in front of a gate wall */
const blockTex = () =>
  canvasTex('block', 128, 512, (g) => {
    g.fillStyle = 'rgba(255,40,60,.22)';
    g.fillRect(0, 0, 128, 512);
    g.strokeStyle = 'rgba(255,70,80,.85)';
    g.lineWidth = 10;
    for (let y = -128; y < 640; y += 56) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(128, y + 128);
      g.stroke();
    }
    g.strokeRect(5, 5, 118, 502);
  });

const mat = (map: THREE.Texture) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2 });

export const isMoving = (o: LiveObstacle) => o.spec.type === 'drone' || o.spec.type === 'platform' || o.spec.type === 'traffic';
/** first obstacle of a hard (tier 3+) row carries the row's caution bar */
const leadsHardRow = (o: LiveObstacle) => (o.row.tier ?? 0) >= 3 && o.row.obstacles[0] === o.spec;
const needsGuide = (o: LiveObstacle) => isMoving(o) || o.spec.type === 'gate' || leadsHardRow(o);

interface Guide {
  group: THREE.Group;
  sign: THREE.Sprite;
  warn: THREE.Mesh;
  go2: THREE.Mesh;
  hazard: THREE.Mesh[];
  go: THREE.Mesh[];
  mats: THREE.MeshBasicMaterial[];
}

export class Guides {
  private active = new Map<number, Guide>();
  private free: Guide[] = [];
  private flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  constructor(private parent: THREE.Object3D) {}

  private make(): Guide {
    const group = new THREE.Group();
    const hazard: THREE.Mesh[] = [];
    const go: THREE.Mesh[] = [];
    const mats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const hm = mat(oncomingTex());
      const h = new THREE.Mesh(this.flat, hm);
      h.renderOrder = 2;
      group.add(h);
      hazard.push(h);
      const gm = mat(goTex());
      const g = new THREE.Mesh(this.flat, gm);
      g.renderOrder = 2;
      group.add(g);
      go.push(g);
      mats.push(hm, gm);
    }
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex(), transparent: true, depthWrite: false, toneMapped: false }));
    sign.scale.set(2.6, 1.08, 1);
    group.add(sign);
    const wm = mat(warnTex());
    const warn = new THREE.Mesh(this.flat, wm);
    warn.renderOrder = 2;
    group.add(warn);
    const g2m = mat(goTex());
    const go2 = new THREE.Mesh(this.flat, g2m);
    go2.renderOrder = 2;
    group.add(go2);
    mats.push(wm, g2m);
    return { group, sign, warn, go2, hazard, go, mats };
  }

  spawn(o: LiveObstacle) {
    if (!needsGuide(o)) return;
    const g = this.free.pop() ?? this.make();
    const s = o.spec;
    // caution bar ~30 m before any hard row
    g.warn.visible = leadsHardRow(o);
    g.warn.scale.set(8.2, 1, 0.55);
    g.warn.position.set(0, 0.036, 30);
    g.go2.visible = false;
    g.sign.visible = false;
    if (!isMoving(o)) {
      for (let i = 0; i < 3; i++) g.hazard[i].visible = g.go[i].visible = false;
      if (s.type === 'gate') {
        // the one open door is obvious from far away: green arrows lead in, closed lanes are hatched red
        const door = s.door ?? 1;
        for (let i = 0; i < 3; i++) {
          const h = g.hazard[i];
          h.visible = i !== door;
          (h.material as THREE.MeshBasicMaterial).map = blockTex();
          h.scale.set(1.6, 1, 24);
          h.position.set(LANES[i], 0.035, 14);
        }
        g.go[door].visible = true;
        g.go[door].scale.set(0.8, 1, 1.4);
        g.go[door].position.set(LANES[door], 0.04, 12);
        g.go2.visible = true;
        g.go2.scale.set(0.8, 1, 1.4);
        g.go2.position.set(LANES[door], 0.04, 30);
      }
      this.parent.add(g.group);
      this.active.set(o.id, g);
      return;
    }
    const lanes = s.type === 'traffic' ? [s.lane] : [Math.min(s.lane, s.lane2 ?? s.lane), Math.max(s.lane, s.lane2 ?? s.lane)];
    const covered = (i: number) => i >= lanes[0] && i <= lanes[lanes.length - 1];
    for (let i = 0; i < 3; i++) {
      const h = g.hazard[i];
      const on = covered(i);
      h.visible = on && (s.type === 'traffic' || i === lanes[0]);
      if (s.type === 'traffic') {
        (h.material as THREE.MeshBasicMaterial).map = oncomingTex();
        h.scale.set(1.3, 1, 26);
        h.position.set(LANES[i], 0.035, 13);
      } else {
        // one strip spanning all swept lanes
        (h.material as THREE.MeshBasicMaterial).map = sweepTex();
        const x0 = LANES[lanes[0]] - 1.2;
        const x1 = LANES[lanes[1]] + 1.2;
        h.scale.set(x1 - x0, 1, 16);
        h.position.set((x0 + x1) / 2, 0.035, 4);
      }
      const free = (o.row.masks[i] & PASS_N) !== 0 && !on;
      g.go[i].visible = free;
      g.go[i].scale.set(0.75, 1, 1.3);
      g.go[i].position.set(LANES[i], 0.04, 15);
    }
    g.sign.visible = false; // no floating ⇠ ⇢ sign
    g.warn.visible = leadsHardRow(o);
    g.sign.position.set((LANES[lanes[0]] + LANES[lanes[lanes.length - 1]]) / 2, 3.6, 0);
    this.parent.add(g.group);
    this.active.set(o.id, g);
  }

  despawn(o: LiveObstacle) {
    const g = this.active.get(o.id);
    if (!g) return;
    this.parent.remove(g.group);
    this.active.delete(o.id);
    this.free.push(g);
  }

  update(obstacles: LiveObstacle[], _t: number) {
    for (const o of obstacles) {
      const g = this.active.get(o.id);
      if (!g) continue;
      // traffic closes faster than the road: anchor the guide to the row, not the car
      const ahead = -o.z;
      g.group.position.z = o.z;
      // visible from 120 m out, fade once the car is almost there
      const a = Math.min(1, Math.max(0, (120 - ahead) / 25)) * Math.min(1, Math.max(0, (ahead - 4) / 10));
      const pulse = 0.85; // steady (no pulsing paint on the road)
      for (let i = 0; i < g.mats.length; i++) g.mats[i].opacity = a * (i % 2 ? pulse : 1);
      (g.sign.material as THREE.SpriteMaterial).opacity = a * Math.min(1, Math.max(0, (ahead - 12) / 10));
      g.group.visible = a > 0.01 && !o.smashed;
    }
  }

  clear() {
    for (const [, g] of this.active) {
      this.parent.remove(g.group);
      this.free.push(g);
    }
    this.active.clear();
  }
}
