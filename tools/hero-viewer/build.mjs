// Hero 3D viewer — standalone page to inspect the bike + rider asset (poses, camera angles, wireframe).
//   node tools/hero-viewer/build.mjs   -> builds/hero-viewer.html
// three.js is loaded from jsDelivr through an import map (same version as package.json), everything
// else (BikeRiderAsset / BikeBody / RiderHuman + viewer UI) is bundled inline.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const res = await build({
  entryPoints: [join(here, 'main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  write: false,
  external: ['three', 'three/*'],
});
const js = res.outputFiles[0].text;
if (js.includes('</script')) throw new Error('bundle contains </script');
const shell = readFileSync(join(here, 'shell.html'), 'utf8');
mkdirSync(join(root, 'builds'), { recursive: true });
const out = join(root, 'builds', 'hero-viewer.html');
writeFileSync(out, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + shell.replace('/*__BUNDLE__*/', js));
console.log('wrote', out, (js.length / 1024).toFixed(1) + ' KB JS');
