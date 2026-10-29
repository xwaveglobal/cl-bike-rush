/*! preview-runtime.js — PREVIEW ONLY: the phone the game runs on in hs-web preview.
 *
 * Loaded in the game frame BEFORE tt-web-shim.js. The preview page around the
 * frame (preview-shell.js) holds the fake HS backend, the phones and the
 * inspector; this file connects the game to them:
 *   - network: every /api/… call goes to the fake backend; anything else that
 *     is not this page's own server is refused (the page's CSP refuses it too),
 *     so the game's real Game ID / SDK key never leave the computer;
 *   - TikTok mode: tt.login, tt.pay, ads, share and the two missions, each a
 *     screen you answer by hand;
 *   - Android mode: HSNative (device account, ads, share, Google Play billing);
 *   - the clock (+1 day) and app background / foreground for the inspector.
 *
 * Never ship this file: TikTok and the real app provide their own.
 */
(function (window) {
  'use strict';
  var doc = window.document;
  var shell = window.parent !== window ? window.parent.HSPreview : null;
  if (!shell) {
    doc.write('<p style="font:16px system-ui;color:#fff;padding:20px">Open the preview from its main page: ' +
      '<a style="color:#8cf" href="/">/</a></p>');
    return;
  }
  var platform = shell.platform();
  var phone = shell.phone();

  // ─── The clock: "+1 day" moves it forward (the fake backend's clock too) ───
  var offset = shell.clockOffset();
  if (offset) {
    var RealDate = window.Date;
    var FakeDate = function (a, b, c, d, e, f, g) {
      if (!(this instanceof FakeDate)) return new RealDate(RealDate.now() + offset).toString();
      switch (arguments.length) {
        case 0: return new RealDate(RealDate.now() + offset);
        case 1: return new RealDate(a);
        default: return new RealDate(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0, g || 0);
      }
    };
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = function () { return RealDate.now() + offset; };
    FakeDate.parse = RealDate.parse;
    FakeDate.UTC = RealDate.UTC;
    window.Date = FakeDate;
  }

  // ─── Network: the fake backend, or nothing ───────────────────────────────
  function apiPath(url) {
    var m = /^(?:https?:\/\/[^/]+)?(\/api\/[^?#]*)/.exec(String(url || ''));
    return m ? m[1] : null;
  }
  function sameOrigin(url) {
    try { return new URL(String(url), window.location.href).origin === window.location.origin; } catch (e) { return false; }
  }
  /** The fake backend's answer, a little later (a real network is never instant). */
  function api(path, body, headers) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(JSON.parse(shell.api(path, typeof body === 'string' ? body : JSON.stringify(body || {}), JSON.stringify(headers || {})))); }, 80);
    });
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var path = apiPath(url);
    if (path) {
      var headers = {};
      var h = (init && init.headers) || {};
      if (typeof h.forEach === 'function') h.forEach(function (v, k) { headers[k] = v; }); else for (var k in h) headers[k] = h[k];
      return api(path, init && init.body, headers).then(function (r) {
        return new window.Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json' } });
      });
    }
    if (!sameOrigin(url)) {
      shell.log('blocked', 'network call to ' + String(url).slice(0, 120));
      return Promise.reject(new TypeError('preview: network blocked (' + url + ')'));
    }
    return realFetch(input, init);
  };
  var realOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  if (realOpen) {
    window.XMLHttpRequest.prototype.open = function (method, url) {
      if (!sameOrigin(url) || apiPath(url)) {
        shell.log('blocked', 'XMLHttpRequest to ' + String(url).slice(0, 120));
        throw new TypeError('preview: network blocked (' + url + ')');
      }
      return realOpen.apply(this, arguments);
    };
  }

  // ─── Screens you answer by hand ──────────────────────────────────────────
  function sheet(title, lines, buttons) {
    return new Promise(function (resolve) {
      var shade = doc.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,20,.92);color:#fff;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:12px;font:15px/1.4 system-ui,sans-serif;z-index:2147483646;text-align:center;padding:16px';
      var h = doc.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-size:20px;font-weight:600';
      shade.appendChild(h);
      lines.forEach(function (l) { var p = doc.createElement('div'); p.textContent = l; p.style.opacity = '.75'; shade.appendChild(p); });
      buttons.forEach(function (b) {
        var el = doc.createElement('button');
        el.textContent = b.label;
        el.style.cssText = 'min-width:220px;padding:12px 16px;border:0;border-radius:10px;font:inherit;cursor:pointer;background:' + (b.color || '#2b6cff') + ';color:#fff';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          doc.body.removeChild(shade);
          shell.log('screen', title + ' → ' + b.label);
          resolve(b.value);
        });
        shade.appendChild(el);
      });
      // Taps on the screen must not reach the game underneath.
      ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(function (t) {
        shade.addEventListener(t, function (e) { e.stopPropagation(); });
      });
      doc.body.appendChild(shade);
    });
  }

  // ─── App background / foreground ─────────────────────────────────────────
  var visible = true;
  var bus = { pause: [], resume: [] };
  function emit(name) { bus[name].slice().forEach(function (cb) { try { cb(); } catch (e) { console.error(e); } }); }
  // Hidden when the inspector sent the app away OR the browser tab really is
  // hidden (the player switched tabs) — both pause the game.
  var realVisibility = Object.getOwnPropertyDescriptor(window.Document.prototype, 'visibilityState');
  var tabHidden = function () { try { return realVisibility.get.call(doc) === 'hidden'; } catch (e) { return false; } };
  try { Object.defineProperty(doc, 'visibilityState', { configurable: true, get: function () { return visible && !tabHidden() ? 'visible' : 'hidden'; } }); } catch (e) { /* old browser */ }
  var dispatching = false;   // our own event below: setVisible tells the app itself
  if (platform === 'android') {
    doc.addEventListener('visibilitychange', function () { if (!dispatching && visible) emit(tabHidden() ? 'pause' : 'resume'); });
  }
  function setVisible(v) {
    if (visible === v) return;
    visible = v;
    dispatching = true;
    try { doc.dispatchEvent(new window.Event('visibilitychange')); } finally { dispatching = false; }
    if (platform === 'android' && !tabHidden()) emit(v ? 'resume' : 'pause');
    shell.log('app', v ? 'back in the foreground' : 'sent to the background');
  }
  /** What a real fullscreen ad / sheet does: the app goes to the background meanwhile. */
  function away(promise) { setVisible(false); return promise.then(function (r) { setVisible(true); return r; }); }

  window.__hsPreview = {
    platform: platform,
    background: function () { setVisible(false); },
    foreground: function () { setVisible(true); },
    get visible() { return visible; }
  };

  // ─── Android: the HS app's bridge ────────────────────────────────────────
  if (platform === 'android') {
    var nextPurchase = 0;
    window.HSNative = {
      platform: 'android',
      preview: true,
      // Stand-in credentials: requests never leave this page.
      config: { gameId: 'preview-android', sdkKey: 'sk_test_preview', adProvider: 'preview' },
      request: function (req) {
        var path = apiPath(req.url);
        if (!path) {
          shell.log('blocked', 'network call to ' + String(req.url).slice(0, 120));
          return Promise.reject(new Error('preview: network blocked'));
        }
        return api(path, req.body, req.headers);
      },
      deviceId: function () { return Promise.resolve(phone.deviceId); },
      ads: {
        show: function (req) {
          var rewarded = req.type === 'rewarded';
          return away(sheet(rewarded ? 'Rewarded ad (preview)' : 'Interstitial ad (preview)', ['unit ' + req.unitId], rewarded ? [
            { label: 'Watched to the end', value: { shown: true, completed: true } },
            { label: 'Closed early', value: { shown: true, completed: false }, color: '#666' },
            { label: 'No fill', value: { shown: false, completed: false, error: 'NO_FILL (preview)' }, color: '#a33' }
          ] : [
            { label: 'Close ad', value: { shown: true, completed: true } },
            { label: 'No fill', value: { shown: false, completed: false, error: 'NO_FILL (preview)' }, color: '#a33' }
          ]));
        }
      },
      share: function (opts) {
        return away(sheet('Android share sheet (preview)', [String(opts.title || ''), String(opts.text || '')].filter(Boolean), [
          { label: 'Share to an app', value: { ok: true } },
          { label: 'Cancel', value: { ok: false, error: 'cancelled' }, color: '#666' }
        ]));
      },
      on: function (event, cb) {
        if (!bus[event] || typeof cb !== 'function') return function () {};
        bus[event].push(cb);
        return function () { var i = bus[event].indexOf(cb); if (i >= 0) bus[event].splice(i, 1); };
      }
    };
    if (shell.billing()) {
      window.HSNative.billing = {
        products: function (ids) {
          return Promise.resolve(ids.map(function (id) { var p = shell.googlePrice(id); return p && { id: id, price: p, currency: 'USD' }; }).filter(Boolean));
        },
        buy: function (id) {
          var n = ++nextPurchase;
          var purchase = function () {
            var orderId = 'GPA.PREVIEW-' + Date.now() + '-' + n, token = 'preview-token-' + Date.now() + '-' + n;
            var json = JSON.stringify({ orderId: orderId, packageName: 'preview', productId: id, purchaseTime: Date.now(), purchaseState: 0, purchaseToken: token });
            return { productId: id, orderId: orderId, token: token, json: json, signature: 'preview' };
          };
          return away(sheet('Google Play (preview)', [id + ' — ' + (shell.googlePrice(id) || '?')], [
            { label: 'Buy', value: 'buy' },
            { label: 'Cancel', value: 'cancel', color: '#666' },
            { label: 'Pending payment (completes later)', value: 'pending', color: '#a70' },
            { label: 'Buy, then the app dies', value: 'kill', color: '#a33' }
          ])).then(function (choice) {
            if (choice === 'cancel') return { ok: false, cancelled: true };
            var p = purchase();
            if (choice === 'pending') {
              shell.addPending(p);
              return { ok: false, error: 'PENDING — finish it with "Complete pending payment" in the inspector' };
            }
            shell.addOwned(p);
            if (choice === 'kill') { shell.reloadApp('the app died after the payment'); return new Promise(function () {}); }
            return { ok: true, purchase: p };
          });
        },
        owned: function () { return Promise.resolve(JSON.parse(shell.owned())); },
        finish: function (f) { shell.finishPurchase(f.token, f.consumable); return Promise.resolve(); }
      };
    }
  }

  // ─── TikTok: the services the web shim leaves out ────────────────────────
  // Added after tt-web-shim.js has made window.tt (frame page calls this).
  window.__hsPreviewAfterShim = function () {
    var tt = window.tt;
    if (!tt || platform !== 'tiktok') return;
    var cb = function (o, ok, res) { var f = o && (ok ? o.success : o.fail); if (typeof f === 'function') f(res); if (o && typeof o.complete === 'function') o.complete(res); };

    tt.login = function (o) {
      setTimeout(function () {
        if (shell.loginFails()) cb(o, false, { errMsg: 'login:fail (preview: login is switched off)' });
        else cb(o, true, { code: 'preview-code-' + shell.account(), errMsg: 'login:ok' });
      }, 120);
    };

    tt.pay = function (o) {
      var trade = o && o.orderInfo && o.orderInfo.order_id;
      var order = shell.order(trade);
      away(sheet('TikTok pay (preview)', [order ? order.name + ' — ' + order.beans + ' Beans' : String(trade)], [
        { label: 'Pay', value: 'pay' },
        { label: 'Cancel', value: 'cancel', color: '#666' },
        { label: 'Pay, then the app dies', value: 'kill', color: '#a33' }
      ])).then(function (choice) {
        if (choice === 'cancel') return cb(o, false, { errMsg: 'pay:fail cancel' });
        shell.markPaid(trade);
        if (choice === 'kill') return shell.reloadApp('the app died after the payment');
        cb(o, true, { errMsg: 'pay:ok' });
      });
    };

    function ad(kind) {
      return function (opts) {
        var closeCbs = [], errorCbs = [];
        var unit = opts && opts.adUnitId;
        return {
          onClose: function (f) { closeCbs.push(f); }, offClose: function () { closeCbs = []; },
          onError: function (f) { errorCbs.push(f); }, offError: function () { errorCbs = []; },
          onLoad: function () {}, offLoad: function () {}, load: function () { return Promise.resolve(); },
          destroy: function () {},
          show: function () {
            var rewarded = kind === 'rewarded';
            away(sheet(rewarded ? 'TikTok rewarded ad (preview)' : 'TikTok interstitial (preview)', ['unit ' + unit], rewarded ? [
              { label: 'Watched to the end', value: 'end' },
              { label: 'Closed early', value: 'early', color: '#666' },
              { label: 'No fill', value: 'nofill', color: '#a33' }
            ] : [
              { label: 'Close ad', value: 'end' },
              { label: 'No fill', value: 'nofill', color: '#a33' }
            ])).then(function (r) {
              if (r === 'nofill') errorCbs.forEach(function (f) { f({ errMsg: 'no fill (preview)', errCode: 1004 }); });
              else closeCbs.forEach(function (f) { f({ isEnded: r === 'end' }); });
            });
            return Promise.resolve();
          }
        };
      };
    }
    tt.createRewardedVideoAd = ad('rewarded');
    tt.createInterstitialAd = ad('interstitial');

    tt.shareAppMessage = function (o) {
      away(sheet('TikTok share (preview)', [String((o && o.title) || '')], [
        { label: 'Share', value: true },
        { label: 'Cancel', value: false, color: '#666' }
      ])).then(function (ok) { cb(o, ok, ok ? { errMsg: 'shareAppMessage:ok' } : { errMsg: 'shareAppMessage:fail cancel' }); });
    };

    // The two missions. The reward is TikTok's to confirm: after "Add" the next
    // check pays (as if opened from the icon); after the profile visit, too.
    var missions = phone.missions;
    tt.addShortcut = function (o) {
      away(sheet('Add to home screen (preview)', [], [
        { label: 'Add', value: true }, { label: 'Cancel', value: false, color: '#666' }
      ])).then(function (ok) {
        if (ok) { missions.shortcut = true; shell.savePhone(); }
        cb(o, ok, ok ? { errMsg: 'addShortcut:ok' } : { errMsg: 'addShortcut:fail cancel' });
      });
    };
    tt.checkShortcut = function (o) { setTimeout(function () { cb(o, true, { status: !!missions.shortcut, installed: !!missions.shortcut }); }, 30); };
    tt.getShortcutMissionReward = function (o) { setTimeout(function () { cb(o, true, { canReceiveReward: !!missions.shortcut }); }, 30); };
    tt.startEntranceMission = function (o) {
      away(sheet('TikTok profile (preview)', ['The player visits the game\'s TikTok profile.'], [
        { label: 'Visited — come back', value: true }, { label: 'Cancel', value: false, color: '#666' }
      ])).then(function (ok) {
        if (ok) { missions.profile = true; shell.savePhone(); }
        cb(o, ok, ok ? { errMsg: 'startEntranceMission:ok' } : { errMsg: 'startEntranceMission:fail cancel' });
      });
    };
    tt.getEntranceMissionReward = function (o) { setTimeout(function () { cb(o, true, { canReceiveReward: !!missions.profile }); }, 30); };
  };

  // ─── What the game does, for the inspector's log ─────────────────────────
  window.addEventListener('error', function (e) { shell.log('error', (e && e.message) || 'error'); });
  window.addEventListener('unhandledrejection', function (e) { shell.log('error', 'unhandled: ' + String(e && e.reason && (e.reason.message || e.reason))); });
  var hooked = false;
  var hook = setInterval(function () {
    var g = window.HSGame;
    if (!g || hooked || typeof g.on !== 'function') return;
    hooked = true;
    clearInterval(hook);
    try {
      g.on('given', function (items, from) { shell.log('given', JSON.stringify(items) + ' from ' + from); });
      g.on('pause', function (why) { shell.log('pause', String(why || '')); });
      g.on('resume', function () { shell.log('resume', ''); });
      g.on('otherDevice', function () { shell.log('otherDevice', 'another phone took this account over'); });
      g.on('accountChosen', function (w) { shell.log('account', 'player kept: ' + w); });
    } catch (e) { /* an older kit */ }
  }, 100);
})(window);
