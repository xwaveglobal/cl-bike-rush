# Progress log

Newest entry on top. Every AI session adds a short entry: what was done, what is unfinished, what's next.

---

## 2026-10-29 (chiều, 2) — Ghép hero 3D đã căn vào game, merge `feat/hero-3d-align` → `main`

- Game (web build) chạy với xe + người lái mới ở menu và trong lượt chơi Endless (kiểm tra headless: Play → bỏ qua hướng dẫn → Endless → GO).
- Bản chơi được một file: `builds/sky-bike-run-hero3d.html` (bundle bằng bun, ảnh UI nhúng base64, three 0.169 tải từ jsDelivr qua import map → cần mạng). Mô hình GLB không tải được trong bản này nên game dùng xe dựng bằng code (đúng hero 3D).
- Chưa chạy `npm test` / `build:tiktok` (npm bị chặn trong phiên cloud).

## 2026-10-29 (chiều) — Căn lệch lần 2 + ánh sáng chi tiết (branch `feat/hero-3d-align`, chưa push)

- Đo độ trùng hình bóng (IoU) với ảnh mẫu bằng `docs/hero-3d/overlay/sil.py`: trung bình 0.729 (main) → 0.790 (lần 1) → 0.803; ngang trái 0.734 → 0.881, xe ngang 0.854 → 0.916.
- Người: lưng ngắn lại (`TORSO_K` 0.82, hình thân nội suy theo), tay dài hơn (`UPPER_ARM_LEN` 0.29 / `FOREARM_LEN` 0.27) để với tới tay lái từ tư thế ngồi thẳng, lưng dày hơn, hông nâng, gác chân 0.488/0.335. Các khớp lệch ảnh mẫu ≤4 cm.
- Xe: kính chắn gió thấp/lùi thêm, mặt trên mũi thấp 2.5 cm, đuôi cao thêm ~1.4 cm, thêm ốp tối giữa yên và bánh sau.
- Ánh sáng: thấu kính đèn pha emissive 2.4 (bloom bắt), quầng sáng hướng trước ở 2 đèn, SpotLight "Headlight" rọi đường phía trước (không đổ bóng), quầng sáng đèn hậu hướng sau; cạnh vát sáng (`edgeRim`, vật liệu `bikeEdge`) chạy theo mép tấm ốp bạc chính và tấm "<".
- Tam giác: LOD0 ~72k, LOD1 ~49k; thêm ~7 mesh quầng sáng + 1 đèn. Typecheck 15 lỗi có sẵn.

## 2026-10-29 (trưa) — Chồng 3D lên ảnh mẫu để căn chỉnh (branch `feat/hero-3d-align`, chưa push)

- Render studio gần trực giao, căn theo tâm 2 bánh với ảnh mẫu (góc LEFT / BIKE SIDE), chồng 50/50 + đường viền (`docs/hero-3d/overlay/`, script `ov.py` + `probe.cjs` đo vị trí xương so với điểm mốc đo trên ảnh mẫu).
- Người lái: từ dáng nằm rạp sang ngồi sport thẳng lưng như ảnh mẫu — `BIKE_ERGO` pelvis (0.97, 0.425), gác chân (0.47, 0.32); pelvisPitch −0.15, spineFlex −0.13; đùi 0.34 m / cẳng chân 0.41 m (`THIGH_LEN`/`SHIN_LEN`, hình chân được nội suy theo); lưng dày hơn; mũ phóng 1.08 (`HELMET_SCALE`); `RIDER_SCALE` (=1) để chỉnh cỡ người nếu cần.
- Độ lệch khớp so với ảnh mẫu (góc ngang trái): trước 10–32 cm, sau ≤5 cm.
- Xe: kính chắn gió dựng dốc, đỉnh lùi ~6 cm. Mũi xe vẫn dài hơn ảnh mẫu ~5–10 cm (chưa sửa).

## 2026-10-29 (sáng) — Chốt hero 3D: cổ + mũ giống thật, merge vào `main`

- Mũ: mép dưới vỏ theo dáng mũ thật (sâu ở quai hàm/cằm, vồng lên ở tai, xuống lại ở gáy) thay cho mặt cắt tròn phẳng; tỉ lệ dài hơn (≈23×25×30 cm); kính lớn hơn; viền cao su cuộn theo mép dưới + lớp lót tối đóng kín đáy (không còn nhìn xuyên vỏ); lẫy mở kính.
- Cổ: thon và ngắn lại, nằm gọn trong mũ; cổ áo đen với một đường viền xanh mảnh (bỏ dải xanh to trông như vòng tròn quanh cổ).
- Tam giác: LOD0 ~71k, LOD1 ~48k, LOD2 ~34k. Typecheck 15 lỗi có sẵn.
- Bảo mật: repo public nên SDK key HS (`sk_live_…`) đã được gỡ khỏi toàn bộ lịch sử chưa push (`src/native/hs.ts`, `tiktok/game.js` dùng chỗ trống `__HS_SDK_KEY__`). `npm run build:tiktok` tự chèn key từ biến môi trường `HS_SDK_KEY` hoặc file `hs.local.json` (đã git-ignore). Không commit `tiktok/game.js` có key thật.
- Nhánh: `feat/hero-3d` merge vào `main`; `run-old` tạo từ `main` trước khi merge (bản Sky Bike Run preview / Comic Speed) để phát triển tiếp thành game.

## 2026-10-29 — Trau chuốt hero 3D để đưa vào game (branch `feat/hero-3d`)

- Texture mũ và atlas bộ đồ chuyển sang `THREE.DataTexture` (mảng byte thuần), không còn dùng `createImageData/putImageData` của canvas 2D → chạy được cả bản web lẫn bản TikTok native (canvas của adapter có thể không có ImageData).
- Nướng atlas nhanh hơn: mỗi texel chỉ 1 lần tính điểm bề mặt (pháp tuyến lấy từ điểm lân cận), mã màu sRGB tính sẵn theo màu, bỏ `Math.pow` khi tiết diện là ellipse, mũ dùng bảng cos/sin. Mật độ atlas 480 px/m. Dựng người lái lần đầu (gồm nướng texture) ~220 ms trên desktop, các lần sau ~25 ms.
- Mũ: dải bạc nhìn ngang cong theo spline (dốc từ cằm, vòng qua tai, rủ xuống ở đuôi), đuôi gió thấp và tối hơn, gân bạc mảnh lại.
- Người: hông/mông gọn hơn, khuỷu tay khép xuống, thêm tấm bạc ở mông (không còn một khối đen khi nhìn từ camera game), bỏ đường may chữ thập ở mông.
- Kiểm tra ở góc camera game (LOD1) các tư thế chạy thẳng / cúi / nghiêng. Tam giác không đổi: LOD0 ~70k, LOD1 ~47k, LOD2 ~33k. Typecheck 15 lỗi có sẵn.
- Chưa làm: npm test / build TikTok trong phiên cloud (npm bị chặn) → cần chạy `npm run typecheck && npm test && npm run build:tiktok && npm run check:tiktok` trên máy trước khi merge.

## 2026-10-27 — Mũ bảo hiểm chi tiết + livery bộ đồ nướng texture (branch `feat/hero-3d`)

- `src/render/RiderHelmet.ts` (mới): mũ full-face riêng, gắn cứng vào xương Head. Vỏ có cằm nhô ra, livery vẽ theo từng texel trong không gian 3D (không lỗi đường nối): mảng bạc trán rộng hẹp dần ra sau có viền xanh, đường V xanh, swoosh bạc lớn từ cằm lên đuôi, viền xanh quanh kính, mảng xanh sau dưới. Kính là khối dày riêng (cạnh cong), viền bạc trên, đèn cyan giữa trán + 2 vạch góc kính, 2 thanh cyan sau gáy, chốt kính nhỏ, đuôi gió bám theo vỏ, khe gió trên/cằm, đệm cổ. Mọi chi tiết gắn lên vỏ dùng `shellBlock` (khối bám mặt cầu đã biến dạng) nên không còn lơ lửng.
- Sửa lỗi: UV v của vỏ cắt ở theta 2.42 chứ không phải π → hoạ tiết trước đây bị lệch lên trên.
- Đầu nhìn thẳng đường hơn (pitch ≈ +1° thay vì −7°), low tuck bớt gập.
- `RiderHuman.ts`: các phần loft của bộ đồ (thân, tay, chân, găng, ống giày) được nướng vào atlas 1024² (màu + roughness/metalness) từ chính painter → nét sắc thay cho bậc thang vertex color. Lưng theo crop 22: tấm V bạc, dải xanh xiên ở sườn, tấm thận bạc, đường may.
- Tam giác: LOD0 ~70k, LOD1 ~47k, LOD2 ~33k. Typecheck vẫn 15 lỗi có sẵn.
- Tiếp theo: dáng/tỉ lệ người (vai, lưng cong), swoosh mũ cong hơn ở nhìn ngang.

## 2026-10-26 (chiều) — Người lái bớt cứng (branch `feat/hero-3d`)

**Done**: `RiderHuman.ts`: mũ thu 88% và hạ sát vai, hông/mông/đùi thon lại, lưng trên tròn + cổ/vai đầy hơn, giáp ép dẹt thành tấm (bỏ "quả cầu"), giảm độ bóng giáp, lưới thân dày hơn để mảng màu sắc nét; phối màu: tay áo đen, chữ V bạc hẹp sau lưng. `BikeRiderAsset.ts`: khuỷu tay mở ra ngoài, ngồi nhích lên + rạp thêm cho khuỷu gập; chuyển động phụ (thở, rung theo đường, đầu khẽ đảo nhìn đường, nghiêng người vào cua, đầu giữ ngang chân trời). Ảnh: `docs/hero-3d/master/rider-before-after.jpg`.

**Next**: kiểm tra trên điện thoại; skin đổi màu thật.

---

## 2026-10-26 — Hero 3D theo master prompt (branch `feat/hero-3d`)

**Done**: Thân xe dựng lại theo số đo trên ảnh mẫu (`BikeBody.ts`): mũi cao ngắn, kính cao, ốp nhiều tấm có độ dày (`sidePlate`), bình xăng có đệm gối, yên ~0.85 m, đuôi mảnh "mỏ vịt", đèn pha tam giác + DRL + hốc tối, đèn hậu chữ V + chấm đỏ, vành 10 chấu, heo đỏ, gắp hộp, chắn bùn sau, ống xả tròn bên phải, phuộc sau. `BIKE_ERGO` dùng chung cho IK (tay lái 0.925 m lùi sau, gác chân z 0.26, ngồi y 0.95). Người lái ngồi nghiêng ~50° như mẫu, mũ có cạnh + kính lớn. LOD 0/1/2 (60k/41k/29k), game dùng LOD 1. Viewer: nút LOD, camera theo xe khi nhảy, chế độ studio. Tài liệu + checklist: `docs/hero-3d/master/`.

**Unfinished**: ốp còn ít tầng gấp hơn mẫu; giáp ngực/lưng mới vẽ màu; chưa có texture carbon.

**Next**: skin đổi màu thật; kiểm tra trên điện thoại (TikTok build) với LOD 1.

---

## 2026-10-25 (tối) — Hero 3D bản chi tiết (branch `feat/hero-3d`)

**Done**: `BikeBody.ts` thêm chi tiết cơ khí (máy lộ sau ốp, 4 cổ pô, ống xả vát cạnh, đĩa khoan lỗ, heo dầu, nhông có răng, xích ôm nhông, lốp gân, phuộc sau lò xo, két nước, hốc đèn pha + DRL, xi-nhan gương, ốp trong đen; ốp sườn thu ngắn để lộ máy như ảnh mẫu). `RiderHuman.ts` thêm giáp nhiều lớp + mũ thon có khe gió. ~68k tam giác. Typecheck: không thêm lỗi.

**Next**: skin đổi màu thật; LOD cho máy yếu; cân nhắc .glb nếu cần đúng 100% ảnh mẫu.

---

## 2026-10-25 — Hero 3D: người lái liền khối, thân xe theo ảnh mẫu, cạnh gấp (branch `feat/hero-3d`)

**Done**:
- `src/render/RiderHuman.ts` (mới): người lái liền khối, da uốn mềm qua khớp, phối màu theo ảnh mẫu; khung xương 18 xương + IK giữ nguyên.
- `src/render/BikeBody.ts` (mới): xe supersport theo `docs/hero-3d/reference-sheet.jpg` — ốp có cạnh gấp (polygon section + creased normals), livery canvas atlas chiếu ngang, phuộc vàng, 2 đĩa trước, vành 5 chấu chữ Y viền xanh, ống xả ngắn bên phải, đuôi vút với đèn hậu chữ V.
- `src/render/BikeRiderAsset.ts`: vật liệu mới, gọi BikeBody + RiderHuman (bản cũ giữ lại dạng export), tư thế rạp hơn, cổ/đầu tự cân → LowTuck/DownSlide không còn chìm đầu.
- `src/render/Vehicle.ts`: dời điểm phát hiệu ứng (đèn hậu, ống xả) theo thân xe mới.
- `tools/hero-viewer/` + `builds/hero-viewer.html`: trang xem 3D; `docs/HERO-3D.md` + ảnh so sánh `docs/hero-3d/`.

**Unfinished**: màu xe trong garage chưa đổi màu mô hình; chi tiết ốp/máy/mũ còn kém ảnh mẫu.

**Next**: skin đổi màu thật; thêm tầng gấp ốp + chi tiết máy; tối ưu tam giác (~47k).

---

## 2026-10-24 — SKY BIKE RUN Complete Visual Production Package (`v7.0`)

**Done**:
- **Branding, App Icons, Main Logo & 9:16 Loading Art**: Extracted and built the complete **SKY BIKE RUN** ("Ride Beyond Limits") icon suite (`public/icons/icon-1024.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`, `src/assets/images/app-icon.webp`, `src/native/img/app-icon.jpg`), main logo (`src/assets/images/sky-roadster-logo.webp`, `src/native/img/sky-roadster-logo.png`), and 9:16 key-art loading screen (`src/assets/images/loading.jpg`). Updated `index.html`, `metadata.json`, and `public/manifest.webmanifest`.
- **8 Sportbike Color Variants (`SKINS`)**: Updated `src/render/Vehicle.ts` and `src/ui/shared.ts` with all 8 SKY BIKE RUN color variants (`Blue White` (`zenith`), `Red Force` (`vega`), `Purple Shadow` (`volt`), `Gold Legend` (`phantom`), `Green Emerald` (`inferno`), `Silver Frost` (`nexus`), `Black Stealth` (`stealth`), `Orange Blaze` (`blaze`)) and generated matching `.webp` + `.jpg` hero thumbnails (`src/assets/images/cars/*.webp`, `src/native/img/cars-*.jpg`, `src/assets/images/car/x1-back.webp`, `src/native/img/car-x1-back.png`, `src/assets/images/car/vega-back.webp`, `src/native/img/car-vega-back.png`).
- **World Art Direction & 10 Track Environments**: Updated `LOOKS.city` and `buildCity` in `src/render/Scenery.ts` to a bright daylight floating sky city with white/silver futuristic architecture and cyan light trails (`0x2ef2ff`), updated track thumbnails (`src/assets/images/tracks/*.jpg`) and tutorial guide cards (`src/assets/images/guide/guide-{1,2,3}.jpg`), and aligned track names across `src/gameplay/Courses.ts` and `src/Game.ts` (`Sky City`, `Cloud Highway`, `Neon Night City`, `Celestial Gateway`, `Sunset Horizon`, `Floating Islands`, `Crystal Bridge`, `Waterfall Canyon`, `Storm Corridor`, `Mountain Skyway`).
- **Bike-Themed Items & Specials**: Updated item names and descriptions across `src/meta/Daily.ts`, `src/ui/UI.ts`, `src/native/ui/consts.ts`, and `src/Game.ts` (`Aero Nitro`, `Aegis Shield`, `Flux Magnet`, `Jump Booster`, `HYPER FLIGHT`, `Emergency Rescue`, `Double Coin`, `Armor Core`), and updated `carSvg` & `CAR_LINE` to a sportbike silhouette.
- **Asset Handoff Package & Claude Implementation Prompt**: Added `docs/SKY-BIKE-RUN-PRODUCTION-PACKAGE.md`, `docs/CLAUDE-IMPLEMENTATION-PROMPT.md`, and updated `asset_manifest.json`.
- **GitHub Push Compatibility**: Removed binary `.glb`/`.zip` files so AI Studio's GitHub Push tool serializes all repository files cleanly without `Request contains an invalid argument`.

---

## 2026-10-24 — v7.0 (branch `7.0`) & new repository `g-bike-rush` — 3D Futuristic Motorcycle & Rider

**Done**:
- Disconnected from the old `sky-roadster` repository and pointed `origin` + `SkyRoadster-Dev.bat` + `AGENTS.md` to the new repository: `https://github.com/xwaveglobal/g-bike-rush`.
- Restored `main-back` (`v3.0.11` flying-car build) back to `main`, and split the 3D Futuristic Motorcycle & Rider version into branch **`7.0`** (**v7.0**, `src/Game.ts`, `package.json`, `README.md`, `AGENTS.md`).
- Rebuilt the main player vehicle visual representation as a complete 3D Futuristic Motorcycle with Articulated Rider (`src/render/BikeRiderAsset.ts`, `src/render/Vehicle.ts`, `src/assets/manifest.ts`) based on the 7 reference images, while keeping all gameplay, hitboxes, controls, camera, obstacles, UI, and audio untouched.

---

## 2026-10-23 — AI Studio dev server port migration

**Done**: Updated Vite dev server configuration (`vite.config.ts` and `package.json`) to bind `0.0.0.0:3000`, added `metadata.json` and OpenGraph metadata in `index.html`, and removed `bun.lock` for npm compatibility.

---

## 2026-10-23 — v3.0.11

**Done**: owner's addendum (reward button visibility + auto layout + Reward Claimed!) — `src/meta/Perks.ts` (pure), `hs.perkState()/perkVisible()`, home rail in `screens.ts` (railY glide), `NativeUI.rewardClaimed`, `main.ts` given → notice, popup tap guards, web `UI.perkBadges` + CSS. Revive ad fix (`Game.continueByAd` freezes the countdown; `popups.ts continueOv` canShowAd), ad waits capped (`Ads.ts capped`). Android launch: renderer context fallback (`Renderer.makeRenderer`), MSAA 2× on Android. In-game log `src/native/log.ts` (corner 5 taps / Settings diag / boot error screen).

**Note**: the addendum refers to "previous" Android-launch / notification task texts this session never received — implemented from the addendum itself. vConsole: TikTok only shows it for a debug build opened from the developer tool; on some Android versions it does not open — the in-game log covers that.

**Next**: owner tests on Android + iPhone: reward buttons after claiming, Revive ad, offline start.

---

## 2026-10-23 — v3.0.10

**Done**: Training button in the track page header (`screens.ts tracks`, `UI.ts head`), card alignment, home chip flag removed. First Play → `openTutorialIntro` while `tutorialDone` is false (unchanged, verified in the sim).

---

## 2026-10-22 — v3.0.9

**Done**: Android jank (owner: home + race start) → compile hidden pooled meshes at load (Game.ts), `platform.android` + `scaleCap 1.5`, home UI redraw throttle (NativeUI.frame), audio baking sliced (Audio.ts). SVG flags `src/meta/Flags.ts` used by native gfx.rich (emoji → SVG) and pickers. Rank guide rows wrap (popups.ts rankguideOv).

**Next**: web UI still shows emoji flags (fine on iOS/macOS, letters on Windows) — could switch to `flagSvg` too.

---

## 2026-10-22 — v3.0.8

**Done**: `layout.ts capRow()/belowCap()` + capsule rect in `SAFE` (main.ts) → first row beside the capsule (home, pageHead, HUD). Native shop rewritten (`screens.ts shop`): Remove Ads, free coins, pack tiles. New products in `tiktok.hs-dashboard.json` (owner must paste into the HS dashboard — the game reads products from there). `ITEM_PRICE` specials raised. Shield 2 hits, timer ×0.7 (`SHIELD` in config). Owner confirmed sound OK on iPhone.

**Note**: HS reports `has('shop')` off on Android → the shop shows "open soon" there; packs appear where HS enables the shop.

---

## 2026-10-22 — v3.0.7

**Done**: Android now loads (v3.0.6 regex fix confirmed by owner screenshot). Top inset fix in `src/native/main.ts measureSafe()` (px → layout units, clamps) + smaller offsets in `screens.ts` (home, pageHead) and `hud.ts`.

**Next**: owner checks the top spacing on Android + iPhone, and the sound on iPhone.

---

## 2026-10-22 — v3.0.6

**Done**: Android load failure found from the owner's screenshot — `/[^\p{L}\p{N} _.\-]/u` in `Game.setName` is a SyntaxError on the Android engine → `cleanName()` without `\p{}`; build guard in `scripts/build-tiktok.mjs` rejects post-ES2017 regex features. Baked audio for native (`Audio.ts`: `baked`, `bakeSfx`, `bakeLoopAsync`, synth helpers at the end of the file) to stop the iPhone crackle. Bonus: every 1 h, open 30 min, random place per opening (`meta/Bonus.ts` `themeIdx`), replayable (Game.startBonus / retry); tests in `tests/bonus.test.ts`.

**Next**: owner tests v3.0.6 on the two Android phones and the iPhone (sound). If Android shows another engine error, the boot error screen prints it.

---

## 2026-10-22 — v3.0.5

**Done**: HUD coin card (race + total) and cleaner score box (`hud.ts`); Audio compat layer + resume (`src/audio/Audio.ts`, `main.ts`); Colour row removed (auto calibration kept, diag = tap version ×5); `src/ui/shared.ts` so the native bundle skips UI.ts and its images.

**Android 1007 ERROR_CANNOT_OPEN_MINIS**: shown by TikTok before the game loads (FPS 0 on the debug panel), same zip works on iPhone → not the game code. TikTok's troubleshooting page: the scanning account must be a test user, in the same region; latest package uploaded. Owner to check tester list / account region on the Android phones.

---

## 2026-10-22 — v3.0.4: colour calibration + Android "Couldn't open TikTok Minis"

**Owner report**: iPhone still washed out (menus much worse than home); 2 Android phones show "Couldn't open TikTok Minis".

**Colour**: the v3.0.3 alpha theory did not fix it. Dark navy → slate grey everywhere points at an extra sRGB encode (screen surface) or sRGB textures not decoded. `src/native/color.ts` measures both at start (render target + screen readback of a 50 % grey) and fixes only what it finds; Settings → Colour lets the owner force Normal / Screen fix / Texture fix and shows `out` / `tex` readings (browser: 55 / 55). UI quad = RawShaderMaterial copying the canvas raw (decode only when the screen encodes).

**Android**: removed `tiktok/package.json` (tools now run on a temp copy), ES2017 downlevel of game.js via TypeScript (build script), `put()` for read-only runtime globals, boot error screen. Also to check on the owner side: the Android TikTok accounts must be testers of the app in the TikTok developer portal, TikTok app up to date.

**Next**: owner sends a Settings screenshot from the iPhone (the colour line) → confirms which fix applied.

---

## 2026-10-22 — v3.0.3: native fidelity (owner screenshots: H5 vs TikTok native)

**Cause of the faded look**: the canvas UI quad blended its alpha into the framebuffer (and post passes can leave alpha < 1); TikTok composites the game canvas with alpha, so the page showed through everything. Fix in `src/native/main.ts`: UI material keeps destination alpha (CustomBlending, alpha Zero/One) + `opaque()` clears alpha to 1 after the UI pass.

**HUD** (`src/native/ui/hud.ts`) redrawn to the H5 layout; `shieldBadge()`; pause menu sizes up (`popups.ts`). Capsule safe area re-measured at 0.8 s / 3 s with a fallback.

**Not verifiable here**: the alpha fix (desktop Chrome honours `alpha:false`) — check on the phone.

---

## 2026-10-22 — v3.0.2: buttons dead on the TikTok device

**Cause (reproduced)**: `Audio.unlock()` on the first tap built the Web Audio graph with chained `connect()` and `createDynamicsCompressor` — a mini-game Web Audio without them threw halfway, leaving `ctx` set but buses undefined → every `audio.play('click')` (first line of most button handlers) threw → nothing happened; the music timer threw 40×/s. Also: Three's ImageLoader waits on `addEventListener('load')`, which a runtime image may not fire → no car sprite.

**Fix**: fail-safe Audio (no chained connect, unlock/play/schedule in try/catch, off on failure); makeImage always installs its own listeners; `Gfx.guard()` per screen; touch device-pixel guard; handler errors toast once.

**Test rig** (scratch, not in repo): Chromium Web Worker = TikTok-like runtime (no window/document), OffscreenCanvas screen, strict tt (partial Web Audio, onload-only images), touches forwarded from the page. Flow home → settings → garage → play → tracks → special → countdown all respond.

---

## 2026-10-22 — v3.0.1 release package

**Done**: HS Game ID = TikTok App ID `7698594517263403028` (in `src/native/hs.ts` and `tiktok/project.config.json`), SDK key set, real TikTok ad unit ids for the 5 places in `tiktok.hs-dashboard.json`. `npm run check:tiktok` → 0 fail, 0 warn. `npm run pack:tiktok` → `tiktok-tiktok.zip` (git-ignored).

**Next**: paste `tiktok.hs-dashboard.json` (iaa_config → Ads Config raw JSON, products → Products import) in the HS dashboard; upload the zip; test on a phone (WebGL 2, ads, Beans shop).

---

## 2026-10-22 — v3.0.1

**Done**: pause never times out (Game.tick: `paused` no longer shares the `continue` 7 s countdown → it used to end the race); ad places renamed `rw_revive` / `rw_end_bonus` / `rw_free_coins` / `rw_head_start` (rewarded) and `int_race_end` (interstitial) in `src/native/hs.ts` + `tiktok.hs-dashboard.json`; home right rail always has Share / Entry / Launch (live where `HSGame.has`, else a tap explains; claimed = ✓); web preview takes keyboard focus on tap (the HS web shim cancels pointerdown, so arrows/WASD did nothing in a frame).

---

## 2026-10-22 — v3.0.0: native TikTok mini game (main) · v2 kept on branch `v2`

**Owner asked**: release as a native game for TikTok Minis with the HS SDK kit (hs-sdk 1.1.2); "clone thành native version 3.0, giữ bản 2.0 ở GitHub, 3.0 làm main". HS answers: SAVE local · no Game ID / SDK key yet · shop + ads at revive / end bonus / free coins / head start · no sign-in button.

**Done**
- `v2` branch = v2.3.0 (untouched). `main` = v3.
- `src/native/`: `adapter.ts` (window/document/localStorage/Image/AudioContext over `tt`, first `tt.createCanvas()` = screen), `hs.ts` (HSGame.profile local + DEFAULTS + literal showAd / share / tiktokMission / shop / buy), `save.ts` (SaveData → profile; wallet / super / hyper / escape / noAds are accessors on profile fields; other data via `src/core/kv.ts` → profile `kv`), `main.ts` (Game on the screen canvas, canvas UI layer via `Renderer.uiPass`, tt touch → UI first, else `Input.touchBegin/Move/End`, HS pause/resume/given), `text.ts` (name entry via tt.showModal editable).
- Canvas UI (`src/native/ui/`): `gfx.ts` (painter, hit regions, scroll areas, rich text for the game's HTML strings, rank badges, buttons), `svg.ts` (SVG → canvas for every inline icon/avatar/art), `NativeUI.ts` (same 69-member API as the DOM UI; the build aliases `src/ui/UI.ts` to it), `screens.ts`, `popups.ts`, `hud.ts`. All screens ported.
- Hooks in shared code: `src/platform.ts`, `setAdProvider` (Ads.ts), `setSaveBackend` (Save.ts), `kv.ts`, Renderer optional canvas + `uiPass`, Input touch methods, `setLangCode` (i18n).
- `scripts/build-tiktok.mjs` (esbuild or Bun) → `tiktok/game.js` 1.27 MB + assets (folder 2.5 MB of 4 MB). `tiktok/package.json` = `{"type":"commonjs"}` so Node's hs-check loads the kit inside this ESM repo.
- `tiktok.hs-dashboard.json`: 5 ad places (placeholder ad ids), share / tiktok_profile / tiktok_shortcut rewards, items, 5 Beans products (coin packs + Remove Ads, prices = guesses to adjust).
- `npm run check:tiktok`: **0 FAIL** (warns: App ID not set, placeholder ad ids). Headless preview (hs-web build + Chromium): home, tutorial, tracks, special pick, race HUD + countdown all render and respond to taps.

**Not tested here / risks**
- Real TikTok device: Three r169 needs **WebGL 2** in the TikTok runtime; audio via `tt.createWebAudioContext`. Test on a phone with the TikTok developer tool before review.
- v2.3 cloud accounts are off in native (profile is the save). Missions / daily quests / check-in stay game-side rewards (not HS claim keys yet).

**Next**: owner gets App ID + HS Game ID / SDK key → put App ID in `tiktok/project.config.json`, keys in `src/native/hs.ts`, real ad unit ids + products in the HS dashboard, then `npm run pack:tiktok`. Possible: map daily check-in / missions to `HSGame.claim` keys so the dashboard can tune them.

---

## 2026-10-22 — v2.3.0: accounts & cloud save (owner chose "cách 2", server coming)

**Done**: `src/net/Cloud.ts` (guest token, email code, Google/Apple via server-side OAuth popup/redirect, GET/PUT /save with rev + 409 conflict, run queue), Game: `cloudSync` / `resolveCloud` / `applyCloud` (writes the cloud save then reloads) / `cloudAction` / `reportRun`; UI: Settings → Account popup, "Which progress?" chooser. Server rewritten: `server/index.mjs` + `server/core.mjs` + `schema.sql` + README (env vars, go-live). Tested end-to-end headless with a local server: device A (4,600 EXP, 7,054 coins) signs in by email → device B fresh install signs in → same progress restored.

**To go live**: host the server (HTTPS), set env (README), put the address in `CLOUD.api` (src/config.ts), rebuild. Google needs an OAuth Web client; Apple needs a Services ID + key; email needs a mail key (Resend) or another mailer in `sendCode()`.

**Next**: switch the leaderboards to the server boards when the server is live (PlayerStore already has `RemotePlayerStore`).

---

## 2026-10-22 — v2.2.8: Home = owner mock-up

**Done**: CSS block "v2.2.8 — Home exactly like the owner's mock-up" at the end of `ui.css`; stars in the speed selector, `ROCKET_W` / `CAR_LINE` icons, `.pchev` on PLAY.

---

## 2026-10-22 — v2.2.7

**Done**: removed the v2.2.5 Home button overrides (owner wants Home exactly as his 08:50 screenshot); glossy icon-button rule now skips `#start`.

---

## 2026-10-22 — v2.2.6: glossy buttons everywhere

**Done**: one CSS block at the end of `ui.css` (`#ui .screen .btn:not(.mbtn)` + `.icon-btn`) restyles every button.

---

## 2026-10-22 — v2.2.5: Home polish

**Done**: all-time #rank badge on the Home avatar (`homeSync.allRank`), glossy mini buttons, animated PLAY.

---

## 2026-10-22 — v2.2.4: owner round AA

**Done**: AA1–AA5 (see README). Root cause of the dead Retry: `#specialpick` was stacked under `#gameover` / `#pause` (same z-index, earlier in the DOM). Pause → Home now calls `gameOver()`. Difficulty: `PHASES` D/C/B and `PHASE_UNLOCK` shifted one step earlier (v1 rhythm); `COIN_LINES.endless` = v1 values. All tests pass (hard-row shares still rise phase by phase).

---

## 2026-10-22 — v2.2.3: owner round Z

**Done**: FIXLIST Z1–Z12. `World.step` eases speed; `UI.hudLevel/hudTop` + `.hnext`; `ADS.endBonus`; COIN_LINES endless 0.545 / bonus 0.5; `GIFTS.boxChance` 0.15, `boxGap` 600; Bonus power slots 240–380 m; `BONUS.finishCoins` 300.

**Speed check**: Easy / Normal / Hard = 62 / 91 / 113 km/h at the start → 124 / 184 / 228 km/h at 6 km (plus rank-phase bumps).

---

## 2026-10-22 — v2.2.2: owner round Y

**Done**: FIXLIST Y1–Y6 (see README). `Run.coin2T` (ring double coins), `Game.shareGameLink`, `carRear` for the share card, speeds Normal 1.21 / Hard 1.5 with EXP rates 0.184 / 0.19 / 0.318, Bonus special chance 0.065.

---

## 2026-10-22 — v2.2.1: hotfix

**Done**: Tutorial card opened from Home → close → Home had no buttons (it was shown alone, not over Home). Fixed in `openTutorialIntro` + close goes through `closeModal`.

---

## 2026-10-22 — v2.2.0: owner rounds H–X done

**Done**: all of `docs/FIXLIST.md` H–X (see README "v2.2.0"). New code: `meta/Career.ts` (career missions), `ui/ShareCard.ts` (share image), `render/BonusTunnels.ts`, `Spawner.setPieces / buildSetPiece / tunnels`, `World.injectRows`, `GIFTS` + `BONUS_SET` in config, `tests/bonus.test.ts`.

**Notes**: double EXP can push the run's EXP ahead of the distance-based rank gates (by design request). Base road speed still rises slowly with distance / rank phase on Endless (turbo itself now eases back to that base). Headless checks only — feel of slow-mo swing, set pieces and tunnels needs a phone test.

**Next**: owner playtest; rear renders for Volt / Phantom / Inferno / Nexus; delete dead v1 code (cups, courses, MissionTracker, upgrades, pass).

---

## 2026-10-22 — v2.1.0: owner fix list done

**Done**: everything in `docs/FIXLIST.md` (A–G) — see README "v2.1.0". New: `ENDLESS_LADDER` / `ladderAt` / `nextWorldAt` (Spawner), 7 ladder sceneries (`buildLadder` in Scenery), themed obstacle props per place (`buildThemed` / `buildLadderProp` in ObstacleViews, keyed pools), `HEARTS`, XWAVE Vega (`rear` skin field), emblem avatars, `docs/assets-inbox/` (owner's original logo + car image).

**Notes**: F1 (home buttons missing after training) could not be reproduced headless; Home now force-resets training overlays/state. Tests: `tests/phases.test.ts` also checks the 12-world order.

**Next**: owner playtest on phone; rear renders for Volt / Phantom / Inferno / Nexus; remove dead v1 code (cups, courses, MissionTracker, upgrades, pass).

---

## 2026-10-22 — v2.0.3 → v2.0.8: v2 steps 3–8 done (owner: "auto làm đủ hết")

**Done** (details in README per version):
- 3 Tracks & cars: Endless + Mega Rush (Track 2, opens at AAA, ranks S/SS/SSS) + 3 "coming soon"; cars unlock by rank only; Endless uses the chosen speed level.
- 4 Specials & coins: one special per race (popup on track tap), buy with coins, Magic Bag rules, AAA teaser specials, coin-only shop, v1 refunds (`save.v2`).
- 5 Revive by rewarded ad (max 2), interstitial after each race unless Remove Ads.
- 6 New ~60 s training on first Play.
- 7 Bonus events every 2 h (desert / forest / country / sea scenery, 30-min road with finish, coins only, auto-firing specials incl. Wall Run / Tunnel Rider / Sky Rail / Phase Ghost) — replaces cups.
- 8 Daily + Missions merged (coins), coin balance.

**Still in the code but unused** (safe to delete later): old cups (`meta/Events.ts`, events screen), 20 courses (`gameplay/Courses.ts` except the Course type), `MissionTracker`, garage upgrades, XWAVE Pass / bundle code paths.

**Notes / next**
- Owner to send rear PNGs of Volt / Phantom / Inferno / Nexus (cars are still tints of Zenith).
- Bonus obstacles still use the neon city props; themed props (rocks, logs, buoys…) would make the places feel more real.
- All checks were headless (0.5 fps); test feel on a phone: `?rank=A` etc. on localhost.

---

## 2026-10-22 — v2.0.2: v2 step 2 (difficulty phases & rank gates)

**Done**: GAME-DESIGN §8 step 2 — see README "v2.0.2". Code: `PHASES`/`PHASE_UNLOCK`/`GATE`/`phaseAt`/`rankDist` in `gameplay/Difficulty.ts`; `Spawner.zoneAt`/`phaseSpeed`/`phaseCfg` (Endless only — old courses still use `MAPS`); `World.reset(..., startDist)`; HUD gate strip `UI.gateHud`; `tests/phases.test.ts` in `npm test`.

**Notes**: tune difficulty in `PHASES` / `GATE`; if phase speeds change, re-run the calibration (tests/exp.test.ts shows the minutes) and adjust `EXP.rank`. Verified with headless autopilot only — owner should try `?rank=A` etc. on a phone.

**Next**: step 3 — tracks & cars (Endless + track 2 at AAA + 3 "coming soon"; cars unlock by rank).

---

## 2026-10-22 — v2.0.1: v2 step 1 (EXP & rank)

**Done**: GAME-DESIGN.md §8 step 1 — see README "v2.0.1". New: `EXP` config, `expFor`/`rankMinutes` in `meta/Rank.ts`, `Run.exp`, `save.expBest`/`expWeek`, `tests/exp.test.ts` (in `npm test`).

**Interim (removed in later steps)**: cups, track stars, 20 courses, upgrades, old items still exist; cups no longer give rank points. Track 2's S/SS/SSS ranks are not in `CLASSES` yet (step 3).

**Links**: v2 test build = NEW artifact https://claude.ai/artifact/ENuX27c3FrNtRSEYtkXETG (publish `builds/sky-roadster-v2.html`). The old artifact QFASRhp6EQAWvJdu7Djwxr stays v1.

**Next**: step 2 — difficulty phases by distance + rank gates.

---

## 2026-10-22 — v2 game design locked (no code yet)

**Done**: owner and Claude locked the v2 design in `docs/GAME-DESIGN.md`: EXP = skill rating (best run), D→AAA (+S/SS/SSS on track 2), Coin is the only currency (special items only), Endless + 1 AAA track, Bonus events every 2 h, revive max 2× by ads only. `ECONOMY.md` is now marked superseded.

**Branches**: `v1` = old game frozen at v1.19.1 (commit 51c08a9), still maintainable. `main` = v2 development.

**Next**: implement GAME-DESIGN.md §8 step by step (1: EXP & rank).

---

## 2026-10-21 — v1.19 / v1.19.1: speed feel + tyre rotation per owner's reference

**Done**: speed blur post pass + side streaks (v1.19); v1.19.1 = bag only in Profile, stale glow after death fixed, side walls in `Track.ts`, tread scroll synced to ground speed (`TYRE.treadTileM`), air free-spin, pitch. See README.

**Notes**: tyre/blur tuning lives in `TYRE` (config.ts). Verified only in headless 0.5 fps — get real-device feedback. Artifact: https://claude.ai/artifact/QFASRhp6EQAWvJdu7Djwxr (file `builds/sky-roadster-v1.18.html`).

---

## 2026-10-21 — v1.18: big UI/meta pass (owner's 13-point list + popup/daily/car mock-ups)

**Done**: see README "v1.18 changes". New modules: `src/ui/art.ts` (popup illustrations), `src/meta/Country.ts`, `docs/ECONOMY.md`. Car art in `src/assets/images/cars/` was cropped from the owner's line-up sheet.

**Pending / notes**
- Car-specific skills (Ion Burst, Phase Shift, Fire Trail…) are shown as "SOON". They are not implemented.
- In-race car sprite is still the X1 render, tinted per car. The owner will send high-res transparent rear renders of the 5 cars; swap them into `X1_VIEWS` / per-skin textures.
- Daily Day 4 / Day 7 in the mock-up show cars. The rewards stay items/coins (cars are class-gated); revisit if cars become daily prizes.
- Mega Gate aiming was typechecked + unit-tested, but not played through in a browser (the 0.5 fps headless run was stopped).
- The old artifact link stopped accepting updates (validator false positive), so v1.18 was published as a NEW artifact: https://claude.ai/artifact/QFASRhp6EQAWvJdu7Djwxr. Update that one from now on.
- Emoji flags render as letters on Windows Chrome (OS limitation).

---

## 2026-10-21 — v1.17: ROADSTER button, leftover points, wheel speed

**Done**
- Training: early ROADSTER tap → nudge + toast instead of silent ignore (`Game.useRocket`, `UI.rocketWait`).
- ROADSTER button glows + "TAP!" when the danger hint says a jump is needed (`UI.danger` → `.ready`), same look as the training `.call` state.
- Bug fix: ROADSTER/SOS count badges never updated (`data-h` was missing on the badges).
- Track finish: unused Roadster/HYPER/SOS charges converted to points (`Game.cashLeftovers`, `LEFTOVER_POINTS`), and shown on the result screen.
- Tyres: per-frame capped tread step (no wagon-wheel strobing), longer blur and streaks, tyre spray particles (`TYRE` config, `Game.tyreSpray`, `Vehicle.rearTyreWorld`).
- `builds/sky-roadster-v1.17.html` (single file) replaces v1.16 and is published to the Claude artifact link.

**Notes for the next session**
- The cloud workspace has no npm registry access. Builds there use bun with three.js r169 fetched from GitHub, so they are not byte-identical to `vite build`. The owner's PC runs the real `npm run dev`.
- Wheel feel was checked only in a 0.5 fps headless browser. Get the owner's feedback on real devices and tune with `TYRE.*`.

**Next**
- (owner to fill in)

---

## 2026-10-21 — Moved to GitHub (v1.16)

**Done**
- Imported the project from a Claude chat (zip of the source + single-file HTML build).
- Verified the HTML build matches this source (both `v1.16`); kept it as `builds/sky-roadster-v1.16.html`.
- Added `AGENTS.md`, `CLAUDE.md`, this file. GitHub is used only for version control (no CI / Pages).
- Added `SkyRoadster-Dev.bat` + `scripts/dev-autopull.ps1`: owner double-clicks once on Windows; it runs `npm run dev` and pulls `main` every 20 s so localhost follows every push.
- Online test link = Claude artifact (republished from `builds/` single-file HTML on each release).

**Known gaps**
- `README.md` changelog stops at v1.14; code is at v1.16 (CSS notes mention v1.15.x changes: "+" next to coins opens Watch-Ad reward, big pickup title, collect flyers). Write the v1.15 / v1.16 changelog sections when known.
- No `package-lock.json` (the auto-pull script installs with `--no-package-lock` so a local lockfile never blocks `git pull`). If a lockfile is committed later, drop that flag.
- `package.json` name is still `xwave-flying-run` (old name). Harmless; rename if wanted.
- `server/` is a reference implementation only (JSON file storage, no auth).

**Next**
- (owner to fill in: next features / bugs)
