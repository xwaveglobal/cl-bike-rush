import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildBikeRiderAsset, type BikePoseParams } from '../../src/render/BikeRiderAsset.ts';

const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');

// ---------- renderer / scene (same tone mapping + env as the game's Renderer.ts) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b18);
scene.fog = new THREE.Fog(0x070b18, 14, 46);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
(scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x141a2a, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(3.5, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
const sc = key.shadow.camera as THREE.OrthographicCamera;
sc.left = -2.5; sc.right = 2.5; sc.top = 2.5; sc.bottom = -2.5; sc.near = 1; sc.far = 20;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight(0x4fe3ff, 1.4);
rim.position.set(-4, 2.5, -5);
scene.add(rim);

// ---------- road: three lanes, scrolling neon lines ----------
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a3142';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 30 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v + 4},${v + 14},0.5)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // lane dividers (3 lanes)
  g.fillStyle = '#7fe9ff';
  for (const x of [512 / 3, (512 * 2) / 3]) {
    g.fillRect(x - 3, 0, 6, 300);
  }
  // edge lines
  g.fillStyle = '#4fd8ff';
  g.fillRect(0, 0, 8, 512);
  g.fillRect(504, 0, 8, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 14);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const roadTex = roadTexture();
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 84),
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82, metalness: 0.05 }),
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, -20);
road.receiveShadow = true;
scene.add(road);

// ---------- the hero asset ----------
// three detail levels (0 = garage/close, 1 = gameplay, 2 = low-end); built lazily and swapped in place
const rigs: (ReturnType<typeof buildBikeRiderAsset> | undefined)[] = [];
let rig: ReturnType<typeof buildBikeRiderAsset>;
let mats = new Set<THREE.Material>();
function useLod(level: number) {
  if (!rigs[level]) {
    const r = buildBikeRiderAsset(512, level);
    r.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
    rigs[level] = r;
  }
  if (rig) scene.remove(rig.root);
  rig = rigs[level]!;
  scene.add(rig.root);
  let tris = 0, meshes = 0;
  mats = new Set<THREE.Material>();
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
  });
  $('st-tris').textContent = Math.round(tris).toLocaleString('vi-VN');
  $('st-mesh').textContent = String(meshes);
  $('st-bones').textContent = String(rig.skeleton.bones.length);
  $('st-mats').textContent = String(mats.size);
  mats.forEach((m) => { (m as THREE.MeshStandardMaterial).wireframe = (document.getElementById('o-wire') as HTMLInputElement | null)?.checked ?? false; });
  document.querySelectorAll<HTMLButtonElement>('[data-lod]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.lod) === level)));
}
useLod(0);
document.querySelectorAll<HTMLButtonElement>('[data-lod]').forEach((b) => b.addEventListener('click', () => useLod(Number(b.dataset.lod))));

// ---------- poses ----------
type P = Required<Pick<BikePoseParams, 'lean' | 'air' | 'downSlide' | 'lowTuck' | 'pitch'>>;
const POSES: Record<string, P> = {
  StraightRide: { lean: 0, air: 0, downSlide: 0, lowTuck: 0, pitch: 0 },
  LeanLeft: { lean: -1, air: 0, downSlide: 0, lowTuck: 0, pitch: 0 },
  LeanRight: { lean: 1, air: 0, downSlide: 0, lowTuck: 0, pitch: 0 },
  AirborneJump: { lean: 0, air: 1, downSlide: 0, lowTuck: 0, pitch: 0.14 },
  DownSlide: { lean: 0, air: 0, downSlide: 1, lowTuck: 0, pitch: 0 },
  LowTuck: { lean: 0, air: 0, downSlide: 0, lowTuck: 1, pitch: 0 },
};
const cur: P = { ...POSES.StraightRide };
let target: P = { ...POSES.StraightRide };
let poseName = 'StraightRide';

const poseBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-pose]')];
function setPose(name: string, fromUser = true) {
  poseName = name;
  target = { ...POSES[name] };
  poseBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === name)));
  if (fromUser && demo) toggleDemo(false);
}
poseBtns.forEach((b) => b.addEventListener('click', () => setPose(b.dataset.pose!)));

// demo loop: mimics a run (lane changes, jump, slide, turbo tuck)
const DEMO = ['StraightRide', 'LeanLeft', 'StraightRide', 'LeanRight', 'StraightRide', 'AirborneJump', 'StraightRide', 'DownSlide', 'StraightRide', 'LowTuck'];
let demo = true, demoI = 0, demoT = 0;
const demoBtn = $('demo') as HTMLButtonElement;
function toggleDemo(on = !demo) {
  demo = on;
  demoBtn.setAttribute('aria-pressed', String(on));
  demoBtn.textContent = on ? 'Dừng demo' : 'Chạy demo';
  if (on) { demoI = 0; demoT = 0; setPose(DEMO[0], false); }
}
demoBtn.addEventListener('click', () => toggleDemo());

// ---------- camera presets ----------
const VIEWS: Record<string, { pos: [number, number, number]; look: [number, number, number] }> = {
  game: { pos: [0, 2.35, 6.2], look: [0, 0.55, -6] },
  rear: { pos: [0, 1.15, 3.2], look: [0, 0.65, 0] },
  three: { pos: [-2.6, 1.35, -2.4], look: [0, 0.6, 0] },
  left: { pos: [-3.6, 0.85, 0], look: [0, 0.6, 0] },
  right: { pos: [3.6, 0.85, 0], look: [0, 0.6, 0] },
  front: { pos: [0, 1.0, -3.4], look: [0, 0.6, 0] },
};
const viewBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
let camFrom: { p: THREE.Vector3; l: THREE.Vector3 } | null = null;
let camTo: { p: THREE.Vector3; l: THREE.Vector3 } | null = null;
let camK = 1;
function setView(name: string, snap = false) {
  const v = VIEWS[name];
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  const p = new THREE.Vector3(...v.pos), l = new THREE.Vector3(...v.look);
  if (snap) { camera.position.copy(p); controls.target.copy(l); controls.update(); camK = 1; return; }
  camFrom = { p: camera.position.clone(), l: controls.target.clone() };
  camTo = { p, l };
  camK = 0;
}
viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view!)));
controls.addEventListener('start', () => {
  camK = 1;
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
});

// ---------- toggles ----------
const opt = (id: string) => $(id) as HTMLInputElement;
opt('o-wire').addEventListener('change', () => mats.forEach((m) => { (m as THREE.MeshStandardMaterial).wireframe = opt('o-wire').checked; }));
opt('o-rotate').addEventListener('change', () => { controls.autoRotate = opt('o-rotate').checked; });
controls.autoRotateSpeed = 1.4;

// ---------- resize ----------
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- loop ----------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let wheel = 0, time = 0, last = performance.now(), lastRootY = 0;
const poseLabel = $('pose-now');
const LABELS: Record<string, string> = {
  StraightRide: 'Chạy thẳng', LeanLeft: 'Nghiêng trái', LeanRight: 'Nghiêng phải',
  AirborneJump: 'Bay nhảy', DownSlide: 'Trượt thấp', LowTuck: 'Cúi thấp (turbo)',
};
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  if (demo) {
    demoT += dt;
    const hold = DEMO[demoI] === 'StraightRide' ? 0.9 : 1.5;
    if (demoT > hold) { demoT = 0; demoI = (demoI + 1) % DEMO.length; setPose(DEMO[demoI], false); }
  }
  poseLabel.textContent = LABELS[poseName];

  const k = 1 - Math.exp(-7 * dt);
  (Object.keys(cur) as (keyof P)[]).forEach((n) => { cur[n] += (target[n] - cur[n]) * k; });

  const moving = opt('o-run').checked && !reduce;
  if (moving) {
    wheel += 22 * (1 - cur.air * 0.65) * dt;
    roadTex.offset.y += dt * 1.6;
  }
  rig.root.position.y = cur.air * 0.95 + Math.sin(time * 3.2) * 0.03 * cur.air;
  // keep the bike framed when it jumps: camera + orbit target follow the ride height
  const dyFollow = rig.root.position.y - lastRootY;
  lastRootY = rig.root.position.y;
  camera.position.y += dyFollow;
  controls.target.y += dyFollow;
  if (camFrom && camTo) { camFrom.p.y += dyFollow; camFrom.l.y += dyFollow; camTo.p.y += dyFollow; camTo.l.y += dyFollow; }
  rig.applyPose({
    lean: cur.lean, air: cur.air, downSlide: cur.downSlide, lowTuck: cur.lowTuck,
    pitch: cur.pitch, wheelSpin: wheel, time: moving ? time : 0,
  });

  if (camK < 1 && camFrom && camTo) {
    camK = Math.min(1, camK + dt / 0.7);
    const e = camK < 0.5 ? 4 * camK ** 3 : 1 - (-2 * camK + 2) ** 3 / 2;
    camera.position.lerpVectors(camFrom.p, camTo.p, e);
    controls.target.lerpVectors(camFrom.l, camTo.l, e);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// test hooks: snap camera / pose instantly (used by automated screenshots)
(window as unknown as Record<string, unknown>).__viewer = {
  // studio look for side-by-side comparison with the reference sheet (light backdrop, no road)
  studio: (on: boolean) => {
    scene.background = new THREE.Color(on ? 0xe3e5e9 : 0x070b18);
    scene.fog = on ? null : new THREE.Fog(0x070b18, 14, 46);
    road.visible = !on;
  },
  fov: (deg: number) => { camera.fov = deg; camera.updateProjectionMatrix(); },
  rider: (on: boolean) => { rig.riderMesh.visible = on; },
  lod: (n: number) => useLod(n),
  view: (n: string) => { toggleDemo(false); setView(n, true); },
  cam: (p: [number, number, number], l: [number, number, number]) => { toggleDemo(false); camK = 1; camera.position.set(...p); controls.target.set(...l); controls.update(); },
  pose: (n: string) => { toggleDemo(false); setPose(n, false); Object.assign(cur, POSES[n]); },
  run: (on: boolean) => { opt('o-run').checked = on; },
};
setView('game', true);
toggleDemo(!reduce);
if (reduce) setPose('StraightRide', false);
$('loading').hidden = true;
requestAnimationFrame(frame);
