import * as THREE from 'three';
import { OVERLAY_LAYER } from './Renderer.ts';
import type { Vehicle } from './Vehicle.ts';

/**
 * Game-over crash: a FEW pieces break off the car (bumper corners, diffuser, mirrors) and fly away,
 * spin, fall and fade — the car itself stays on the road (only chipped, not blown apart).
 * Shards are cut from the exact studio image (same texture + tint) and drawn in the overlay pass,
 * so the wreck looks like the real car coming apart.
 */
const COLS = 8;
const ROWS = 5;

interface Shard {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  v: THREE.Vector3;
  w: THREE.Vector3;
}

export class CarShatter {
  group = new THREE.Group();
  private shards: Shard[] = [];
  private t = 0;
  private live = false;
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();

  burst(v: Vehicle) {
    const src = v.shatterSource();
    if (!src) return;
    this.clear();
    const { tex, tint, tintAmt, matrix } = src;
    matrix.decompose(this.tmpP, this.tmpQ, this.tmpS);
    const centre = this.tmpP.clone();
    // jittered grid → irregular quads (each cell's corners are shared, so the car starts whole)
    const jx = (i: number, j: number) => (i === 0 || i === COLS ? 0 : Math.sin(i * 12.9 + j * 78.2) * 0.35 / COLS);
    const jy = (i: number, j: number) => (j === 0 || j === ROWS ? 0 : Math.sin(i * 39.3 + j * 11.7) * 0.35 / ROWS);
    // cells (column, row from the bottom) that break off: rear corners, diffuser, side panels, mirrors
    const picks = new Set(['0,1', '7,1', '1,0', '6,0', '3,0', '4,0', '0,2', '7,2', '1,3', '6,3']);
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        if (!picks.has(`${i},${j}`)) continue;
        const c = [
          [i / COLS + jx(i, j), j / ROWS + jy(i, j)],
          [(i + 1) / COLS + jx(i + 1, j), j / ROWS + jy(i + 1, j)],
          [(i + 1) / COLS + jx(i + 1, j + 1), (j + 1) / ROWS + jy(i + 1, j + 1)],
          [i / COLS + jx(i, j + 1), (j + 1) / ROWS + jy(i, j + 1)],
        ];
        const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4;
        const cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
        const g = new THREE.BufferGeometry();
        // local positions relative to the shard centre (sprite plane units, centre 0)
        const pos = new Float32Array([
          c[0][0] - cx, c[0][1] - cy, 0, c[1][0] - cx, c[1][1] - cy, 0, c[2][0] - cx, c[2][1] - cy, 0,
          c[0][0] - cx, c[0][1] - cy, 0, c[2][0] - cx, c[2][1] - cy, 0, c[3][0] - cx, c[3][1] - cy, 0,
        ]);
        const uv = new Float32Array([c[0][0], c[0][1], c[1][0], c[1][1], c[2][0], c[2][1], c[0][0], c[0][1], c[2][0], c[2][1], c[3][0], c[3][1]]);
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        const mat = new THREE.ShaderMaterial({
          uniforms: { map: { value: tex }, tint: { value: tint.clone() }, tintAmt: { value: tintAmt }, fade: { value: 1 }, heat: { value: 1 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform sampler2D map; uniform vec3 tint; uniform float tintAmt; uniform float fade; uniform float heat; varying vec2 vUv;
            void main(){
              vec4 c = texture2D(map, vUv);
              if (c.a < 0.05) discard;
              float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
              float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
              float body = smoothstep(0.34, 0.12, (mx - mn) / max(mx, 0.01)) * smoothstep(0.16, 0.42, l);
              vec3 col = mix(c.rgb, tint * (0.18 + l * 1.25) + vec3(0.06) * l, body * tintAmt);
              col = mix(col, col * 0.35, 1.0 - heat);                // scorched as it cools
              col += vec3(1.0, 0.45, 0.1) * heat * 0.25;              // hot glow just after impact
              gl_FragColor = vec4(col, c.a * fade);
            }`,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        const m = new THREE.Mesh(g, mat);
        m.layers.set(OVERLAY_LAYER);
        m.renderOrder = 20;
        // place at the shard's spot on the car (sprite → world)
        const local = new THREE.Vector3(cx - 0.5, cy - 0.5, 0).applyMatrix4(matrix);
        m.position.copy(local);
        m.quaternion.copy(this.tmpQ);
        m.scale.copy(this.tmpS).multiplyScalar(0.55 + Math.random() * 0.2); // pieces, not whole panels
        // blast outward from the impact point (front-centre of the car), up, and toward the camera
        const dx = cx - 0.5;
        const r = Math.random();
        const vel = new THREE.Vector3(Math.sign(dx || 0.1) * (2.5 + Math.abs(dx) * 6 + r * 3), 2.5 + Math.random() * 4, 2 + Math.random() * 5);
        vel.applyQuaternion(this.tmpQ);
        vel.y = Math.abs(vel.y) + 1.5;
        const spin = new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 12);
        this.shards.push({ m, v: vel, w: spin });
        this.group.add(m);
      }
    }
    void centre;
    this.t = 0;
    this.live = true;
  }

  update(dt: number) {
    if (!this.live) return;
    this.t += dt;
    const fade = this.t < 1.1 ? 1 : Math.max(0, 1 - (this.t - 1.1) / 0.7);
    const heat = Math.max(0, 1 - this.t / 0.6);
    for (const s of this.shards) {
      s.v.y -= 16 * dt;
      s.v.multiplyScalar(1 - 0.6 * dt);
      s.m.position.addScaledVector(s.v, dt);
      if (s.m.position.y < 0.02) {
        s.m.position.y = 0.02;
        s.v.y *= -0.3;
        s.v.x *= 0.7;
        s.v.z *= 0.7;
      }
      s.m.rotation.x += s.w.x * dt;
      s.m.rotation.y += s.w.y * dt;
      s.m.rotation.z += s.w.z * dt;
      s.m.material.uniforms.fade.value = fade;
      s.m.material.uniforms.heat.value = heat;
    }
    if (fade <= 0) this.clear();
  }

  clear() {
    for (const s of this.shards) {
      s.m.geometry.dispose();
      s.m.material.dispose();
      this.group.remove(s.m);
    }
    this.shards = [];
    this.live = false;
  }
}
