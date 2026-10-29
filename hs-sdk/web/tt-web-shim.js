/*! tt-web-shim.js 1.0.0 — runs a native TikTok mini game in a web page.
 *
 * Used by the HS Android app (the game in a WebView) and by the desktop
 * preview. Load it BEFORE the game: it defines `tt` and `GameGlobal` with the
 * part of the TikTok runtime a canvas game uses — canvas, images, touch,
 * storage, audio, lifecycle, system info, network, small UI.
 *
 * It deliberately does NOT define the TikTok-only services: login, pay, ads,
 * share, missions (addShortcut / startEntranceMission…). The game reaches
 * those through hs-game.js only, which knows what each platform offers
 * (HSGame.has). A game that calls them on `tt` directly breaks here — and
 * hs-check says so before it gets this far.
 *
 * When the Android app's bridge (HSNative) is present, network, storage and
 * pause / resume go through it.
 */
(function (window) {
  'use strict';
  if (window.tt && window.tt.__hsWebShim) return;

  var doc = window.document;
  var nav = window.navigator || {};
  var native = window.HSNative && window.HSNative.platform === 'android' ? window.HSNative : null;
  var noop = function () {};

  function call(fn, arg) { if (typeof fn === 'function') { try { fn(arg); } catch (e) { reportError(e); } } }
  /** TikTok's callback style: success / fail / complete. */
  function settle(o, ok, res) {
    o = o || {};
    call(ok ? o.success : o.fail, res);
    call(o.complete, res);
  }
  function listeners() {
    var list = [];
    return {
      on: function (cb) { if (typeof cb === 'function' && list.indexOf(cb) < 0) list.push(cb); },
      off: function (cb) { if (!cb) { list.length = 0; return; } var i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); },
      emit: function (arg) { list.slice().forEach(function (cb) { call(cb, arg); }); },
      get size() { return list.length; }
    };
  }

  // ─── Page: a full-screen, non-scrolling, non-zooming surface ─────────────

  function preparePage() {
    var style = doc.createElement('style');
    style.textContent =
      'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;' +
      'touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}' +
      'canvas.hs-screen{position:fixed;left:0;top:0;width:100vw;height:100vh;display:block;touch-action:none}';
    (doc.head || doc.documentElement).appendChild(style);
    doc.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ─── System info ────────────────────────────────────────────────────────

  var safeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  function measureSafeArea() {
    if (!doc.body) return;
    var probe = doc.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)';
    doc.body.appendChild(probe);
    var cs = window.getComputedStyle(probe);
    safeInsets = {
      top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0
    };
    doc.body.removeChild(probe);
  }

  function osName() {
    var ua = String(nav.userAgent || '');
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'devtools';
  }

  // The window size the game was last told. Many games read it once at start
  // and lay out for it; when the window then changes (Android's system bars
  // settling, a rotation, a desktop resize) the screen canvas is stretched to
  // the new size while the game still thinks in the old one. Touches are
  // mapped into this size, so a tap lands where the game drew the button.
  var told = { w: 0, h: 0 };

  function systemInfo() {
    var w = window.innerWidth, h = window.innerHeight;
    told = { w: w, h: h };
    var s = window.screen || {};
    return {
      platform: osName(),
      brand: '', model: '', system: String(nav.platform || ''),
      language: String(nav.language || 'en'),
      version: '', SDKVersion: 'web', appName: native ? 'HSAndroid' : 'Web',
      pixelRatio: window.devicePixelRatio || 1,
      screenWidth: s.width || w, screenHeight: s.height || h,
      windowWidth: w, windowHeight: h,
      statusBarHeight: safeInsets.top,
      safeArea: {
        left: safeInsets.left, top: safeInsets.top,
        right: w - safeInsets.right, bottom: h - safeInsets.bottom,
        width: w - safeInsets.left - safeInsets.right, height: h - safeInsets.top - safeInsets.bottom
      }
    };
  }

  // ─── Canvas, images, fonts ──────────────────────────────────────────────

  var screenCanvas = null;
  /**
   * The FIRST call is the on-screen canvas, later calls are off-screen — as in
   * TikTok. The screen canvas fills the viewport (CSS) and starts at the
   * window size in CSS pixels; a game that wants a sharp image sets
   * width / height to windowWidth * pixelRatio itself, as on TikTok.
   */
  function createCanvas() {
    var c = doc.createElement('canvas');
    if (screenCanvas) return c;
    screenCanvas = c;
    c.className = 'hs-screen';
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    if (!told.w) told = { w: c.width, h: c.height };   // a game that never asked lays out for this
    var attach = function () { if (!c.parentNode) doc.body.appendChild(c); };
    if (doc.body) attach(); else doc.addEventListener('DOMContentLoaded', attach);
    return c;
  }

  var fontCount = 0;
  /** Returns the font family to use in ctx.font; the font loads in the background. */
  function loadFont(url) {
    var family = 'hsfont' + (++fontCount);
    try {
      if (window.FontFace && doc.fonts) {
        var face = new window.FontFace(family, 'url(' + JSON.stringify(String(url)) + ')');
        face.load().then(function (f) { doc.fonts.add(f); }, function (e) { reportError(e); });
      }
    } catch (e) { reportError(e); }
    return family;
  }

  // ─── Touch: pointer events (finger and mouse) → TikTok touch events ─────

  var touchStart = listeners(), touchMove = listeners(), touchEnd = listeners(), touchCancel = listeners();
  var active = {};   // pointerId → last Touch

  /** A pointer position in the window size the game was last told (see `told`). */
  function toTouch(e) {
    var x = e.clientX, y = e.clientY;
    var r = screenCanvas && told.w ? safe(function () { return screenCanvas.getBoundingClientRect(); }) : null;
    if (r && r.width > 0 && r.height > 0) {
      x = (x - r.left) * told.w / r.width;
      y = (y - r.top) * told.h / r.height;
    }
    return { identifier: e.pointerId, clientX: x, clientY: y, pageX: x, pageY: y, force: e.pressure || 1 };
  }
  function safe(fn) { try { return fn(); } catch (err) { return null; } }
  function activeList() { var out = []; for (var k in active) out.push(active[k]); return out; }
  function touchEvent(e, t) { return { touches: activeList(), changedTouches: [t], timeStamp: e.timeStamp }; }

  function hookTouch() {
    var opts = { passive: false };
    doc.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      unlockAudio();
      var t = toTouch(e);
      active[e.pointerId] = t;
      if (e.cancelable) e.preventDefault();
      touchStart.emit(touchEvent(e, t));
    }, opts);
    doc.addEventListener('pointermove', function (e) {
      if (!active[e.pointerId]) return;           // a mouse moving with no button down is not a touch
      var t = toTouch(e);
      active[e.pointerId] = t;
      if (e.cancelable) e.preventDefault();
      touchMove.emit(touchEvent(e, t));
    }, opts);
    var finish = function (bus) {
      return function (e) {
        if (!active[e.pointerId]) return;
        var t = toTouch(e);
        delete active[e.pointerId];
        bus.emit(touchEvent(e, t));
      };
    };
    doc.addEventListener('pointerup', finish(touchEnd), opts);
    doc.addEventListener('pointercancel', finish(touchCancel), opts);
    // The finger left the window (desktop preview): end it, never leave it stuck.
    window.addEventListener('blur', function () {
      for (var k in active) touchCancel.emit({ touches: [], changedTouches: [active[k]], timeStamp: Date.now() });
      active = {};
    });
  }

  // ─── Storage: the app's own storage, else localStorage ──────────────────
  // TikTok keeps the type that was stored (5 comes back as 5), so values are
  // kept as JSON under a prefix of their own.

  var PREFIX = 'tt:';
  var backing = (function () {
    if (native && native.storage) return native.storage;
    try { var ls = window.localStorage; ls.setItem('__tt_probe', '1'); ls.removeItem('__tt_probe'); return ls; } catch (e) { return null; }
  })();
  var memStore = {};

  function storageKeys() {
    var keys = [];
    if (backing && typeof backing.length === 'number' && typeof backing.key === 'function') {
      for (var i = 0; i < backing.length; i++) { var k = backing.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k.slice(PREFIX.length)); }
    } else {
      for (var m in memStore) keys.push(m);
    }
    return keys;
  }
  // The backing store (quota, a native storage error) never throws into the
  // game: the memory copy still holds the value for this session.
  function setStorageSync(key, value) {
    var text = JSON.stringify(value === undefined ? null : value);
    memStore[key] = text;
    if (backing) { try { backing.setItem(PREFIX + key, text); } catch (e) { reportError(e); } }
  }
  function getStorageSync(key) {
    var text = null;
    if (backing) { try { text = backing.getItem(PREFIX + key); } catch (e) { text = null; } }
    if (text === null || text === undefined) text = Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    if (text === null || text === undefined) return '';
    try { return JSON.parse(text); } catch (e) { return text; }
  }
  function removeStorageSync(key) {
    delete memStore[key];
    if (backing) { try { backing.removeItem(PREFIX + key); } catch (e) { reportError(e); } }
  }
  function clearStorageSync() { storageKeys().forEach(removeStorageSync); }

  // ─── Lifecycle: the app's pause / resume, else page visibility ──────────

  var shown = listeners(), hidden = listeners();
  var visible = true;
  function goHidden() { if (!visible) return; visible = false; pauseAudio(); hidden.emit(); }
  function goShown() { if (visible) return; visible = true; resumeAudio(); shown.emit({ query: {}, scene: '', path: '' }); }

  function hookLifecycle() {
    if (native && typeof native.on === 'function') {
      try { native.on('pause', goHidden); native.on('resume', goShown); } catch (e) { reportError(e); }
    }
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') goHidden(); else goShown(); });
  }

  // ─── Audio ──────────────────────────────────────────────────────────────
  // A WebView will not play sound before the player's first touch, while
  // TikTok will. Plays asked for before that wait and start on the first touch.

  var unlocked = false;
  var waiting = [];          // plays that waited for the first touch
  var contexts = [];         // Web Audio contexts the game created
  var audios = [];           // inner audio contexts alive
  var hiddenPlaying = [];    // audios that were playing when the app went away
  var hiddenRunning = [];    // Web Audio contexts that were running when the app went away

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    contexts.forEach(function (c) { if (c.state === 'suspended' && visible) safePromise(c.resume()); });
    var w = waiting; waiting = [];
    w.forEach(function (fn) { fn(); });
  }
  function safePromise(p) { if (p && typeof p.catch === 'function') p.catch(noop); }
  // Only what THIS shim stopped is started again: a context or a sound the
  // game paused itself (muted in settings, on HSGame 'pause') stays paused.
  function pauseAudio() {
    hiddenRunning = contexts.filter(function (c) { return c.state === 'running'; });
    hiddenRunning.forEach(function (c) { safePromise(c.suspend()); });
    hiddenPlaying = audios.filter(function (a) { return !a._el.paused; });
    hiddenPlaying.forEach(function (a) { a._el.pause(); });
  }
  function resumeAudio() {
    if (unlocked) hiddenRunning.forEach(function (c) { if (c.state === 'suspended') safePromise(c.resume()); });
    hiddenRunning = [];
    hiddenPlaying.forEach(function (a) { safePromise(a._el.play()); });
    hiddenPlaying = [];
  }

  function createWebAudioContext() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available');
    var c = new Ctor();
    contexts.push(c);
    return c;
  }

  function createInnerAudioContext() {
    var el = new window.Audio();
    el.preload = 'auto';
    var bus = {};
    ['Canplay', 'Play', 'Pause', 'Stop', 'Ended', 'Error', 'TimeUpdate', 'Waiting', 'Seeking', 'Seeked'].forEach(function (n) { bus[n] = listeners(); });
    el.addEventListener('canplay', function () { bus.Canplay.emit(); });
    el.addEventListener('play', function () { bus.Play.emit(); });
    el.addEventListener('pause', function () { bus.Pause.emit(); });
    el.addEventListener('ended', function () { bus.Ended.emit(); });
    el.addEventListener('error', function () { bus.Error.emit({ errMsg: 'audio error', errCode: el.error ? el.error.code : -1 }); });
    el.addEventListener('timeupdate', function () { bus.TimeUpdate.emit(); });
    el.addEventListener('waiting', function () { bus.Waiting.emit(); });
    el.addEventListener('seeking', function () { bus.Seeking.emit(); });
    el.addEventListener('seeked', function () { bus.Seeked.emit(); });

    var startTime = 0;
    var a = {
      _el: el,
      get src() { return el.getAttribute('src') || ''; },
      set src(v) { el.src = String(v); if (a.autoplay) a.play(); },
      autoplay: false,
      get loop() { return el.loop; }, set loop(v) { el.loop = !!v; },
      get volume() { return el.volume; }, set volume(v) { el.volume = Math.max(0, Math.min(1, Number(v) || 0)); },
      get startTime() { return startTime; }, set startTime(v) { startTime = Number(v) || 0; },
      get obeyMuteSwitch() { return true; }, set obeyMuteSwitch(v) { void v; },
      get currentTime() { return el.currentTime; },
      get duration() { return el.duration || 0; },
      get paused() { return el.paused; },
      get buffered() { return el.buffered && el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0; },
      play: function () {
        var go = function () {
          if (startTime && el.currentTime === 0) el.currentTime = startTime;
          var p = el.play();
          if (p && typeof p.catch === 'function') {
            p.catch(function (e) {
              if (e && e.name === 'NotAllowedError' && !unlocked) waiting.push(go);
              else bus.Error.emit({ errMsg: String(e && e.message || e), errCode: -1 });
            });
          }
        };
        go();   // refused before the first touch → waits for it (see the catch above)
      },
      pause: function () { el.pause(); },
      stop: function () { el.pause(); el.currentTime = 0; bus.Stop.emit(); },
      seek: function (t) { el.currentTime = Number(t) || 0; },
      destroy: function () { el.pause(); el.removeAttribute('src'); el.load(); var i = audios.indexOf(a); if (i >= 0) audios.splice(i, 1); }
    };
    Object.keys(bus).forEach(function (n) { a['on' + n] = bus[n].on; a['off' + n] = bus[n].off; });
    audios.push(a);
    return a;
  }

  // ─── Network ────────────────────────────────────────────────────────────

  function request(o) {
    o = o || {};
    var method = String(o.method || 'GET').toUpperCase();
    var headers = {};
    var h = o.header || o.headers || {};
    for (var k in h) headers[k] = String(h[k]);
    var url = String(o.url || '');
    var body = '';
    var data = o.data;
    if (data !== undefined && data !== null) {
      if (method === 'GET' && typeof data === 'object') {
        var q = Object.keys(data).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]); }).join('&');
        if (q) url += (url.indexOf('?') < 0 ? '?' : '&') + q;
      } else if (typeof data === 'string') {
        body = data;
      } else {
        body = JSON.stringify(data);
        if (!headers['content-type'] && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      }
    }
    var aborted = false;
    var timeoutMs = Number(o.timeout) > 0 ? Number(o.timeout) : 60000;
    var timer = setTimeout(function () { finish(false, { errMsg: 'request:fail timeout' }); }, timeoutMs);
    var done = false;
    function finish(ok, res) { if (done) return; done = true; clearTimeout(timer); settle(o, ok, res); }
    function answer(status, text, respHeaders) {
      var out = text;
      if (o.dataType !== 'string' && o.responseType !== 'text') { try { out = JSON.parse(text); } catch (e) { out = text; } }
      if (o.dataType === 'string' || o.responseType === 'text') out = text;
      finish(true, { statusCode: status, data: out, header: respHeaders || {} });
    }
    var sending = (native && typeof native.request === 'function')
      ? Promise.resolve().then(function () { return native.request({ url: url, method: method, headers: headers, body: body, timeoutMs: timeoutMs }); })
          .then(function (r) {
            if (!r) throw new Error('no answer from the app');
            return { status: r.status, text: typeof r.body === 'string' ? r.body : (r.body == null ? '' : JSON.stringify(r.body)), headers: r.headers };
          })
      : window.fetch(url, { method: method, headers: headers, body: method === 'GET' || method === 'HEAD' ? undefined : body })
          .then(function (r) {
            var hs = {};
            r.headers.forEach(function (v, key) { hs[key] = v; });
            return r.text().then(function (t) { return { status: r.status, text: t, headers: hs }; });
          });
    sending.then(function (r) { if (!aborted) answer(r.status, r.text, r.headers); },
      function (e) { if (!aborted) finish(false, { errMsg: 'request:fail ' + String(e && e.message || e) }); });
    return { abort: function () { aborted = true; finish(false, { errMsg: 'request:fail abort' }); }, onHeadersReceived: noop, offHeadersReceived: noop };
  }

  // ─── Small UI: toast, modal, loading ────────────────────────────────────

  var toastEl = null, toastTimer = null;
  function showToast(o) {
    o = o || {};
    hideToast();
    toastEl = doc.createElement('div');
    toastEl.textContent = String(o.title || '');
    toastEl.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-width:70vw;padding:12px 18px;' +
      'background:rgba(0,0,0,.75);color:#fff;font:15px/1.4 system-ui,sans-serif;border-radius:10px;text-align:center;z-index:2147483000;pointer-events:none';
    doc.body.appendChild(toastEl);
    toastTimer = setTimeout(hideToast, Number(o.duration) || 1500);
    settle(o, true, { errMsg: 'showToast:ok' });
  }
  function hideToast(o) {
    clearTimeout(toastTimer);
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = null;
    if (o) settle(o, true, { errMsg: 'hideToast:ok' });
  }
  function showLoading(o) { showToast({ title: (o && o.title) || '…', duration: 600000 }); settle(o, true, { errMsg: 'showLoading:ok' }); }
  function hideLoading(o) { hideToast(); settle(o, true, { errMsg: 'hideLoading:ok' }); }

  function showModal(o) {
    o = o || {};
    var shade = doc.createElement('div');
    shade.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:2147483001';
    var box = doc.createElement('div');
    box.style.cssText = 'background:#fff;color:#111;width:min(80vw,320px);border-radius:12px;font:15px/1.45 system-ui,sans-serif;overflow:hidden';
    var body = doc.createElement('div');
    body.style.cssText = 'padding:20px 18px;text-align:center';
    if (o.title) { var t = doc.createElement('div'); t.textContent = String(o.title); t.style.cssText = 'font-weight:600;margin-bottom:8px'; body.appendChild(t); }
    if (o.content) { var c = doc.createElement('div'); c.textContent = String(o.content); body.appendChild(c); }
    box.appendChild(body);
    var row = doc.createElement('div');
    row.style.cssText = 'display:flex;border-top:1px solid #ddd';
    var close = function (confirm) {
      if (shade.parentNode) shade.parentNode.removeChild(shade);
      settle(o, true, { confirm: confirm, cancel: !confirm, errMsg: 'showModal:ok' });
    };
    var button = function (text, color, confirm) {
      var b = doc.createElement('button');
      b.textContent = text;
      b.style.cssText = 'flex:1;padding:13px;border:0;background:none;font:inherit;color:' + color;
      b.addEventListener('click', function (e) { e.stopPropagation(); close(confirm); });
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      row.appendChild(b);
    };
    if (o.showCancel !== false) button(o.cancelText || 'Cancel', o.cancelColor || '#666', false);
    button(o.confirmText || 'OK', o.confirmColor || '#1677ff', true);
    box.appendChild(row);
    shade.appendChild(box);
    shade.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    doc.body.appendChild(shade);
  }

  // ─── Errors ─────────────────────────────────────────────────────────────

  var errors = listeners();
  function safeText(v) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (x) { return String(v); } }
  function reportError(e) {
    // One string: the Android app's log (Capacitor / logcat) prints objects as "[object Object]".
    var text = e && e.message ? e.message + (e.stack ? '\n' + e.stack : '') : safeText(e);
    try { console.error('[tt-web-shim] ' + text); } catch (x) { /* ignore */ }
    if (errors.size) errors.emit({ message: String(e && e.message || e), stack: String(e && e.stack || '') });
  }
  window.addEventListener('error', function (e) { errors.emit({ message: String(e.message), stack: String(e.error && e.error.stack || '') }); });

  // ─── tt ─────────────────────────────────────────────────────────────────

  var resize = listeners();
  window.addEventListener('resize', function () {
    measureSafeArea();
    // Only a game that listens takes the new size; for the others touches stay
    // mapped into the size they laid out for.
    if (resize.size) told = { w: window.innerWidth, h: window.innerHeight };
    resize.emit({ windowWidth: window.innerWidth, windowHeight: window.innerHeight });
  });

  var launch = { query: {}, scene: '', path: '', referrerInfo: {} };
  var syncOk = function (name) { return function (o) { settle(o, true, { errMsg: name + ':ok' }); }; };

  var tt = {
    __hsWebShim: true,
    env: { USER_DATA_PATH: 'ttfile://user' },

    getSystemInfoSync: systemInfo,
    getSystemInfo: function (o) { settle(o, true, systemInfo()); },
    getWindowInfo: function () { var s = systemInfo(); return { pixelRatio: s.pixelRatio, screenWidth: s.screenWidth, screenHeight: s.screenHeight, windowWidth: s.windowWidth, windowHeight: s.windowHeight, statusBarHeight: s.statusBarHeight, safeArea: s.safeArea }; },
    getLaunchOptionsSync: function () { return launch; },
    getEnterOptionsSync: function () { return launch; },
    /** No TikTok menu button here: an empty rect at the top-right, below the status bar. */
    getMenuButtonBoundingClientRect: function () {
      var w = window.innerWidth, top = safeInsets.top;
      return { width: 0, height: 0, top: top, bottom: top, left: w - safeInsets.right, right: w - safeInsets.right };
    },
    getPerformance: function () { return window.performance; },

    createCanvas: createCanvas,
    createOffscreenCanvas: function () { return doc.createElement('canvas'); },
    createImage: function () { return new window.Image(); },
    loadFont: loadFont,
    setPreferredFramesPerSecond: noop,
    triggerGC: noop,

    onTouchStart: touchStart.on, offTouchStart: touchStart.off,
    onTouchMove: touchMove.on, offTouchMove: touchMove.off,
    onTouchEnd: touchEnd.on, offTouchEnd: touchEnd.off,
    onTouchCancel: touchCancel.on, offTouchCancel: touchCancel.off,

    setStorageSync: setStorageSync,
    getStorageSync: getStorageSync,
    removeStorageSync: removeStorageSync,
    clearStorageSync: clearStorageSync,
    getStorageInfoSync: function () { return { keys: storageKeys(), currentSize: 0, limitSize: 10240 }; },
    setStorage: function (o) { o = o || {}; try { setStorageSync(o.key, o.data); settle(o, true, { errMsg: 'setStorage:ok' }); } catch (e) { settle(o, false, { errMsg: 'setStorage:fail ' + e }); } },
    getStorage: function (o) { o = o || {}; var v = getStorageSync(o.key); if (v === '') settle(o, false, { errMsg: 'getStorage:fail data not found' }); else settle(o, true, { data: v, errMsg: 'getStorage:ok' }); },
    removeStorage: function (o) { o = o || {}; removeStorageSync(o.key); settle(o, true, { errMsg: 'removeStorage:ok' }); },
    clearStorage: function (o) { clearStorageSync(); settle(o, true, { errMsg: 'clearStorage:ok' }); },

    onShow: shown.on, offShow: shown.off,
    onHide: hidden.on, offHide: hidden.off,
    onWindowResize: resize.on, offWindowResize: resize.off,
    onError: errors.on, offError: errors.off,
    onAudioInterruptionBegin: noop, offAudioInterruptionBegin: noop,
    onAudioInterruptionEnd: noop, offAudioInterruptionEnd: noop,

    createInnerAudioContext: createInnerAudioContext,
    createWebAudioContext: createWebAudioContext,

    request: request,

    showToast: showToast, hideToast: hideToast,
    showLoading: showLoading, hideLoading: hideLoading,
    showModal: showModal,

    vibrateShort: function (o) { try { if (nav.vibrate) nav.vibrate(15); } catch (e) { /* ignore */ } settle(o, true, { errMsg: 'vibrateShort:ok' }); },
    vibrateLong: function (o) { try { if (nav.vibrate) nav.vibrate(400); } catch (e) { /* ignore */ } settle(o, true, { errMsg: 'vibrateLong:ok' }); },
    setKeepScreenOn: syncOk('setKeepScreenOn'),
    setClipboardData: function (o) {
      o = o || {};
      var p = nav.clipboard && nav.clipboard.writeText ? nav.clipboard.writeText(String(o.data || '')) : Promise.reject(new Error('no clipboard'));
      p.then(function () { settle(o, true, { errMsg: 'setClipboardData:ok' }); }, function (e) { settle(o, false, { errMsg: 'setClipboardData:fail ' + e }); });
    },
    getUpdateManager: function () { return { onCheckForUpdate: noop, onUpdateReady: noop, onUpdateFailed: noop, applyUpdate: noop }; },
    exitMiniProgram: syncOk('exitMiniProgram')
  };

  window.tt = tt;
  if (!window.GameGlobal) window.GameGlobal = window;

  preparePage();
  hookTouch();
  hookLifecycle();
  if (doc.body) measureSafeArea(); else doc.addEventListener('DOMContentLoaded', measureSafeArea);
})(window);
