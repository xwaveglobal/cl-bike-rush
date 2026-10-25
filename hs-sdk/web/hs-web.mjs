#!/usr/bin/env node
/*! hs-web.mjs 1.1.0 —a native TikTok mini game as a web page.
 *
 *   node hs-web.mjs preview <game folder> [--port 8090] [--dashboard file.json] [--platform tiktok|android]
 *       The game in a phone-sized frame on your desktop, as TikTok Minis or
 *       as the HS Android app (switch in the page), with an inspector: what
 *       HSGame sees, the hard cases at one click (fresh install, the app dying
 *       mid-payment, another phone, +1 day…), the checker, a log, the phone's
 *       storage and the cloud. A fake HS backend inside the page answers from
 *       the dashboard JSON — offline, never the live backend (the page may not
 *       connect anywhere else). Listens on 127.0.0.1 only.
 *
 *   node hs-web.mjs pack <game folder>
 *       The package to send HS for the Android build: <game>-android.zip next
 *       to the game folder, from the files next to it — <game>.android.json
 *       (the app's details), <game>.icon-512.png, <game>.hs-dashboard.json.
 *       Checks them, refuses keys / keystores / .env files, and runs hs-check
 *       (0 FAIL needed).
 *
 *   node hs-web.mjs pack <game folder> --tiktok
 *       The zip to upload to TikTok: <game>-tiktok.zip next to the game folder,
 *       the game folder's files at the zip root. Checks TikTok's rules (appid
 *       set, no empty files, 30 MB total / 4 MB main package / 4 MB per
 *       independent subpackage), refuses keys / keystores / .env files, and
 *       runs hs-check (0 FAIL needed; the Android lines are only reported).
 *
 *   node hs-web.mjs build <game folder> --out <dir> [--native hs-native.js]
 *       The www/ folder the Android app ships: the game's files, index.html,
 *       tt-web-shim.js, and game.js bundled into one file (esbuild when it is
 *       installed, else hs-loader.js loads the files at runtime). The app's
 *       bridge script (hs-native.js, defines HSNative) runs first.
 *
 * Node 18+. No dependencies (esbuild optional, for build).
 */
import { createServer } from 'node:http';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIM_FILES = ['tt-web-shim.js', 'hs-loader.js', 'preview-runtime.js', 'preview-shell.js'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.atlas': 'text/plain; charset=utf-8', '.fnt': 'text/plain; charset=utf-8',
};

/** Files of the game folder that never go into the app. */
const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'project.config.json', 'project.private.config.json']);

function fail(msg) {
  console.error(`hs-web: ${msg}`);
  process.exit(1);
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function gameFolder(p) {
  if (!p) fail('give the game folder (the one with game.js)');
  const dir = resolve(p);
  if (!existsSync(join(dir, 'game.js'))) fail(`no game.js in ${dir}`);
  return dir;
}

/** The game's orientation from game.json — the app locks the screen to it. */
function orientation(dir) {
  try {
    const g = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8'));
    return g.deviceOrientation === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

function indexHtml({ title, scripts, boot }) {
  const tags = scripts.map((s) => `  <script src="${s}"></script>`).join('\n');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <title>${title.replace(/[<>&"]/g, '')}</title>
  <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}</style>
</head>
<body>
${tags}
${boot ? `  <script>${boot}</script>\n` : ''}</body>
</html>
`;
}

// ─── preview ──────────────────────────────────────────────────────────────

// The page may load and run this server's files only, and talk to nothing
// else: the game's real Game ID / SDK key can never reach the live backend.
// (Images may come from anywhere — products and items have remote icons.)
const CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; " +
  "form-action 'none'; base-uri 'none'";

function preview(opts) {
  const dir = gameFolder(opts._[1]);
  const port = Number(opts.port) || 8090;
  const dashPath = opts.dashboard ? resolve(String(opts.dashboard)) : `${dir}.hs-dashboard.json`;
  const platformForced = opts.platform === 'android' || opts.platform === 'tiktok';
  const name = basename(dir);
  const readDash = () => { try { return JSON.parse(readFileSync(dashPath, 'utf8')); } catch { return null; } };

  // The phone: runtime first (network, clock, the platform's services), then the web tt.
  const frame = indexHtml({
    title: `${name} — game`,
    scripts: ['/__hs/preview-runtime.js', '/__hs/tt-web-shim.js', '/__hs/hs-loader.js'],
    boot: "window.__hsPreviewAfterShim && window.__hsPreviewAfterShim(); HSLoader.run('game.js');",
  });
  // The page around it. Read on every load, so an edited dashboard JSON shows at once.
  const shell = () => {
    const cfg = { game: name, orientation: orientation(dir), platform: platformForced ? opts.platform : 'tiktok', platformForced, dashboard: readDash() };
    const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
    return `<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>${name.replace(/[<>&"]/g, '')} — HS preview</title>\n</head>\n<body>\n` +
      `  <script>window.HSPreviewConfig = ${json};</script>\n  <script src="/__hs/preview-shell.js"></script>\n</body>\n</html>\n`;
  };

  // hs-check, run in the background and kept for the inspector.
  let check = null;
  const runCheck = () => {
    check = { running: true };
    const args = [join(HERE, '..', 'hs-check.mjs'), dir, '--json'];
    if (existsSync(dashPath)) args.push('--dashboard', dashPath);
    if (!existsSync(args[0])) { check = { error: 'hs-check.mjs not found next to web/' }; return; }
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => { try { check = JSON.parse(out); } catch { check = { error: 'hs-check gave no result' }; } });
  };
  runCheck();

  const send = (res, status, type, body) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP });
    res.end(body);
  };

  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, MIME['.txt'], 'GET only');
    // This computer's own names only: a web page whose domain is re-pointed at
    // 127.0.0.1 (DNS rebinding) must not read the game and its keys through the browser.
    const host = String(req.headers.host || '');
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, MIME['.txt'], 'wrong host');
    let url;
    try {
      url = new URL(req.url, 'http://x');
      url.pathname = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, MIME['.txt'], 'bad path');
    }
    const path = url.pathname;
    if (path === '/' || path === '/index.html') return send(res, 200, MIME['.html'], shell());
    if (path === '/__hs_frame.html') return send(res, 200, MIME['.html'], frame);
    if (path === '/__hs/check.json') {
      if (url.searchParams.get('again') && !(check && check.running)) runCheck();
      return send(res, 200, MIME['.json'], JSON.stringify(check || { running: true }));
    }
    if (path.startsWith('/__hs/')) {
      const file = path.slice('/__hs/'.length);
      if (!SHIM_FILES.includes(file)) return send(res, 404, MIME['.txt'], 'not found');
      return send(res, 200, MIME['.js'], readFileSync(join(HERE, file)));
    }
    // A game file — and nothing outside the game folder.
    const file = resolve(dir, '.' + path);
    if (file !== dir && !file.startsWith(dir + sep)) return send(res, 403, MIME['.txt'], 'outside the game folder');
    if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, MIME['.txt'], 'not found');
    return send(res, 200, MIME[extname(file).toLowerCase()] || 'application/octet-stream', readFileSync(file));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`HS preview of ${name} (${orientation(dir)}): http://127.0.0.1:${port}/`);
    console.log(existsSync(dashPath) ? `Dashboard data from ${dashPath}` : `No ${basename(dashPath)} — no ads, rewards or products from a dashboard`);
    console.log('Offline: the game talks only to the fake HS backend in the page. Ctrl+C to stop.');
  });
}

// ─── build ────────────────────────────────────────────────────────────────

function copyGame(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.endsWith('.hs-dashboard.json')) continue;
    cpSync(join(dir, name), join(out, name), {
      recursive: true,
      filter: (src) => !SKIP.has(basename(src)),
    });
  }
}

/**
 * A bundler installed next to this file (the kit's own node_modules) or where
 * hs-web is run from (a build worker's node_modules). Null when neither has it.
 */
async function loadBundler(name) {
  for (const base of [import.meta.url, pathToFileURL(join(process.cwd(), 'noop.js')).href]) {
    try {
      const path = createRequire(base).resolve(name);
      const mod = await import(pathToFileURL(path).href);
      return mod.build ? mod : mod.default;
    } catch {
      /* not installed there */
    }
  }
  return null;
}

/**
 * esbuild (native binary), else esbuild-wasm (runs inside node — for a sandbox
 * that may only exec node), else false: hs-loader.js loads the files at runtime.
 * A bundler that loads but cannot run falls through to the next one.
 */
async function bundle(dir, outFile) {
  for (const name of ['esbuild', 'esbuild-wasm']) {
    const esbuild = await loadBundler(name);
    if (!esbuild) continue;
    try {
      await esbuild.build({
        entryPoints: [join(dir, 'game.js')],
        outfile: outFile,
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2017',
        logLevel: 'warning',
        // The game's code stays readable in a crash report.
        minify: false,
        sourcemap: false,
      });
      return name;
    } catch (e) {
      console.log(`  ${name} could not bundle (${String(e && e.message || e).split('\n')[0]}) — trying the next way`);
    }
  }
  return false;
}

async function build(opts) {
  const dir = gameFolder(opts._[1]);
  if (!opts.out || opts.out === true) fail('give --out <dir>');
  const out = resolve(String(opts.out));
  if (out === dir || out.startsWith(dir + sep)) fail('--out must be outside the game folder');
  if (existsSync(out) && readdirSync(out).length) fail(`${out} is not empty`);
  mkdirSync(out, { recursive: true });

  copyGame(dir, out);
  cpSync(join(HERE, 'tt-web-shim.js'), join(out, 'tt-web-shim.js'));
  if (opts.native && opts.native !== true) cpSync(resolve(String(opts.native)), join(out, 'hs-native.js'));

  const bundled = await bundle(dir, join(out, 'game.bundle.js'));
  if (!bundled) cpSync(join(HERE, 'hs-loader.js'), join(out, 'hs-loader.js'));

  const scripts = ['hs-native.js', 'tt-web-shim.js', bundled ? 'game.bundle.js' : 'hs-loader.js'];
  writeFileSync(join(out, 'index.html'), indexHtml({
    title: basename(dir),
    scripts,
    boot: bundled ? '' : "HSLoader.run('game.js');",
  }));
  const manifest = {
    game: basename(dir),
    orientation: orientation(dir),
    entry: 'index.html',
    bundled,
    files: listFiles(out).length,
  };
  writeFileSync(join(out, 'hs-web.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`www for ${manifest.game}: ${out}`);
  console.log(`  ${manifest.files} files, ${bundled ? `game bundled (${bundled})` : 'game loaded by hs-loader.js (no bundler could run)'}, ${manifest.orientation}`);
  if (!existsSync(join(out, 'hs-native.js'))) console.log('  hs-native.js is not in it yet — the Android app build adds it.');
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p).map((f) => join(name, f)));
    else out.push(relative(dir, p));
  }
  return out;
}

// ─── pack: the package partners send HS for the Android build ────────────

/** Never in a package: signing keys, private keys, environment files. */
const SECRET = /(\.(jks|keystore|p12|pem|key)$)|(^\.env)/i;

function pack(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const problems = [];
  const notes = [];
  // <game>.android.json — or android.json, the name inside an earlier package
  // (a studio that unpacked the zip it sent before keeps working).
  const side = (suffix) => {
    const own = join(dirname(dir), name + suffix);
    const plain = join(dirname(dir), suffix.slice(1));
    if (!existsSync(own) && suffix !== '.hs-dashboard.json' && existsSync(plain)) {
      notes.push(`using ${basename(plain)} (from an earlier package) as ${basename(own)}`);
      return plain;
    }
    return own;
  };

  // The app's details.
  const detailsFile = side('.android.json');
  let details = null;
  if (!existsSync(detailsFile)) problems.push(`missing ${basename(detailsFile)} next to the game folder (the app's details — see INTEGRATE-WITH-AI.md, step 5)`);
  else {
    try { details = JSON.parse(readFileSync(detailsFile, 'utf8')); } catch { problems.push(`${basename(detailsFile)} is not valid JSON`); }
  }
  if (details) {
    const d = details;
    if (typeof d.app_name !== 'string' || !d.app_name.trim() || d.app_name.length > 30) problems.push('app_name: 1–30 characters');
    if (d.package_name && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(d.package_name)) problems.push('package_name: like com.yourstudio.game (lowercase, dots) — or leave it out and HS picks one');
    if (typeof d.version_name !== 'string' || !/^\d+(\.\d+){0,3}$/.test(d.version_name)) problems.push('version_name: like 1.0.0');
    if (typeof d.privacy_policy_url !== 'string' || !/^https:\/\/\S+$/.test(d.privacy_policy_url)) problems.push('privacy_policy_url: an https:// link (Google Play requires it)');
    if (typeof d.contact_email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contact_email)) problems.push('contact_email: an email address');
  }

  // The icon: a real 512×512 PNG, no transparency.
  const iconFile = side('.icon-512.png');
  if (!existsSync(iconFile)) problems.push(`missing ${basename(iconFile)} next to the game folder (512×512 PNG)`);
  else {
    const png = readFileSync(iconFile);
    const isPng = png.length > 33 && png.readUInt32BE(0) === 0x89504e47 && png.toString('ascii', 12, 16) === 'IHDR';
    if (!isPng) problems.push(`${basename(iconFile)} is not a PNG`);
    else {
      const w = png.readUInt32BE(16), h = png.readUInt32BE(20), colorType = png[25];
      if (w !== 512 || h !== 512) problems.push(`${basename(iconFile)} is ${w}×${h} — it must be 512×512`);
      // 4 = grey + alpha, 6 = RGBA; a palette PNG can carry a tRNS chunk. Many
      // tools save a fully opaque icon as RGBA, so this is a reminder, not a stop.
      if (colorType === 4 || colorType === 6 || png.includes(Buffer.from('tRNS'))) {
        notes.push(`${basename(iconFile)} has an alpha channel — make sure no pixel is transparent (Google Play needs a solid background)`);
      }
    }
  }

  // The dashboard JSON the AI wrote.
  const dashFile = side('.hs-dashboard.json');
  if (!existsSync(dashFile)) problems.push(`missing ${basename(dashFile)} next to the game folder`);

  // Nothing secret in the game folder.
  const files = listFiles(dir);
  const secrets = files.filter((f) => f.split(sep).some((part) => SECRET.test(part)));
  if (secrets.length) problems.push('remove these from the game folder (never send keys, keystores or .env files): ' + secrets.join(', '));

  if (problems.length) {
    console.log(`Cannot pack ${name}:\n` + problems.map((p) => '  ❌ ' + p).join('\n'));
    process.exit(1);
  }

  // The game must pass hs-check — the Android lines included.
  const fails = checkFails(dir);
  if (fails.length) {
    console.log(`Cannot pack ${name}: hs-check has failures — fix them first:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }

  const entries = [];
  for (const f of files) entries.push({ name: `${name}/${f.split(sep).join('/')}`, data: readFileSync(join(dir, f)) });
  entries.push({ name: `${name}.hs-dashboard.json`, data: readFileSync(dashFile) });
  entries.push({ name: 'icon-512.png', data: readFileSync(iconFile) });
  entries.push({ name: 'android.json', data: Buffer.from(JSON.stringify(details, null, 2) + '\n') });
  const out = side('-android.zip');
  writeFileSync(out, zip(entries));
  console.log(`Android package: ${out}\n  ${files.length} game files + dashboard JSON + icon + android.json · hs-check passed`);
  for (const n of notes) console.log('  ⚠️ ' + n);
  console.log('Send this file to your HS contact.');
}

/**
 * hs-check's FAIL lines. The checker missing next to web/ (a kit copied
 * without it) checks nothing; it not answering is a failure.
 */
function checkFails(dir) {
  const checker = join(HERE, '..', 'hs-check.mjs');
  if (!existsSync(checker)) return [];
  const r = spawnSync(process.execPath, [checker, dir, '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* reported below */ }
  if (!report) return [{ level: 'FAIL', msg: 'hs-check did not run' }];
  return report.lines.filter((l) => l.level === 'FAIL');
}

// ─── pack --tiktok: the zip partners upload to TikTok ────────────────────

// TikTok's limits for a native (non-Unity) mini game, before compression
// (developers.tiktok.com → Mini games technical overview). The upload fails above them.
const TT_TOTAL = 30 * 1024 * 1024;
const TT_PART = 4 * 1024 * 1024;

/** Never uploaded: tool folders, OS junk, the DevTool's private settings (may hold a login). */
const TT_SKIP = new Set(['node_modules', '.git', '.DS_Store', 'Thumbs.db', '__MACOSX', 'project.private.config.json']);

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

/**
 * The game folder's files, relative, without TT_SKIP (dropped ones are not
 * walked). Symlinks are listed in `links`, never followed: one could pull a
 * file from outside the folder (a key, ~/.ssh) into a public upload.
 */
function tiktokFiles(dir, links, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (TT_SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) links.push(relative(base, p));
    else if (st.isDirectory()) out.push(...tiktokFiles(p, links, base));
    else if (st.isFile()) out.push(relative(base, p));
  }
  return out;
}

function packTiktok(opts) {
  const dir = gameFolder(opts._[1]);
  const name = basename(dir);
  const problems = [];
  const notes = [];
  const links = [];
  const files = tiktokFiles(dir, links);
  const posix = (f) => f.split(sep).join('/');
  if (links.length) problems.push('replace these links with the real files (a link can pull in files from outside the game folder): ' + links.join(', '));

  // TikTok matches the package to the app by project.config.json → appid.
  let conf = null;
  try { conf = JSON.parse(readFileSync(join(dir, 'project.config.json'), 'utf8')); } catch { /* reported below */ }
  if (!conf || !conf.appid || /YOUR|xxx|TODO/i.test(String(conf.appid))) {
    problems.push('project.config.json → "appid": put the TikTok App ID there — it must match the app in the TikTok developer portal (INTEGRATE-WITH-AI.md, step 0)');
  }

  // Files that must not go up: secrets, and the HS files that live NEXT TO the folder.
  const secrets = files.filter((f) => f.split(sep).some((part) => SECRET.test(part)));
  if (secrets.length) problems.push('remove these from the game folder (never upload keys, keystores or .env files): ' + secrets.join(', '));
  const sideFiles = files.filter((f) => /(\.hs-dashboard\.json|\.android\.json|\.icon-512\.png|-android\.zip|-tiktok\.zip)$/.test(f) || f === 'android.json');
  if (sideFiles.length) problems.push('move these NEXT TO the game folder, not inside it (everything inside is uploaded to TikTok): ' + sideFiles.join(', '));

  // TikTok refuses empty files.
  const sizes = new Map(files.map((f) => [f, statSync(join(dir, f)).size]));
  const empty = files.filter((f) => sizes.get(f) === 0);
  if (empty.length) problems.push('TikTok refuses empty (0-byte) files — remove or fill: ' + empty.join(', '));

  // Sizes: the total, the main package (everything outside the subpackage roots), each independent subpackage.
  let game = null;
  try { game = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')); } catch { /* hs-check reports it */ }
  const subs = [];
  for (const s of (game && Array.isArray(game.subpackages) ? game.subpackages : [])) {
    const root = String((s && s.root) || '').replace(/^\.?\/+/, '').replace(/\/+$/, '');
    if (!root || !existsSync(join(dir, root))) { problems.push(`game.json → subpackages: root "${(s && s.root) || ''}" is not a folder in the game`); continue; }
    subs.push({ name: (s && s.name) || root, root, independent: !!(s && s.independent), bytes: 0 });
  }
  let total = 0, main = 0;
  for (const f of files) {
    const n = sizes.get(f);
    total += n;
    const sub = subs.find((s) => posix(f) === s.root || posix(f).startsWith(s.root + '/'));
    if (sub) sub.bytes += n; else main += n;
  }
  if (total > TT_TOTAL) problems.push(`the game is ${mb(total)} — TikTok allows ${mb(TT_TOTAL)} in all (before compression)`);
  if (main > TT_PART) problems.push(`the main package is ${mb(main)} — TikTok allows ${mb(TT_PART)}; move assets into subpackages (game.json → "subpackages")`);
  for (const s of subs) if (s.independent && s.bytes > TT_PART) problems.push(`independent subpackage "${s.name}" is ${mb(s.bytes)} — TikTok allows ${mb(TT_PART)}`);

  if (problems.length) {
    console.log(`Cannot pack ${name} for TikTok:\n` + problems.map((p) => '  ❌ ' + p).join('\n'));
    process.exit(1);
  }

  // hs-check: the TikTok side must pass; the Android lines do not stop a TikTok upload.
  const allFails = checkFails(dir);
  const androidFails = allFails.filter((l) => /^Android:/.test(l.msg));
  const fails = allFails.filter((l) => !androidFails.includes(l));
  if (fails.length) {
    console.log(`Cannot pack ${name} for TikTok: hs-check has failures — fix them first:\n` + fails.map((l) => '  ❌ ' + l.msg).join('\n'));
    process.exit(1);
  }
  if (androidFails.length) notes.push(`hs-check has ${androidFails.length} Android failure(s) — fine for TikTok, but fix them before "prepare the Android build"`);

  // The folder's files at the zip root, as TikTok's CLI uploads the folder itself.
  const out = join(dirname(dir), name + '-tiktok.zip');
  writeFileSync(out, zip(files.map((f) => ({ name: posix(f), data: readFileSync(join(dir, f)) }))));
  console.log(`TikTok package: ${out}\n  ${files.length} files · ${mb(total)} (main package ${mb(main)}${subs.length ? `, ${subs.length} subpackage(s)` : ''}) · hs-check passed`);
  for (const n of notes) console.log('  ⚠️ ' + n);
  console.log('Upload it: TikTok developer portal → your app → Code version → Add code asset → this zip.\n' +
    'Or from the game folder with TikTok\'s CLI: npm i -g @ttmg/cli · ttmg login · ttmg upload');
}

// A small zip writer (deflate), so packing needs nothing installed.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const packed = deflateRawSync(e.data);
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(e.data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

const opts = args(process.argv.slice(2));
if (opts._[0] === 'preview') preview(opts);
else if (opts._[0] === 'build') build(opts).catch((e) => fail(String(e && e.message || e)));
else if (opts._[0] === 'pack') (opts.tiktok ? packTiktok : pack)(opts);
else {
  console.log('usage:\n  node hs-web.mjs preview <game folder> [--port 8090] [--dashboard file.json] [--platform tiktok|android]\n  node hs-web.mjs pack <game folder> [--tiktok]\n  node hs-web.mjs build <game folder> --out <dir> [--native hs-native.js]');
  process.exit(opts._[0] ? 1 : 0);
}
