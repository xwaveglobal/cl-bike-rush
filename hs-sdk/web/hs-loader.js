/*! hs-loader.js 1.0.0 — require() for a native TikTok mini game in a web page.
 *
 * TikTok runs game.js with CommonJS: require('./hs-game.js'). A web page has
 * no require, so this loads each file by path (synchronous XHR, relative to
 * the file that asks) and caches it. Used by the desktop preview; an app
 * build bundles the game into one file instead (hs-web.mjs build), and this
 * file is then not loaded at all.
 *
 *   HSLoader.run('game.js')
 */
(function (window) {
  'use strict';

  var cache = {};

  function dirOf(path) { var i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i + 1); }

  function normalize(path) {
    var out = [];
    path.split('/').forEach(function (part) {
      if (part === '' || part === '.') return;
      if (part === '..') { if (out.length) out.pop(); return; }
      out.push(part);
    });
    return out.join('/');
  }

  function fetchText(path) {
    var xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', path, false);
      xhr.send(null);
    } catch (e) {
      return null;
    }
    return xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null;
  }

  /**
   * './a.js' is that file only; './a' tries './a.js', './a.json', './a/index.js'.
   * Every miss is a 404 in the app's log, so a name with an extension (the
   * kit's own requires) is never probed four ways.
   */
  function resolveFile(from, request) {
    var base = request.charAt(0) === '/' ? request.slice(1) : normalize(dirOf(from) + request);
    var tries = /\.(js|json)$/.test(base) ? [base] : [base + '.js', base + '.json', base + '/index.js', base];
    for (var i = 0; i < tries.length; i++) {
      if (Object.prototype.hasOwnProperty.call(cache, tries[i])) return { path: tries[i], text: null };
      var text = fetchText(tries[i]);
      if (text !== null) return { path: tries[i], text: text };
    }
    return null;
  }

  function load(from, request) {
    var found = resolveFile(from, String(request));
    if (!found) throw new Error("Cannot find module '" + request + "' from '" + (from || '/') + "'");
    var path = found.path;
    if (Object.prototype.hasOwnProperty.call(cache, path)) return cache[path].exports;
    var module = { exports: {}, id: path, filename: path, loaded: false };
    cache[path] = module;
    if (/\.json$/.test(path)) {
      module.exports = JSON.parse(found.text);
    } else {
      // sourceURL keeps the real file name in stack traces and devtools.
      var fn = new Function('require', 'module', 'exports', '__filename', '__dirname',
        found.text + '\n//# sourceURL=' + window.location.origin + '/' + path);
      fn.call(module.exports, function (r) { return load(path, r); }, module, module.exports, path, dirOf(path));
    }
    module.loaded = true;
    return module.exports;
  }

  window.HSLoader = {
    run: function (entry) { return load('', './' + String(entry || 'game.js').replace(/^\.\//, '')); }
  };
})(window);
