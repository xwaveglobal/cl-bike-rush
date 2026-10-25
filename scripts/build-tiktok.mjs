// v3 native build: src/native/main.ts → tiktok/game.js (+ tiktok/assets/*), the TikTok mini game folder.
//
//   npm run build:tiktok            (Node + esbuild, which comes with Vite)
//   bun scripts/build-tiktok.mjs    (same output with Bun, no node_modules needed)
//
// The game folder must hold only what is uploaded to TikTok: game.js, game.json, project.config.json,
// hs-game.js, hs-sdk.min.js and assets/. The HS kit itself stays outside (hs-sdk/).
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tiktok');
const assetsOut = join(out, 'assets');
const entry = join(root, 'src/native/main.ts');
const nativeImg = join(root, 'src/native/img');
const watch = process.argv.includes('--watch');

rmSync(assetsOut, { recursive: true, force: true });
mkdirSync(assetsOut, { recursive: true });

/** .webp art → the PNG / JPG copy made for the native runtime (src/native/img/<folder>-<name>.png|jpg) */
function nativeImage(path) {
  const base = basename(path, extname(path));
  const folder = basename(dirname(path));
  const name = folder === 'images' ? base : `${folder}-${base}`;
  for (const ext of ['.png', '.jpg']) {
    const p = join(nativeImg, name + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

const plugin = {
  name: 'sky-roadster-native',
  setup(b) {
    // the HS kit is loaded at run time by the mini game's own require()
    b.onResolve({ filter: /hs-game\.js$/ }, (a) => ({ path: a.path, external: true }));
    // the DOM UI → the canvas UI (files in src/native still reach the original for its constants)
    b.onResolve({ filter: /(^|\/)ui\/UI(\.ts)?$/ }, (a) => (a.importer.replace(/\\/g, '/').includes('src/native/') ? undefined : { path: join(root, 'src/native/ui/NativeUI.ts') }));

    // no glTF replacements in the native build (procedural models only)
    b.onResolve({ filter: /GLTFLoader\.js$/ }, () => ({ path: join(root, 'scripts/stubs/GLTFLoader.js') }));
    // CSS is the web UI's; the native UI draws on a canvas
    b.onResolve({ filter: /\.css$/ }, () => ({ path: join(root, 'scripts/stubs/empty.js') }));
    b.onResolve({ filter: /\.webp$/ }, (a) => {
      const abs = join(a.resolveDir, a.path);
      const p = nativeImage(abs);
      if (!p) throw new Error(`no native copy for ${a.path} — run: python3 scripts/native-images.py`);
      return { path: p };
    });
  },
};

const common = {
  entryPoints: [entry],
  bundle: true,
  target: 'es2018',
  define: { 'process.env.NODE_ENV': '"production"', __NATIVE__: 'true' },
  loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.json': 'json' },
  assetNames: 'assets/[name]-[hash]',
  publicPath: '',
};

async function buildEsbuild() {
  const { build } = await import('esbuild');
  await build({
    ...common,
    outfile: join(out, 'game.js'),
    format: 'iife',
    platform: 'browser',
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [plugin],
  });
}

async function buildBun() {
  // eslint-disable-next-line no-undef
  const res = await Bun.build({
    entrypoints: [entry],
    outdir: out,
    naming: { entry: 'game.js', asset: 'assets/[name]-[hash].[ext]' },
    format: 'iife',
    target: 'browser',
    minify: { whitespace: true, syntax: true, identifiers: false },
    define: common.define,
    loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file' },
    publicPath: '',
    plugins: [
      {
        name: plugin.name,
        setup(b) {
          b.onResolve({ filter: /hs-game\.js$/ }, (a) => ({ path: a.path, external: true }));
          b.onResolve({ filter: /(^|\/)ui\/UI(\.ts)?$/ }, (a) => (a.importer.replace(/\\/g, '/').includes('src/native/') ? undefined : { path: join(root, 'src/native/ui/NativeUI.ts') }));
          b.onResolve({ filter: /GLTFLoader\.js$/ }, () => ({ path: join(root, 'scripts/stubs/GLTFLoader.js') }));
          b.onResolve({ filter: /\.css$/ }, () => ({ path: join(root, 'scripts/stubs/empty.js') }));
          b.onResolve({ filter: /\.webp$/ }, (a) => {
            const abs = join(dirname(a.importer), a.path);
            const p = nativeImage(abs);
            if (!p) throw new Error(`no native copy for ${a.path}`);
            return { path: p };
          });
        },
      },
    ],
  });
  if (!res.success) {
    for (const l of res.logs) console.error(l);
    throw new Error('bun build failed');
  }
}

const t0 = Date.now();
if (typeof Bun !== 'undefined') await buildBun();
else await buildEsbuild();

// Downlevel the bundle to ES2017 so older mini-game JS engines (some Android TikTok builds) parse it:
// optional chaining, ??, ??=, class fields, object spread… become plain ES2017. TypeScript does it.
{
  let ts = null;
  try {
    ts = (await import('typescript')).default;
  } catch {
    try {
      const { createRequire } = await import('node:module');
      const { execSync } = await import('node:child_process');
      const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      ts = createRequire(join(globalRoot, 'x.js'))('typescript');
    } catch {
      ts = null;
    }
  }
  const f = join(out, 'game.js');
  if (ts) {
    const t1 = Date.now();
    const r = ts.transpileModule(readFileSync(f, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.None, allowJs: true, removeComments: false, newLine: ts.NewLineKind.LineFeed },
      reportDiagnostics: false,
    });
    // keep the bundle's own (sloppy) mode: TypeScript adds a "use strict" of its own
    writeFileSync(f, r.outputText.replace(/^\s*"use strict";\s*/, ''));
    console.log(`game.js downlevelled to ES2017 in ${Date.now() - t1} ms`);
    // regex features older mini-game engines reject at load (TikTok Android: "Invalid regular expression")
    const sf = ts.createSourceFile('game.js', readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const bad = [];
    const walk = (n) => {
      if (n.kind === ts.SyntaxKind.RegularExpressionLiteral) {
        const t = n.getText();
        const body = t.slice(1, t.lastIndexOf('/'));
        const flags = t.slice(t.lastIndexOf('/') + 1);
        if (/\\[pP]\{/.test(body) || /\(\?<[=!A-Za-z]/.test(body) || /[sdv]/.test(flags)) bad.push(t.slice(0, 60));
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    if (bad.length) throw new Error(`game.js has regex features older engines reject (\\p{…}, lookbehind, named groups, s/d/v flags):\n  ${bad.join('\n  ')}`);
  } else console.warn('⚠ typescript not found: game.js left at the bundler output level');
}

// TikTok refuses 0-byte files; report sizes against the 4 MB main-package limit
let total = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else total += st.size;
  }
};
walk(out);
const gameJs = statSync(join(out, 'game.js')).size;
// keep `require('./hs-game.js')` greppable for hs-check (bundlers may rewrite it as __require)
const src = readFileSync(join(out, 'game.js'), 'utf8');
if (!/require\(\s*['"]\.\/hs-game\.js['"]\s*\)/.test(src)) throw new Error('game.js lost require("./hs-game.js")');
console.log(`tiktok/ built in ${Date.now() - t0} ms · game.js ${(gameJs / 1024).toFixed(0)} KB · folder ${(total / 1024 / 1024).toFixed(2)} MB (limit 4 MB)`);
if (watch) console.log('(--watch is not implemented; re-run the build)');
