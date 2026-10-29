# SKY BIKE RUN — Complete Visual Production Package & Asset Handoff

**Project Title:** SKY BIKE RUN ("Ride Beyond Limits")  
**Studio:** Xwave Global (`https://github.com/xwaveglobal/g-bike-rush`)  
**Engine & Target:** Three.js 0.169 · TypeScript · Vite 5 · Mobile H5 (9:16 Portrait) & Native TikTok Mini Game (`tiktok/`)  
**Version:** `v7.0`

---

## 1. Visual Identity & Art Direction

### 1.1 Hero Vehicle & Armored Rider
The hero vehicle is a **futuristic silver, carbon-black, and electric-blue sportbike** piloted by an articulated armored rider:
- **Motorcycle Proportions & Silhouette:** Aggressive forward-cant supersport fairing, smoked aerodynamic windscreen, sculpted tank with cobalt/cyan recesses, exposed mechanical trellis frame, wide rear racing slick (`radius = 0.34`, `width = 0.31`) with single-sided swingarm, and a compact titanium-and-carbon exhaust canister mounted exclusively on the **rider's right side**.
- **Rear Signature Lighting:** Twin angular cyan LED tail blades (`#2EF2FF`) flanking the tail cowl, plus a central ruby-red brake/beacon light (`#FF2A3C`) below the tail tip.
- **Armored Rider:** Full-face aerodynamic helmet with dark visor and rear cyan LED telemetry strip (`#2EF2FF`), segmented titanium-silver spine protector (`5` rigid articulated plates attached to the upper torso), cobalt-blue and charcoal-graphite armored racing suit, carbon knee sliders, and hands/feet locked to the clip-on handlebars and rearset footpegs.

### 1.2 World Art Direction
- **Floating Sky Cities:** Elevated three-lane highways suspended above a bright daylight cloud sea.
- **Architecture:** Crisp white, pearl-silver, and glass futuristic towers (`#F4F8FF`, `#E2ECFC`, `#D0E2FA`) with cyan energy accents (`#2EF2FF`), sky bridges, floating islands with cascading waterfalls, and clean atmospheric perspective.
- **Zero Legacy Western/Desert Clutter:** All legacy Western/Cowboy vehicle and item names are replaced with futuristic sportbike terminology.

### 1.3 UI Color & Typography System
- **Primary Palette:**
  - Deep Navy Carbon (`#060B1E` – `#0C1636`)
  - Metallic Titanium Silver (`#DCE6F7` – `#F4F8FF`)
  - Electric Blue (`#1C64FF` – `#2A7BFF`)
  - Telemetry Cyan (`#2EF2FF` – `#5CEEFF`)
  - Championship Gold (`#FFC21A` – `#FFD23D`) for 3-Star ratings, Coin counters, and Mythic/Epic highlights.
- **Component States:** Every interactive button and card supports `Normal`, `Pressed` (scale `0.97`, inner cyan glow), `Selected` (2px `#2EF2FF` border + subtle outer bloom), `Disabled` (desaturated navy `#1A2238`, 45% opacity), and `Claimed` (emerald check badge `#24D64A`).

---

## 2. Production Asset Catalog (9-Stage Handoff)

### A. Vehicle & Rider Views + 8 Color Variants (`SKINS`)
Implemented in `src/render/BikeRiderAsset.ts` (procedural 3D rig + PBR textures) and `src/render/Vehicle.ts` + 2D Garage/Share renders in `src/assets/images/cars/*.webp` and `src/native/img/cars-*.jpg`:

| Skin ID | Variant Name | Rarity | Class Gate | Body Hex | Trim Hex | Glow Hex | Signature Skills | Thumbnail Asset (Web / Native) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `zenith` | **Blue White** | Common | `D` | `#EEF3FC` | `#181C26` | `#2EF2FF` | Aero Nitro · Gyro Stabilizer | `src/assets/images/cars/zenith.webp` / `src/native/img/cars-zenith.jpg` |
| `vega` | **Red Force** | Rare | `C` | `#E01E2B` | `#181A20` | `#FF3B4E` | Crimson Surge · Apex Grip | `src/assets/images/cars/vega.webp` / `src/native/img/cars-vega.jpg` |
| `volt` | **Purple Shadow** | Rare | `B` | `#7A3CFF` | `#141222` | `#B46BFF` | Ion Burst · Shockwave | `src/assets/images/cars/volt.webp` / `src/native/img/cars-volt.jpg` |
| `phantom` | **Gold Legend** | Epic | `A` | `#E5B546` | `#1D1912` | `#FFD23D` | Phase Shift · Flux Magnet | `src/assets/images/cars/phantom.webp` / `src/native/img/cars-phantom.jpg` |
| `inferno` | **Green Emerald** | Legendary | `AA` | `#24D64A` | `#141C16` | `#3DFF78` | Emerald Trail · Overdrive Rush | `src/assets/images/cars/inferno.webp` / `src/native/img/cars-inferno.jpg` |
| `nexus` | **Silver Frost** | Mythic | `AAA` | `#F4F8FF` | `#B8C4D8` | `#5CEEFF` | Sky Glide · Cryo Shield | `src/assets/images/cars/nexus.webp` / `src/native/img/cars-nexus.jpg` |
| `stealth` | **Black Stealth** | Mythic | `AAA` | `#1C202A` | `#2D3446` | `#00D8FF` | Shadow Cloak · Silent Afterburner | `src/assets/images/cars/stealth.webp` / `src/native/img/cars-stealth.jpg` |
| `blaze` | **Orange Blaze** | Mythic | `AAA` | `#FF6E1A` | `#1C1816` | `#FF9A2E` | Solar Nova · Hyper Ignition | `src/assets/images/cars/blaze.webp` / `src/native/img/cars-blaze.jpg` |

- **Rear Gameplay & Share Card Renders:**
  - `src/assets/images/car/x1-back.webp` & `src/native/img/car-x1-back.png` (Hero Blue/Silver Sportbike rear camera view)
  - `src/assets/images/car/vega-back.webp` & `src/native/img/car-vega-back.png` (Red Force Sportbike rear camera view)

---

### B. Articulated 3D Animation States (`src/render/BikeRiderAsset.ts` & `src/render/Vehicle.ts`)
All animations are driven in-place by gameplay state without root-motion drift:
1. **Idle / Garage Turntable:** Gentle suspension breathing (`sin(t * 2.2)`), subtle rider head scan.
2. **Straight Driving (`Normal`):** Forward aerodynamic tuck (`spinePitch = +0.58 rad`), high-frequency road micro-vibration, speed-linked front/rear wheel spin (`wheelAngle += dt * speed * 1.65`).
3. **Left / Right Lane Change & Corner Lean:** Spring-damped roll (`leanSpring`, up to `±28°`), rider counter-lean into the turn (`hipShiftX`, inside knee flare, inside shoulder drop, head gaze into apex), and front fork steering turn.
4. **Speed Tuck (`Boost` / `Aero Nitro`):** Rider lowers chest toward tank, elbows tuck inward, twin cyan tail thrusters flare with additive plasma plumes.
5. **Extreme Low Slide (`Down` / Dive Under Barriers):** Triggered when `player.duckTimer > 0`. The motorcycle banks nearly horizontal (`roll = -1.24 rad ≈ -71°`, lowered center of gravity `y = 0.23`) while the rider presses chest flat against the tank, drops head and shoulders, and tucks limbs tightly to clear low overhead laser beams (`passHeight = PASS_L`).
6. **Jump, Flight & Air Dash:** Conventional two-wheel airborne pose (no wings), nose-up pitch on launch, suspension extension, and 360° barrel roll on `Jump Booster` / `Hyper Flight`.
7. **Landing:** Spring-damped suspension compression (`squashG.scale.y`) and rear-tire contact shadow expansion.
8. **Collision & Emergency Rescue:** Shatter/debris burst on crash (`src/render/Shatter.ts`) and vertical thruster lift + shield dome on rescue/respawn.

---

### C. Ten Track Environments (`src/gameplay/Courses.ts` & `src/render/Scenery.ts`)
1. **Sky City (`city`)** — Bright daylight floating metropolis, white futuristic towers, sky bridges, cyan highway rails (`src/assets/images/tracks/future-city.jpg`).
2. **Cloud Highway (`cloud`)** — High-altitude highway above a sunlit cloud sea with floating sky islands (`src/assets/images/tracks/cloud-city.jpg`).
3. **Neon Night City (`tunnel`)** — Enclosed cyber-tunnel with pulsing cyan/violet light arches and laser gates (`src/assets/images/tracks/neon-tunnel.jpg`).
4. **Celestial Gateway (`space`)** — Orbital starlight highway through an asteroid & crystal belt (`src/assets/images/tracks/space-zone.jpg`).
5. **Sunset Horizon (`mega`)** — Golden-hour megacity highway with towering sky arches (`src/assets/images/tracks/mega-city.jpg`).
6. **Floating Islands (`future-city-1` / `forest`)** — Lush suspended archipelago with glowing waterfalls and sky towers.
7. **Crystal Bridge (`cloud-city-1` / `sea`)** — Translucent energy causeway spanning crystalline spires.
8. **Waterfall Canyon (`neon-tunnel-1` / `canyon`)** — Deep vertical sky gorge with cascading mist and energy rings.
9. **Storm Corridor (`space-zone-1` / `storm`)** — High-wind thunderhead highway with lightning arcs.
10. **Mountain Skyway (`mega-city-1` / `desert`)** — Alpine sky-ridge viaduct with sweeping elevation vistas.

---

### D. Obstacles & Pickups (`src/render/ObstacleViews.ts` & `src/render/PickupViews.ts`)
- **Obstacles:** Futuristic armored trucks (`traffic`), plasma road barriers (`barrier`), floating cargo containers (`crate`), overhead laser beams (`beam` / `laser`), broken bridge gaps, security energy gates (`gate`), and patrol drones (`drone`).
- **Pickups:** Rotating Gold Coins (`coin`), Energy Rings (`ring`), and glowing hexagonal Power-Up Pods.

---

### E. Bike-Themed Items & Specials (`src/meta/Daily.ts`, `src/ui/UI.ts`, `src/native/ui/consts.ts`)
| Internal Key | SKY BIKE RUN Name | Category | Function |
| :--- | :--- | :--- | :--- |
| `turbo` | **Aero Nitro** | Start / Road Boost | High-velocity afterburner burst; shatters obstacles on contact |
| `shield` | **Aegis Shield** | Start / Road Boost | Hexagonal cyan energy dome absorbing 1 collision |
| `magnet` | **Flux Magnet** | Start / Road Boost | Pulls coins from all 3 lanes toward the sportbike |
| `super` | **Jump Booster** | Magic Bag Special | High-thrust hop clearing 2 obstacle rows with a 360° aerial roll |
| `hyper` | **HYPER FLIGHT** | Magic Bag Special | Mythic 7.4 m sky flight with double aerial roll and golden trail |
| `escape` | **Emergency Rescue** | Magic Bag Special | Last-second vertical rescue lift before an unavoidable crash |
| `double` | **Double Coin** | Start / Road Boost | 2× score & EXP overdrive multiplier |
| `life` | **Armor Core** | Start Boost | Adds +1 extra heart to the rider's armor integrity (up to 4) |

---

### F. Complete Interface & Branding Assets
- **App Icons:**
  - `public/icons/icon-1024.png` (`1024×1024` PNG)
  - `public/icons/icon-512.png` & `public/icons/icon-maskable-512.png` (`512×512` PNG)
  - `public/icons/icon-192.png` (`192×192` PNG)
  - `public/icons/apple-touch-icon.png` (`180×180` PNG)
  - `public/icons/favicon-32.png` (`32×32` PNG)
  - `src/assets/images/app-icon.webp` & `src/native/img/app-icon.jpg` (`256×256`)
- **Main Logo:** `src/assets/images/sky-roadster-logo.webp` & `src/native/img/sky-roadster-logo.png` (`800×213` transparent PNG/WebP — `SKY BIKE RUN`)
- **Loading Screen (9:16):** `src/assets/images/loading.jpg` (`720×1280` vertical key art — `SKY BIKE RUN · RIDE BEYOND LIMITS`)
- **Tutorial / Guide Cards:** `src/assets/images/guide/guide-{1,2,3}.jpg` (`240×240` sportbike action cards: Corner Lean, Extreme Down Slide, Airborne Jump)

---

### G. Bonus Run (`src/meta/Bonus.ts` & `src/Game.ts`)
- **Active Gameplay:** Coin-rich sky highway event with countdown timer HUD, automatic special showcase triggers (`Phase Ghost`, `Wall Run`, `Sky Rail`, `Tunnel Rider`), and end-of-run reward confirmation modal.
- **Economy & Eligibility Safeguards:** Preserves server-verified EXP/coin settlement (`server/core.mjs`) and rank-gate eligibility.
