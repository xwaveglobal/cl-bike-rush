#!/usr/bin/env node
/**
 * Reproducible PBR Texture & Binary glTF 2.0 (.glb) Generator for the
 * Futuristic Motorcycle & Rider main player asset in Sky Roadster.
 *
 * Outputs:
 *   - textures/bike_rider_basecolor.png  (1024x1024, sRGB)
 *   - textures/bike_rider_normal.png     (1024x1024, Linear, +Y glTF convention)
 *   - textures/bike_rider_roughness.png  (1024x1024, Linear)
 *   - textures/bike_rider_metallic.png   (1024x1024, Linear)
 *   - textures/bike_rider_ao.png         (1024x1024, Linear)
 *   - textures/bike_rider_orm.png        (1024x1024, Linear: R=AO, G=Roughness, B=Metallic)
 *   - textures/bike_rider_emissive.png   (1024x1024, sRGB)
 *   - models/bike_rider.glb              (Complete glTF 2.0 binary: meshes, UVs, normals, tangents,
 *                                         18-bone rider skinning, embedded PBR textures, 6 animations)
 *   - public/assets/vehicles/bike_rider.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as THREE from 'three';
import {
  buildBikeRiderAsset,
  generatePBRBuffers,
} from '../src/render/BikeRiderAsset.ts';

// ---------------------------------------------------------------------------
// 1. Minimal Pure-Node PNG Encoder (RGBA 8-bit)
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgbaUint8, isSRGB = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filter 0 (None) per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    // Flip Y so UV (0,0) bottom-left matches standard image top-left when flipY=false in glTF
    const srcRow = y * stride;
    Buffer.from(rgbaUint8.buffer, rgbaUint8.byteOffset + srcRow, stride).copy(raw, rowStart + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  const chunks = [signature, pngChunk('IHDR', ihdr)];
  if (isSRGB) {
    // sRGB chunk: rendering intent 0 (perceptual)
    chunks.push(pngChunk('sRGB', Buffer.from([0])));
  }
  chunks.push(pngChunk('IDAT', compressed));
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// 2. Generate & Write 1024x1024 PBR Texture Maps
// ---------------------------------------------------------------------------
const ROOT_DIR = process.cwd();
const TEX_DIR = path.join(ROOT_DIR, 'textures');
const MODELS_DIR = path.join(ROOT_DIR, 'models');
const PUBLIC_VEHICLES_DIR = path.join(ROOT_DIR, 'public', 'assets', 'vehicles');

fs.mkdirSync(TEX_DIR, { recursive: true });
fs.mkdirSync(MODELS_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_VEHICLES_DIR, { recursive: true });

const TEX_SIZE = 1024;
console.log(`Generating ${TEX_SIZE}x${TEX_SIZE} PBR texture maps...`);
const pbr = generatePBRBuffers(TEX_SIZE);

const pngBaseColor = encodePNG(TEX_SIZE, TEX_SIZE, pbr.baseColor, true);
const pngNormal = encodePNG(TEX_SIZE, TEX_SIZE, pbr.normal, false);
const pngRoughness = encodePNG(TEX_SIZE, TEX_SIZE, pbr.roughness, false);
const pngMetallic = encodePNG(TEX_SIZE, TEX_SIZE, pbr.metallic, false);
const pngAO = encodePNG(TEX_SIZE, TEX_SIZE, pbr.ao, false);
const pngORM = encodePNG(TEX_SIZE, TEX_SIZE, pbr.orm, false);
const pngEmissive = encodePNG(TEX_SIZE, TEX_SIZE, pbr.emissive, true);

fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_basecolor.png'), pngBaseColor);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_normal.png'), pngNormal);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_roughness.png'), pngRoughness);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_metallic.png'), pngMetallic);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_ao.png'), pngAO);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_orm.png'), pngORM);
fs.writeFileSync(path.join(TEX_DIR, 'bike_rider_emissive.png'), pngEmissive);
console.log('Saved all 7 PBR texture maps to textures/*.png');

// ---------------------------------------------------------------------------
// 3. Build 3D Asset & Serialize Complete Binary glTF 2.0 (.glb)
// ---------------------------------------------------------------------------
console.log('Building 3D Futuristic Motorcycle & Rider rig and animations...');
const asset = buildBikeRiderAsset(512);
// Ensure bind / rest pose (StraightRide at t=0) before exporting node hierarchy
asset.applyPose({
  lean: 0,
  air: 0,
  downSlide: 0,
  lowTuck: 0,
  pitch: 0,
  wheelSpin: 0,
  time: 0,
});
asset.root.updateMatrixWorld(true);

function serializeToGLB(rig, embeddedPngs) {
  const binChunks = [];
  let byteLength = 0;

  function appendBuffer(buf, target) {
    const pad = (4 - (buf.length % 4)) % 4;
    const aligned = pad > 0 ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
    const byteOffset = byteLength;
    binChunks.push(aligned);
    byteLength += aligned.length;
    const view = {
      buffer: 0,
      byteOffset,
      byteLength: buf.length,
    };
    if (target !== undefined) view.target = target;
    bufferViews.push(view);
    return bufferViews.length - 1;
  }

  const bufferViews = [];
  const accessors = [];
  const images = [];
  const textures = [];
  const materials = [];
  const meshes = [];
  const nodes = [];
  const skins = [];
  const animations = [];

  // 1. Samplers & Embedded Textures
  const samplers = [
    {
      magFilter: 9729, // LINEAR
      minFilter: 9987, // LINEAR_MIPMAP_LINEAR
      wrapS: 10497,    // REPEAT
      wrapT: 10497,    // REPEAT
    },
  ];

  const texOrder = [
    { name: 'bike_rider_basecolor', buf: embeddedPngs.baseColor },
    { name: 'bike_rider_normal', buf: embeddedPngs.normal },
    { name: 'bike_rider_orm', buf: embeddedPngs.orm },
    { name: 'bike_rider_emissive', buf: embeddedPngs.emissive },
  ];
  for (const t of texOrder) {
    const bv = appendBuffer(t.buf);
    const imgIdx = images.length;
    images.push({
      name: t.name,
      mimeType: 'image/png',
      bufferView: bv,
    });
    textures.push({
      name: t.name,
      sampler: 0,
      source: imgIdx,
    });
  }

  // 2. Materials (10 named PBR materials sharing the embedded atlas textures)
  const matList = [
    rig.materials.suit,
    rig.materials.armorSilver,
    rig.materials.cobalt,
    rig.materials.tyre,
    rig.materials.mechDark,
    rig.materials.forkGold,
    rig.materials.visor,
    rig.materials.mirror,
    rig.materials.cyanGlow,
    rig.materials.redGlow,
  ];
  const matToIdx = new Map();
  for (const m of matList) {
    const idx = materials.length;
    matToIdx.set(m, idx);
    const isEmissive = m === rig.materials.cyanGlow || m === rig.materials.redGlow;
    materials.push({
      name: m.name || `Material_${idx}`,
      DoubleSided: false,
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: 0 },
        metallicFactor: 1.0,
        roughnessFactor: 1.0,
        metallicRoughnessTexture: { index: 2 },
      },
      normalTexture: { index: 1, scale: m.normalScale ? m.normalScale.x : 1.0 },
      occlusionTexture: { index: 2, strength: 1.0 },
      emissiveTexture: { index: 3 },
      emissiveFactor: isEmissive ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0],
    });
  }

  function addAccessor(typedArr, componentType, type, count, target, computeMinMax = false) {
    const buf = Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength);
    const bv = appendBuffer(buf, target);
    const acc = {
      bufferView: bv,
      byteOffset: 0,
      componentType,
      count,
      type,
    };
    if (computeMinMax && count > 0) {
      const stride = type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : type === 'VEC2' ? 2 : 1;
      const min = new Array(stride).fill(Infinity);
      const max = new Array(stride).fill(-Infinity);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < stride; c++) {
          const v = typedArr[i * stride + c];
          if (v < min[c]) min[c] = v;
          if (v > max[c]) max[c] = v;
        }
      }
      acc.min = min;
      acc.max = max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  }

  function exportGeometryToMesh(geo, matOrGroups, meshName, isSkinned = false) {
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const uvAttr = geo.getAttribute('uv');
    const tanAttr = geo.getAttribute('tangent');
    const skinIdxAttr = geo.getAttribute('skinIndex');
    const skinWtAttr = geo.getAttribute('skinWeight');
    const indexAttr = geo.getIndex();

    const vCount = posAttr.count;
    const posArr = new Float32Array(vCount * 3);
    const normArr = new Float32Array(vCount * 3);
    const uvArr = new Float32Array(vCount * 2);
    const tanArr = tanAttr ? new Float32Array(vCount * 4) : null;

    for (let i = 0; i < vCount; i++) {
      posArr[i * 3 + 0] = posAttr.getX(i);
      posArr[i * 3 + 1] = posAttr.getY(i);
      posArr[i * 3 + 2] = posAttr.getZ(i);

      normArr[i * 3 + 0] = normAttr ? normAttr.getX(i) : 0;
      normArr[i * 3 + 1] = normAttr ? normAttr.getY(i) : 1;
      normArr[i * 3 + 2] = normAttr ? normAttr.getZ(i) : 0;

      // Flip V for glTF image convention (top-left origin py=0 corresponds to v=1 in generatePBRBuffers)
      uvArr[i * 2 + 0] = uvAttr ? uvAttr.getX(i) : 0.5;
      uvArr[i * 2 + 1] = uvAttr ? 1.0 - uvAttr.getY(i) : 0.5;

      if (tanArr && tanAttr) {
        tanArr[i * 4 + 0] = tanAttr.getX(i);
        tanArr[i * 4 + 1] = tanAttr.getY(i);
        tanArr[i * 4 + 2] = tanAttr.getZ(i);
        const tw = tanAttr.getW(i);
        tanArr[i * 4 + 3] = tw === 1 || tw === -1 ? tw : 1;
      }
    }

    const attributes = {
      POSITION: addAccessor(posArr, 5126, 'VEC3', vCount, 34962, true),
      NORMAL: addAccessor(normArr, 5126, 'VEC3', vCount, 34962, false),
      TEXCOORD_0: addAccessor(uvArr, 5126, 'VEC2', vCount, 34962, false),
    };
    if (tanArr) {
      attributes.TANGENT = addAccessor(tanArr, 5126, 'VEC4', vCount, 34962, false);
    }

    if (isSkinned && skinIdxAttr && skinWtAttr) {
      const jointsArr = new Uint16Array(vCount * 4);
      const weightsArr = new Float32Array(vCount * 4);
      for (let i = 0; i < vCount; i++) {
        jointsArr[i * 4 + 0] = skinIdxAttr.getX(i);
        jointsArr[i * 4 + 1] = skinIdxAttr.getY(i);
        jointsArr[i * 4 + 2] = skinIdxAttr.getZ(i);
        jointsArr[i * 4 + 3] = skinIdxAttr.getW(i);

        let w0 = skinWtAttr.getX(i);
        let w1 = skinWtAttr.getY(i);
        let w2 = skinWtAttr.getZ(i);
        let w3 = skinWtAttr.getW(i);
        const sum = w0 + w1 + w2 + w3;
        if (sum > 0) {
          w0 /= sum;
          w1 /= sum;
          w2 /= sum;
          w3 /= sum;
        } else {
          w0 = 1;
        }
        weightsArr[i * 4 + 0] = w0;
        weightsArr[i * 4 + 1] = w1;
        weightsArr[i * 4 + 2] = w2;
        weightsArr[i * 4 + 3] = w3;
      }
      attributes.JOINTS_0 = addAccessor(jointsArr, 5123, 'VEC4', vCount, 34962, false);
      attributes.WEIGHTS_0 = addAccessor(weightsArr, 5126, 'VEC4', vCount, 34962, false);
    }

    const primitives = [];
    const groups =
      Array.isArray(matOrGroups) && geo.groups && geo.groups.length > 0
        ? geo.groups
        : [{ start: 0, count: indexAttr ? indexAttr.count : vCount, materialIndex: 0 }];

    for (const grp of groups) {
      const mat = Array.isArray(matOrGroups)
        ? matOrGroups[grp.materialIndex ?? 0]
        : matOrGroups;
      const matIdx = matToIdx.get(mat) ?? 0;

      const idxCount = grp.count;
      const subIndices = new Uint32Array(idxCount);
      if (indexAttr) {
        for (let k = 0; k < idxCount; k++) {
          subIndices[k] = indexAttr.getX(grp.start + k);
        }
      } else {
        for (let k = 0; k < idxCount; k++) {
          subIndices[k] = grp.start + k;
        }
      }
      const idxAcc = addAccessor(subIndices, 5125, 'SCALAR', idxCount, 34963, false);
      primitives.push({
        attributes,
        indices: idxAcc,
        material: matIdx,
        mode: 4, // TRIANGLES
      });
    }

    const meshIdx = meshes.length;
    meshes.push({
      name: meshName,
      primitives,
    });
    return meshIdx;
  }

  // 3. Traverse Scene Graph & Build Nodes
  const objToNodeIdx = new Map();
  let skinnedMeshNodeIdx = -1;

  function buildNode(obj) {
    const nodeIdx = nodes.length;
    objToNodeIdx.set(obj, nodeIdx);

    const node = {
      name: obj.name || `Node_${nodeIdx}`,
      translation: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
    nodes.push(node);

    if (obj.isSkinnedMesh) {
      node.mesh = exportGeometryToMesh(obj.geometry, obj.material, obj.name || 'Rider_SkinnedMesh', true);
      // SkinnedMesh in glTF sits at identity relative to root when skeleton shares root parent
      skinnedMeshNodeIdx = nodeIdx;
    } else if (obj.isMesh) {
      node.mesh = exportGeometryToMesh(obj.geometry, obj.material, obj.name || `Mesh_${nodeIdx}`, false);
    }

    const childIndices = [];
    for (const child of obj.children) {
      childIndices.push(buildNode(child));
    }
    if (childIndices.length > 0) {
      node.children = childIndices;
    }
    return nodeIdx;
  }

  const rootNodeIdx = buildNode(rig.root);

  // 4. Export Skeleton Skin for Rider_SkinnedMesh (preserve bind-pose boneInverses from buildRiderSkinnedMesh!)
  const skeleton = rig.riderMesh.skeleton;
  const numBones = skeleton.bones.length;
  const ibmArr = new Float32Array(numBones * 16);
  const jointNodeIndices = [];

  for (let b = 0; b < numBones; b++) {
    const bone = skeleton.bones[b];
    const bNodeIdx = objToNodeIdx.get(bone);
    jointNodeIndices.push(bNodeIdx);
    skeleton.boneInverses[b].toArray(ibmArr, b * 16);
  }
  const ibmAcc = addAccessor(ibmArr, 5126, 'MAT4', numBones, undefined, false);
  skins.push({
    name: 'Rider_Armature_Skin',
    inverseBindMatrices: ibmAcc,
    skeleton: jointNodeIndices[0],
    joints: jointNodeIndices,
  });
  if (skinnedMeshNodeIdx >= 0) {
    nodes[skinnedMeshNodeIdx].skin = 0;
  }

  // 5. Export All 6 Animation Clips
  const nameToNodeIdx = new Map();
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].name) nameToNodeIdx.set(nodes[i].name, i);
  }

  for (const clip of rig.animations) {
    const animSamplers = [];
    const animChannels = [];

    for (const track of clip.tracks) {
      // Three.js track names are "<NodeName>.position" or "<NodeName>.quaternion"
      const dotIdx = track.name.lastIndexOf('.');
      const targetName = track.name.slice(0, dotIdx);
      const prop = track.name.slice(dotIdx + 1);
      const targetNodeIdx = nameToNodeIdx.get(targetName);
      if (targetNodeIdx === undefined) continue;

      const times = new Float32Array(track.times);
      const values = new Float32Array(track.values);
      const inputAcc = addAccessor(times, 5126, 'SCALAR', times.length, undefined, true);

      let pathProp = null;
      let valType = null;
      if (prop === 'position') {
        pathProp = 'translation';
        valType = 'VEC3';
      } else if (prop === 'quaternion') {
        pathProp = 'rotation';
        valType = 'VEC4';
      } else if (prop === 'scale') {
        pathProp = 'scale';
        valType = 'VEC3';
      }
      if (!pathProp) continue;

      const outputAcc = addAccessor(values, 5126, valType, times.length, undefined, false);
      const samplerIdx = animSamplers.length;
      animSamplers.push({
        input: inputAcc,
        interpolation: 'LINEAR',
        output: outputAcc,
      });
      animChannels.push({
        sampler: samplerIdx,
        target: {
          node: targetNodeIdx,
          path: pathProp,
        },
      });
    }

    if (animChannels.length > 0) {
      animations.push({
        name: clip.name,
        samplers: animSamplers,
        channels: animChannels,
      });
    }
  }

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'SkyRoadster BikeRider GLB Exporter',
      copyright: 'Sky Roadster (v3)',
    },
    scene: 0,
    scenes: [
      {
        name: 'BikeRider_Scene',
        nodes: [rootNodeIdx],
      },
    ],
    nodes,
    meshes,
    skins,
    animations,
    materials,
    textures,
    images,
    samplers,
    accessors,
    bufferViews,
    buffers: [
      {
        byteLength,
      },
    ],
  };

  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunkData =
    jsonPad > 0 ? Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]) : jsonBuf;

  const binChunkData = Buffer.concat(binChunks);

  const totalLength = 12 + 8 + jsonChunkData.length + 8 + binChunkData.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunkData.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunkData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return {
    glb: Buffer.concat([header, jsonChunkHeader, jsonChunkData, binChunkHeader, binChunkData]),
    stats: {
      nodes: nodes.length,
      meshes: meshes.length,
      materials: materials.length,
      textures: textures.length,
      bones: numBones,
      animations: animations.map((a) => a.name),
      byteLength: totalLength,
    },
  };
}

// Generate compact 512x512 embedded PNGs for the GLB so the GLB stays fast and self-contained
const pbr512 = generatePBRBuffers(512);
const embeddedPngs = {
  baseColor: encodePNG(512, 512, pbr512.baseColor, true),
  normal: encodePNG(512, 512, pbr512.normal, false),
  orm: encodePNG(512, 512, pbr512.orm, false),
  emissive: encodePNG(512, 512, pbr512.emissive, true),
};

const { glb, stats } = serializeToGLB(asset, embeddedPngs);
const modelPath = path.join(MODELS_DIR, 'bike_rider.glb');
const publicModelPath = path.join(PUBLIC_VEHICLES_DIR, 'bike_rider.glb');

fs.writeFileSync(modelPath, glb);
fs.writeFileSync(publicModelPath, glb);

console.log('Successfully generated models/bike_rider.glb and public/assets/vehicles/bike_rider.glb!');
console.log('GLB Stats:', JSON.stringify(stats, null, 2));
