// Browser-side fake `tt` global.
//
// Lets the sample page exercise the whole SDK on a desktop browser with no
// TikTok setup at all. It mirrors src/host/mock.ts, which is what the unit
// suite uses — same behaviours, reached through the real global-detection path
// rather than through init({ host }).
//
// NEVER ship this file inside a game build.
(function () {
  var settings = {
    code: 'SHIM_AUTH_CODE',
    failLogin: false,
    failPay: false,
    adOutcome: 'close', // 'close' | 'error' | 'silent'
    adIsEnded: true,
    adDelayMs: 800,
  };

  var hideCbs = [];
  var showCbs = [];

  function later(fn, ms) { setTimeout(fn, ms || 0); }

  function log(msg) {
    if (window.__shimLog) window.__shimLog('tt.' + msg);
  }

  function makeAd(kind, adUnitId) {
    log(kind + '(' + adUnitId + ')');
    var closeCb, errorCb;

    return {
      onClose: function (cb) { closeCb = cb; },
      onError: function (cb) { errorCb = cb; },
      destroy: function () { log('ad.destroy'); },
      show: function () {
        log('ad.show(' + adUnitId + ')');
        if (settings.adOutcome === 'error') {
          later(function () { errorCb && errorCb({ errorCode: 4001, errMsg: 'no fill (shim)' }); }, settings.adDelayMs);
          return;
        }
        if (settings.adOutcome === 'silent') {
          // Models TikTok swallowing a frequency-cap failure: show() is
          // accepted and nothing ever calls back. This is what the SDK's
          // 11004 heuristic exists to catch.
          return;
        }
        // A real ad takes over the screen, so emit a hide/show pair — without
        // it the heuristic would fire a false 11004.
        later(function () { hideCbs.forEach(function (c) { c(); }); }, 50);
        later(function () {
          showCbs.forEach(function (c) { c(); });
          closeCb && closeCb({ isEnded: settings.adIsEnded });
        }, settings.adDelayMs);
      },
    };
  }

  function succeed(opts, value) {
    later(function () { opts && opts.success && opts.success(value); });
  }
  function fail(opts, err) {
    later(function () { opts && opts.fail && opts.fail(err); });
  }

  window.tt = {
    login: function (opts) {
      log('login()');
      if (settings.failLogin) return fail(opts, { errMsg: 'user cancelled (shim)' });
      succeed(opts, { code: settings.code });
    },

    pay: function (opts) {
      log('pay(' + (opts.orderInfo && opts.orderInfo.order_id) + ')');
      if (settings.failPay) return fail(opts, { errMsg: 'payment cancelled (shim)' });
      succeed(opts);
    },

    createRewardedVideoAd: function (o) { return makeAd('createRewardedVideoAd', o.adUnitId); },
    createInterstitialAd: function (o) { return makeAd('createInterstitialAd', o.adUnitId); },

    startEntranceMission: function (opts) {
      log('startEntranceMission()');
      succeed(opts);
      // The user "returns" from the TikTok profile shortly afterwards.
      later(function () { showCbs.forEach(function (c) { c(); }); }, 1200);
    },
    getEntranceMissionReward: function (opts) { log('getEntranceMissionReward()'); succeed(opts, {}); },
    addShortcut: function (opts) { log('addShortcut()'); succeed(opts, {}); },
    checkShortcut: function (opts) { log('checkShortcut()'); succeed(opts, { installed: false }); },
    getShortcutMissionReward: function (opts) {
      log('getShortcutMissionReward()');
      succeed(opts, { canReceiveReward: true });
    },

    onHide: function (cb) { hideCbs.push(cb); },
    offHide: function (cb) { hideCbs = hideCbs.filter(function (c) { return c !== cb; }); },
    onShow: function (cb) { showCbs.push(cb); },
    offShow: function (cb) { showCbs = showCbs.filter(function (c) { return c !== cb; }); },
  };

  window.__ttShim = settings;
})();
