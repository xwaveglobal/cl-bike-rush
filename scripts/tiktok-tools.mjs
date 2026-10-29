// v3: run the HS kit's tools on the TikTok game folder.
//
//   node scripts/tiktok-tools.mjs check   → hs-check (must say 0 FAIL)
//   node scripts/tiktok-tools.mjs pack    → tiktok-tiktok.zip (the zip to upload)
//
// This repo's package.json says "type": "module", which makes Node load the kit's CommonJS files
// (hs-game.js, hs-sdk.min.js) as ES modules during the check. The game folder must not carry a
// package.json of its own (TikTok's Android loader rejects unknown files), so the tools run on a
// temporary copy of tiktok/ outside the repo, with the dashboard JSON next to it.
import { cpSync, copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cmd = process.argv[2] ?? 'check';
const work = mkdtempSync(join(tmpdir(), 'sky-roadster-'));
const game = join(work, 'tiktok');
try {
  cpSync(join(root, 'tiktok'), game, { recursive: true });
  writeFileSync(join(work, 'package.json'), '{ "type": "commonjs" }\n');
  if (existsSync(join(root, 'tiktok.hs-dashboard.json'))) copyFileSync(join(root, 'tiktok.hs-dashboard.json'), join(work, 'tiktok.hs-dashboard.json'));
  const args = cmd === 'pack' ? [join(root, 'hs-sdk/web/hs-web.mjs'), 'pack', game, '--tiktok'] : [join(root, 'hs-sdk/hs-check.mjs'), game];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: work });
  if (cmd === 'pack' && existsSync(join(work, 'tiktok-tiktok.zip'))) {
    copyFileSync(join(work, 'tiktok-tiktok.zip'), join(root, 'tiktok-tiktok.zip'));
    console.log(`→ ${join(root, 'tiktok-tiktok.zip')}`);
  }
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
