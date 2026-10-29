// v2.2 Bonus roads: tunnel sections (rock / trees / barn / sea glass) placed along the road.
// Pure visuals — the spawner decides where they are (Spawner.tunnels()); Tunnel Rider uses them.
import * as THREE from 'three';

type Theme = 'desert' | 'forest' | 'country' | 'sea';

const LOOK: Record<Theme, { shell: number; rib: number; glow: number; opacity: number }> = {
  desert: { shell: 0x8a4e2a, rib: 0x5e3218, glow: 0xffb35a, opacity: 1 },
  forest: { shell: 0x1f5a24, rib: 0x4a2f1a, glow: 0xb6ff6a, opacity: 1 },
  country: { shell: 0x8e2a20, rib: 0xd9b47a, glow: 0xffd27a, opacity: 1 },
  sea: { shell: 0x2fa8e8, rib: 0xe8f6ff, glow: 0x7fe6ff, opacity: 0.32 },
};

const R = 9.5;

export class BonusTunnels {
  group = new THREE.Group();
  private items: { g: THREE.Group; from: number; len: number }[] = [];

  set(sections: { from: number; to: number }[], theme: string | null) {
    for (const it of this.items) {
      this.group.remove(it.g);
      it.g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.items = [];
    if (!theme || !(theme in LOOK)) return;
    const L = LOOK[theme as Theme];
    for (const s of sections) {
      const len = s.to - s.from;
      const g = new THREE.Group();
      const shellGeo = new THREE.CylinderGeometry(R, R, len, 18, 1, true, Math.PI / 2, Math.PI);
      shellGeo.rotateX(Math.PI / 2);
      shellGeo.translate(0, -0.4, -len / 2);
      const shell = new THREE.Mesh(
        shellGeo,
        new THREE.MeshBasicMaterial({ color: L.shell, side: THREE.DoubleSide, transparent: L.opacity < 1, opacity: L.opacity, depthWrite: L.opacity >= 1, fog: true }),
      );
      g.add(shell);
      const ribMat = new THREE.MeshBasicMaterial({ color: L.rib, fog: true });
      for (let z = 0; z <= len; z += 8) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(R - 0.15, z === 0 || z + 8 > len ? 0.7 : 0.28, 6, 20, Math.PI), ribMat);
        rib.position.set(0, -0.4, -z);
        g.add(rib);
      }
      // a soft light strip along the crown
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, len), new THREE.MeshBasicMaterial({ color: L.glow, toneMapped: false, fog: true }));
      strip.position.set(0, R - 0.55, -len / 2);
      g.add(strip);
      g.visible = false;
      this.group.add(g);
      this.items.push({ g, from: s.from, len });
    }
  }

  update(dist: number) {
    for (const it of this.items) {
      const z = -(it.from - dist);
      it.g.position.z = z;
      // visible from ~260 m ahead until the exit is behind the camera
      it.g.visible = z > -260 && z - it.len < 20;
    }
  }
}
