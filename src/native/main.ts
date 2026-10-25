/**
 * v3 — native TikTok mini game entry (bundled to tiktok/game.js by scripts/build-tiktok.mjs).
 *
 *   adapter (window/document shim) → HS SDK (profile, ads, share, shop) → the Game on the screen
 *   canvas → the canvas UI drawn on top (Renderer.uiPass) → tt touch routed to UI or steering.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import './log.ts'; // first: catches everything logged while the game starts
import { LOG, logErrors } from './log.ts';
import { DPR, NATIVE, emitWindow, makeImage, safeArea, screenCanvas, sizeScreen, viewH, viewW } from './adapter.ts';
import { hs, profile } from './hs.ts';
import './save.ts';
import * as THREE from 'three';
import { COLOR_MODES, applyColor, color, colorLine, measure } from './color.ts';
import { setAdProvider, type RewardPlacement } from '../ads/Ads.ts';
import { platform } from '../platform.ts';
import { Game } from '../Game.ts';
import type { UI } from './ui/NativeUI.ts';
import { Gfx } from './ui/gfx.ts';
import { SAFE } from './ui/layout.ts';

declare const GameGlobal: any;
const G: any = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
const T: any = G.tt;

// ---------------------------------------------------------------- platform services (HS SDK)
platform.native = true;
try {
  platform.android = /android/i.test(String(T?.getSystemInfoSync?.()?.platform ?? ''));
} catch {
  /* not Android */
}
platform.canvas = screenCanvas;
platform.share = (text) => hs.share('Sky Roadster', text).then((r) => r === 'shared');
platform.buy = (sku) => hs.buy(sku);
setAdProvider({
  name: 'hs',
  rewarded: (p: RewardPlacement) => hs.rewarded(p),
  interstitial: () => hs.interstitial(),
});

// ---------------------------------------------------------------- safe area (status bar, TikTok capsule)
function measureSafe() {
  let sys: any = {};
  try {
    sys = T.getSystemInfoSync?.() ?? {};
  } catch {
    /* keep the first reading */
  }
  const sa = sys.safeArea ?? safeArea;
  // v3.0.7: some Android TikTok builds answer in physical pixels instead of layout units → the
  // whole UI was pushed ~200 units down. Detect px values (wider than the view / taller than a
  // status bar can be) and divide by the pixel ratio.
  const pr = Math.max(1, sys.pixelRatio || DPR || 1);
  const unit = (v: number, limit: number) => (v > limit && pr > 1 ? v / pr : v);
  const statusBar = Math.min(80, unit(Math.max(0, sys.statusBarHeight ?? 0, sa?.top ?? 0), viewH * 0.1));
  SAFE.top = statusBar;
  const saBottom = sa?.bottom ?? viewH;
  SAFE.bottom = Math.min(48, Math.max(0, viewH - (saBottom > viewH * 1.05 ? saBottom / pr : saBottom)));
  // TikTok's "… ×" capsule sits top-right over the game: keep the top bar just below it.
  // Without a readable rect (some app versions answer 0 at start) assume its usual place.
  let capsule = 0;
  try {
    const m = T.getMenuButtonBoundingClientRect?.();
    if (m && m.bottom > 0) {
      const px = m.right > viewW * 1.05 || m.bottom > viewH * 0.2;
      const k = px ? 1 / pr : 1;
      const bottom = m.bottom * k;
      if (bottom < viewH * 0.16) {
        capsule = bottom + 4;
        SAFE.capL = Math.max(viewW * 0.4, (m.left ?? m.right - (m.width ?? 87)) * k);
        SAFE.capTop = Math.max(0, (m.top ?? m.bottom - (m.height ?? 32)) * k);
        SAFE.capBottom = bottom;
      }
    }
  } catch {
    /* no capsule */
  }
  SAFE.menuBottom = capsule || Math.max(statusBar, 20) + 40;
  if (!capsule) {
    // no readable rect: TikTok's capsule is ~87×32, 6–10 units from the top-right corner
    SAFE.capL = viewW - 100;
    SAFE.capTop = Math.max(statusBar, 20) + 4;
    SAFE.capBottom = SAFE.capTop + 32;
  }
  try {
    if (ui) ui.dirty = true; // (not yet declared on the first call)
  } catch {
    /* first call, before the UI exists */
  }
}
measureSafe();
// the app may report the capsule only once it is on screen: measure again shortly after start
setTimeout(measureSafe, 800);
setTimeout(measureSafe, 3000);

// ---------------------------------------------------------------- the game
const container: any = {
  get clientWidth() {
    return viewW;
  },
  get clientHeight() {
    return viewH;
  },
  appendChild: (x: any) => x,
  removeChild: (x: any) => x,
  addEventListener() {},
  removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: viewW, height: viewH, right: viewW, bottom: viewH }),
  style: {},
};

let game: Game | null = null;
let ui: UI | null = null;
try {
  game = new Game(container);
  ui = (game as any).ui as UI;
} catch (e) {
  console.error('[sky-roadster] could not start the 3D view', e);
  bootError(e);
}

/** the 3D view could not start: say why on screen (instead of a blank / closed game) */
function bootError(e: unknown) {
  try {
    const c = screenCanvas.getContext('2d');
    if (!c) return;
    c.fillStyle = '#04071a';
    c.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    c.fillStyle = '#ffffff';
    const k = screenCanvas.width / viewW;
    c.font = `${Math.round(16 * k)}px sans-serif`;
    c.textAlign = 'center';
    c.fillText('Sky Roadster could not start the 3D view', screenCanvas.width / 2, screenCanvas.height * 0.42);
    c.font = `${Math.round(12 * k)}px sans-serif`;
    c.fillStyle = '#9fb3dd';
    c.fillText(String((e as Error)?.message ?? e).slice(0, 70), screenCanvas.width / 2, screenCanvas.height * 0.42 + 28 * k);
    c.fillText('Please update TikTok and try again.', screenCanvas.width / 2, screenCanvas.height * 0.42 + 50 * k);
    // v3.0.11: the last warnings / errors, so a screenshot tells what went wrong (no vConsole needed)
    c.textAlign = 'left';
    c.font = `${Math.round(9 * k)}px monospace`;
    let yy = screenCanvas.height * 0.42 + 80 * k;
    for (const l of LOG.filter((q) => q.lv !== 'log').slice(-10)) {
      c.fillStyle = l.lv === 'error' ? '#ff8a8a' : '#ffd27a';
      for (const part of l.msg.split('\n').slice(0, 2)) {
        c.fillText(part.slice(0, 64), 10 * k, yy);
        yy += 12 * k;
      }
    }
  } catch {
    /* the canvas already holds a WebGL context */
  }
}

// ---------------------------------------------------------------- canvas UI layer over the 3D view
const uiCanvas: any = G.document?.createElement ? G.document.createElement('canvas') : T.createCanvas();
const gfx = new Gfx(uiCanvas);
gfx.makeImage = makeImage;
const uiScale = Math.min(DPR, 2);
gfx.resize(viewW, viewH, uiScale);
let uiTex: THREE.CanvasTexture | null = null;
let uiScene: THREE.Scene | null = null;
let uiCam: THREE.OrthographicCamera | null = null;
if (ui && game) {
  ui.attach(gfx);
  uiTex = new THREE.CanvasTexture(uiCanvas);
  // the UI canvas is copied to the screen as-is (no sRGB decode / encode round trip that a
  // runtime could get wrong); `decode` is only on when the screen itself encodes to sRGB
  uiTex.colorSpace = THREE.NoColorSpace;
  uiTex.minFilter = THREE.LinearFilter;
  uiTex.magFilter = THREE.LinearFilter;
  uiTex.generateMipmaps = false;
  uiScene = new THREE.Scene();
  uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.RawShaderMaterial({
    uniforms: { map: { value: uiTex }, decode: { value: 0 } },
    vertexShader: 'attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision mediump float; uniform sampler2D map; uniform float decode; varying vec2 vUv;
      vec3 toLinear(vec3 c){ return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(vec3(0.04045), c)); }
      void main(){ vec4 c = texture2D(map, vUv); if (decode > 0.5) c.rgb = toLinear(c.rgb); gl_FragColor = c; }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  // normal blending for colour; the alpha channel stays 1 (the app composites the game canvas)
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.SrcAlphaFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendEquationAlpha = THREE.AddEquation;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  uiScene.add(quad);
  const renderer = (game as any).renderer;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // colour calibration (see color.ts) — before any 3D material is compiled
  const r0: THREE.WebGLRenderer = renderer.renderer;
  measure(r0, () => (G.document?.createElement ? G.document.createElement('canvas') : T.createCanvas()));
  applyColor(r0, 'auto'); // measured at start: compensates only what this phone needs
  ui.colorCtl = {
    mode: () => color.mode,
    line: () => `${colorLine()} · audio ${(game as any)?.audio?.ctx ? (game as any).audio.ctx.state ?? 'on' : 'off'}`,
    cycle: () => {
      const i = COLOR_MODES.indexOf(color.mode);
      const next = COLOR_MODES[(i + 1) % COLOR_MODES.length];
      applyColor(r0, next);
      if (next === 'normal' && color.applied.texture === false) ui!.toast('Colour: normal · reopen the game if textures still look pale', '#4fc3ff');
    },
  };
  renderer.uiPass = (r: THREE.WebGLRenderer) => {
    if (ui!.frame(now())) uiTex!.needsUpdate = true;
    mat.uniforms.decode.value = color.applied.surface ? 1 : 0;
    r.render(uiScene!, uiCam!);
    opaque(r);
  };
  /** force the finished frame's alpha to 1 (bloom / post passes can leave it below 1) */
  const opaque = (r: THREE.WebGLRenderer) => {
    const gl = r.getContext();
    r.setRenderTarget(null);
    gl.colorMask(false, false, false, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
    r.resetState();
  };
  // until the game loop starts (boot: shaders, key art), draw the UI alone — no blank screen
  let booted = false;
  const r3: THREE.WebGLRenderer = renderer.renderer;
  const orig = r3.setAnimationLoop.bind(r3);
  r3.setAnimationLoop = (cb: any) => {
    booted = true;
    orig(cb);
  };
  const raf = G.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 16));
  const pre = () => {
    if (booted) return;
    try {
      r3.setRenderTarget(null);
      r3.setClearColor(0x04071a, 1);
      r3.clear();
      renderer.uiPass(r3);
    } catch {
      /* not ready */
    }
    raf(pre);
  };
  pre();
}

// ---------------------------------------------------------------- touch: UI first, else steering
let owner: 'ui' | 'input' | null = null;
let touchId: number | null = null;
let firstTouch = true;
const input = () => (game as any)?.input as { touchBegin(x: number, y: number): void; touchMove(x: number, y: number): void; touchEnd(): void } | undefined;
function pt(e: any): { id: number; x: number; y: number } | null {
  const list = e?.changedTouches ?? e?.touches ?? [];
  const t = list[0];
  if (!t) return null;
  return { id: t.identifier ?? 0, ...xy(t) };
}
/** a touch point in CSS pixels (a runtime reporting device pixels is scaled back) */
function xy(t: any): { x: number; y: number } {
  let x = Number(t.clientX ?? t.x ?? t.pageX ?? 0),
    y = Number(t.clientY ?? t.y ?? t.pageY ?? 0);
  if (x > viewW * 1.25 || y > viewH * 1.25) {
    x /= DPR;
    y /= DPR;
  }
  return { x, y };
}
/** web preview (browser / artifact frame): the shim cancels pointerdown, so the page never takes
 *  keyboard focus by itself — focus it on every tap so the arrow keys / WASD steer */
function takeFocus() {
  if (NATIVE) return;
  try {
    G.focus?.();
    const c = screenCanvas as any;
    if (c && typeof c.focus === 'function') {
      if (!(c.tabIndex >= 0)) c.tabIndex = 0;
      c.style.outline = 'none';
      c.focus({ preventScroll: true });
    }
  } catch {
    /* ignore */
  }
}
function onStart(e: any) {
  takeFocus();
  const p = pt(e);
  if (!p) return;
  // audio: start on the first touch, and resume it on any later touch if the app suspended it
  if (firstTouch) {
    firstTouch = false;
    emitWindow('pointerdown');
    emitWindow('touchstart');
  } else {
    try {
      (game as any)?.audio?.unlock();
    } catch {
      /* ignore */
    }
  }
  if (touchId !== null) {
    // a second finger: only UI taps (ROADSTER / SOS while steering)
    ui?.touchStart(p.x, p.y);
    ui?.touchEnd();
    return;
  }
  touchId = p.id;
  // v3.0.11: 5 quick taps in the top-left corner → in-game log (works even if a screen is stuck)
  if (p.x < 44 && p.y < 44) {
    const now = Date.now();
    cornerTaps = now - cornerT < 600 ? cornerTaps + 1 : 1;
    cornerT = now;
    if (cornerTaps >= 5 && ui) {
      cornerTaps = 0;
      ui.showOverlay('logs');
      return;
    }
  }
  if (ui && ui.touchStart(p.x, p.y)) owner = 'ui';
  else {
    owner = 'input';
    input()?.touchBegin(p.x, p.y);
  }
}
let cornerTaps = 0,
  cornerT = 0;
function onMove(e: any) {
  const list = e?.changedTouches ?? e?.touches ?? [];
  for (const t of list) {
    if ((t.identifier ?? 0) !== touchId) continue;
    const { x, y } = xy(t);
    if (owner === 'ui') ui?.touchMove(x, y);
    else if (owner === 'input') input()?.touchMove(x, y);
  }
}
function onEnd(e: any) {
  const list = e?.changedTouches ?? [];
  let mine = !list.length;
  for (const t of list) if ((t.identifier ?? 0) === touchId) mine = true;
  if (!mine) return;
  if (owner === 'ui') ui?.touchEnd();
  else if (owner === 'input') input()?.touchEnd();
  owner = null;
  touchId = null;
}
T.onTouchStart?.(onStart);
T.onTouchMove?.(onMove);
T.onTouchEnd?.(onEnd);
T.onTouchCancel?.(onEnd);

// ---------------------------------------------------------------- resize
G.addEventListener?.('resize', () => {
  sizeScreen();
  measureSafe();
  gfx.resize(viewW, viewH, uiScale);
  if (ui) ui.dirty = true;
});

// ---------------------------------------------------------------- HS events
hs.onPause(() => {
  const gm: any = game;
  if (!gm) return;
  gm.audio?.duck(true);
  if (gm.state === 'run') gm.pause();
});
hs.onResume(() => {
  if (ui) ui.dirty = true; // v3.0.11: back from TikTok (mission / share): re-check reward buttons
  const a = (game as any)?.audio;
  a?.duck(false);
  try {
    a?.unlock(); // resume a context the app suspended while it was hidden
  } catch {
    /* ignore */
  }
});
const REWARD_TITLE: Record<string, string> = { tiktok_profile: 'Entry Reward', tiktok_shortcut: 'Launch Reward', share: 'Share Reward' };
hs.onGiven((items, from) => {
  const gm: any = game;
  const parts: string[] = [];
  for (const [k, n] of Object.entries(items)) if (n) parts.push(k === 'coins' ? `+${n} coins` : `${hs.itemName(k)} ×${n}`);
  // v3.0.11: the three reward buttons get a clear "Reward Claimed!" (it stays even when the button hides)
  const title = REWARD_TITLE[String(from ?? '')];
  if (title && parts.length) ui?.rewardClaimed(title, `🎁 <b>${parts.join(' · ')}</b>`);
  else if (parts.length) ui?.toast(`🎁 <b>${parts.join(' · ')}</b>`, 'var(--gold)');
  if (gm) {
    gm.persist?.();
    ui?.refreshProfile(gm.save);
    gm.perkBadges?.();
  }
});
for (const k of ['coins', 'super', 'hyper', 'escape', 'no_ads'])
  profile.on(k, () => {
    if (ui) ui.dirty = true;
  });

// ---------------------------------------------------------------- go
if (game) {
  T.setKeepScreenOn?.({ keepScreenOn: true });
  game.boot().catch((e: unknown) => console.error('[sky-roadster] boot failed', e));
}
void NATIVE;
void logErrors;
