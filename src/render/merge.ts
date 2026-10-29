import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapse static child meshes of `root` into one mesh per material.
 * Draw-call optimisation for procedural models built from many primitives.
 */
export function mergeByMaterial(root: THREE.Object3D, exclude: Set<THREE.Object3D> = new Set()) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const victims: THREE.Mesh[] = [];
  const isExcluded = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (exclude.has(p)) return true;
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || isExcluded(m) || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (!m.visible) return;
    let g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const list = buckets.get(m.material) ?? [];
    list.push(g);
    buckets.set(m.material, list);
    victims.push(m);
  });
  for (const v of victims) v.parent?.remove(v);
  const out: THREE.Mesh[] = [];
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    root.add(mesh);
    out.push(mesh);
  }
  return out;
}

/** Bake a group of meshes (any materials) into a single geometry with vertex colours. */
export function bakeVertexColors(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    let g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    const col = mat.color ?? new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) col.toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geos.push(g);
  });
  return mergeGeometries(geos, false);
}
