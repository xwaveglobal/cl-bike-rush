#!/usr/bin/env node
// hs-check — does this native TikTok mini game integrate the HS SDK kit correctly?
//
//   node hs-check.mjs <game folder> [--dashboard file] [--json]
//
// Runs the game's own game.js — with its hs-game.js and hs-sdk.min.js —
// inside a fake TikTok native runtime and a fake HS backend. Nothing reaches
// TikTok or our servers, and no file in the game folder is changed.
//
// The dashboard JSON the AI wrote is read from <game folder>.hs-dashboard.json
// (next to the folder), or --dashboard. Its iaa_config is served as the live
// dashboard config, so the check answers: will these rewards actually reach the
// player with THIS build?
//
// Three runs, each in its own process:
//   fresh     first launch: boots, logs in, claims every reward key, plays a test ad, saves
//   returning a new phone: the cloud save from run 1 comes back and must be restored
//   android   the HS Android app: the same files with the web `tt` shim and the
//             HSNative bridge — no login, no TikTok services, ads via the bridge
//
// Exit code 0 = no FAIL.

import { fork } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SELF = fileURLToPath(import.meta.url);
const MIN_SDK = [1, 0, 7];
const SDK_FILE = 'hs-sdk.min.js';
const OLD_SDK_FILE = 'hs-tiktok-sdk.min.js';
const MIN_KIT = [3, 0, 0];
const ANDROID_KIT = [3, 2, 0];

/** What kit/web/tt-web-shim.js gives the game in the Android app. Keep in step with it. */
const ANDROID_TT = new Set([
  'env', 'getSystemInfoSync', 'getSystemInfo', 'getWindowInfo', 'getLaunchOptionsSync', 'getEnterOptionsSync',
  'getMenuButtonBoundingClientRect', 'getPerformance', 'createCanvas', 'createOffscreenCanvas', 'createImage', 'loadFont',
  'setPreferredFramesPerSecond', 'triggerGC',
  'onTouchStart', 'offTouchStart', 'onTouchMove', 'offTouchMove', 'onTouchEnd', 'offTouchEnd', 'onTouchCancel', 'offTouchCancel',
  'setStorageSync', 'getStorageSync', 'removeStorageSync', 'clearStorageSync', 'getStorageInfoSync',
  'setStorage', 'getStorage', 'removeStorage', 'clearStorage',
  'onShow', 'offShow', 'onHide', 'offHide', 'onWindowResize', 'offWindowResize', 'onError', 'offError',
  'onAudioInterruptionBegin', 'offAudioInterruptionBegin', 'onAudioInterruptionEnd', 'offAudioInterruptionEnd',
  'createInnerAudioContext', 'createWebAudioContext', 'request',
  'showToast', 'hideToast', 'showLoading', 'hideLoading', 'showModal',
  'vibrateShort', 'vibrateLong', 'setKeepScreenOn', 'setClipboardData', 'getUpdateManager', 'exitMiniProgram',
]);
/** TikTok-only names the kit and SDK look up to learn they are absent — not the game's doing. */
const KIT_PROBES = new Set([
  'login', 'pay', 'createRewardedVideoAd', 'createInterstitialAd', 'shareAppMessage', 'addShortcut', 'checkShortcut',
  'startEntranceMission', 'getEntranceMissionReward', 'getShortcutMissionReward', 'canIUse', 'then',
]);

// ════════════════════════════════════════════════════════════ child: one run
if (process.env.HS_CHECK_CHILD) {
  const cfg = JSON.parse(process.env.HS_CHECK_CHILD);
  runGame(cfg).then(
    (out) => { process.send(out); process.exit(0); },
    (e) => { process.send({ crash: String(e && e.stack || e) }); process.exit(0); }
  );
} else {
  main();
}

async function runGame(cfg) {
  const gameJs = join(cfg.dir, 'game.js');
  const requests = [];
  const errors = [];
  const adShows = [];
  process.on('uncaughtException', (e) => errors.push(String(e && e.message || e)));
  process.on('unhandledRejection', (e) => errors.push('unhandled rejection: ' + String(e && e.message || e)));

  // ─── fake HS backend: the dashboard JSON (if any) is the live config ───
  const dash = cfg.iaa || {};
  const iaaConfig = {
    ...dash,
    // The checker's own test place: a rewarded unit, no reward key.
    placements: [...(dash.placements || []), { label: '__check', ads: [{ id: 'check_rewarded' }] }],
  };
  const aps = [{ id: 'check_rewarded', type: 'rewarded', status: 'active' }];
  const loginBody = () => {
    const b = { success: true, session_token: 'sess_check', open_id: 'open_check', last_updated_timestamp: 1,
      ack_required: true, refund_mode: 'auto', aps, iaa_config: JSON.stringify(iaaConfig) };
    if (cfg.cloud) b.profile_data = JSON.stringify(cfg.cloud);
    return b;
  };
  const route = (ep, data) => {
    if (ep === '/api/login') return loginBody();
    if (ep === '/api/pending_rewards') return { success: true, pending_count: 0, rewards: [] };
    if (ep === '/api/sync') return { success: true, last_updated_timestamp: 2 };
    if (ep === '/api/orders/mark_delivered') { const ids = JSON.parse(data).order_ids || []; return { success: true, delivered: ids, already: [], not_found: [], not_paid: [] }; }
    if (ep === '/api/ads/config') return { success: true, aps, iaa_config: JSON.stringify(iaaConfig) };
    if (ep === '/api/shop/items') return { success: true, items: [] };
    return { success: false, error: 'hs-check: no route ' + ep };
  };

  // ─── fake native runtime ───
  const hole = new Proxy(function () {}, { get: (t, p) => (p === 'then' ? undefined : hole), apply: () => hole, construct: () => hole });
  const grad = { addColorStop() {} };
  const ctx2d = (canvas) => new Proxy({ canvas }, {
    get: (t, p) => (p in t ? t[p] : p === 'measureText' ? () => ({ width: 10 }) : p === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => grad),
    set: (t, p, v) => { t[p] = v; return true; },
  });
  const makeCanvas = () => { const c = { width: 1080, height: 1920, style: {}, addEventListener() {} }; c.getContext = (k) => (k === '2d' ? ctx2d(c) : hole); return c; };
  const store = new Map();
  const known = {
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, screenWidth: 390, screenHeight: 844, pixelRatio: 3, platform: 'ios' }),
    createCanvas: makeCanvas,
    getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
    setStorageSync: (k, v) => { store.set(k, v); },
    removeStorageSync: (k) => { store.delete(k); },
    createImage: () => { const im = { width: 0, height: 0, complete: false }; let s = '';
      Object.defineProperty(im, 'src', { get: () => s, set: (v) => { s = v; setTimeout(() => { im.width = im.height = 10; im.complete = true; im.onload && im.onload(); }, 1); } });
      return im; },
    onShow() {}, onHide() {}, offShow() {}, offHide() {},
    login: (o) => setTimeout(() => o.success({ code: 'CHECK_CODE' }), 5),
    request: (o) => {
      const ep = String(o.url).replace(/^https?:\/\/[^/]+/, '');
      requests.push({ ep, header: o.header || {}, data: o.data });
      setTimeout(() => o.success({ statusCode: 200, data: JSON.stringify(route(ep, o.data)), header: {} }), 5);
      return { abort() {} };
    },
    // 3 s and no hide event — the iOS case SDKs before 1.0.7 turned into a false 11004.
    createRewardedVideoAd: ({ adUnitId }) => { let close; adShows.push(adUnitId);
      return { onClose: (cb) => { close = cb; }, onError() {}, offClose() {}, offError() {}, destroy() {},
        show: () => { setTimeout(() => close && close({ isEnded: true }), 3000); return Promise.resolve(); } }; },
    createInterstitialAd: ({ adUnitId }) => { let close; adShows.push(adUnitId);
      return { onClose: (cb) => { close = cb; }, onError() {}, destroy() {}, show: () => { setTimeout(() => close && close(), 50); return Promise.resolve(); } }; },
  };
  const android = cfg.scenario === 'android';
  const missingTt = new Set();
  let tt;
  if (!android) {
    tt = new Proxy(known, { get: (t, p) => (p in t ? t[p] : typeof p === 'string' && /^(on|off|create|get|set|show|hide|request|navigate|vibrate|report)/.test(p) ? hole : undefined) });
    globalThis.TTMinis = { game: { login: known.login, canIUse: () => true } };
  } else {
    // The Android app: the web shim's tt (no TikTok services) + the HSNative bridge.
    const shim = { ...known };
    for (const k of KIT_PROBES) delete shim[k];
    tt = new Proxy(shim, {
      get: (t, p) => {
        if (p in t) return t[p];
        if (typeof p === 'string' && ANDROID_TT.has(p)) return hole;
        if (typeof p === 'string' && !KIT_PROBES.has(p)) missingTt.add(p);
        return undefined;
      },
    });
    globalThis.HSNative = {
      platform: 'android',
      config: { gameId: '8000000000000000000', sdkKey: 'sk_test_hscheck_android', adProvider: 'check' },
      request: (req) => {
        const ep = String(req.url).replace(/^https?:\/\/[^/]+/, '');
        requests.push({ ep, header: req.headers || {}, data: req.body, native: true });
        return new Promise((r) => setTimeout(() => r({ status: 200, body: JSON.stringify(route(ep, req.body)) }), 5));
      },
      ads: { show: (req) => { adShows.push(req.unitId); return new Promise((r) => setTimeout(() => r({ shown: true, completed: true }), 50)); } },
      share: () => Promise.resolve({ ok: true }),
      on() { return () => {}; },
    };
  }

  globalThis.tt = tt;
  globalThis.GameGlobal = globalThis;
  // Globals the TikTok runtime (and a WebView) give every game.
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.require = createRequire(gameJs);
  globalThis.__HS_CHECK__ = { gameId: '7000000000000000000', sdkKey: 'sk_test_hscheck' };

  const quiet = ['log', 'info', 'warn', 'debug'].map((n) => { const o = console[n]; console[n] = () => {}; return () => { console[n] = o; }; });
  try {
    vm.runInThisContext(readFileSync(gameJs, 'utf8'), { filename: gameJs });
  } catch (e) {
    errors.push('game.js threw while loading: ' + String(e && e.message || e));
  }
  for (const r of quiet) r();

  await wait(800);   // boot + login + post-login hooks over fake 5 ms requests
  const HS = globalThis.HSGame;
  const out = { errors, requests: [], trace: [], adShows, hsLoaded: !!HS };
  if (!HS) { out.requests = requests; return out; }

  out.kitVersion = HS.version;
  out.ready = HS.ready;
  out.canGive = HS.canGive;
  out.platform = HS.sdk ? HS.sdk.platform : null;
  out.defaults = HS.defaults;

  // What the GAME touched, before the checker's own calls below add to the trace.
  out.gameTrace = HS.trace;

  if (android) {
    out.kitPlatform = HS.platform;
    out.has = {};
    if (typeof HS.has === 'function') for (const f of ['tiktok_missions', 'share', 'ads', 'shop', 'cloud']) out.has[f] = HS.has(f);
    out.adResult = HS.ready ? await HS.showAd('__check') : null;
    out.missingTt = [...missingTt];
    out.requests = requests;
    out.trace = HS.trace;
    return out;
  }

  if (cfg.scenario === 'fresh' && HS.ready) {
    // Can THIS build give every reward key — the game's defaults and the dashboard's?
    const keys = new Set([...Object.keys(out.defaults.rewards || {}), ...Object.keys(dash.rewards || {})]);
    out.probe = {};
    // Did the game call HSGame.save() DURING onGive (the same tick)? Counted
    // around each probe, however the game reaches save() (Rotate Rings: give →
    // saveHints → Host.saveProgress → HSGame.save).
    const realSave = HS.save;
    let saveCalls = 0;
    HS.save = function () { saveCalls++; return realSave.apply(this, arguments); };
    for (const k of keys) {
      const before = saveCalls;
      const p = HS._probe ? HS._probe(k) : { empty: true };
      if (p && !p.empty) p.saved = saveCalls > before;
      out.probe[k] = p;
    }
    HS.save = realSave;
    out.adResult = await HS.showAd('__check');   // the checker's own ad, not the game's
    if (HS.sdk && HS.sdk.sync) { try { await HS.sdk.sync.syncNow(); } catch (e) { /* reported below */ } }
  } else {
    await wait(200);
    if (HS.sdk && HS.sdk.sync) { try { await HS.sdk.sync.syncNow(); } catch (e) { /* ignore */ } }
  }
  await wait(100);
  out.trace = HS.trace;
  // A 3.1 game's progress lives in the profile (HSGame.profile() returns the existing one).
  if (out.trace.indexOf('profile') >= 0) { try { out.profileData = HS.profile().all(); } catch (e) { /* ignore */ } }
  out.requests = requests;
  return out;
}

// ════════════════════════════════════════════════════════════ parent: report
async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--dashboard');
  const asJson = args.includes('--json');
  if (!dir) {
    console.log('usage: node hs-check.mjs <game folder> [--dashboard file] [--json]');
    process.exit(2);
  }
  const root = resolve(dir);
  const lines = [];
  const add = (level, msg, fix) => lines.push({ level, msg, fix });

  // ─── package ───
  const has = (f) => existsSync(join(root, f));
  if (!has('game.js')) { add('FAIL', 'no game.js — not a native mini game package'); return finish(lines, asJson); }
  if (has('index.html')) add('FAIL', 'index.html found — TikTok no longer accepts H5 games', 'build a native package: game.js + game.json, canvas from tt.createCanvas()');
  else add('PASS', 'native package (game.js, no index.html)');
  if (!has('game.json')) add('FAIL', 'no game.json', 'add { "deviceOrientation": "portrait" }');

  const conf = readJson(join(root, 'project.config.json'));
  if (!conf || !conf.appid || /YOUR|xxx|TODO/i.test(String(conf.appid))) add('WARN', 'project.config.json appid is not set', 'put the TikTok App ID there (or the Client Key, if your TikTok CLI asks for that) before uploading — INTEGRATE-WITH-AI.md, step 0');

  // Only hs-game.js + the SDK belong in the game: everything in this folder is uploaded to TikTok.
  // Names that are certainly ours (a game may have its own AGENTS.md, docs/ or sample/).
  const kitExtras = ['INTEGRATE-WITH-AI.md', 'DASHBOARD-CONFIG.md', 'hs-check.mjs', 'web/hs-web.mjs', 'web/tt-web-shim.js', 'docs/SDK-REFERENCE.md']
    .filter((f) => has(f));
  const kitCopies = readdirSync(root).filter((f) => /^hs-sdk-\d/.test(f));
  if (kitExtras.length || kitCopies.length) {
    add('WARN', 'kit files inside the game folder: ' + [...kitExtras, ...kitCopies].join(', '),
      'keep the kit folder OUTSIDE the game folder — only hs-game.js and ' + SDK_FILE + ' go next to game.js (everything here is uploaded to TikTok)');
  }

  if (!has('hs-game.js')) add('FAIL', 'hs-game.js missing next to game.js', 'copy it from the kit into the game folder');
  // hs-sdk.min.js since 1.1; hs-tiktok-sdk.min.js before (hs-game.js loads either).
  const sdkFile = has(SDK_FILE) ? SDK_FILE : has(OLD_SDK_FILE) ? OLD_SDK_FILE : '';
  if (!sdkFile) add('FAIL', `${SDK_FILE} missing next to game.js`, 'copy it from the kit into the game folder');
  else {
    const v = versionOf(readFileSync(join(root, sdkFile), 'utf8').slice(0, 200));
    if (v && cmp(v, MIN_SDK) >= 0) add('PASS', `SDK v${v.join('.')}`);
    else add('FAIL', `SDK v${v ? v.join('.') : '?'} is older than ${MIN_SDK.join('.')}`, `replace it with ${SDK_FILE} from the kit (older ones lose iOS ad rewards)`);
    if (sdkFile === OLD_SDK_FILE) add('WARN', `the SDK is still named ${OLD_SDK_FILE}`, `replace it with ${SDK_FILE} from the kit (same SDK, new name since 1.1 — it also runs the Android app)`);
  }

  // ─── source scan ───
  const src = readFileSync(join(root, 'game.js'), 'utf8');
  if (/client_secret|clientSecret/.test(src)) add('FAIL', 'game.js mentions a client secret', 'secrets never go in game.js — everything in it is public');
  if (/\b(createRewardedVideoAd|createInterstitialAd|shareAppMessage|addShortcut|startEntranceMission|getEntranceMissionReward|getShortcutMissionReward|requestGamePayment)\s*\(/.test(src)) {
    add('FAIL', 'game.js calls TikTok ads / share / missions / pay directly', 'use HSGame.showAd / share / tiktokMission / buy — direct calls bypass the dashboard and crash in the Android app');
  }
  if (!/require\(\s*['"]\.\/hs-game(\.js)?['"]\s*\)/.test(src)) add('FAIL', "game.js never does require('./hs-game.js')", 'see INTEGRATE-WITH-AI.md');

  // ─── TikTok review: the entry screen must offer these three ───
  const q = `['"]`;
  const review = [
    [new RegExp(`tiktokMission\\.start\\(\\s*${q}profile${q}`), 'Entry Reward — tiktokMission.start("profile")'],
    [new RegExp(`tiktokMission\\.start\\(\\s*${q}shortcut${q}`), 'Launch Reward — tiktokMission.start("shortcut")'],
    [/HSGame\.share\s*\(/, 'Share — HSGame.share(…)'],
  ].filter(([re]) => !re.test(src)).map(([, what]) => what);
  if (review.length) add('FAIL', 'TikTok review needs on the entry screen: ' + review.join(' · '), 'add a button + step popup for each (see INTEGRATE-WITH-AI.md, "TikTok review")');
  else add('PASS', 'TikTok review: Entry Reward, Launch Reward and Share are in the code');

  // ─── one game, two platforms: UI shown by has(), never by platform ───
  const hasCall = (f) => new RegExp(`HSGame\\.has\\(\\s*${q}${f}${q}`).test(src);
  if (/HSGame\.tiktokMission\./.test(src) && !hasCall('tiktok_missions')) add('WARN', 'TikTok mission buttons are not gated by HSGame.has("tiktok_missions")', 'the Android app has no TikTok missions — show those buttons only when has("tiktok_missions")');
  if (/HSGame\.share\s*\(/.test(src) && !hasCall('share') && !/HSGame\.canShare\s*\(/.test(src)) add('WARN', 'the share button is not gated by HSGame.has("share")', 'show it only when has("share")');
  if (/HSGame\.(shop|buy)\s*\(/.test(src) && !hasCall('shop')) add('WARN', 'the shop button is not gated by HSGame.has("shop")', 'the first Android version may have no shop — show it only when has("shop")');
  if (/\.platform\s*===?\s*['"](android|minis|ios)['"]/.test(src)) add('WARN', 'game.js branches on the platform', 'use HSGame.has(feature) instead — the platform list will grow');
  if (/HSGame\.(showAd|buy)\s*\(/.test(src) && !/HSGame\.on\(\s*['"]pause['"]/.test(src)) add('WARN', 'no HSGame.on("pause", …)', 'mute the music and freeze the game on "pause", back on "resume" — ads and purchases cover the game');

  // ─── the dashboard JSON the AI wrote ───
  const dashArg = valueAfter(args, '--dashboard');
  const dashFile = [dashArg && resolve(dashArg), root + '.hs-dashboard.json', join(root, 'hs-dashboard.json')].find((f) => f && existsSync(f));
  const dash = dashFile ? readJson(dashFile) : null;
  if (dashFile && dashFile.startsWith(root + '/')) add('WARN', 'the dashboard JSON is INSIDE the game folder', `move it to ${root}.hs-dashboard.json — it must not be uploaded to TikTok`);
  if (dashFile && !dash) add('FAIL', `${dashFile} is not valid JSON`);

  // ─── run 1: fresh install ───
  const fresh = await child({ dir: root, scenario: 'fresh', iaa: dash && dash.iaa_config });
  if (fresh.crash) { add('FAIL', 'the checker crashed: ' + fresh.crash.split('\n')[0]); return finish(lines, asJson); }
  if (fresh.errors.length) add('FAIL', 'game errors in the native runtime: ' + fresh.errors.slice(0, 3).join(' | '), 'browser-only code (window, document, DOM, localStorage) does not exist in a native mini game');
  else add('PASS', 'boots in the native runtime without errors');

  if (!fresh.hsLoaded) { add('FAIL', 'HSGame never loaded', "require('./hs-game.js') at the top of game.js"); return finish(lines, asJson); }
  const kv = versionOf('v' + (fresh.kitVersion || ''));
  if (!kv || cmp(kv, MIN_KIT) < 0) add('FAIL', `hs-game.js ${fresh.kitVersion || '?'} is older than ${MIN_KIT.join('.')}`, 'replace hs-game.js from the kit');
  const t = fresh.trace;
  if (t.indexOf('start') < 0) add('FAIL', 'HSGame.start() is never called', 'call it once at startup');
  else if (!fresh.canGive) add('FAIL', 'rewards have nowhere to go', 'use HSGame.profile({...}) before start() (rewards are credited to it), or pass onGive to start()');
  else if (!fresh.ready) add('FAIL', 'HSGame.start() did not start the SDK', `check gameId / sdkKey and that ${SDK_FILE} loads`);
  else add('PASS', `SDK started (host: ${fresh.platform})`);

  const login = fresh.requests.find((r) => r.ep === '/api/login');
  if (login) {
    const body = safeJson(login.data) || {};
    if (body.client_ack === true && login.header['X-SDK-Platform'] === 'js') add('PASS', 'login over tt.request, with delivery confirmation');
    else add('FAIL', 'login request is not the 1.0.7 shape', `update ${SDK_FILE} from the kit`);
  } else if (fresh.ready) add('FAIL', 'no login request was made');

  if (fresh.ready) {
    if (fresh.adResult && fresh.adShows.includes('check_rewarded')) add('PASS', 'a 3 s rewarded ad with no hide event completes (iOS case)');
    else add('FAIL', 'the test rewarded ad did not complete', `update hs-game.js and ${SDK_FILE} from the kit`);
  }

  // ─── rewards: can this build give every key? ───
  const defaults = fresh.defaults || { rewards: {}, items: {} };
  const probe = fresh.probe || {};
  const takes = [], refuses = [];
  for (const [k, p] of Object.entries(probe)) {
    if (p.empty) continue;
    (p.given ? takes : refuses).push(`${k} ${JSON.stringify(p.items)}`);
  }
  if (takes.length) add('PASS', 'this build can give: ' + takes.join(' · '));
  if (refuses.length) add(dash ? 'FAIL' : 'WARN', 'this build cannot give: ' + refuses.join(' · '), 'add those items as profile number fields, or handle them in onGive — until then players get nothing for them');

  // ─── what the code uses vs what is configured ───
  const used = collectUsage(src, fresh.gameTrace || []);
  add('INFO', `uses: ${used.features.join(', ') || 'nothing beyond login'}`);
  if (used.places.size) add('INFO', 'ad places in the code: ' + [...used.places].join(', '));
  // claim(key) refuses a key that is also an ad place (showAd pays that one).
  const clash = [...used.claimed].filter((k) => used.places.has(k));
  if (clash.length) add('FAIL', 'claim() of a key that is also an ad place — it is refused and gives nothing: ' + clash.join(', '),
    'use two names at that moment, e.g. claim("level_bonus") + showAd("level_win")');
  if (used.dynamic.length) add('WARN', 'HSGame calls with a variable instead of a written name: ' + used.dynamic.join(', '),
    'write each key / place / mission kind as a literal, e.g. HSGame.claim("daily_gift") — this check (and the dashboard JSON) read them from the code');
  if (used.keys.size) add('INFO', 'reward keys in the code: ' + [...used.keys].join(', '));
  const noDefault = [...used.keys].filter((k) => !(k in (defaults.rewards || {})));
  if (noDefault.length) add('WARN', 'reward keys with no default: ' + noDefault.join(', '), 'add them to defaults.rewards — without a dashboard entry they give nothing');
  const catalog = defaults.items || {};
  const itemsUsed = new Set();
  for (const v of Object.values(defaults.rewards || {})) for (const id of Object.keys(itemsOf(v))) itemsUsed.add(id);
  const uncatalogued = [...itemsUsed].filter((id) => !(id in catalog));
  if (Object.keys(catalog).length && uncatalogued.length) add('WARN', 'items given but not in defaults.items: ' + uncatalogued.join(', '), 'add them, so the game and the shop can show their name and icon');
  if (Object.keys(catalog).length) add('INFO', 'item categories the game handles: ' + [...new Set(Object.values(catalog).map((i) => i && i.category).filter(Boolean))].join(', '));

  if (dash) checkDashboard(dash, used, add);
  else add('INFO', `no ${root}.hs-dashboard.json — the defaults in the code are all that is checked`);

  // ─── cloud save ───
  const usesProfile = /HSGame\.profile\s*\(/.test(src);
  const localOnly = usesProfile && /save\s*:\s*['"]local['"]/.test(src);
  if (usesProfile) {
    add('PASS', `progress in HSGame.profile (${localOnly ? 'this device only' : 'device + cloud, one active device'})`);
    if (/\b(localStorage\.setItem|setStorageSync)\s*\(/.test(src)) add('WARN', 'game.js also writes storage directly', 'keep all progress in the profile — two save systems drift apart');
    if (!localOnly && !/HSGame\.on\(\s*['"]otherDevice['"]/.test(src)) {
      add('WARN', 'no HSGame.on("otherDevice", …) message', 'when the account opens on another phone, show "Playing on another device · Play here" → HSGame.takeOver()');
    }
  }
  const saves = /HSGame\.save\s*\(/.test(src) || (usesProfile && !localOnly);
  const syncs = fresh.requests.filter((r) => r.ep === '/api/sync');
  const pushed = syncs.length ? (safeJson(syncs[syncs.length - 1].data) || {}).profile_data : undefined;
  const gamePart = pushed && typeof pushed === 'object' ? Object.fromEntries(Object.entries(pushed).filter(([k]) => k !== '_hs')) : null;
  if (!saves) add('INFO', localOnly ? 'no cloud save (profile is device-only)' : 'no cloud save (HSGame.save / profile not used)');
  else if (!usesProfile && t.indexOf('save') < 0) add('WARN', 'HSGame.save is in the code but was not called during startup', 'call save(progress) whenever progress changes (and once at startup)');
  else if (!gamePart || !Object.keys(gamePart).length) add(usesProfile ? 'INFO' : 'FAIL', usesProfile ? 'the profile did not change during startup, so nothing was uploaded yet' : 'save() was called but nothing reached the cloud');
  else add('PASS', 'progress uploads to the cloud: ' + JSON.stringify(gamePart).slice(0, 80));

  // ─── run 2: a new phone ───
  // 3.0 save(): the RULE "HSGame.save() inside onGive". A purchase credited in
  // onGive but saved later is credited again after a restart (the kit restores
  // the last save(), which lacks it) — and its delivery waits for that save.
  if (!usesProfile && /HSGame\.save\s*\(/.test(src)) {
    const given = Object.entries(probe).filter(([, p]) => p && !p.empty && p.given);
    const unsaved = given.filter(([, p]) => !p.saved).map(([k]) => k);
    if (unsaved.length) add('FAIL', 'onGive did not call HSGame.save() for: ' + unsaved.join(', '),
      'call HSGame.save(progress) inside onGive, right after adding the items (RULE: save in onGive)');
    else if (given.length) add('PASS', 'onGive saves the progress (HSGame.save in the same call)');
  }

  if (saves && gamePart && Object.keys(gamePart).length) {
    const back = await child({ dir: root, scenario: 'returning', cloud: pushed, iaa: dash && dash.iaa_config });
    const bt = back.trace || [];
    const re = (back.requests || []).filter((r) => r.ep === '/api/sync').map((r) => (safeJson(r.data) || {}).profile_data);
    const strip = (o) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== '_hs')) : o);
    if (usesProfile) {
      const pd = back.profileData || {};
      const off = Object.keys(gamePart).filter((k) => JSON.stringify(pd[k]) !== JSON.stringify(gamePart[k]));
      if (!off.length) add('PASS', 'new phone: the profile was restored from the cloud');
      else add('FAIL', 'new phone: profile fields not restored: ' + off.join(', '), 'check the merge rules — progress fields use max, others latest');
    } else if (bt.indexOf('onLoad') < 0) add('FAIL', 'on a new phone the cloud save never reached onLoad', 'pass onLoad to HSGame.start({ ... })');
    else if (!re.length) add('WARN', 'after onLoad the game did not call save() again', 'merge the cloud copy, then save(merged)');
    else if (JSON.stringify(strip(re[re.length - 1])) === JSON.stringify(gamePart)) add('PASS', 'new phone: cloud progress restored and saved back unchanged');
    else add('WARN', 'new phone: progress after restore differs from the cloud copy', 'check the merge keeps the further progress: ' + JSON.stringify(strip(re[re.length - 1])).slice(0, 80));
  }

  // ─── run 3: the HS Android app ───
  const sdkText = sdkFile ? readFileSync(join(root, sdkFile), 'utf8') : '';
  if (!kv || cmp(kv, ANDROID_KIT) < 0) add('WARN', `Android: not checked — hs-game.js ${fresh.kitVersion || '?'} is older than ${ANDROID_KIT.join('.')}`, `replace hs-game.js and ${SDK_FILE} from the kit`);
  else if (!sdkText.includes('hs-android')) add('WARN', `Android: not checked — this ${sdkFile || 'SDK'} has no Android host`, `replace it with ${SDK_FILE} from the kit`);
  else checkAndroid(await child({ dir: root, scenario: 'android', iaa: dash && dash.iaa_config }), add);

  finish(lines, asJson);
}

function checkAndroid(run, add) {
  if (run.crash) return add('FAIL', 'Android: the checker crashed: ' + run.crash.split('\n')[0]);
  const fix = 'the Android app runs the game with a web version of tt — use only what it has (kit/web/tt-web-shim.js), and TikTok services only through HSGame';
  if (run.missingTt && run.missingTt.length) add('FAIL', 'Android: game uses tt APIs the app does not have: ' + run.missingTt.map((n) => 'tt.' + n).join(', '), fix);
  if (run.errors && run.errors.length) add('FAIL', 'Android: game errors: ' + run.errors.slice(0, 3).join(' | '), fix);
  if (!run.hsLoaded) return add('FAIL', 'Android: HSGame never loaded');
  // A game that threw before start() has said all there is to say above.
  if (!run.ready) return run.errors.length || run.missingTt.length ? undefined : add('FAIL', 'Android: HSGame.start() did not start the SDK');
  if (run.kitPlatform !== 'android' || run.platform !== 'android') return add('FAIL', `Android: ran as "${run.kitPlatform}/${run.platform}", not android`, `replace hs-game.js and ${SDK_FILE} from the kit`);
  if (!run.missingTt.length && !run.errors.length) add('PASS', 'Android: boots in the app runtime (web tt + HSNative) without errors');
  const eps = (run.requests || []).map((r) => r.ep);
  if (eps.includes('/api/login')) add('FAIL', 'Android: a login request was made — the app has no login yet');
  if (!(run.requests || []).every((r) => r.native)) add('FAIL', 'Android: a request went around the app bridge', `update ${SDK_FILE} from the kit`);
  if (run.adResult && run.adShows.includes('check_rewarded')) add('PASS', 'Android: a rewarded ad through the app\'s ad provider completes');
  else add('FAIL', 'Android: the test ad through the app\'s ad provider did not complete');
  const on = Object.entries(run.has || {}).filter(([, v]) => v).map(([k]) => k);
  add('INFO', `Android: has() → ${on.join(', ') || 'nothing'} (TikTok missions, cloud and shop are off there)`);
}

/** Ad places and reward keys: string literals in the source, plus what the run touched. */
function collectUsage(src, trace) {
  const places = new Set();
  const keys = new Set();
  const lit = (re) => [...src.matchAll(re)].map((m) => m[1]);
  for (const p of lit(/HSGame\.(?:showAd|canShowAd)\(\s*['"]([\w.-]+)['"]/g)) places.add(p);
  for (const k of lit(/HSGame\.(?:claim|rewards|available)\(\s*['"]([\w.-]+)['"]/g)) keys.add(k);
  const claimed = new Set(lit(/HSGame\.claim\(\s*['"]([\w.-]+)['"]/g));
  // Calls whose name is not written in the code (a variable): nothing above can see them.
  const dynamic = [...new Set([...src.matchAll(/HSGame\.(claim|showAd|canShowAd|rewards|available|has|tiktokMission\.start)\(\s*([A-Za-z_$][\w$.]*)\s*[,)]/g)].map((m) => `${m[1]}(${m[2]})`))];
  for (const k of lit(/HSGame\.share\([^)]*,\s*['"]([\w.-]+)['"]\s*\)/g)) keys.add(k);
  for (const e of trace || []) {
    const m = /^(showAd|canShowAd|claim|rewards|available|share):(.+)$/.exec(e);
    if (!m || m[2].startsWith('__check')) continue;
    if (m[1] === 'showAd' || m[1] === 'canShowAd') places.add(m[2]); else keys.add(m[2]);
  }
  const features = [];
  if (/HSGame\.profile\s*\(/.test(src)) features.push(/save\s*:\s*['"]local['"]/.test(src) ? 'profile (device only)' : 'profile (cloud)');
  if (/HSGame\.save\s*\(/.test(src)) features.push('cloud save (3.0 save)');
  if (/HSGame\.(showAd|canShowAd)\s*\(/.test(src)) features.push('ads');
  if (/HSGame\.(buy|shop)\s*\(/.test(src)) features.push('shop');
  if (/HSGame\.share\s*\(/.test(src)) { features.push('share'); if (!/HSGame\.share\([^)]*,/.test(src)) keys.add('share'); }
  if (/HSGame\.tiktokMission\./.test(src)) { features.push('TikTok missions'); keys.add('tiktok_shortcut'); keys.add('tiktok_profile'); }
  if (/HSGame\.claim\s*\(/.test(src)) features.push('claims');
  return { places, keys, features, claimed, dynamic };
}

/** Validate the AI-written dashboard JSON before anyone pastes it into the dashboard. */
function checkDashboard(dash, used, add) {
  const bad = [];
  const iaa = dash.iaa_config || {};
  const labels = new Set();
  for (const p of iaa.placements || []) {
    if (!p.label) bad.push('a placement without a label');
    else if (p.label !== p.label.toLowerCase()) add('WARN', `place "${p.label}" has capitals`, 'use lowercase labels — they must match the code exactly');
    labels.add(p.label);
    for (const a of p.ads || []) {
      // The partner's JSON is for the TikTok HS game; the Android one's ids (AppLovin MAX) are set by HS.
      if (dash.platform !== 'android' && !/^ad[a-zA-Z0-9]+$/.test(String(a.id || ''))) add('WARN', `place "${p.label}": ad id "${a.id}" is not a TikTok ad unit id yet`, 'replace it with the ad… id from the TikTok console');
    }
  }
  const rewards = iaa.rewards || {};
  for (const [k, v] of Object.entries(rewards)) {
    if (v === null) continue;
    if (typeof v !== 'object') { bad.push(`rewards["${k}"] must be { item: count }`); continue; }
    if (!Array.isArray(v) && v.$limit && !['once', 'daily', 'always'].includes(v.$limit)) bad.push(`rewards["${k}"].$limit must be once, daily or always`);
    if (!Object.keys(itemsOf(v)).length) bad.push(`rewards["${k}"] gives no item`);
  }
  const items = iaa.items || {};
  for (const [id, it] of Object.entries(items)) {
    if (it && typeof it === 'object' && !it.category) bad.push(`items["${id}"] has no category`);
  }
  const ids = new Set();
  for (const pr of dash.products || []) {
    const id = pr.id ?? pr.product_id;
    if (!Number.isInteger(Number(id))) bad.push(`product "${pr.name}": id must be a number`);
    else if (ids.has(Number(id))) bad.push(`product id ${id} is used twice`);
    ids.add(Number(id));
    if (!(Number(pr.beans_cost) > 0)) bad.push(`product "${pr.name}": beans_cost must be above 0`);
    if (!Object.keys(itemsOf(pr.rewards)).length) bad.push(`product "${pr.name}" gives no item`);
    // Bought once for good (an entitlement, a skin…): Google Play must keep it owned and restore it.
    const permanent = Object.keys(itemsOf(pr.rewards)).filter((i) => items[i] && items[i].category && !['consumable', 'currency'].includes(items[i].category));
    if (permanent.length && pr.consumable !== false) add('WARN', `product "${pr.name}" unlocks ${permanent.join(', ')} for good but is not "consumable": false`, 'add "consumable": false — Google Play then keeps it owned and restores it on a new phone');
    if (pr.google_id !== undefined) add('WARN', `product "${pr.name}" has a google_id`, 'leave google_id out — HS adds it once the product exists in Google Play');
  }

  if (bad.length) add('FAIL', 'dashboard JSON: ' + bad.slice(0, 4).join(' · '), 'fix it before pasting into the dashboard');
  else add('PASS', `dashboard JSON is well-formed (${labels.size} places, ${Object.keys(rewards).length} reward keys, ${Object.keys(items).length} items, ${ids.size} products)`);

  const missing = [...used.places].filter((p) => !labels.has(p));
  if (missing.length) add('INFO', 'ad places in the code with no ad in the dashboard JSON (they show nothing): ' + missing.join(', '));
  const unusedPlaces = [...labels].filter((l) => !used.places.has(l));
  if (unusedPlaces.length && used.places.size) add('WARN', 'dashboard places the code never calls: ' + unusedPlaces.join(', '), 'check the spelling — a label must match showAd("…") exactly');
}

function itemsOf(v) {
  const out = {};
  if (Array.isArray(v)) { for (const x of v) if (x && x.type) out[x.type] = 1; return out; }
  if (v && typeof v === 'object') for (const [k, n] of Object.entries(v)) if (!k.startsWith('$') && (n === true || Number(n) > 0)) out[k] = n;
  return out;
}

function child(cfg) {
  return new Promise((done) => {
    const p = fork(SELF, [], { env: { ...process.env, HS_CHECK_CHILD: JSON.stringify(cfg) }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let got = null;
    const timer = setTimeout(() => { p.kill(); done(got || { crash: 'timed out after 30 s' }); }, 30000);
    p.on('message', (m) => { got = m; });
    p.on('exit', () => { clearTimeout(timer); done(got || { crash: 'the run exited without a result' }); });
  });
}

function finish(lines, asJson) {
  const fails = lines.filter((l) => l.level === 'FAIL').length;
  const warns = lines.filter((l) => l.level === 'WARN').length;
  if (asJson) {
    console.log(JSON.stringify({ ok: fails === 0, fails, warns, lines }, null, 2));
  } else {
    const icon = { PASS: '✅', FAIL: '❌', WARN: '⚠️ ', INFO: 'ℹ️ ' };
    console.log('\nHS SDK integration check\n');
    for (const l of lines) {
      console.log(`${icon[l.level]} ${l.level.padEnd(4)}  ${l.msg}`);
      if (l.fix && l.level !== 'PASS') console.log(`          → ${l.fix}`);
    }
    console.log(`\n${fails ? '❌' : '✅'} ${fails} fail, ${warns} warn\n`);
  }
  process.exit(fails ? 1 : 0);
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function readJson(f) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } }
function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } }
function cmp(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function versionOf(s) { const m = /v(\d+)\.(\d+)\.(\d+)/.exec(s || ''); return m ? m.slice(1).map(Number) : null; }
function valueAfter(args, flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] || '' : ''; }
