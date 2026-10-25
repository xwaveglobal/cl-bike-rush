/**
 * v3 native runtime adapter — makes the browser-shaped code (Three.js, the game) run inside a
 * native TikTok mini game, where there is no window / document / DOM.
 *
 * Load FIRST (src/native/main.ts imports it before anything else). It only fills in what is
 * missing: in a web page with tt-web-shim.js (desktop preview, the HS Android app) the real
 * window / document are kept and only `tt` is used for the screen canvas, touch and lifecycle.
 *
 * Native-safe tt APIs only (HS kit RULE 1): createCanvas, createImage, getSystemInfoSync,
 * onTouch*, createWebAudioContext, get/set/removeStorageSync, onShow/onHide, vibrate*, …
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const GameGlobal: any;
declare const tt: any;

const G: any = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
const T: any = G.tt;

/** true when there is no real browser around (TikTok native runtime / hs-check) */
export const NATIVE = typeof G.document === 'undefined' || !G.document.createElement;

const info = (() => {
  try {
    return T.getSystemInfoSync();
  } catch {
    return { windowWidth: 390, windowHeight: 844, pixelRatio: 2, platform: 'devtools', language: 'en' };
  }
})();

/** THE on-screen canvas: the first tt.createCanvas() call (TikTok rule). */
export const screenCanvas: any = T.createCanvas();
export const DPR = Math.min(3, info.pixelRatio || 2);
export let viewW: number = info.windowWidth || 390;
export let viewH: number = info.windowHeight || 844;
export const safeArea = info.safeArea || { top: info.statusBarHeight || 0, bottom: viewH, left: 0, right: viewW };

function noop() {}

/** tt images have onload/onerror only — give them the addEventListener Three.js' ImageLoader uses */
export function makeImage(): any {
  const im = T.createImage();
  // always our own listener list, fed from onload / onerror: a runtime image may have an
  // addEventListener that never fires 'load' (Three.js' ImageLoader listens that way)
  const evs: Record<string, ((e: any) => void)[]> = { load: [], error: [] };
  im.addEventListener = (t: string, cb: (e: any) => void) => (evs[t] ??= []).push(cb);
  im.removeEventListener = (t: string, cb: (e: any) => void) => {
    evs[t] = (evs[t] ?? []).filter((f) => f !== cb);
  };
  im.onload = () => evs.load.slice().forEach((f) => f.call(im, { type: 'load', target: im }));
  im.onerror = (e: any) => evs.error.slice().forEach((f) => f.call(im, e ?? { type: 'error', target: im }));
  im.style ??= {};
  return im;
}
type Listener = (e?: any) => void;
const listeners: Record<string, Listener[]> = {};
function on(type: string, cb: Listener) {
  (listeners[type] ??= []).push(cb);
}
function off(type: string, cb: Listener) {
  const l = listeners[type];
  if (l) listeners[type] = l.filter((f) => f !== cb);
}
export function emitWindow(type: string, e?: any) {
  for (const cb of (listeners[type] ?? []).slice()) {
    try {
      cb(e ?? { type });
    } catch (err) {
      console.error(err);
    }
  }
}

if (NATIVE) {
  const canvasLike = () => {
    const c = T.createCanvas();
    c.style ??= {};
    c.addEventListener ??= noop;
    c.removeEventListener ??= noop;
    c.getBoundingClientRect ??= () => ({ left: 0, top: 0, width: c.width, height: c.height, right: c.width, bottom: c.height });
    return c;
  };
  screenCanvas.style ??= {};
  screenCanvas.addEventListener ??= noop;
  screenCanvas.removeEventListener ??= noop;
  screenCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: viewW, height: viewH, right: viewW, bottom: viewH });
  screenCanvas.clientWidth = viewW;
  screenCanvas.clientHeight = viewH;

  const el = (tag = 'div'): any => ({
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [],
    childNodes: [],
    appendChild(x: any) {
      return x;
    },
    removeChild(x: any) {
      return x;
    },
    insertBefore(x: any) {
      return x;
    },
    insertAdjacentHTML: noop,
    setAttribute: noop,
    getAttribute: () => null,
    removeAttribute: noop,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: viewW, height: viewH, right: viewW, bottom: viewH }),
    getContext: () => null,
    focus: noop,
    blur: noop,
  });

  const createElement = (tag: string) => {
    const t = String(tag).toLowerCase();
    if (t === 'canvas') return canvasLike();
    if (t === 'img') return makeImage();
    return el(t);
  };

  const body = el('body');
  const document: any = {
    hidden: false,
    visibilityState: 'visible',
    readyState: 'complete',
    referrer: '',
    body,
    head: el('head'),
    documentElement: el('html'),
    createElement,
    createElementNS: (_ns: string, tag: string) => createElement(tag),
    createTextNode: () => el('text'),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: on,
    removeEventListener: off,
    dispatchEvent: noop,
    fonts: { add: noop, load: () => Promise.resolve([]), ready: Promise.resolve() },
  };

  // in-memory only: the game's data goes through the HS profile (src/core/kv.ts → src/native/save.ts)
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    get length() {
      return mem.size;
    },
  };

  const perf = (() => {
    try {
      if (G.performance && typeof G.performance.now() === 'number') return G.performance;
      const p = T.getPerformance?.();
      if (p && typeof p.now === 'function' && typeof p.now() === 'number') return p;
    } catch {
      /* ignore */
    }
    const t0 = Date.now();
    return { now: () => Date.now() - t0 };
  })();

  const navigator: any = {
    userAgent: `TikTokMiniGame ${info.platform || ''}`,
    language: info.language || 'en',
    languages: [info.language || 'en'],
    platform: info.platform || '',
    onLine: true,
    vibrate: (ms: number | number[]) => {
      try {
        const n = Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms;
        if (n >= 300) T.vibrateLong?.({});
        else T.vibrateShort?.({ type: n > 30 ? 'heavy' : 'light' });
      } catch {
        /* ignore */
      }
      return true;
    },
  };

  const win = G;
  /** set a global; read-only ones (a getter on the runtime's global) are redefined, else skipped */
  const put = (k: string, v: any) => {
    try {
      win[k] = v;
      if (win[k] === v) return;
    } catch {
      /* read-only */
    }
    try {
      Object.defineProperty(win, k, { value: v, configurable: true, writable: true });
    } catch {
      /* the runtime keeps its own */
    }
  };
  put('window', win);
  put('self', win);
  put('top', win);
  put('parent', win);
  put('document', document);
  put('navigator', navigator);
  put('performance', perf);
  put('localStorage', storage);
  put('sessionStorage', storage);
  put('location', { href: '', search: '', hash: '', origin: '', pathname: '/', hostname: '', protocol: 'tt:', host: '', reload: noop });
  put('screen', { width: viewW, height: viewH });
  put('innerWidth', viewW);
  put('innerHeight', viewH);
  put('devicePixelRatio', DPR);
  put('addEventListener', on);
  put('removeEventListener', off);
  put('dispatchEvent', noop);
  put('matchMedia', () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop }));
  put('getComputedStyle', () => ({ getPropertyValue: () => '' }));
  win.Image = function Image() {
    return makeImage();
  };
  win.HTMLElement ??= function HTMLElement() {};
  // the runtime's own frame clock (global, or on tt), else a 60 Hz timer
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : T.requestAnimationFrame?.bind(T);
  const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : T.cancelAnimationFrame?.bind(T);
  win.requestAnimationFrame ??= raf ?? ((cb: (t: number) => void) => setTimeout(() => cb(perf.now()), 16));
  win.cancelAnimationFrame ??= caf ?? ((id: number) => clearTimeout(id));
  win.AudioContext ??= function AudioContext() {
    return T.createWebAudioContext();
  };
  put('webkitAudioContext', win.AudioContext);
  win.alert ??= (m: string) => T.showModal?.({ title: '', content: String(m), showCancel: false });

  // app lifecycle → the visibilitychange / resize events the game already listens to
  try {
    T.onHide?.(() => {
      document.hidden = true;
      document.visibilityState = 'hidden';
      emitWindow('visibilitychange');
    });
    T.onShow?.(() => {
      document.hidden = false;
      document.visibilityState = 'visible';
      emitWindow('visibilitychange');
    });
    T.onWindowResize?.((r: any) => {
      viewW = r.windowWidth || viewW;
      viewH = r.windowHeight || viewH;
      win.innerWidth = viewW;
      win.innerHeight = viewH;
      emitWindow('resize');
    });
  } catch {
    /* ignore */
  }
} else {
  // web page (preview / Android WebView): the shim already put the screen canvas in the page
  try {
    (G.tt as typeof tt).onWindowResize?.((r: any) => {
      viewW = r.windowWidth || viewW;
      viewH = r.windowHeight || viewH;
    });
  } catch {
    /* ignore */
  }
}

/** keep the screen canvas at the window size × pixel ratio (sharp on phones) */
export function sizeScreen() {
  screenCanvas.width = Math.round(viewW * DPR);
  screenCanvas.height = Math.round(viewH * DPR);
}
sizeScreen();
