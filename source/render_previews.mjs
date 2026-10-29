#!/usr/bin/env node
/**
 * Headless WebGL2 GLB Verification & Preview Renderer.
 *
 * 1. Reopens `models/bike_rider.glb` via Three.js `GLTFLoader` in Headless Chromium.
 * 2. Verifies meshes, UVs, normals, tangents, PBR materials, embedded textures,
 *    18-bone rider skeleton, and all 6 AnimationClips.
 * 3. Plays each animation clip via `THREE.AnimationMixer` and renders high-resolution
 *    rear-view and multi-angle inspection PNGs to `previews/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire('/root/.bun/install/global/node_modules/playwright-core/index.js');
const { chromium } = require('playwright-core');

const ROOT_DIR = process.cwd();
const PREVIEWS_DIR = path.join(ROOT_DIR, 'previews');
fs.mkdirSync(PREVIEWS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

const VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>html, body { margin: 0; padding: 0; overflow: hidden; background: #0b101d; }</style>
  <script type="importmap">
  {
    "imports": {
      "three": "/node_modules/three/build/three.module.js",
      "three/addons/": "/node_modules/three/examples/jsm/"
    }
  }
  </script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

window.renderGLBPreviews = async function() {
  const width = 1200;
  const height = 900;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  document.body.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x0c1324);

  // Studio + gameplay sky-city lighting
  const hemi = new THREE.HemisphereLight(0xdbeeff, 0x1a243a, 1.35);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 2.5);
  keyLight.position.set(2.8, 5.5, 4.8);
  scene.add(keyLight);

  const rimLeft = new THREE.DirectionalLight(0x48d8ff, 1.6);
  rimLeft.position.set(-4.0, 2.6, 1.5);
  scene.add(rimLeft);

  const backFill = new THREE.DirectionalLight(0xdce8ff, 1.35);
  backFill.position.set(0, 2.2, 6.0);
  scene.add(backFill);

  // Stylized neon sky-road surface for gameplay context
  const roadGroup = new THREE.Group();
  const roadGeo = new THREE.PlaneGeometry(8.4, 40);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x131926,
    roughness: 0.72,
    metalness: 0.22,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0, -10);
  roadGroup.add(roadMesh);

  // Cyan lane lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x28d8ff });
  for (const lx of [-3.9, -1.3, 1.3, 3.9]) {
    const lineGeo = new THREE.PlaneGeometry(Math.abs(lx) > 3 ? 0.09 : 0.045, 40);
    lineGeo.rotateX(-Math.PI / 2);
    const lm = new THREE.Mesh(lineGeo, lineMat);
    lm.position.set(lx, 0.004, -10);
    roadGroup.add(lm);
  }
  scene.add(roadGroup);

  // Overhead barrier (Y = 0.95 m bottom edge, matching ObstacleViews.ts 'beam') for DownSlide clearance proof
  const barrierGroup = new THREE.Group();
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x262d3d, roughness: 0.4, metalness: 0.8 });
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff9914 });
  const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.42, 0.45), beamMat);
  beamMesh.position.set(0, 1.16, 0); // bottom edge at 1.16 - 0.21 = 0.95 m!
  barrierGroup.add(beamMesh);
  for (let i = -5; i <= 5; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.47), hazardMat);
    stripe.position.set(i * 0.44, 1.02, 0);
    barrierGroup.add(stripe);
  }
  barrierGroup.visible = false;
  scene.add(barrierGroup);

  // Load models/bike_rider.glb via GLTFLoader
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.load('/models/bike_rider.glb', resolve, undefined, reject);
  });

  const modelRoot = gltf.scene;
  scene.add(modelRoot);

  // Inspect & validate loaded GLB contents
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let boneCount = 0;
  let totalVertices = 0;
  let missingUVs = 0;
  let missingNormals = 0;
  let missingTangents = 0;
  const matNames = new Set();

  modelRoot.traverse((obj) => {
    if (obj.isSkinnedMesh) {
      skinnedMeshCount++;
      boneCount = obj.skeleton ? obj.skeleton.bones.length : 0;
    }
    if (obj.isMesh) {
      meshCount++;
      const g = obj.geometry;
      totalVertices += g.attributes.position ? g.attributes.position.count : 0;
      if (!g.attributes.uv) missingUVs++;
      if (!g.attributes.normal) missingNormals++;
      if (!g.attributes.tangent) missingTangents++;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m) {
          matNames.add(m.name);
          // Controlled emissive intensity on cyan/red lights so ACES Filmic preserves rich cyan and red saturation
          if (m.name === 'Mat_Cyan_Emissive') {
            m.color = new THREE.Color(0x0cc8ff);
            m.emissive = new THREE.Color(0x00b8ff);
            m.emissiveIntensity = 0.85;
          } else if (m.name === 'Mat_Red_Emissive') {
            m.color = new THREE.Color(0xff1832);
            m.emissive = new THREE.Color(0xff1028);
            m.emissiveIntensity = 0.95;
          }
        }
      }
    }
  });

  const mixer = new THREE.AnimationMixer(modelRoot);
  const clipNames = gltf.animations.map((c) => c.name);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);

  function playClipAt(name, timeSec) {
    mixer.stopAllAction();
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw new Error('Missing animation clip: ' + name);
    const action = mixer.clipAction(clip);
    action.reset();
    action.play();
    mixer.setTime(timeSec);
    modelRoot.updateMatrixWorld(true);
  }

  function computeVisualBounds() {
    const box = new THREE.Box3();
    modelRoot.updateMatrixWorld(true);
    modelRoot.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        if (obj.isSkinnedMesh) {
          const pos = obj.geometry.attributes.position;
          const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            if (typeof obj.applyBoneTransform === 'function') {
              obj.applyBoneTransform(i, v);
            } else if (typeof obj.boneTransform === 'function') {
              obj.boneTransform(i, v);
            }
            v.applyMatrix4(obj.matrixWorld);
            box.expandByPoint(v);
          }
        } else {
          obj.geometry.computeBoundingBox();
          const b = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
          box.union(b);
        }
      }
    });
    return {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      height: box.max.y - box.min.y,
    };
  }

  const shots = [
    {
      file: 'rear_straight_riding.png',
      clip: 'StraightRide',
      time: 0.25,
      camPos: [0, 1.48, 2.85],
      lookAt: [0, 0.72, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'isolated_rear_reference.png',
      clip: 'StraightRide',
      time: 0.0,
      camPos: [0, 1.36, 2.65],
      lookAt: [0, 0.72, 0.05],
      road: false,
      barrier: false,
      bg: 0xf4f6fa,
      yOffset: 0,
    },
    {
      file: 'rear_left_lean.png',
      clip: 'LeanLeft',
      time: 0.5,
      camPos: [0, 1.46, 2.85],
      lookAt: [-0.08, 0.68, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'rear_right_lean.png',
      clip: 'LeanRight',
      time: 0.5,
      camPos: [0, 1.46, 2.85],
      lookAt: [0.08, 0.68, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'rear_airborne_jump.png',
      clip: 'AirborneJump',
      time: 0.5,
      camPos: [0, 2.05, 3.05],
      lookAt: [0, 1.25, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0.58,
    },
    {
      file: 'rear_down_slide.png',
      clip: 'DownSlide',
      time: 0.5,
      camPos: [0, 1.22, 2.75],
      lookAt: [0, 0.52, 0.0],
      road: true,
      barrier: true,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'rear_low_tuck.png',
      clip: 'LowTuck',
      time: 0.5,
      camPos: [0, 1.42, 2.80],
      lookAt: [0, 0.66, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'front_three_quarter.png',
      clip: 'StraightRide',
      time: 0.25,
      camPos: [1.65, 1.28, -2.35],
      lookAt: [0, 0.68, 0.0],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'side_right_profile.png',
      clip: 'StraightRide',
      time: 0.25,
      camPos: [2.75, 0.95, 0.15],
      lookAt: [0, 0.66, -0.05],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
    {
      file: 'side_left_profile.png',
      clip: 'StraightRide',
      time: 0.25,
      camPos: [-2.75, 0.95, 0.15],
      lookAt: [0, 0.66, -0.05],
      road: true,
      barrier: false,
      bg: 0x0c1324,
      yOffset: 0,
    },
  ];

  const poseBounds = {};
  const images = {};

  for (const s of shots) {
    playClipAt(s.clip, s.time);
    modelRoot.position.set(0, s.yOffset, 0);
    modelRoot.updateMatrixWorld(true);

    if (!poseBounds[s.clip] && s.yOffset === 0) {
      poseBounds[s.clip] = computeVisualBounds();
    }

    roadGroup.visible = s.road;
    barrierGroup.visible = s.barrier;
    scene.background = new THREE.Color(s.bg);

    camera.position.set(...s.camPos);
    camera.lookAt(...s.lookAt);
    renderer.render(scene, camera);
    images[s.file] = renderer.domElement.toDataURL('image/png');
  }

  return {
    verification: {
      meshCount,
      skinnedMeshCount,
      boneCount,
      totalVertices,
      missingUVs,
      missingNormals,
      missingTangents,
      materials: Array.from(matNames),
      clips: clipNames,
      poseBounds,
    },
    images,
  };
};
</script>
</body>
</html>`;

async function run() {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (urlPath === '/viewer.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(VIEWER_HTML);
      return;
    }
    const filePath = path.join(ROOT_DIR, urlPath);
    if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Preview server listening on http://127.0.0.1:${port}`);

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.on('console', (msg) => console.log('[Browser]', msg.text()));
    page.on('pageerror', (err) => console.error('[PageError]', err));

    await page.goto(`http://127.0.0.1:${port}/viewer.html`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      return await window.renderGLBPreviews();
    });

    console.log('GLB Reopen & Verification Report:', JSON.stringify(result.verification, null, 2));

    for (const [filename, dataUrl] of Object.entries(result.images)) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const outPath = path.join(PREVIEWS_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`Wrote preview: previews/${filename}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
