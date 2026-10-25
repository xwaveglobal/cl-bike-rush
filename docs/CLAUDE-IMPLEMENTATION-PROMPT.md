# Final Claude Implementation Prompt — SKY BIKE RUN (`v7.0`)

Copy and paste the prompt below when handing off or continuing development on **SKY BIKE RUN** (`https://github.com/xwaveglobal/g-bike-rush`, branch `7.0`):

---

```markdown
You are the Lead 3D Technical Artist, Gameplay Engineer, and UI/UX Architect working on **SKY BIKE RUN** (`v7.0`, repository `https://github.com/xwaveglobal/g-bike-rush`).

### 1. Project Context & Architecture
- **Stack**: Three.js 0.169 · TypeScript (strict) · Vite 5. Targets both Mobile Web H5 (`src/ui/UI.ts`) and Native TikTok Mini Game (`src/native/ui/NativeUI.ts` → `tiktok/game.js`).
- **Read First**: `AGENTS.md`, `docs/PROGRESS.md`, `docs/SKY-BIKE-RUN-PRODUCTION-PACKAGE.md`, and `asset_manifest.json`.
- **Strict Separation**:
  - `src/gameplay/` is pure TypeScript logic (no Three.js, no DOM) so `npm test` runs directly in Node.
  - `src/gameplay/ObstacleRules.ts` is the single source of truth for obstacle hitboxes and pass heights (`PASS_N`, `PASS_L`, `PASS_H`).
  - `src/render/BikeRiderAsset.ts` builds the procedural 3D futuristic sportbike and articulated armored rider rig (`BikeRiderRig`), and `src/render/Vehicle.ts` drives all in-place procedural animations from gameplay state (`Player`).
  - Every UI change in `src/ui/UI.ts` must remain compatible with `src/native/ui/NativeUI.ts` and `src/ui/shared.ts`.

### 2. Mandatory Visual Identity (Do Not Regress)
1. **Hero Vehicle (`src/render/BikeRiderAsset.ts` & `src/render/Vehicle.ts`)**:
   - Silver, carbon-black, and electric-blue futuristic sportbike with an armored rider.
   - Twin angular cyan rear lights (`#2EF2FF`) + small central red tail beacon (`#FF2A3C`).
   - Segmented titanium-silver spine armor (`5` rigid plates), cobalt-and-graphite racing suit, full-face helmet with rear cyan LED strip.
   - Short exhaust canister on the **rider's right side only**.
   - 8 vehicle skins in `SKINS` (`zenith` Blue White, `vega` Red Force, `volt` Purple Shadow, `phantom` Gold Legend, `inferno` Green Emerald, `nexus` Silver Frost, `stealth` Black Stealth, `blaze` Orange Blaze) with matching `.webp` thumbnails in `src/assets/images/cars/` and `.jpg` thumbnails in `src/native/img/cars-*.jpg`.
2. **Poses & Animations**:
   - **Normal riding**: Aerodynamic forward tuck, hands locked to clip-on grips, feet on rearset pegs.
   - **Left / Right lean**: Natural motorcycle roll (`±28°`) + rider knee-out counter-lean and steering angle.
   - **Down Slide (Low Tuck beneath overhead barriers)**: Motorcycle banks nearly horizontal (`~71°`) while the rider presses chest flat to the tank and tucks head/shoulders/limbs tightly so the visual height drops cleanly beneath `PASS_L` overhead beams.
   - **Airborne / Jump / Air Dash**: Conventional two-wheel jump posture (no wings), nose-up pitch on launch, 360° barrel roll on `Jump Booster` / `Hyper Flight`.
3. **World & Track Art Direction (`src/render/Scenery.ts` & `src/gameplay/Courses.ts`)**:
   - Bright daylight floating sky cities (`LOOKS.city`), white/silver futuristic towers, floating islands with waterfalls, elevated 3-lane highways with cyan light rails, and 10 named tracks (`Sky City`, `Cloud Highway`, `Neon Night City`, `Celestial Gateway`, `Sunset Horizon`, `Floating Islands`, `Crystal Bridge`, `Waterfall Canyon`, `Storm Corridor`, `Mountain Skyway`).
4. **Bike-Themed Items**:
   - Use only bike-themed item names (`Aero Nitro`, `Aegis Shield`, `Flux Magnet`, `Jump Booster`, `HYPER FLIGHT`, `Emergency Rescue`, `Double Coin`, `Armor Core`).

### 3. Verification Checklist Before Finishing Any Task
Run all four checks and ensure 0 errors:
1. `npm run typecheck`
2. `npm test`
3. `npm run build:tiktok`
4. `npm run check:tiktok` (must report `0 FAIL`)
```
