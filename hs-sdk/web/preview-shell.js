/*! preview-shell.js — PREVIEW ONLY: the page around the game in hs-web preview.
 *
 * Left: the game in a phone-sized frame. Right: the inspector — what HSGame
 * sees, buttons for the hard cases (fresh install, the app dying mid-payment,
 * another phone, +1 day…), the checker's results, a log, the phone's storage
 * and the fake cloud.
 *
 * It also IS the HS backend for the preview (window.HSPreview.api), kept in
 * this page's storage so it survives reloads. Nothing here talks to the real
 * backend: the game frame's network goes only to this page.
 */
(function (window) {
  'use strict';
  var doc = window.document;
  var CFG = window.HSPreviewConfig || {};
  var KEY = '__hsp:state';
  var ls = window.localStorage;

  // ─── State (survives reloads) ────────────────────────────────────────────
  var S = load();
  function fresh() {
    return {
      game: CFG.game, platform: CFG.platform === 'android' ? 'android' : 'tiktok',
      phones: {}, phoneOf: { tiktok: 'A', android: 'A' }, clockOffset: 0,
      account: 1, loginFails: false, billing: true,
      users: {}, orders: [], nextOrder: 1, googleReports: 0, log: []
    };
  }
  function load() {
    var s = null;
    try { s = JSON.parse(ls.getItem(KEY) || 'null'); } catch (e) { s = null; }
    // Another game on this port: its data is not this game's.
    if (!s || s.game !== CFG.game) { wipeGameStorage(); s = fresh(); }
    if (CFG.platformForced) s.platform = CFG.platform;
    return s;
  }
  function save() { try { ls.setItem(KEY, JSON.stringify(S)); } catch (e) { /* full */ } }

  function gameKeys() {
    var out = [];
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf('__hsp:') !== 0) out.push(k); }
    return out;
  }
  function wipeGameStorage() { gameKeys().forEach(function (k) { ls.removeItem(k); }); }

  function phoneKey() { return S.platform + ':' + S.phoneOf[S.platform]; }
  function phone() {
    var k = phoneKey();
    if (!S.phones[k]) {
      var n = Object.keys(S.phones).length + 1;
      S.phones[k] = { name: S.phoneOf[S.platform], storage: null, missions: {}, owned: [], pending: [],
        deviceId: 'a1b2c3d4e5f6' + ('0000' + n.toString(16)).slice(-4) };
      save();
    }
    return S.phones[k];
  }

  /** Swap the phone in the frame: keep this one's storage, put the other's in. */
  function switchPhone(platform, name) {
    unloadApp();   // its last writes land in THIS phone's storage, not the next one's
    var cur = phone();
    var snap = {};
    gameKeys().forEach(function (k) { snap[k] = ls.getItem(k); });
    cur.storage = snap;
    wipeGameStorage();
    S.platform = platform;
    S.phoneOf[platform] = name;
    var next = phone();
    if (next.storage) for (var k in next.storage) ls.setItem(k, next.storage[k]);
    save();
  }

  function nowMs() { return Date.now() + S.clockOffset; }
  function nowSec() { return Math.floor(nowMs() / 1000); }

  function log(kind, msg) {
    S.log.push({ t: new Date(nowMs()).toLocaleTimeString(), kind: kind, msg: String(msg) });
    if (S.log.length > 300) S.log = S.log.slice(-300);
    save();
    renderSoon();
  }

  // ─── The dashboard JSON as the backend's data ────────────────────────────
  var dash = CFG.dashboard || {};
  var iaa = dash.iaa_config || (dash.placements || dash.rewards ? dash : {});
  function adsConfig() {
    var aps = [];
    (iaa.placements || []).forEach(function (p) {
      (p.ads || []).forEach(function (a) {
        if (!a || !a.id || aps.some(function (x) { return x.id === a.id; })) return;
        aps.push({ id: a.id, type: a.type || (/int/i.test(a.id) ? 'interstitial' : 'rewarded'), status: 'active' });
      });
    });
    return { success: true, aps: aps, iaa_config: (iaa.placements || iaa.rewards || iaa.items) ? JSON.stringify(iaa) : null };
  }
  function products() {
    return (dash.products || []).map(function (p) {
      var out = {};
      for (var k in p) out[k] = p[k];
      out.product_id = p.product_id !== undefined ? p.product_id : p.id;
      out.id = p.id !== undefined ? p.id : p.product_id;
      // The Android app sells only products linked to Google Play. HS links
      // them for real; the preview links every product to a stand-in id.
      if (S.platform === 'android' && !out.google_id) out.google_id = 'preview_' + out.product_id;
      return out;
    });
  }
  function product(id) { return products().filter(function (p) { return String(p.product_id) === String(id); })[0] || null; }

  // ─── The fake HS backend ─────────────────────────────────────────────────
  function userBy(token) {
    for (var id in S.users) if (S.users[id].session === token) return { id: id, u: S.users[id] };
    return null;
  }
  function pendingOf(openId) {
    return S.orders.filter(function (o) { return o.open_id === openId && o.status === 'PAID' && !o.delivered; })
      .map(function (o) { return { order_id: o.id, product_id: o.product_id, name: o.name, rewards: o.rewards }; });
  }
  var R = function (status, body) { return { status: status, body: JSON.stringify(body) }; };

  function handle(path, body) {
    var b = {};
    try { b = body ? JSON.parse(body) : {}; } catch (e) { return R(400, { error: 'bad JSON' }); }
    var me = b.session_token ? userBy(b.session_token) : null;
    // A session another phone replaced: the backend's own 401 bodies (create_order names it, the rest do not).
    var authed = function () {
      if (me) return null;
      return R(401, path === '/api/create_order' ? { error: 'SESSION_INVALID', code: 'SESSION_INVALID' } : { error: 'Unauthorized' });
    };
    var o, ids;
    switch (path) {
      case '/api/login': {
        var openId = b.device_id ? 'dv_' + b.device_id : 'tt_player_' + S.account;
        var u = S.users[openId] || (S.users[openId] = { profile: null, ts: 0 });
        u.session = 'preview-session-' + Math.random().toString(36).slice(2);
        var res = { success: true, session_token: u.session, open_id: openId, last_updated_timestamp: u.ts, refund_mode: 'auto',
          pending_rewards: pendingOf(openId), ack_required: true, refund_orders: [] };
        if (u.profile) res.profile_data = u.profile;
        var ads = adsConfig();
        res.aps = ads.aps;
        if (ads.iaa_config) res.iaa_config = ads.iaa_config;
        log('login', openId + (res.pending_rewards.length ? ' · ' + res.pending_rewards.length + ' paid order(s) not delivered yet' : ''));
        return R(200, res);
      }
      case '/api/ads/config': return R(200, adsConfig());
      case '/api/shop/items': return R(200, { success: true, items: products() });
      case '/api/create_order': {
        if (authed()) return authed();
        var p = product(b.product_id);
        if (!p) return R(400, { success: false, error: 'Unknown product ' + b.product_id });
        o = { id: S.nextOrder++, open_id: me.id, product_id: Number(p.product_id), name: p.name, beans: p.beans_cost, rewards: p.rewards, status: 'PENDING', delivered: false };
        o.trade = 'PREVIEW_' + o.id;
        o.created = new Date(nowMs()).toISOString();
        S.orders.push(o);
        log('order', '#' + o.id + ' ' + p.name + ' created');
        return R(200, { success: true, trade_order_id: o.trade, order_id: o.id });
      }
      case '/api/check_order': {
        if (authed()) return authed();
        o = S.orders.filter(function (x) { return x.id === Number(b.order_id) && x.open_id === me.id; })[0];
        if (!o) return R(404, { success: false, error: 'Order not found' });
        if (o.status !== 'PAID') return R(200, { success: true, isProcessed: false, status: o.status, pay_status: 0 });
        return R(200, { success: true, isProcessed: true, status: 'PAID', pay_status: 1, product_id: o.product_id, order_id: o.id, ack_required: true, already_delivered: o.delivered, rewards: o.rewards });
      }
      case '/api/pending_rewards': {
        if (authed()) return authed();
        var pend = pendingOf(me.id);
        return R(200, { success: true, pending_count: pend.length, rewards: pend, ack_required: true });
      }
      case '/api/orders/mark_delivered': {
        if (authed()) return authed();
        ids = Array.isArray(b.order_ids) ? b.order_ids : [b.order_id];
        var out = { success: true, delivered: [], already: [], not_found: [], not_paid: [] };
        ids.forEach(function (id) {
          var x = S.orders.filter(function (y) { return y.id === Number(id) && y.open_id === me.id; })[0];
          if (!x) out.not_found.push(id);
          else if (x.status !== 'PAID') out.not_paid.push(id);
          else if (x.delivered) out.already.push(id);
          else { x.delivered = true; out.delivered.push(id); log('order', '#' + id + ' confirmed delivered by the game'); }
        });
        save();
        return R(200, Array.isArray(b.order_ids) ? out : { success: true, pay_status: 1 });
      }
      case '/api/check_refunds': return authed() || R(200, { success: true, refund_count: 0, refund_orders: [] });
      case '/api/orders': return authed() || R(200, { success: true, orders: S.orders.filter(function (x) { return x.open_id === me.id && (!b.status || x.status === b.status); }).map(function (x) {
        return { order_id: x.id, trade_order_id: x.trade, product_id: String(x.product_id), product_name: x.name, status: x.status, amount_beans: x.beans,
          refund_amount: 0, refund_source: null, rewards: x.rewards, created_at: x.created || '', pay_status: x.delivered ? 1 : 0 };
      }) });
      case '/api/sync': {
        if (authed()) return authed();
        me.u.profile = JSON.stringify(b.profile_data);
        me.u.ts = nowSec();
        log('cloud', me.id + ' saved: ' + me.u.profile.slice(0, 160));
        return R(200, { success: true, last_updated_timestamp: me.u.ts });
      }
      case '/api/purchases/google': {
        if (authed()) return authed();
        S.googleReports++;
        log('google', 'purchase reported to the backend');
        return R(200, { success: true, verified: null, duplicate: false });
      }
      default:
        log('backend', 'unknown endpoint ' + path);
        return R(404, { success: false, error: 'preview: no such endpoint ' + path });
    }
  }

  // ─── What the game frame calls (preview-runtime.js) ──────────────────────
  var frame = null;
  window.HSPreview = {
    platform: function () { return S.platform; },
    phone: function () { return phone(); },
    clockOffset: function () { return S.clockOffset; },
    api: function (path, body) { var r = handle(path, body); save(); return JSON.stringify(r); },
    log: log,
    account: function () { return S.account; },
    loginFails: function () { return S.loginFails; },
    billing: function () { return S.billing; },
    order: function (trade) { return S.orders.filter(function (o) { return o.trade === trade; })[0] || null; },
    markPaid: function (trade) {
      S.orders.forEach(function (o) { if (o.trade === trade) { o.status = 'PAID'; log('order', '#' + o.id + ' paid'); } });
      save();
    },
    googlePrice: function (gid) {
      var p = products().filter(function (x) { return x.google_id === gid; })[0];
      return p ? '$' + Math.max(0.99, (Number(p.beans_cost) || 99) / 100).toFixed(2) + ' (preview)' : null;
    },
    // Copied: an object made in the game frame belongs to that frame's page,
    // which is gone after the next reload.
    addOwned: function (p) { p = JSON.parse(JSON.stringify(p)); phone().owned.push({ p: p, acknowledged: false }); log('google', p.productId + ' bought'); save(); },
    addPending: function (p) { p = JSON.parse(JSON.stringify(p)); phone().pending.push(p); log('google', p.productId + ' payment pending'); save(); },
    owned: function () { return JSON.stringify(phone().owned.map(function (x) { return x.p; })); },
    finishPurchase: function (token, consumable) {
      var ph = phone();
      ph.owned = ph.owned.filter(function (x) {
        if (x.p.token !== token) return true;
        if (consumable) { log('google', x.p.productId + ' consumed (can be bought again)'); return false; }
        if (!x.acknowledged) log('google', x.p.productId + ' acknowledged (owned for good)');
        x.acknowledged = true;
        return true;
      });
      save();
    },
    savePhone: save,
    reloadApp: function (why) { log('app', why || 'reloaded'); setTimeout(reloadApp, 300); }
  };

  // ─── Actions ─────────────────────────────────────────────────────────────
  // The app is killed by removing its frame: the page's last writes (the
  // SDK keeps an unsent cloud save on hide) run right here, synchronously —
  // so storage changed after unloadApp() is never overwritten by the old app.
  function unloadApp() {
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null;
  }
  function reloadApp() {
    unloadApp();
    frame = doc.createElement('iframe');
    frame.id = 'game';
    frame.title = 'game';
    frame.src = '/__hs_frame.html?' + Date.now();
    doc.getElementById('phone').appendChild(frame);
  }
  function fg() { try { return frame.contentWindow.__hsPreview; } catch (e) { return null; } }
  function game() { try { return frame.contentWindow.HSGame || null; } catch (e) { return null; } }

  var ACTIONS = {
    reload: function () { log('app', 'restarted'); reloadApp(); },
    fresh: function () {
      unloadApp();
      wipeGameStorage();
      var ph = phone(); ph.storage = null; ph.missions = {};
      save();
      log('app', 'fresh install (this phone\'s storage cleared; Google Play purchases stay owned)');
      reloadApp();
    },
    away: function () { var f = fg(); if (!f) return; if (f.visible) f.background(); else f.foreground(); renderSoon(); },
    day: function () { S.clockOffset += 86400000; save(); log('clock', '+1 day → ' + new Date(nowMs()).toDateString()); reloadApp(); },
    other: function () {
      var g = game(); var id = g && g.openId;
      if (!id || !S.users[id]) return log('account', 'not logged in — nothing to take over');
      S.users[id].session = 'another-phone-' + Date.now();
      save();
      log('account', 'another phone logged in as ' + id + ' — this one finds out at its next save or when it comes back');
    },
    account: function () { S.account++; save(); log('account', 'next login is TikTok account tt_player_' + S.account); reloadApp(); },
    login: function () { S.loginFails = !S.loginFails; save(); log('login', S.loginFails ? 'TikTok login now FAILS (the player is a guest)' : 'TikTok login works again'); reloadApp(); },
    billing: function () { S.billing = !S.billing; save(); log('google', S.billing ? 'app built WITH Google Play billing' : 'app built WITHOUT billing'); reloadApp(); },
    pending: function () {
      var ph = phone();
      if (!ph.pending.length) return log('google', 'no pending payment');
      var p = ph.pending.shift();
      ph.owned.push({ p: p, acknowledged: false });
      save();
      log('google', p.productId + ' payment completed while the app was away');
      var f = fg();
      if (f) { f.background(); setTimeout(function () { f.foreground(); }, 400); }
    },
    reset: function () {
      if (!window.confirm('Forget every phone, the fake cloud and all orders?')) return;
      unloadApp(); wipeGameStorage(); var keepPlatform = S.platform; S = fresh(); S.platform = keepPlatform; save(); reloadApp();
    }
  };
  function choosePhone(platform, name) { switchPhone(platform, name); log('phone', (platform === 'android' ? 'Android' : 'TikTok') + ' phone ' + name); reloadApp(); render(); }

  // ─── The page ────────────────────────────────────────────────────────────
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var portrait = CFG.orientation !== 'landscape';

  doc.head.insertAdjacentHTML('beforeend', '<style>' +
    ':root{--bg:#0f1115;--panel:#171a21;--line:#2a2f3a;--text:#e8eaf0;--dim:#8a91a3;--ok:#3ecf8e;--warn:#f5b84b;--bad:#ff6b6b;--accent:#6aa8ff}' +
    '*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font:13px/1.45 system-ui,sans-serif}' +
    '#wrap{display:flex;height:100%;gap:0}#stage{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;padding:12px}' +
    '#phone{background:#000;border:10px solid #23262f;border-radius:28px;overflow:hidden;box-shadow:0 10px 40px #0008}' +
    '#phone iframe{border:0;display:block;width:100%;height:100%}' +
    '#side{width:440px;max-width:48vw;border-left:1px solid var(--line);background:var(--panel);overflow:auto;padding:12px 14px}' +
    'h1{font-size:15px;margin:0 0 8px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin:16px 0 6px}' +
    '.row{display:flex;flex-wrap:wrap;gap:6px}.btn{background:#232838;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit}' +
    '.btn:hover{border-color:var(--accent)}.btn.on{background:var(--accent);color:#081120;border-color:var(--accent)}.btn.bad{border-color:#5a2a2a}' +
    'table{width:100%;border-collapse:collapse}td{padding:3px 4px;border-bottom:1px solid var(--line);vertical-align:top;word-break:break-word}td:first-child{color:var(--dim);width:38%}' +
    '.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}.dim{color:var(--dim)}' +
    '.log{font:12px/1.4 ui-monospace,Menlo,monospace;max-height:260px;overflow:auto;background:#0c0e12;border:1px solid var(--line);border-radius:8px;padding:6px}' +
    'pre{white-space:pre-wrap;word-break:break-word;margin:0;font:12px/1.4 ui-monospace,Menlo,monospace}' +
    'details{border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:4px 0}summary{cursor:pointer}' +
    '.note{color:var(--dim);font-size:12px}' +
    '</style>');

  doc.body.innerHTML = '<div id="wrap"><div id="stage"><div id="phone"></div></div>' +
    '<div id="side"><h1></h1><div id="ui"></div></div></div>';
  doc.querySelector('#side h1').textContent = (CFG.game || 'game') + ' — HS preview';

  function fit() {
    var w = portrait ? 390 : 844, h = portrait ? 844 : 390;
    var st = doc.getElementById('stage');
    var k = Math.min((st.clientWidth - 40) / w, (st.clientHeight - 40) / h, 1);
    var ph = doc.getElementById('phone');
    ph.style.width = Math.round(w * k) + 20 + 'px';
    ph.style.height = Math.round(h * k) + 20 + 'px';
  }
  window.addEventListener('resize', fit);

  var check = null;
  function loadCheck(again) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/__hs/check.json' + (again ? '?again=1' : ''));
    xhr.onload = function () { try { check = JSON.parse(xhr.responseText); } catch (e) { check = null; } render(); if (check && check.running) setTimeout(loadCheck, 1500); };
    xhr.send();
  }

  var FEATURES = ['tiktok_missions', 'share', 'ads', 'shop', 'cloud'];
  function statusRows() {
    var g = game();
    if (!g) return '<tr><td>HSGame</td><td class="warn">not loaded (yet)</td></tr>';
    var v = function (fn) { try { return fn(); } catch (e) { return '—'; } };
    var flag = function (x) { return x ? '<span class="ok">yes</span>' : '<span class="dim">no</span>'; };
    var rows = [
      ['kit', esc(v(function () { return g.version; }))],
      ['platform', esc(v(function () { return g.platform; }))],
      ['logged in', flag(v(function () { return g.loggedIn; }))],
      ['player', esc(v(function () { return g.openId || '(guest)'; }))],
      ['sign-in button', flag(v(function () { return g.canSignIn; }))],
      ['paused', flag(v(function () { return g.paused; }))],
      ['other device', v(function () { return g.otherDevice; }) ? '<span class="bad">yes — paused cloud saves</span>' : '<span class="dim">no</span>'],
      ['has()', FEATURES.map(function (f) { return (v(function () { return g.has(f); }) ? '<span class="ok">' : '<span class="dim">') + f + '</span>'; }).join(' · ')]
    ];
    return rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
  }

  function button(id, label, on) { return '<button class="btn' + (on ? ' on' : '') + '" data-a="' + id + '">' + esc(label) + '</button>'; }

  function render() {
    fit();
    var ph = phone();
    var f = fg();
    var phones = Object.keys(S.phones).filter(function (k) { return k.indexOf(S.platform + ':') === 0; }).map(function (k) { return k.split(':')[1]; });
    if (phones.indexOf(S.phoneOf[S.platform]) < 0) phones.push(S.phoneOf[S.platform]);
    var nextPhone = String.fromCharCode(65 + phones.length);
    var html = '';

    html += '<div class="row">' + button('p:tiktok', 'TikTok Minis', S.platform === 'tiktok') + button('p:android', 'Android app', S.platform === 'android') + '</div>';
    html += '<p class="note">Offline: the game talks only to this page\'s fake HS backend — never to the real one. ' +
      (S.platform === 'tiktok' ? 'The game\'s own Game ID / SDK key stay on this computer.' : 'The app uses stand-in credentials.') + '</p>';

    html += '<h2>Phones</h2><div class="row">' + phones.map(function (n) { return button('ph:' + n, 'Phone ' + n, n === S.phoneOf[S.platform]); }).join('') +
      button('ph:' + nextPhone, '+ another phone') + '</div>';
    html += '<p class="note">Each phone keeps its own storage; the cloud is shared — log in on two phones to test the cloud merge.</p>';

    html += '<h2>HSGame now</h2><table>' + statusRows() + '</table>';

    html += '<h2>Try the hard cases</h2><div class="row">' +
      button('reload', 'Restart app') + button('fresh', 'Fresh install') +
      button('away', f && !f.visible ? 'Bring app back' : 'Send app to background', f && !f.visible) +
      button('day', '+1 day') + button('other', 'Another phone logs in') +
      (S.platform === 'tiktok' ? button('account', 'Next TikTok account') + button('login', S.loginFails ? 'Login: FAILS' : 'Login: works', S.loginFails) : '') +
      (S.platform === 'android' ? button('billing', S.billing ? 'Billing: on' : 'Billing: off', !S.billing) + (ph.pending.length ? button('pending', 'Complete pending payment (' + ph.pending.length + ')') : '') : '') +
      button('reset', 'Reset all') + '</div>';
    if (S.clockOffset) html += '<p class="note">Clock: ' + esc(new Date(nowMs()).toDateString()) + ' (+' + Math.round(S.clockOffset / 86400000) + ' day)</p>';
    html += '<p class="note">Purchases: the pay screen has "…then the app dies" — the item must arrive once after the restart. ' +
      'Ads / share / pay screens send the app to the background like the real ones.</p>';

    html += '<h2>Checker (hs-check)</h2>';
    if (!check) html += '<p class="dim">…</p>';
    else if (check.running) html += '<p class="dim">running…</p>';
    else if (check.error) html += '<p class="bad">' + esc(check.error) + '</p>';
    else {
      html += '<p>' + (check.fails ? '<span class="bad">' + check.fails + ' ❌</span>' : '<span class="ok">0 ❌</span>') + ' · ' + check.warns + ' ⚠️ ' + button('check', 'Run again') + '</p>';
      html += '<details' + (check.fails || check.warns ? ' open' : '') + '><summary>' + (check.lines || []).length + ' lines</summary><table>' +
        (check.lines || []).map(function (l) {
          var c = l.level === 'FAIL' ? 'bad' : l.level === 'WARN' ? 'warn' : l.level === 'PASS' ? 'ok' : 'dim';
          return '<tr><td class="' + c + '">' + esc(l.level) + '</td><td>' + esc(l.msg) + (l.fix ? '<br><span class="dim">→ ' + esc(l.fix) + '</span>' : '') + '</td></tr>';
        }).join('') + '</table></details>';
    }

    html += '<h2>Log</h2><div class="log" id="log">' + S.log.slice(-150).map(function (e) {
      var c = e.kind === 'error' || e.kind === 'blocked' ? 'bad' : e.kind === 'given' ? 'ok' : e.kind === 'otherDevice' ? 'warn' : '';
      return '<div><span class="dim">' + esc(e.t) + '</span> <span class="' + c + '">' + esc(e.kind) + '</span> ' + esc(e.msg) + '</div>';
    }).join('') + '</div>';

    var keys = gameKeys().sort();
    html += '<h2>This phone\'s storage (' + keys.length + ')</h2>' + keys.map(function (k) {
      var val = ls.getItem(k) || '';
      var pretty = val;
      try { pretty = JSON.stringify(JSON.parse(val), null, 2); } catch (e) { /* plain text */ }
      return '<details><summary>' + esc(k) + ' <span class="dim">' + esc(val.slice(0, 50)) + (val.length > 50 ? '…' : '') + '</span></summary><pre>' + esc(pretty) + '</pre></details>';
    }).join('');

    html += '<h2>Fake cloud (HS backend)</h2>' + (Object.keys(S.users).length ? Object.keys(S.users).map(function (id) {
      var u = S.users[id], pretty = u.profile || '(no cloud save yet)';
      try { pretty = JSON.stringify(JSON.parse(u.profile), null, 2); } catch (e) { /* as is */ }
      return '<details><summary>' + esc(id) + ' <span class="dim">' + (u.ts ? 'saved ' + esc(new Date(u.ts * 1000).toLocaleTimeString()) : '') + '</span></summary><pre>' + esc(pretty) + '</pre></details>';
    }).join('') : '<p class="dim">no player yet</p>');
    if (S.orders.length) {
      html += '<details><summary>orders (' + S.orders.length + ')</summary><table>' + S.orders.map(function (o) {
        return '<tr><td>#' + o.id + ' ' + esc(o.name) + '</td><td>' + esc(o.status) + (o.status === 'PAID' ? (o.delivered ? ' · delivered' : ' · <span class="warn">not delivered yet</span>') : '') + ' · ' + esc(o.open_id) + '</td></tr>';
      }).join('') + '</table></details>';
    }
    if (S.platform === 'android') {
      html += '<details><summary>Google Play on this phone (' + ph.owned.length + ' owned, ' + ph.pending.length + ' pending)</summary><table>' +
        ph.owned.map(function (x) { return '<tr><td>' + esc(x.p.productId) + '</td><td>' + (x.acknowledged ? 'owned for good' : '<span class="warn">not finished yet</span>') + '</td></tr>'; }).join('') +
        '</table></details>';
    }

    var ui = doc.getElementById('ui');
    var logEl = doc.getElementById('log');
    var atBottom = !logEl || logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    var open = {};
    ui.querySelectorAll('details').forEach(function (d, i) { if (d.open) open[i] = true; });
    ui.innerHTML = html;
    ui.querySelectorAll('details').forEach(function (d, i) { if (open[i]) d.open = true; });
    logEl = doc.getElementById('log');
    if (logEl && atBottom) logEl.scrollTop = logEl.scrollHeight;
  }

  var renderTimer = null;
  function renderSoon() { if (renderTimer) return; renderTimer = setTimeout(function () { renderTimer = null; render(); }, 150); }

  doc.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el) return;
    var a = el.getAttribute('data-a');
    if (a.indexOf('p:') === 0) { var p = a.slice(2); if (p !== S.platform) { switchPhone(p, S.phoneOf[p] || 'A'); log('platform', p === 'android' ? 'Android app' : 'TikTok Minis'); reloadApp(); render(); } return; }
    if (a.indexOf('ph:') === 0) { var n = a.slice(3); if (n !== S.phoneOf[S.platform]) choosePhone(S.platform, n); return; }
    if (a === 'check') { check = { running: true }; render(); loadCheck(true); return; }
    if (ACTIONS[a]) ACTIONS[a]();
    render();
  });

  // The status table follows the game live; the rest re-renders on events.
  setInterval(function () {
    var t = doc.querySelector('#ui table');
    if (t) t.innerHTML = statusRows();
  }, 500);

  phone();
  save();
  render();
  reloadApp();
  loadCheck(false);
})(window);
