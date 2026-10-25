/**
 * ASSET MANIFEST
 * ---------------------------------------------------------------------------
 * Every visual/audio asset the game uses, grouped by the folders in
 * /public/assets/. All of them ship as procedural fallbacks (built in code), so
 * the game runs with zero downloads. To replace one with authored art, drop a
 * file into the matching folder and set `file` below — the AssetLoader will try
 * the file first and silently fall back to the procedural builder if it is
 * missing or fails to load.
 *
 * GLB/GLTF conventions for replacement models:
 *  - +Y up, -Z forward (the car drives toward -Z), 1 unit = 1 metre
 *  - origin at the visual centre for vehicles, at ground level for obstacles
 *  - keep the footprint inside the hitbox noted for each obstacle
 */
export type AssetKind = 'model' | 'texture' | 'audio';
export type Category = 'vehicles' | 'obstacles' | 'powerups' | 'environments' | 'ui' | 'effects' | 'audio';

export interface AssetEntry {
  id: string;
  category: Category;
  kind: AssetKind;
  /** builder used when no file is provided */
  procedural: string;
  /** optional replacement file, relative to /public (e.g. 'assets/vehicles/xwave_car.glb') */
  file?: string;
  notes?: string;
}

export const MANIFEST: AssetEntry[] = [
  // vehicles
  { id: 'vehicle.xwave', category: 'vehicles', kind: 'model', procedural: 'render/BikeRiderAsset.ts#buildBikeRiderAsset', file: 'assets/vehicles/bike_rider.glb', notes: 'Main player vehicle: Futuristic motorcycle with articulated rider (graphite/cobalt racing suit, segmented silver Y-spine armor, full-face helmet with rear cyan strips, twin angular cyan taillights, center red tail light, right-side short exhaust).' },
  { id: 'vehicle.skins', category: 'vehicles', kind: 'texture', procedural: 'render/Vehicle.ts#SKINS', notes: 'Zenith, Vega, Volt, Phantom, Inferno, Nexus colourways.' },
  // obstacles (hitboxes live in gameplay/ObstacleRules.ts)
  { id: 'obstacle.crate', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#crate', notes: 'Hitbox 1.7 cube. Fly over or change lane.' },
  { id: 'obstacle.barrier', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#barrier', notes: 'Energy barrier, 0–1.35 m high. Fly over.' },
  { id: 'obstacle.beam', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#beam', notes: 'Overhead block from 0.95 m up. Fly under.' },
  { id: 'obstacle.drone', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#drone', notes: 'Sweeps between two lanes, 0.5–1.9 m.' },
  { id: 'obstacle.laser', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#laser', notes: 'Per-lane low / high / block / open.' },
  { id: 'obstacle.traffic', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#traffic', notes: 'Oncoming hover van, lane-only dodge.' },
  { id: 'obstacle.ring', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#ring', notes: 'Energy ring; pass through the centre (not HIGH).' },
  { id: 'obstacle.platform', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#platform', notes: 'Sliding platform, 0–1.1 m, sweeps two lanes.' },
  { id: 'obstacle.asteroid', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#asteroid', notes: 'Space Zone. Lane-only.' },
  { id: 'obstacle.gate', category: 'obstacles', kind: 'model', procedural: 'render/ObstacleViews.ts#gate', notes: 'Mechanical gate with one open door lane.' },
  // power-ups
  { id: 'powerup.coin', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#coins (instanced)' },
  { id: 'powerup.shield', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#shield' },
  { id: 'powerup.magnet', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#magnet' },
  { id: 'powerup.turbo', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#turbo' },
  { id: 'powerup.double', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#double' },
  { id: 'powerup.life', category: 'powerups', kind: 'model', procedural: 'render/PickupViews.ts#life' },
  // environments
  { id: 'env.road', category: 'environments', kind: 'texture', procedural: 'render/textures.ts#roadTexture' },
  { id: 'env.city', category: 'environments', kind: 'model', procedural: 'render/Scenery.ts#buildCity', notes: 'WORLD 1 — Future City (fully playable).' },
  { id: 'env.tunnel', category: 'environments', kind: 'model', procedural: 'render/Scenery.ts#buildTunnel', notes: 'WORLD 2 — Neon Tunnel.' },
  { id: 'env.cloud', category: 'environments', kind: 'model', procedural: 'render/Scenery.ts#buildCloud', notes: 'WORLD 3 — Cloud City.' },
  { id: 'env.space', category: 'environments', kind: 'model', procedural: 'render/Scenery.ts#buildSpace', notes: 'WORLD 4 — Space Zone.' },
  { id: 'env.mega', category: 'environments', kind: 'model', procedural: 'render/Scenery.ts#buildCity(mega)', notes: 'WORLD 5 — XWAVE Megacity.' },
  { id: 'env.billboards', category: 'environments', kind: 'texture', procedural: 'render/textures.ts#billboardTexture' },
  // ui
  { id: 'ui.logo', category: 'ui', kind: 'texture', procedural: 'ui/ui.css .logo (CSS)', notes: 'Replace with an SVG/PNG wordmark if desired.' },
  { id: 'ui.icons', category: 'ui', kind: 'texture', procedural: 'ui/icons.ts (inline SVG)' },
  // effects
  { id: 'fx.particles', category: 'effects', kind: 'texture', procedural: 'render/Effects.ts#Particles' },
  { id: 'fx.speedlines', category: 'effects', kind: 'model', procedural: 'render/Effects.ts#SpeedLines' },
  { id: 'fx.shield', category: 'effects', kind: 'model', procedural: 'render/Effects.ts#makeShield' },
  { id: 'fx.portal', category: 'effects', kind: 'model', procedural: 'render/Effects.ts#makePortal' },
  // audio — every SFX name in audio/Audio.ts can be overridden
  { id: 'coin', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#coin' },
  { id: 'crash', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#crash' },
  { id: 'power', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#power' },
  { id: 'up', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#up' },
  { id: 'down', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#down' },
  { id: 'lane', category: 'audio', kind: 'audio', procedural: 'audio/Audio.ts#lane' },
];
