# Asset folders

Everything in Sky Roadster is generated procedurally, so these folders start empty.
Drop replacement files here and reference them from `src/assets/manifest.ts` (`file` field).

| Folder | What goes here |
|---|---|
| `vehicles/` | Car GLB/GLTF (+Y up, −Z forward, metres, ~1.5 × 0.8 × 2.6 m) |
| `obstacles/` | Obstacle GLBs (origin at ground level; stay inside the hitbox in `ObstacleRules.ts`) |
| `powerups/` | Coin / power-up GLBs |
| `environments/` | Building / prop GLBs, skybox or billboard textures |
| `ui/` | Logo artwork, icons |
| `effects/` | Particle / sprite textures |
| `audio/` | `.mp3` / `.ogg` overrides for any SFX id in `src/audio/Audio.ts` |

Missing or broken files are ignored and the procedural version is used.
