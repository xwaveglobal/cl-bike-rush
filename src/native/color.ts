/**
 * v3 native — colour calibration.
 *
 * In the browser the 3D frame is encoded to sRGB exactly once (by Three.js) and textures marked
 * sRGB are decoded by the GPU. A mini-game runtime may differ in two ways, and each makes the
 * game look washed out (dark navy turns slate grey):
 *   A. the screen surface encodes to sRGB again on its own   → output sRGB twice
 *   B. sRGB textures are not decoded by the GPU              → textures come in too bright
 * At start the game measures both with two tiny off-screen draws, and compensates only what it
 * finds. The player (or the owner while testing) can override it in Settings → Colour.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';

export type ColorMode = 'auto' | 'normal' | 'surface' | 'texture';
export const COLOR_MODES: ColorMode[] = ['auto', 'normal', 'surface', 'texture'];

export const color = {
  /** measured: 8-bit value read back where the browser gives ~55 (linear 0.2158) */
  outRead: -1,
  texRead: -1,
  /** what the measurements say */
  surfaceEncodes: false,
  textureNotDecoded: false,
  /** what is applied right now */
  applied: { surface: false, texture: false },
  mode: 'auto' as ColorMode,
  gl: '',
  error: '',
};

// ---------------------------------------------------------------- sRGB textures registry (fix B)
/** every texture that asks for sRGB; with fix B they are uploaded raw and decoded in the shader */
const srgbTextures = new Set<THREE.Texture>();
let textureFix = false;
const desc = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'colorSpace');
if (!desc) {
  Object.defineProperty(THREE.Texture.prototype, 'colorSpace', {
    configurable: true,
    get(this: any) {
      return this.__cs ?? THREE.NoColorSpace;
    },
    set(this: any, v: string) {
      this.__cs = v;
      if (v === THREE.SRGBColorSpace) {
        srgbTextures.add(this);
        if (textureFix) markRaw(this);
      }
    },
  });
}
/**
 * Three.js decodes "video" textures in the shader instead of on the GPU (they are uploaded as plain
 * RGBA8): flag sRGB textures that way so the decode happens in the shader.
 */
function markRaw(t: any) {
  if (t.isVideoTexture) return;
  t.isVideoTexture = true;
  t.update ??= () => {};
  t.needsUpdate = true;
}

// ---------------------------------------------------------------- measuring
const VS = 'attribute vec3 position; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
const VS_UV = 'attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

function quad(mat: THREE.RawShaderMaterial) {
  const s = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  s.add(m);
  return s;
}

/** run the two tests (call before any 3D material is compiled) */
export function measure(r: THREE.WebGLRenderer, makeCanvas: () => any) {
  const gl = r.getContext() as WebGL2RenderingContext;
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    color.gl = `${gl.getParameter(gl.VERSION)} · ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`.slice(0, 90);
  } catch {
    color.gl = 'gl ?';
  }
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prevOut = r.outputColorSpace;
  const prevTarget = r.getRenderTarget();
  const autoClear = r.autoClear;
  try {
    r.autoClear = true;
    // B: an sRGB texture holding 128 → decoded it reads ~55, not decoded ~128 (render target, no screen involved)
    const c = makeCanvas();
    c.width = c.height = 4;
    const cx = c.getContext('2d');
    cx.fillStyle = 'rgb(128,128,128)';
    cx.fillRect(0, 0, 4, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    const mB = new THREE.RawShaderMaterial({ vertexShader: VS_UV, fragmentShader: 'precision mediump float; uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }', uniforms: { map: { value: tex } }, depthTest: false });
    r.setRenderTarget(rt);
    r.render(quad(mB), cam);
    const px = new Uint8Array(4 * 16);
    r.readRenderTargetPixels(rt, 0, 0, 4, 4, px);
    color.texRead = px[0];
    // A: write linear 0.2158 straight to the screen → plain surface keeps ~55, an sRGB surface stores ~128
    r.setRenderTarget(null);
    const mA = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: 'precision mediump float; void main(){ gl_FragColor = vec4(0.2158, 0.2158, 0.2158, 1.0); }', depthTest: false });
    r.render(quad(mA), cam);
    const p1 = new Uint8Array(4);
    gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p1);
    color.outRead = p1[0];
    rt.dispose();
    tex.dispose();
    mA.dispose();
    mB.dispose();
  } catch (e) {
    color.error = String((e as Error)?.message ?? e).slice(0, 80);
  }
  r.setRenderTarget(prevTarget);
  r.outputColorSpace = prevOut;
  r.autoClear = autoClear;
  r.resetState();
  // ~55 = as in a browser; ≥ ~100 = encoded / not decoded (midpoint ~90)
  color.surfaceEncodes = color.outRead >= 90;
  color.textureNotDecoded = color.texRead >= 90;
}

/** apply a mode (surface fix is live; the texture fix covers textures from now on + all known ones) */
export function applyColor(r: THREE.WebGLRenderer, mode: ColorMode) {
  color.mode = mode;
  const surface = mode === 'surface' || (mode === 'auto' && color.surfaceEncodes);
  const texture = mode === 'texture' || (mode === 'auto' && color.textureNotDecoded);
  color.applied = { surface, texture };
  // A: let the surface do the one sRGB encode
  r.outputColorSpace = surface ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  // B: decode sRGB textures in the shader
  if (texture && !textureFix) {
    textureFix = true;
    for (const t of srgbTextures) markRaw(t);
  }
}

/** one line for Settings */
export function colorLine() {
  const a = color.applied;
  const fix = a.surface && a.texture ? 'surface+texture' : a.surface ? 'surface' : a.texture ? 'texture' : 'none';
  return `Colour ${color.mode} · fix ${fix} · out ${color.outRead} tex ${color.texRead}${color.error ? ` · ${color.error}` : ''} · ${color.gl}`;
}
