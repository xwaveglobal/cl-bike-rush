import { fitText } from './textures.ts';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeByMaterial } from './merge.ts';

function signTexture(label: string, kind: 'start' | 'finish') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, '#16275e');
  grad.addColorStop(1, '#0a1233');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 192);
  if (kind === 'finish') {
    // checkered borders
    const s = 24;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 1024 / s; x++) {
        g.fillStyle = (x + y) % 2 ? '#ffffff' : '#0a1233';
        g.fillRect(x * s, y * s, s, s);
        g.fillRect(x * s, 192 - (2 - y) * s, s, s);
      }
  }
  // chevrons
  g.strokeStyle = '#4fc3ff';
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.shadowColor = '#4fc3ff';
  g.shadowBlur = 18;
  for (const [x, d] of [[90, -1], [150, -1], [934, 1], [874, 1]] as const) {
    g.beginPath();
    g.moveTo(x - 20 * d, 60);
    g.lineTo(x + 20 * d, 96);
    g.lineTo(x - 20 * d, 132);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = kind === 'finish' ? '#ffc21a' : '#4fc3ff';
  g.shadowBlur = 26;
  g.fillStyle = '#ffffff';
  // stays between the chevrons (x 170..854) with room for the italic slant + glow
  fitText(g, label, 512, 100, 620, 112, 'italic 900 {s} "Arial Black", Arial, sans-serif');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** START / FINISH gantry spanning the road. */
export function makeArch(kind: 'start' | 'finish') {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x1d2440, metalness: 0.85, roughness: 0.35 });
  const neon = new THREE.MeshBasicMaterial({ color: kind === 'finish' ? 0xffc21a : 0x39b6ff, toneMapped: false });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.9, 7.2, 1.2, 2, 0.12), frame);
    leg.position.set(5.2 * s, 3.6, 0);
    g.add(leg);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.6, 1.24), neon);
    strip.position.set(5.2 * s - 0.46 * s, 3.6, 0);
    g.add(strip);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.8), frame);
    foot.position.set(5.2 * s, 0.2, 0);
    g.add(foot);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(11.6, 2.2, 1.3, 2, 0.15), frame);
  beam.position.y = 7.6;
  g.add(beam);
  const under = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.12, 1.34), neon);
  under.position.y = 6.5;
  g.add(under);
  mergeByMaterial(g);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 1.9),
    new THREE.MeshBasicMaterial({ map: signTexture(kind === 'finish' ? 'FINISH' : 'START', kind), toneMapped: false }),
  );
  sign.position.set(0, 7.6, 0.67);
  g.add(sign);
  const back = sign.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.67;
  g.add(back);
  g.visible = false;
  return g;
}
