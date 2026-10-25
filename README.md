# Sky Roadster

Sky Roadster (formerly "XWAVE Flying Run") is a high-speed 3D endless runner. Pilot the XWAVE flying car through a neon sky-city: swipe left or right to switch lanes, up to fly over barriers, down to dive under beams. Collect energy coins, grab shields, magnets and turbo boosts, and chain near misses for combo points. Race five tracks from Future City to the XWAVE Megacity, or go Endless and chase your best score.

**Stack:** Three.js r169 · TypeScript · Vite · WebGL · zero runtime CDNs (every model, texture and sound is generated procedurally and can be swapped for real files).

---

## v3 — native TikTok mini game (main)

From v3.0 the game ships as a **native TikTok mini game** (TikTok Minis). The v2 web game is kept on the GitHub branch `v2` (v1 on `v1`).

```bash
npm run build:tiktok    # src/native/main.ts → tiktok/game.js + tiktok/assets/ (the folder you upload)
npm run check:tiktok    # HS SDK check (must say 0 FAIL)
npm run preview:tiktok  # the native game in a phone frame on your desktop (http://127.0.0.1:8090)
npm run pack:tiktok     # tiktok-tiktok.zip to upload (App ID in tiktok/project.config.json)
```

- `tiktok/` = the game folder TikTok receives: `game.js`, `game.json`, `project.config.json`, `hs-game.js`, `hs-sdk.min.js`, `assets/`. Never put keys, keystores, `.env` files or the HS kit in it.
- `hs-sdk/` = the HS SDK kit (kept OUTSIDE the game folder). `tiktok.hs-dashboard.json` (next to the folder) = what to paste into the HS dashboard: ad places, rewards, items, products (TikTok Beans).
- How it works: `src/native/adapter.ts` gives Three.js a `window` / `document` over the `tt` runtime; the 3D game (`src/Game.ts`, unchanged logic) draws on the runtime's screen canvas; the UI is redrawn on a 2D canvas (`src/native/ui/*`, same API as the DOM UI, swapped in by the build) and shown on top of the 3D view; the game's inline SVG icons are drawn by a small SVG→canvas renderer.
- Progress lives in ONE `HSGame.profile` (device save): `coins`, `super`, `hyper`, `escape`, `no_ads` are profile fields (rewards and purchases land in them directly), the rest of the save is the `game` field.
- Ads — rewarded places (`rw_`): `rw_revive` (revive after a crash), `rw_end_bonus` (+20% coins on the result screen), `rw_free_coins` (free coins popup / + on the wallet), `rw_head_start` (start boost); interstitial place (`int_`): `int_race_end` (when leaving the result screen). Ad buttons are drawn only while `HSGame.canShowAd(place)` is true; with nothing in the dashboard the game simply has no ads.
- Entry Reward / Launch Reward / Share (TikTok review) are on the home screen's right rail, only where `HSGame.has(...)` says so.
- Credentials: `GAME_ID` / `SDK_KEY` in `src/native/hs.ts` (empty = the game plays offline). Never write the TikTok Client Secret anywhere.

`npm run dev` still runs the web build (DOM UI) for quick gameplay work.

## Quick start (web build)

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN; open it on your phone)
```

Production build:

```bash
npm run build        # typecheck + dist/ (static files, host anywhere)
npm run preview      # serve dist/ locally
npm run build:single # dist/index.html with everything inlined (one shareable file)
```

No Vite? `node scripts/build-esbuild.mjs [--single]` builds with esbuild alone (output in `dist-esbuild/`).

Tests:

```bash
npm run test:fairness   # obstacle fairness + movement state-machine tests (Node 22+)
npm run typecheck
```

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Move one lane left / right | swipe ← / → | ← / → or A / D |
| **Fly up** (clear low obstacles) | swipe ↑ | ↑ / W / Space |
| **Fly down** (pass under beams) | swipe ↓ | ↓ / S |
| **Air Dash** (with charges, while airborne): cross 2 lanes with a flip | swipe ← / → in the air | ← / → in the air |
| **Sky Escape** (emergency item) | SOS button | E / Enter |
| Pause | ⏸ button | Esc / P |

Swipes fire the moment your finger passes the threshold (not on release), and one drag can chain gestures (e.g. left, then up).

URL flags: `?debug` (FPS, draw calls, state readout, hitbox wireframes) · `?autopilot` (bot plays; good for demos and soak tests) · `?manual` (time only advances through `window.__xwave.advance(s)`, used by automated browser tests) · `?noauto` (disable automatic quality downgrade).

## Gameplay

- **3 lanes × 3 heights** (LOW / NORMAL / HIGH). Lane changes are allowed at any height.
- **Fly up:** anticipation dip → launch (wings deploy, thrusters swing straight down, engines flare, blue plasma column) → hold → smooth descent.
- **Fly down:** small hop → drop and compress, thrusters tuck back and turn orange → hold → spring back up.
- **Interruption rules:** UP while high extends the hold; DOWN while high is a fast dive (and vice-versa); a second lane swipe mid-slide retargets immediately; inputs during an anticipation are buffered (160 ms).
- **Scoring:** distance, coins, near misses (+50), ring fly-throughs (+100), dodges, combo multiplier (+0.5× every 10 dodges, up to 4×), missions.
- **Speed** ramps from 76 to 166 km/h over distance; obstacle density and pattern complexity rise with it.
- **Worlds** change every 1,000 m through a glowing portal: Future City → Neon Tunnel → Cloud City → Space Zone → XWAVE Megacity → loop.

### Speed levels (home screen)

| Level | For | Speed | Obstacle spacing | Score |
|---|---|---|---|---|
| EASY | new players | ×0.78 (≈ 59–129 km/h) | +20 % | ×0.8 |
| NORMAL | regular players | ×1 (≈ 76–166 km/h) | — | ×1 |
| HARD | experts | ×1.18 (≈ 89–195 km/h) | −8 % | ×1.3 |

Every level passes the same fairness test (no unavoidable patterns). The choice is saved and applies to Endless and every track.

### How the car moves

- **On the road** the four pods stand up as wheels and roll with the speed: the car drives like a car, with a light road vibration and no thruster flames or air columns.
- **Lane changes:** one swipe = exactly one lane. A swipe during a slide is queued and runs once the car has settled, so it never stops between lanes. One touch = one gesture.
- **Wheels:** chrome five-twin-spoke rims with a blue light ring, treaded tyres and a motion-blur disc that fades in with speed.
- **Fly up = one hop:** only possible with the wheels on the road. The pods flip into thrusters and blow air *upward* around the car, it rises, hovers for one beat and lands by itself. UP while airborne is ignored and there is a 0.12 s rest after landing, so spamming UP can't keep the car flying (tested: max 0.97 s airborne under constant spam).
- **Landing:** the pods turn back into wheels and vent smoke and air that rolls out along the road, with an air-release sound.
- **Fly down:** the wheels tuck into the body and the car drops onto its belly, throwing a few sparks.

### First-run training

The first PLAY opens **Pilot Training**: an intro card explaining the moves, then a short scripted practice road. Before each obstacle the game slows almost to a stop and shows an animated swipe prompt (6 steps: left, right, up, down, grab the rocket, Roadster Jump over two walls); only the right gesture continues. The player can't crash, and the result is saved. Settings → *How to play* replays it.

**Advanced training** (same screen, 5 world tiles): a guided tour of every obstacle used in that world — e.g. Neon Tunnel: barrier, low lasers, beam, high lasers, ring, laser wall; Megacity: traffic, mega gate, high lasers, triple wall, laser wall, beam. Each obstacle gets its own slowed-down prompt and explanation. Lessons: `WORLD_LESSONS` in `src/gameplay/Tutorial.ts`.

**Danger arrows** (Settings, on by default): ~0.85 s before an unavoidable hit, a big arrow shows the move that saves you (stay-in-lane moves first: ↓ or ↑, else the open lane; "TAP SOS" when only the Sky Escape can help).

### Game modes

**PLAY** opens the track select screen:

| Track | World | Length | Sections |
|---|---|---|---|
| ∞ Endless | all 5, rotating every 1,000 m | no finish | — |
| 1 Future City | Future City | 3,200 m | Start Area → City Highway → Obstacle Zone → Ring Tunnel → Sky Bridge → Laser Gate → Jump Section → Mega Structure → Final Sprint |
| 2 Neon Tunnel | Neon Tunnel | 2,400 m | Tunnel Entry → Laser Corridor → Ring Run → Overdrive |
| 3 Cloud City | Cloud City | 2,800 m | Cloud Gate → Floating Platforms → Sky Bridges → Drone Swarm |
| 4 Space Zone | Space Zone | 3,000 m | Launch → Asteroid Belt → Orbital Highway → Meteor Storm |
| 5 XWAVE Megacity | XWAVE Megacity | 3,600 m | HQ Approach → Rush Hour → Security Gates → Tower Run → XWAVE Finale |

Tracks run between a START and a FINISH gate. Each section changes the obstacle mix (e.g. Laser Gate = mostly laser gates), later tracks start faster and denser, and the HUD shows section name and progress. Finishing awards up to 3 stars (finish · no lives lost · coin target) and a coin reward; best stars and scores are saved per track. Track definitions live in `src/gameplay/Courses.ts` — add a track by adding an entry. All tracks are open from the start.

### Obstacles

Every obstacle has a bright outline/glow. **Moving obstacles get road guides**: oncoming traffic paints red chevrons in its lane; sweeping drones/platforms paint an amber ⇄ zone with a floating "⇠ ⇢" sign; a **green arrow** marks each lane that is open at driving height (`src/render/Guides.ts`). The hunter drone was rebuilt at hitbox size with a red warning ring, searchlight and a red spot on the road under it.

| Obstacle | How to pass |
|---|---|
| Cargo crate | change lane or fly up |
| Energy barrier | fly up |
| Overhead beam | fly down |
| Drone (sweeps 2 lanes) | change lane or fly up |
| Laser gate (per lane: low / high / full / open) | right lane or right height |
| Flying traffic (oncoming) | change lane |
| Energy ring | fly through the centre (not HIGH): bonus |
| Moving platform (slides 2 lanes) | timing, or fly up |
| Asteroid (Space Zone) | change lane |
| Mechanical gate (one open door) | be in the door lane, not HIGH |

### Power-ups

Energy Coin · **Shield** (absorbs one hit) · **Magnet** (pulls coins) · **Turbo Boost** (×1.55 speed, smashes obstacles, grace period after) · **Double Score** · **Extra Life** (respawn instead of game over, max 3). Each has a 3D pickup, burst VFX, sound and a HUD chip with a countdown ring.

**Roadster Jump** (purple rocket, appears after 250 m, stack max 2): the next swipe UP fires a rocket-assisted super jump to ~5.6 m that clears two rows of obstacles, with a full barrel roll at the apex. The car is invulnerable during the flight + 0.5 s; swipe DOWN cancels it early. Timings: `TIMING.super*`, height: `HEIGHT.SUPER`.

**Air Dash** (teal », road pickup after 150 m, +2 charges, max 3): while airborne a sideways swipe crosses **two lanes** (edge → edge) with a quick flip; the hop is extended until the dash lands. Normal jumps can always shift one lane in the air.

**Sky Escape** (red SOS item, road pickup after 400 m, or from the item inventory): tap the SOS button (or E) at any moment — the car rockets straight up to ~9.6 m, cruises 3 s above every obstacle and glides back down. Landing ends with the same shockwave.

**Car blockade** (Roadster showcase): while you hold a Roadster/HYPER charge, about every 520 m a double wall of cars (a white semi truck flanked by cars) blocks all three lanes, like the stunt reference video — only a rocket jump clears it. A toast warns ~120 m ahead and the danger arrow says ↑. If the charge is gone before you get there, the blockade is removed, so it can never cause an unfair crash. The basic training's last step practises exactly this.

**HYPER JUMP** (mythic, gold rocket — cup prize, check-in day 7, shop): 7.4 m, double barrel roll, golden trail, +1,000 score and +25 coins at the apex. All rocket jumps end in a **landing shockwave** that clears ~26 m of road so the touch-down is always fair.

## Live-ops

| Feature | Where | Notes |
|---|---|---|
| **Daily check-in** | Home → Daily | 7-day calendar (day 7 = HYPER JUMP); missing a day restarts at day 1 |
| **Daily quests** | Home → Daily | 4 per day (same for everyone, seeded by date), points → 3 chests (30/70/100 pts) |
| **Cups (tournaments)** | Home → Cups, live strip on home | back-to-back 72 h cups on a fixed schedule (5 rotating tracks); best score while live counts; prizes: #1 Gold + HYPER ×5 + 5,000 coins … everyone: Roadster ×1 + 150 coins; results are collected on the next home visit |
| **Leaderboard** | Home → Ranks / profile chip | This week / All time; your row is highlighted and pinned with "score X to reach #N" |
| **Boosts** | Track select | equip owned Roadster / HYPER / Sky Escape / Start Shield for the next run |

> **Sample data:** rival pilots on leaderboards and cups are generated deterministically (`src/meta/Leaderboard.ts`, `Events.ts`) so the game feels alive offline; the local player's real scores are ranked against them. A small note says so (`SAMPLE_BOARD_NOTE` in `UI.ts`). Replace `sampleBoard()` with your backend before a public launch.

## In-app purchases

`src/meta/Shop.ts` — products + a `Store` interface. The default **DemoStore** shows a confirmation sheet ("demo — no payment is taken").

| SKU | Price | Content |
|---|---|---|
| `starter_pack` | $1.99 (once) | 3,000 coins, 3 Roadster, 1 HYPER, no interstitials |
| `xwave_pass` | $4.99 / 30 days | daily 300 coins + Roadster, ×2 quest coins, gold name |
| `no_ads` | $2.99 | removes interstitials (rewarded stay optional) |
| `jump_bundle` | $2.99 | 5 Roadster + 2 HYPER |
| `escape_3` | $1.99 | 3 Sky Escapes |
| `hyper_3` | $3.99 | 3 HYPER JUMPs |
| `coins_s/m/l/xl` | $0.99–19.99 | 1,200 – 32,000 coins |

Upsell touchpoints: wallet "+" (everywhere), Continue screen when coins are short, Garage "Need N more · Get coins", Boost tiles with 0 owned. To go live, implement `Store.purchase()` with Google Play Billing / StoreKit (Capacitor plugin) or a web checkout, verify receipts server-side, and grant from the server.

## Ads (rewarded + interstitial)

All ad logic is in `src/ads/Ads.ts` (placements + caps in the `ADS` object). Without an ad SDK a **demo ad overlay** is shown so every placement can be tested.

| Placement | Type | Where | Reward |
|---|---|---|---|
| `continue` | rewarded | "CONTINUE?" overlay after the last life (7 s countdown) | respawn in place, keep score; max 2 per run, or pay coins (300, ×2 each use) |
| `double_coins` | rewarded | Game Over / Track Finish | ×2 coins of the run |
| `free_coins` | rewarded | Home | +100 coins, 5 per day |
| `head_start` | rewarded | Track select | next run starts with Shield + 1 Roadster Jump |
| `between_runs` | interstitial | leaving the results screen | only from run 3, every 3 runs, ≥ 120 s apart, never within 60 s after a rewarded ad, never in the tutorial |

Enable Google H5 Games Ads (AdSense for Games) by adding to `index.html` `<head>`:

```html
<script async data-adbreak-test="on"
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
  crossorigin="anonymous"></script>
<script>
  window.adsbygoogle = window.adsbygoogle || [];
  var adBreak = adConfig = function (o) { adsbygoogle.push(o); };
  adConfig({ preloadAdBreaks: 'on', sound: 'on' });
</script>
```

When `window.adBreak` exists the game uses it automatically (remove `data-adbreak-test` for production). For portals (Poki, CrazyGames) or an app-store wrapper (AdMob), implement the small `AdProvider` interface in `Ads.ts`.

### Meta

Garage: 9 cars in 5 body styles (GT Coupe ×4 colourways, Hyper Wedge, Thunder Muscle, Orbit Pod, Cyber Blade, Gold Legend); locked cars are faded in the car strip and shown as a dark silhouette in 3D. Profile: random pilot-helmet avatar (24 designs, change or re-roll in Settings) with a skill-tier badge in the corner (Rookie → Bronze 1k → Silver 3k → Gold 7k → Platinum 15k → Diamond 30k → Legend 50k best score), also shown on leaderboards. Missions (3 active, rewards in coins, pilot rank), Settings (sound, music, danger arrows, graphics, pilot name), Garage (4 colourways, Engine / Shield / Magnet upgrades, 5 levels each), best score and everything else persisted in `localStorage`.

## v7.0 changes (branch `7.0`) — 3D Futuristic Motorcycle & Rider

- **Branch organization (`main` restored + new `7.0` branch)**: restored `main-back` (`v3.0.11` flying-car build) back to `main`, and split the 3D Futuristic Motorcycle & Rider version into branch **`7.0`** (**v7.0**) for clear version management.
- **3D Main Player Asset — Futuristic Motorcycle & Rider (`src/render/BikeRiderAsset.ts`, `models/bike_rider.glb`)**: replaced the player vehicle visual representation with a complete, articulated 3D futuristic motorcycle and armored rider built from the 7 reference images.
  - **Signature design**: twin angular cyan rear tail-lights, lower center red beacon, segmented titanium-silver spine armor (`7` rigid plates), graphite/cobalt racing suit, full-face aerodynamic helmet with rear cyan strip, and right-side short titanium exhaust (`ExhaustRight` on `+X` only).
  - **In-place animations & state mapping**: `StraightRide`, `LeanLeft`, `LeanRight`, `AirborneJump`, `DownSlide` (extreme ~66° motorcycle bank with rider chest pressed to tank and head/shoulders/elbows/knees tucked low to physically reduce visual height), and `LowTuck` (transitional upright tuck).
  - **Strict gameplay preservation**: all hitboxes, collision rules, speed, jump trajectory, inputs, camera, tracks, UI, and audio remain 100% unchanged.

## v3.0.11 changes (`main`) — reward buttons · revive ad · launch hotfix · in-game log

- **Reward buttons (Entry · Launch · Share)** show only while their reward can still be earned — decided from HSGame's reward config and claim state (`$limit`), never "claimed once = gone": Entry / Launch while the TikTok mission is not done, Share while `available('share')` (back the next day; a Share without a reward stays as the TikTok review button). Nothing shows until HSGame has settled (no flash of an exhausted reward). The visible ones stay centred on the right rail (3 · 2 · 1 · none) and glide to their new place in 200 ms. Pure logic + the 8 layout combinations in `src/meta/Perks.ts` / `tests/perks.test.ts`. Web rail: same rules, CSS centring + FLIP glide.
- **Reward Claimed!** notice after an Entry / Launch / Share reward (from HSGame's `given` event), shown even when its button disappears. Rapid taps can't start a mission or a share twice.
- **Revive ad on real TikTok**: the revive countdown is frozen while the ad loads / plays (it used to run out under a loading video and end the race — the button looked dead); the button shows only while a revive ad is ready ("Ad loading…" otherwise); "No ad available" toast when the platform has none. Ad waits are capped (90 s rewarded / 45 s interstitial) so a lost ad callback can never block later ads or the game-over buttons.
- **Android launch hotfix**: WebGL context retried with safer settings (no MSAA, default / low-power GPU) instead of failing; lighter MSAA (2×) for the Android post-processing target.
- **In-game log** (`src/native/log.ts`) for phones where TikTok's vConsole won't open: last 150 console lines + uncaught errors. Open it with **5 quick taps in the top-left corner** (any screen) or Settings → tap the version 5× → Logs. The boot-error screen also prints the last warnings / errors.
- Offline: the game boots and plays with no network (HSGame offline, ads / share / shop hidden, progress saved locally).

## v3.0.10 changes — training button

- First **Play** still opens the training card (Start training / Skip). After that, training is a **Training** button next to the "SELECT TRACK" title (both UIs).
- Track list aligned: every card has its text on the same left edge and its number in the same top-right circle; upcoming tracks show a soft "?" instead of a left column.
- No flag on the home profile chip (flags stay on leaderboards and the profile).

## v3.0.9 changes — Android smoothness · flags · rank table

- **Smoother on Android** (home + race start): pooled obstacle / pickup meshes are now compiled at load (their shaders used to build on the first race frames); Android renders the 3D view at ≤ 1.5× pixel ratio; the home screen's canvas UI redraws/uploads at ~11 fps (it only pulses) instead of 25; baked audio is rendered in tiny slices (one music step per tick at 22 kHz, envelopes/filters every 16 samples, SFX one per tick after 1.5 s) and the next music intensity is prepared in the background, never at race start.
- **Country flags** drawn as SVG (`src/meta/Flags.ts`, all 62 countries) — emoji flags were blank / letters on Android. Leaderboards, podium, pilot card, profile, country + language pickers, and a flag on the home profile chip.
- **Rank table**: AAA's three unlocks wrap inside the row instead of running off the card.

## v3.0.8 changes — shop · top row beside the TikTok capsule

- **Top row on the capsule line**: home (profile · coins · settings), page headers and the race HUD (pause · score box) now sit on the same line as TikTok's "… ×" capsule, left of it; the race coin card + distance sit just under the capsule. "How to play" lives in Settings when space is short. Profile chip fits its content with a clear gap to the coin chip.
- **Shop**: Remove Ads card on top, free coins (rewarded ad), then coin packs as tiles. New packs (`tiktok.hs-dashboard.json`, paste into the HS dashboard): **5,000 coins = 99 Beans (≈ $0.99)**, 16,000 = 299, 28,000 = 499 (POPULAR), 60,000 = 999, 130,000 = 1,999 (BEST VALUE); Remove Ads 299 (one-time). Web `PRODUCTS` match. The coin chip's **+** always opens the shop.
- **Shield**: breaks after **2 hits** (was 3) and lasts **30 % shorter** (14 s instead of 20 s) — `SHIELD` in `config.ts`.
- **Special item prices up**: Roadster Jump 3,000 (was 1,800), HYPER Jump 7,000 (was 4,000), SOS Escape 2,000 (was 1,200).

## v3.0.7 changes — top inset

- **Android**: some TikTok builds report the "… ×" capsule / status bar in physical pixels → the whole UI sat ~200 units too low. Values are now detected and converted (÷ pixel ratio) and clamped; the top bar sits right under the capsule.
- **iPhone/all**: tighter gap under the capsule on home, pages and the race HUD.

## v3.0.6 changes — Android start · clean sound · hourly Bonus

- **Android**: the game failed to load (`SyntaxError: Invalid regular expression … \p{L}` — Unicode property escapes are missing on the Android engine). The name filter no longer uses them; the TikTok build now refuses any regex feature newer than ES2017 (`\p{}`, lookbehind, named groups, `s`/`d`/`v` flags), and `game.js` parses as plain ES2017.
- **Sound (iPhone crackle)**: in the native build every sound effect and the music loop are **pre-rendered** once into PCM buffers (same recipes; envelopes, glides and filters computed per sample, band-limited oscillators, seamless 4-bar loops per intensity, switched on the bar line) and played with plain buffer sources — no AudioParam automation, so no stepping clicks. The web build keeps the real-time synth.
- **Bonus**: opens **every hour for 30 minutes**, a **random place** each time (the same for every player, never twice in a row), and can be **replayed** as often as you like while open (Retry restarts the Bonus road).

## v3.0.5 changes
- Race HUD: coin card shows this race's coins (+37) and the wallet total; score box reorganised (EXP · level / big race EXP / RACE rank on the right, footer YOU · BEST and NEXT, progress bar to the next rank with the best EXP marked).
- Sound & music on TikTok: Web Audio compatibility layer (missing compressor / filter / delay nodes and AudioParam automation fall back instead of silencing everything), the context is resumed on touches and after the app returns.
- Settings → Colour removed (iPhone OK): calibration stays automatic; test info behind 5 taps on the version.
- Smaller package: the native build no longer pulls in the DOM UI's art (`src/ui/shared.ts`) — guide pictures, unused track pictures and the app icon are gone (2.86 → 2.75 MB).

## v3.0.4 changes — colour calibration · Android start
- Colour calibration at start (`src/native/color.ts`): two tiny off-screen draws measure whether the screen re-encodes sRGB (fix: output linear) and whether sRGB textures are decoded (fix: decode in the shader). Only what is measured is compensated. Settings → Colour: Auto / Normal / Screen fix / Texture fix, and a line with the measured values + GPU for testing.
- The UI layer is copied to the screen raw (no sRGB round trip a runtime could get wrong).
- Android: the game folder no longer contains a `package.json`; the bundle is downlevelled to ES2017 (older mini-game JS engines); globals the runtime keeps read-only are no longer written with plain assignments; a readable error screen if the 3D view cannot start.
- `npm run check:tiktok` / `pack:tiktok` run the HS tools on a temporary copy (`scripts/tiktok-tools.mjs`).

## v3.0.3 changes — native looks like the H5 game
- Washed-out picture on TikTok fixed: the frame's alpha channel is forced to 1 after the UI pass (the UI quad no longer lowers the canvas alpha, and bloom / post passes can't leave it below 1), so the app never shows its page through the game.
- Race HUD rebuilt to the H5 layout: EXP + level tag, big race EXP with RACE shield, YOU / BEST row, NEXT row; coin / distance pills; "SPEED … KM/H" with the rainbow bar; bigger hearts; H5 pause button; shield-shaped class badges; dark ROADSTER button.
- Pause menu typography bigger (title, SFX / MUSIC / quality, Resume, Retry / Home); result-screen nav buttons too.
- Top bar always below TikTok's "… ×" capsule (re-measured after start, safe fallback when the app reports no rect).

## v3.0.2 changes — buttons on real TikTok devices
- Sound engine is fail-safe: a runtime with a partial Web Audio (no compressor, `connect()` not chainable) used to throw at the first tap, leaving the audio half-built so every button's click sound threw and the button did nothing. Now audio switches off cleanly instead.
- Images: the native image wrapper always feeds its own load listeners (the car sprite never appeared when the runtime's own `addEventListener` didn't fire).
- Canvas UI: each screen draws inside a guard — one failing screen can no longer wipe every button; errors show once as a red notice.
- Touch points reported in device pixels are scaled back to screen points.
- Tested in a no-DOM runtime simulator (Web Worker + OffscreenCanvas + strict tt shim): home → settings → garage → play → tracks → special → race.

## v3.0.1 changes
- Pause no longer ends the race after 7 s (the paused state shared the revive countdown) — web and native.
- Ad places renamed by type: rewarded `rw_revive` · `rw_end_bonus` · `rw_free_coins` · `rw_head_start`, interstitial `int_race_end`.
- Home always shows 6 side buttons (Share · Entry · Launch on the right; outside the TikTok app a tap explains they work there).
- Browser preview: the arrow keys / WASD work (the page takes keyboard focus on tap).

## v3.0.0 changes — native TikTok mini game
- New: native TikTok mini game build (`tiktok/`) — no HTML/DOM: Three.js on the TikTok canvas, the whole UI redrawn on a canvas (home, tracks, garage, missions, ranks, daily, shop, Magic Bag, results, pause, revive, tutorial, settings, profile, popups, race HUD, toasts, pops).
- HS SDK 1.1.2 (kit 3.2.3): device save in one profile, rewarded ads at revive / end bonus / free coins / head start + race-end ad, coin packs + Remove Ads for TikTok Beans, share, Entry / Launch Reward (TikTok review).
- Cloud accounts of v2.3 are off in the native build (the HS profile is the save); the web build keeps them.
- v2 web game kept on branch `v2`.

## v2.3.0 changes — accounts & cloud save

- **Settings → Account**: sign in with **Google**, **Apple** or an **email code**. Progress (rank, EXP, coins, specials, cars, missions…) is saved to the account and comes back after a reinstall or on a new phone.
- Every install is a guest account from the first launch; signing in keeps the guest's progress.
- A fresh phone that signs in takes the cloud save automatically; a phone with its own progress shows **"Which progress?"** (rank, EXP, coins, races side by side).
- Auto-sync a few seconds after every change and when the app goes to the background; finished races are queued while offline.
- **EXP is server-verified**: each EXP race is reported and re-computed on the server (distance × rate, impossible speeds rejected); a save can never raise EXP / rank. Pre-cloud progress is imported once.
- Server: `server/index.mjs` (+ `core.mjs`, `schema.sql`, README with the go-live steps). Cloud is off until `CLOUD.api` in `src/config.ts` (or `?api=`) points at it — until then Account says "coming soon".
- `tests/server.test.ts`: server EXP rules stay equal to the game's.

## v2.2.11 changes

- Speed levels each have their own colour: Easy green · Normal gold · Hard red (Home selector and the race HUD tag). Default stays Normal.

## v2.2.10 changes

- Home: the 6 side tiles are equal 50×50 squares; softer (thinner, fainter) borders on the tiles, the speed selector and the bottom row.

## v2.2.9 changes

- Home: side tiles smaller and all the same size (56×60); smaller, balanced type on the tiles, the speed selector and Garage / Shop / Missions.

## v2.2.8 changes

- Home rebuilt to the owner's mock-up: side tiles (icon + label in one glass tile: navy Daily / Ranks, bronze Bonus, teal Share, purple Entry, blue Launch with a rocket), star speed selector with a gold selected tile, deep-blue PLAY with neon rim and » chevrons, navy / purple / bronze Garage · Shop · Missions, gold-rimmed coin pill.

## v2.2.7 changes

- Home buttons back to exactly the owner's reference look (PLAY, Garage / Shop / Missions, top icons); the all-time #rank on the avatar stays. Other screens keep the glossy style.

## v2.2.6 changes

- Every button (result, pause, popups, bag, shop, settings…) uses the glossy 3D candy style of the Home buttons; dark/ghost buttons become glossy navy; round close/share/back buttons are glossy discs.

## v2.2.5 changes

- Home: all-time leaderboard position on the avatar (#N); Garage / Shop / Missions in the same glossy 3D style as the side buttons; bigger PLAY with a glow pulse and light sweep.

## v2.2.4 changes (owner round AA)

- **Retry** always works: the pre-race popups (special pick, Magic Bag, buy, confirm) now sit above the result / pause screens.
- Pause → Home ends the race and shows **its own result screen** (the race counts); old result screens never come back.
- Race HUD redrawn at the start of each race; shows **RACE** rank (this race), **YOU** (your profile rank), BEST and NEXT.
- FINISH card: bigger EXP, glowing "RACE RANK" plate. Share card is drawn in advance so the share sheet opens on tap.
- **EXP road feels like v1 again**: v1 coin lines (skip 18 %, up to 8 coins), road power-ups every 220–360 m, early phases with v1's mix (rings, beams, double blocks from rank D; traffic mixes, lasers, drones from C; gates from B). Bonus ~10 % more coins than the main road.

## v2.2.3 changes (owner round Z)

- **Speed**: the road speed now glides to every new target (level, rank phase, turbo, respawn) — no jolts; the race HUD shows the level (EASY / NORMAL / HARD tag).
- Race HUD: **NEXT** line = next rank + EXP still needed (under BEST).
- Quitting a race half-way → straight Home (never an old result screen, no ad).
- Coins: main road +20 %; Bonus road ~10 % above it, finish +300; fewer items on Bonus; mystery boxes only now and then.
- Bonus finish celebration (banner + coin shower + vibration).
- End-screen ad gives **+20 % coins** (was ×2).
- Brag card uses the transparent in-race car on a glow; Bonus card and leaderboard row spacing fixed.

## v2.2.2 changes (owner round Y)

- Flying through a **ring = double coins** for 8 s (HUD chip "coin ×2"); mystery boxes keep their random rewards.
- Normal and Hard another **+10 % speed** (Normal ×1.21, Hard ×1.5); EXP per metre re-calibrated (labels Easy ×1 · Normal ×1.05 · Hard ×1.7).
- Share card: car drawn from the transparent in-race render (aspect kept, soft glow); preview header fixed; "Save image" hidden inside preview frames (long-press the card).
- Share links work: Add-to-screen tiles (Add / Share / Copy Link / More) and "Share again" share or copy the game link; the link falls back to the page that embeds the game.
- Special pick popup and share popup spacing / cut text fixed.

## v2.2.1 changes

- Fix: opening the Tutorial card from Home and closing it left Home without its buttons (the card now opens over Home and closes back to it).

## v2.2.0 changes (owner fix rounds H–X, `docs/FIXLIST.md`)

- **Training**: no ad after training/practice; no shield or end coin line in basic training; end card with Race / Replay (or Practise again) / **Home**; replay repeats the same practice; HUD shows EXP + rank with a TRAINING tag (nothing saved); a **Skip ›** button during training; first Play opens the training card (Start / Skip).
- **Bonus**: 5-minute road, **one play per event**; normal items as usual; specials are a rare drop and each brings its own **set piece** (car walls, convoy, jam, blocked row, busy stretch, laser zone, tunnel) spawned only after the pickup; **tunnel sections** on every Bonus road (Tunnel Rider only there); finish +500 coins. `tests/bonus.test.ts`.
- **Rings & mystery boxes**: every ring gives a random reward; mystery boxes on the road and at trick spots (hop / duck at the right moment).
- **Beat your best**: best EXP + bar in the race HUD, two short cheers when close, "YOU BEAT YOURSELF!" banner when passed.
- **Roadster jump**: clears 4 car rows; the roll plays in slow motion with a camera swing. Turbo eases back to the chosen speed. Double score → **Double EXP**. Smaller pickup notices. No car outline for Magnet / ×2.
- **Speed levels** +5 % / +10 % / +15 % (Easy / Normal / Hard); EXP per metre re-calibrated (×1 / ×1.15 / ×1.9).
- **END → FINISH**; from rank C a **brag card** (rank shield, big EXP, car, Share). Real **share**: a 1080×1350 card image → share sheet, or a preview to save/copy when sharing is blocked. Entry steps open the profile; Share popup car = tap to share.
- **Leaderboard**: pyramid of bots (few AAA), RANK "#N" pill (top-3 colours), EXP with badge, header RANK · PILOT · EXP, glowing YOU row, "Top x%" for far positions.
- **Rank guide**: RANK · EXP · UNLOCKS (cars, Mega Rush, AAA specials, S/SS/SSS roads); opens on top of the result screen.
- **Magic Bag**: always shows SOS / Roadster / HYPER with counts, "Race without a special", confirm popup before taking one, separate **Buy items** popup; starting kit 1 HYPER + 2 Roadster (+1/+1 once for everyone).
- **Home / profile**: no language button (Settings only), clean profile chip, no Bonus strip / speed line, bigger Play; profile shows a big rank shield + big EXP; avatar effects from rank A (glow → gold pulse → neon ring → flame ring).
- **Missions** are their own screen again: career chains with tiers + pilot level, auto-collect or manual claim / Claim all; **Daily** pool of 15 fun challenges.
- **Garage**: car sits lower, Zenith thumbnail = in-race car, MORE card for S/SS/SSS cars.
- Spacing rhythm for every popup; avatar SVG ids made unique (empty avatars fixed); "Eye comfort" setting explained.

## v2.1.0 changes (owner fix list — all of `docs/FIXLIST.md`)

- **Before every race (Retry too)**: one big SPECIAL button → the Magic Bag opens to pick; "Get with coins" at the bottom. Prices SOS 1,200 · Roadster 1,800 · HYPER 4,000.
- **Hearts**: 1 heart per EXP race, a heart on the road about every 1,000 EXP (max 3); then 2 ad revives; 3rd crash ends the race.
- **Endless never repeats before AAA**: 12-world ladder by EXP (2 per rank): Future City → Neon Harbor → Cloud City → Solar Farms → Neon Tunnel → Crystal Canyon → Space Zone → Asteroid Belt → Megacity → Storm Front → Volcano Core → Aurora Ice; loops after AAA. Each world has its own obstacle looks (same hitboxes).
- **Bonus**: themed props per place (rocks / barrels / pickups, logs / logging trucks, hay / fences / tractors, buoys / crates / boats); showcase specials smash what they pass and pull coins in; Phase Ghost is a steady hologram; a closed Bonus can't be retried.
- **Cars**: new rank-C car **XWAVE Vega** (owner's render, own rear sprite); B+ cars are black silhouettes; v1 coin-bought cars above the rank are re-locked and refunded.
- **UI**: new logo, new emblem avatars, "EXP" pill badge, END screen (EXP + rank reached + leaderboard position), minimal revive popup, Daily = coins only with a 4 + 3 check-in grid (fits 375×640), Near Miss removed, Cups / Trophies / XWAVE Pass leftovers removed, tracks 3–5 open at S / SS / SSS, rival cards show average EXP, shorter texts everywhere, rank-gate strip above the mission strip, rank-up notices jump the queue.

## v2.0.8 changes (v2 step 8 — daily missions & coin balance)

- **Daily + Missions merged**: one daily list (4 missions a day, chests at 30 / 70 / 100 pts) that pays coins; the home "Missions" button opens it. The in-race strip shows the next unfinished daily mission with live progress. The old per-run mission system no longer pays (waiting rewards were moved to the wallet).
- 7-day check-in pays coins 100 → 400, day 7 = 600 coins + 1 Roadster Jump. New missions: "Earn 1,500 EXP in one race", "Use a special" (SOS counts), "Drive 5,000 m"…
- Coin balance (`COIN_LINES` in config): Endless ≈ 25–40 coins / min before the speed-level coin bonus (a special costs 2,000–7,000), Bonus roads ≈ 2× denser.
- XWAVE Pass row hidden; new UI text translated (FR / JA / PT / DE / ES).

## v2.0.7 changes (v2 step 7 — Bonus events replace cups)

- **Bonus** opens every hour (local 00:00, 01:00, …) for 30 minutes (v3.0.6; was every 2 h for 60 min), in a random everyday place each time, replayable while open: **Desert Highway · Pine Forest · Country Road · Ocean Causeway** (new daylight scenery: scrolling sand / grass / fields / sea ground, cacti, mesas, pines, barns, windmills, palm islets, boats, a lighthouse). `meta/Bonus.ts`, `BONUS_WORLDS`.
- A Bonus road is a 30-minute course with a FINISH line (length computed from the speed level), coins only (no EXP, no ranking), finish bonus 800 × coin multiplier. HUD shows "BONUS COINS".
- Specials lie on the road and **fire by themselves**: Roadster, HYPER, and the AAA teasers — **Wall Run** (car rides the side wall), **Tunnel Rider** (upside-down on the roof), **Sky Rail** (glides above the road), **Phase Ghost** (flickers through obstacles).
- Home: the cup strip and rail button became **Bonus** (open now / next opening); the Bonus card explains the rules. Old cup results are no longer shown.

## v2.0.6 changes (v2 step 6 — new training)

- First **Play** starts the training straight away (~60 s): left / right / up / down, coins, road power-ups, then the free Roadster Jump from the bag over a car block. Hints explain distance = EXP, coins buy specials, one special per race, ranks and rank gates.
- The end card explains EXP → rank; "Race Endless" goes to the track list. The per-world advanced trainings are gone (special-item practice stays in the Tutorial hub).

## v2.0.5 changes (v2 step 5 — revive & ads)

- **Revive only by rewarded ad, max 2 per race** ("Revives left 2 / 2 · the 3rd crash sends you back to Start"). Coin continues are gone.
- The race-end interstitial now follows every finished race (after the first 2 runs, ≥45 s apart, 30 s grace after a rewarded ad); **Remove Ads** turns it off.

## v2.0.4 changes (v2 step 4 — specials & coins)

- **Specials** (SOS 2,000 · Roadster 3,000 · HYPER 6,000 coins): bought with coins, kept in the Magic Bag, **one per race**, picked in a popup when you tap a track (or "No special"). The special leaves the bag only if you use it. Empty slot → "Out — get one with coins" + Buy (not enough coins → shop). New players get 1 Roadster.
- Teaser specials (Tunnel Rider, Wall Run, Phase Ghost, Sky Rail) shown blurred, "opens at AAA".
- Specials and extra lives no longer appear on the Endless / Track 2 road; Magnet, Shield, Turbo and ×2 coins pickups stay (same strength for everyone, `V2_POWERUPS`).
- **Shop sells only coins** (1,000 $0.99 · 6,000 $4.99 · 13,000 $9.99 · 30,000 $19.99) + Remove Ads. XWAVE Pass, Starter Pack and bundles are gone.
- Old saves: retired items (Shield, Turbo, Magnet, ×2, Extra Life) and garage upgrades are refunded as coins once (`save.v2`).

## v2.0.3 changes (v2 step 3 — tracks & cars)

- Track list: **Endless** (the rank road D→AAA, at the speed level you pick), **Mega Rush** (Track 2, opens at AAA: starts two phases harder, EXP ×1.25, the only road to **S / SS / SSS** = 65,000 / 85,000 / 110,000 EXP), and three "coming soon" teasers. The 20 old courses are retired from the UI.
- Endless is no longer forced to HARD — the speed selector (EXP ×1 / ×1.15 / ×2) applies.
- Player rank = Endless best (capped at AAA) or Track 2 best (S tiers). `playerRank()` in `meta/Rank.ts`, `save.exp2Best`.
- **Cars unlock by rank only** (Zenith D · Volt B · Phantom A · Inferno AA · Nexus AAA), no coin price, no score bonus — they are trophies; the garage no longer shows upgrades.
- Tests: EXP calibration and rank-phase/autopilot tests cover Track 2 (624 km through all gates, 0 crashes).

## v2.0.2 changes (v2 step 2 — difficulty phases & rank gates)

- **Endless difficulty climbs by rank phase** (`PHASES` in `gameplay/Difficulty.ts`), measured in EXP so every speed level meets the same phase at the same minute:
  D single blockers · C two-lane blocks + beams/barriers · B combos, vehicle + blocker, lasers, platforms · A one safe lane, mega gates, road +6 % · AA rhythm chains, road +10 % · AAA everything, road +14 %.
- **Rank gates**: the last 30 s before each new rank is the hardest stretch (next phase's mix, hard tiers ×1.45) with a "RANK GATE" strip + notice on the HUD; 8 s of easier road after it.
- Rank thresholds re-calibrated for the phase speed-ups: AA 26,000 · AAA 40,000 EXP.
- No Roadster car-blockade on Endless (no obstacle there needs a special item).
- Test shortcut: `?rank=B` (C/B/A/AA/AAA) starts Endless just before that rank gate; that run's EXP is not saved.
- `tests/phases.test.ts`: whole ladder D→AAA reachable on all speed levels, difficulty rising phase by phase, gates harder than their phase, autopilot drives 240 km through all gates with 0 crashes.

## v2.0.1 changes (v2 step 1 — EXP & rank)

v2 redesign per `docs/GAME-DESIGN.md` (the old game lives on the `v1` branch).

- **EXP** = distance × speed-level rate (Easy 0.2 · Normal 0.23 · Hard 0.4 per metre, `EXP` in `config.ts`). Player EXP = best single run, never summed. Calibrated by `tests/exp.test.ts`: C/B/A/AA/AAA at 3/7/12/20/30 min on Hard, ×2 Normal, ×3 Easy.
- **Ranks** D→AAA = EXP 0 / 3,000 / 8,000 / 15,000 / 25,000 / 38,000. New shield logo and shield-shaped rank plates (no more star icon).
- HUD shows the run's EXP + the rank it has reached; in-run notice on each new rank and on beating your best.
- Game over, profile, leaderboards (week / all time) and the rank guide all use EXP. Car / track / boost locks read the EXP rank.
- Rank stars (bolts) are no longer awarded; old saves start v2 at rank D. Score/combo pops removed from the HUD.

## v1.19.1 changes

- **Magic Bag** only in Profile (home top bar freed for the avatar chip).
- **Fix**: dying with Turbo / Shield no longer leaves a glow or dome on the car after restart (`Vehicle.resetFx`, FX targets only while racing).
- **Side walls**: glass barrier with light strips and posts on both road edges, scrolling with speed.
- **Rear tyres** (owner's realistic-rotation prompt, done in Three.js): tread layers masked from the original PNG, scroll exactly synced to ground speed / tyre circumference (both wheels identical), blur only on the tread (outline sharp), free spin decay in the air, landing kick, accel/brake pitch, 1–3 px suspension, restrained turbo rumble. Tyre grit removed.

## v1.18 changes

- **Notices**: toasts and section banners share one lane under the HUD (max 2 toasts), long text wraps.
- **Guide modal**: one detail open at a time; header + close button pinned; tap the backdrop to close.
- **Training**: lane-change lessons (Mega Gate, Laser Wall, Traffic, Asteroid) aim the prompt from the car's real lane.
- **Garage**: 5 XWAVE cars (Zenith Common → Nexus Mythic) with rear-view art, stats and a +0–25 % score bonus. Cars unlock in order (class + coins). The next car shows in colour; later cars are black silhouettes with "Reach class X". Old cars map to the new line-up.
- **Tracks**: 20 tracks (5 worlds + 15 harder remixes). Each unlocks by score on the previous track; tracks 11–20 need class A (the Rank A gate). Endless is always HARD.
- **Reward popups**: Entry, Launch, Share, Add to Screen, Revisit Gift, Invite, Rate, No Connection and the 7-day Daily list, redrawn with illustrated SVG art (`src/ui/art.ts`). The Entry button stays after claiming and links to Daily, Shop, Garage, Tutorial, Race and Cups.
- **Wheels**: spoked rear rims with rotational blur. The spin is capped per frame, so it never strobes backwards.
- **Avatars**: 32 new pilot portraits. The rank badge on the home profile chip is no longer duplicated.
- **Country**: auto-detected (IP, then time zone / language), editable in Profile; your flag replaces the star on leaderboards.
- **Magic Bag**: item inventory with rules and which item fits which track; reachable from the home bar, Profile and track select. Big-reward tracks add items to the bag on a 2–3★ finish.
- **Tutorial**: one hub for basics, special-item practice and advanced worlds.
- **Economy**: every item can be bought singly for coins (`ITEM_PRICE`), and bundles are priced to beat coin packs. The shop shows each bundle's coin value. See `docs/ECONOMY.md`.

## v1.17 changes

**ROADSTER button**
- Training: tapping ROADSTER before the blockade no longer does nothing silently. The button gives a small nudge and a toast ("Save it! Tap ROADSTER when the button lights up"), and the charge is kept for the blockade.
- The button lights up (steady purple / gold glow, slightly larger, label "TAP!") whenever a Roadster or HYPER jump is the way through the row ahead. This also covers the training step. Steady glow, no flashing.
- Fixed: the count badge on the ROADSTER and SOS buttons always showed "1". The HUD wrote to `data-h` but the badges only had `data-k`.

**Unused boosts become points**
- When a track is finished, every Roadster Jump, HYPER JUMP and Sky Escape still held is converted to score (`LEFTOVER_POINTS` in `config.ts`: 1,500 / 3,000 / 1,000 × the run's score multiplier). A "+points · UNUSED BOOSTS" pop and a toast show at the line, and the result screen has an "Unused boosts" row.

**Wheels at speed**
- Rear-tyre tread on the X1 render now moves at most `TYRE.maxStep` of a block per frame. Before, it moved about 0.3–0.7 of a block per frame, so the eye read it as standing still or rolling backwards (wagon-wheel effect).
- The extra speed now shows as a longer 5-tap motion smear, brighter streaks, and grit kicked back from both rear tyres (`TYRE` in `config.ts`). The 3D bodies' wheel blur disc is stronger.

## v1.14 changes

**Panels fit the phone**
- Every overlay was measured at 375×640 and now fits on its own; anything still too tall shrinks to fit.
- Settings: 6 toggles in a 2-column grid, a language row and 4 small buttons. Name and avatar moved to the profile.
- Roadster guide, rank guide, pilot training, boost info and profile were all tightened.

**Loading screen**
- Full key-art screen, with the logo kept visible at the top.
- Progress bar sits on a soft bottom gradient.
- Stays up for at least 2.2 s.

**Jump feel**
- A normal hop now rises higher on screen (visual peak 3.35 instead of 2.85). The camera follows the hop only a little, so the car clearly clears the obstacle.
- While it is above the obstacles, the car is drawn over them, so it no longer looks like it passes through.
- Ducking keeps the wheels on the road: the body squashes instead of sinking into the asphalt.

**Wheels and visuals**
- The rear-render tyres roll: tread bands scroll with road speed, plus a light speed sheen.
- The car's brightness gain is lowered, so it no longer blooms or looks soft.

**Languages**
- English, Français, 日本語, Português (BR), Deutsch and Español (`src/ui/i18n.ts`).
- Pick one from the flag button next to Settings, or from Settings ▸ Language.
- Fixed UI labels are translated; dynamic sentences stay in English.

## v1.13 changes

**XWAVE X1 drawn from the studio renders**
- The rear view (`src/assets/images/car/x1-back.webp`) is cut out of the checkerboard.
- 7 more views come from the design sheet (front, back and both sides, plus the four 45° corners), with 2 corner views mirrored.
- The car is a camera-facing billboard that picks the view by viewing angle. Racing always uses the high-res rear view, which banks and barrel-rolls with the car.
- A soft contact shadow sits under the car.
- The other GT colourways recolour the body paint in the shader.

**Home screen**
- Popups now sit above everything, with a dimmed and blurred background.
- Shop moved next to Garage (Garage · Shop · Missions).
- Share took Shop's place at the top of the right rail.

## v1.12 changes: Sky Roadster

**Branding**
- New name: Sky Roadster.
- New logo, with its white background removed.
- Full-screen loading art.
- New app icon (1024 px, plus 512, 192, 180, 32 and maskable sizes).

**Rank** is shown with a gold star.

**No scrolling on phones**
- Every overlay panel shrinks to fit the screen.
- The result screens are compact: one row of 4 stats, a single coins line with its breakdown, a single rank line with the class bar, and chips for week, cup and quests.

**Crash tips**
- After a crash, `CrashTip.ts` works out the move that would have passed: hop, duck, the open lane, or SOS.
- The tip shows on respawn, on the continue screen and on game over.

**Vibration**
- One short pulse on hop, landing, flip, Roadster, HYPER, Sky Escape, turbo and crash.
- Can be switched off in Settings ▸ Vibration.

**Shield**: a soft cloud of light motes hugging the car's shape. No flicker.

**XWAVE X1 v2 car**
- Smooth body lofted from cross-sections, with the wheels inside the fenders.
- Black glass canopy, full-width red light bar, XWAVE rear panel, finned diffuser.
- Wheel spin is readable and the blur is light.
- The hidden fans puff air only on take-off and landing. A continuous jet appears only on rocket flights.

**Popups** (rewards in coins)

| Popup | How it's opened |
|---|---|
| Entry reward (300) | Side button |
| Launch reward (300) | Side button |
| Share (300 per day) | Side button |
| Invite (100) | Link in the Share popup |
| Rate us | Asked once after 8 runs; no reward |
| Add to screen | From Launch, uses the install prompt where supported |
| No connection | When the device goes offline |
| Daily | Unchanged |
| Watch-ad | Unchanged |
| Welcome back | Unchanged |

**Home screen**
- The guide is now a small tutorial icon next to Settings.
- The Free button is removed.
- The speed tooltip floats above the menu.

## v1.11 changes: eye comfort, controls, X rank points, reward popups, player DB

**Nothing flashes, ever.**
- Removed: full-screen flashes, the shield shimmer and blink, the invulnerability blink, turbo/boost glow on the car and bloom spikes, magnet pulse rings, the finish rings, street-lamp glow halos, and every looping CSS pulse/blink.
- Protection now shows as a steady soft bubble that fades smoothly in its last 2 s, plus the HUD chip.

**Controls**
- Landing is responsive. An UP swipe made in the last 0.34 s before touchdown fires the moment the wheels land, with only a 0.03 s rest instead of 0.12 s.
- A lane swipe made just before landing steers on touchdown.
- Training: the car only takes input when a training prompt is on screen.
- The Roadster / HYPER Jump has its own HUD button (keys R or Shift). A swipe UP is always a normal hop.
- If a training step needs a rocket you don't hold, a sheet offers: use one you own, buy one for 250 coins, or retry.
- The small hint arrow sits in the top-right corner whenever a hard moment is coming.

**X-Points (rank)**
- Shown with the XWAVE "X" badge.
- Result screens list every reward: coins, speed bonus, track reward, missions, quests, X-Points with a breakdown, the class progress bar, and rank-ups.
- "How rank works" opens the conversion table.
- Rank can't be bought: no product, pass or ad grants X-Points.

**Speed tiers**

| Level | Rewards (coin bonus, track reward, X-Points) |
|---|---|
| EASY | ×1 |
| NORMAL | ×1.25 |
| HARD | ×1.6 |

Tapping a level shows a tooltip.

**Popups**
- Daily reward (7 days)
- Watch-ad reward
- Welcome-back gift: 200 coins + shield after 12 h away

**Roadster guide**: tap a step for full details.

**Sliding platforms**: no arrows, and they appear much less often.

**Player database**
- `src/net/PlayerStore.ts`: bots and real players share one players/scores model, stored locally today.
- `?api=` switches to the reference server in `/server` (`index.mjs`, `schema.sql`, README).

## v1.10 changes — classes, ⚡ bolts, cups by division

**Rank classes** (`src/meta/Rank.ts`): every pilot starts in **D** and climbs D → C → B → A → AA → AAA with ⚡ bolts (cup points). No demotion.

| Class | D | C | B | A | AA | AAA |
|---|---|---|---|---|---|---|
| ⚡ needed | 0 | 150 | 450 | 1,100 | 2,400 | 4,800 |

**Earning ⚡**: +1 per 1,000 score, +1 per 10 near misses; finishing a track +2 (+1 per star); ×2 while racing in your live cup; cup placement prizes (below) × division multiplier (D 1, C 1.2, B 1.4, A 1.7, AA 2, AAA 2.5).
The ⚡ total sits top-right in the HUD (gold, steady glow — nothing blinks while racing).

**Cups** (`src/meta/Events.ts`): 2 sessions per day at **12:00 and 22:00 US Eastern** (DST-aware), live 3 h. Each session runs one cup per class; a pilot can only enter the cup of their own class. Base prizes: #1 120⚡ + 3,000 coins + HYPER ×3 + gold trophy · #2–3 80⚡ · #4–10 50⚡ · top 100 25⚡ · everyone 10⚡ + Roadster Jump.

**Profile**: tap the home chip → editable name, racing-helmet avatars (24 liveries, re-roll), class progress, stats. Leaderboard/cup rows open a pilot card. Rivals are demo data until an online backend is connected.

**Boosts**: tapping a boost opens its card (what it does / how / when) with Equip and a free **practice road** (`boostScript()` in Tutorial.ts).

**Missions**: auto-collect switch (default ON); OFF keeps finished rewards in a "Ready to collect" list.

**Worlds**: listed easiest → hardest (World 1–5), Endless is World 6, then 3 hidden worlds that reveal at class A / AA / AAA.

**Defaults**: graphics HIGH, music ON, SFX ON (settings migration rev 3). Music is original procedural Web Audio (no samples) → safe for commercial use.

**Difficulty**: triple walls removed; laser rows always keep one open lane with at most one duck lane; after any jump/duck row there is extra landing + reading time (`VERTICAL_RECOVERY`). Road arrows are smaller. Eye comfort: no screen flashes, no pulsing neon, steady lights.

## v1.9 changes

- New default car body **XWAVE X1** (design sheet): low angular hypercar on the same one-lane footprint — wide wheel arches and rear haunches, black panoramic canopy, V-shaped blue LED face with a blue lip, black lower body with blue LED lines, full-width red light bar and glowing blue XWAVE lettering on the rear fascia. The four wheel/thruster pods still spin and flip to thrusters in flight. All GT Coupe colourways use the X1 body.
- The car stays upright and points straight down the road (bank on lane changes cut to a light lean, almost no yaw).
- **One lane per hop**: while airborne the car can change lane once, then it must touch down. Exception: took off from the left/right edge lane holding an **Air Dash** booster → a second swipe in the same direction carries it to the far edge with a 360° flip (consumes the charge). A refused swipe shows "LAND FIRST". The fairness model and the test bot use the same rule (`tests/airlane.test.ts`).

## v1.8 changes

- Obstacles are matte (no neon glow halos / bloom): solid colours, thin non-glowing outlines.
- The hunter drone is removed from the game (no spawns, not in training); the floating ⇠ ⇢ sign is gone (sliding platforms keep their amber zone on the road).
- ~~Air flip on two lane changes without a booster~~ (replaced in v1.9 by the one-lane-per-hop rule).

## Difficulty system (v1.7)

`src/gameplay/Difficulty.ts`

- **Pattern library** — every spawner pattern has an id (P01–P15), tier, solving actions, minimum lead time, recovery time, an "occludes" flag and the worlds it may appear in.
- **Tiers** — T1 easy (weight 1) · T2 normal (2) · T3 hard (4) · T4 expert (7). Examples: crate/barrier/ring = T1; beam, two blockers, oncoming car, slow drone = T2; sliding platform, laser gate, triple wall = T3; mega gate (one door) = T4.
- **MapDifficultyConfig** per world: tier distribution, max fully-blocked lanes, min time gap, reaction slack, max consecutive hard rows, recovery after hard rows, density, moving-obstacle speed, warm-up distance.

| Map | Target | T1 / T2 / T3 / T4 | Notes |
|---|---|---|---|
| Future City | 2/10 | 75 / 25 / 0 / 0 | learning map: no lasers, walls or gates; slow drones |
| Cloud City | 4/10 | 55 / 35 / 10 / 0 | vertical obstacles, platforms rare |
| Neon Tunnel | 6/10 | 35 / 40 / 25 / 0 | lasers + triple walls |
| Space Zone | 8/10 | 20 / 35 / 35 / 10 | asteroids, drones, first gates |
| XWAVE Megacity | 9/10 | 10 / 25 / 45 / 20 | everything, clearly telegraphed |

Endless runs and the track list now follow this ladder (City → Cloud → Tunnel → Space → Megacity).

- **Selection** — tier first (map mix, damped in the first 30 % of a map, slightly raised in the last 25 %, shifted one step by EASY/HARD), then a pattern of that tier.
- **Spacing** — time-based: base curve, floored by the map's min gap × speed level, plus the pattern's own lead time (walls/gates/lasers get time to align) and recovery after T3/T4 rows.
- **No blind traps** — after a wall that hides the road (mega gate) the next row is T1–T2 with recovery spacing; hard streaks are capped per map.
- **Time-aware validation** — `Fairness.step()` tracks every (lane, height) state through each row using the real lane-switch / fly-up / fly-down / re-jump timings, now with a per-map **reaction slack** each forced move must leave. Candidates that fail are rejected and regenerated (reasons are counted).

### Readability & comfort

`src/render/Readability.ts` — one profile per world (lane glow, road tone, reflections, rail glow, hazard outline colour, dark-metal lift, bloom). Colour language: red/orange = danger, yellow = caution, cyan = navigation, green = safe opening, gold = collectible, purple = special. Cloud City lane glow −55 %, Neon Tunnel gets strong orange hazard outlines on lighter obstacle metal, asteroids get rims. **Comfort visuals** (Settings, on by default) lowers bloom, softens full-screen flashes, pulsing and speed lines.

In-world previews: yellow/black caution bar ~30 m before every T3+ row; mega gates paint the closed lanes red-hatched and lead into the door with green arrows; moving obstacles keep their ⇄ zones and green safe-lane arrows.

Guidance overlays: danger hints are a thin, ~34 %-opacity chevron at the screen edge on the side of the move (↑/↓ at the bottom), fade the moment the move is made, and a gesture stops being hinted after the player has answered it 3 times (toggle hints off/on in Settings to reset). Training prompts are a compact card in the sky area under the HUD; section banners are small and high.

### Rendering

The bloom composer now renders into an **MSAA target** (4×, WebGL2) — previously the canvas `antialias` flag was ignored behind post-processing. Pixel ratio cap 2.0 with **dynamic resolution steps** (2 → 1.75 → 1.5, then bloom off, only then LOW) instead of dropping straight to LOW; anisotropic filtering 8×; tighter, high-threshold bloom (0.3 / radius 0.22).

### Debug & tests

`?debug` shows map + target difficulty, speed level, the next row's pattern id / tier / time-to-collision / safe lanes (N/H/L) / reaction margin, the last collision explained, plus hitboxes. `npm test` runs:

- `tests/fairness.test.ts` — static reachability + a physics bot driving 144 km endless, all 5 tracks and 3 speed levels (0 crashes).
- `tests/difficulty.test.ts` — ~30,000 rows in 360 generated sequences (5 maps × 3 levels × 24 seeds): reachable path, allowed tiers per map, no expert in warm-up, min gaps, recovery after walls, no blind traps, hard-streak caps; prints the observed tier mix vs target and rejection reasons.

## Fairness guarantee

The game never generates an unavoidable pattern:

1. Every obstacle's hitboxes **and** the set of heights that pass it are defined once, in `src/gameplay/ObstacleRules.ts`. Runtime collision and the spawner read the same data.
2. The spawner (`src/gameplay/Spawner.ts`) tracks the set of `(lane, height)` states the player can be in, and only accepts a new row if at least one state is reachable in the time available (`src/gameplay/Fairness.ts`, using lane-step and vertical-action budgets from `config.ts`). Rejected patterns are re-rolled; the fallback is always a single dodgeable crate.
3. `npm run test:fairness` checks this statically (15k+ rows over 40 seeds) and dynamically: an autopilot using human inputs drives the real movement physics against the real hitboxes. Last run: **600 km across 40 seeds at up to max speed, 0 crashes.**

## Architecture

```
src/
  config.ts            all tuning: lanes, heights, timings, speed curve, fairness budgets, scoring
  main.ts              bootstrap + WebGL check
  Game.ts              state machine & orchestration (menu → countdown → run → crash/respawn → game over)
  core/                Input (swipe/keys), Save (localStorage), Pool, Rng, math/springs
  gameplay/            PURE LOGIC, no Three.js, runs in Node:
    Player.ts            movement state machine (lanes, LOW/NORMAL/HIGH phases, buffering, hitbox)
    World.ts             scrolling simulation, swept-AABB collision, near-miss, pickups
    Spawner.ts           pattern generator + speed curve + world sequence
    Fairness.ts          reachability model
    ObstacleRules.ts     hitboxes + pass masks (single source of truth)
    Run.ts               score, combo, power-ups, lives
    Missions.ts          mission defs + tracker
    Autopilot.ts         bot (tests / demo)
  render/              Three.js views (read-only consumers of gameplay state)
    Vehicle.ts           procedural XWAVE car + animation rig + skins
    ObstacleViews.ts     pooled obstacle meshes
    PickupViews.ts       instanced coins + power-up meshes
    Track.ts             scrolling road, instanced lamps & pylons
    Scenery.ts           sky, fog, lights, 5 world themes (lazy-built)
    Effects.ts           particles (1 draw call), speed lines, shield, rings, debris, portal
    CameraRig.ts         chase / menu / garage / crash cameras, FOV kick, shake
    Renderer.ts          renderer, tone mapping, half-res bloom (High quality)
    textures.ts          canvas-generated textures
    merge.ts             static-mesh merging for draw-call reduction
  audio/Audio.ts       Web Audio synth SFX + synthwave sequencer
  ui/                  DOM overlay UI (screens, HUD, garage, missions), CSS, inline SVG icons
  assets/              manifest + loader for optional GLB/audio replacements
public/assets/         drop-in folders for replacement files (see below)
tests/                 fairness & movement tests
```

The car is fixed at `z = 0` and the world scrolls toward it, which keeps float precision perfect on very long runs.

## Performance notes

- Target 60 FPS on modern phones. High quality = MSAA + half-resolution bloom, pixel ratio ≤ 2. Low = no bloom/MSAA, pixel ratio ≤ 1.25. The game drops to Low automatically if it can't hold ~42 FPS, and Low is the default on devices with ≤ 4 CPU cores.
- About 130–160 draw calls in a busy scene (Low). Coins, buildings, lamps, pylons and background traffic are instanced; all particles are a single `Points` draw; static parts of the car and obstacles are merged per material.
- Object pools for obstacles and power-ups; modulo-scrolled props (no spawning); world themes built lazily, ~300 m before they're needed.
- Fixed 120 Hz collision sub-steps + swept AABBs, so no tunnelling at top speed or on slow frames.

## Branding assets

- `src/assets/images/xwave-logo.png` / `xwave-mark.png` — XWAVE chrome logo (UI, billboards, car decals, Megacity arch)
- `src/assets/images/tracks/*.jpg` — track-select thumbnails
- `public/icons/` — app icon: `icon-1024.png` (1024×1024 master), 512/192 PNGs, maskable 512, `apple-touch-icon.png` (180), `favicon-32.png`; `public/manifest.webmanifest` makes the game installable ("Add to Home Screen")

## Replacing procedural assets

See `src/assets/manifest.ts`. Each entry lists its procedural builder and an optional `file`. Put a file in the matching `public/assets/<category>/` folder, set `file: 'assets/<category>/<name>.glb'` and it is loaded at boot, falling back to procedural automatically if it's missing. Car GLBs replace the body shell; thruster pods, wings and VFX stay procedural so the animations keep working. Conventions: +Y up, −Z forward, metres.

Audio: set `file` on any SFX id (`coin`, `crash`, `power`, `up`, `down`, `lane`, …) to override the synthesized sound.

## Tuning cheat-sheet (`src/config.ts`)

- `TIMING`: lane-change time, fly up/down phase durations, input buffer windows
- `HEIGHT` / `CAR_HALF`: car heights and hitbox (keep `ObstacleRules.ts` in sync if you change these)
- `SPEED`: start / max speed and ramp distance
- `FAIRNESS`: time budgets the spawner assumes a human needs (raise for an easier game)
- `SCORE`, `POWERUP_DURATION`, `WORLD_LENGTH`

After changing timings, run `npm run test:fairness`.

---

## Main Player Asset — 3D Futuristic Motorcycle & Rider (`models/bike_rider.glb`)

The main player vehicle visual representation has been rebuilt as a complete 3D **Futuristic Motorcycle with Articulated Rider** (`src/render/BikeRiderAsset.ts` & `src/render/Vehicle.ts`), exported to `models/bike_rider.glb` and `public/assets/vehicles/bike_rider.glb` with dedicated PBR texture maps in `textures/` and verification renders in `previews/`.

### 1. Coordinate System, Scale & Pivot Conventions
- **Axes:** `+Y` Up, `-Z` Forward (direction of travel down the track), `+X` Right (rider's right side, where the short cylindrical exhaust is mounted).
- **Units:** `1.0 unit = 1.0 metre`. Overall dimensions in `StraightRide`: length `2.06 m` (`Z: -1.02 .. +1.04`), width `0.98 m` (`X: -0.49 .. +0.49`), height `1.44 m` (`Y: 0.00 .. 1.44`).
- **Ground Contact & Pivots:**
  - `BikeRiderRoot` (`0, 0, 0`): Ground-level visual root (`Y = 0` at tyre contact patch).
  - `LeanPivot` (`0, 0.08, 0`): Low roll/bank pivot near the tyre contact patch so the motorcycle banks naturally into turns (`±28°`) and into the extreme `DownSlide` (`~68°`) while keeping the tyres grounded.
  - `PitchPivot` (`0, 0.25, 0` local / `0, 0.33, 0` world): Pitch pivot for take-off, airborne jump attitude, and suspension buzz.
  - `SteeringPivot` (`0, 0.72, -0.44`): Upper/lower triple clamps, gold USD fork stanchions, clip-on handlebars, and front wheel assembly.
  - `FrontWheelSpin` (`0, 0.31, -0.72`) & `RearWheelSpin` (`0, 0.33, 0.70`): Centered wheel spin pivots rotating around `-X`.

### 2. Node & Bone Hierarchy
- `BikeRiderRoot`
  - `LeanPivot`
    - `PitchPivot`
      - `ChassisOffset` (`0, -0.33, 0`)
        - `ChassisGroup` (`Bike_BodySilver`, `Bike_BodyCobalt`, `Bike_MechanicsDark`, `Bike_Saddle`, `Bike_CyanLights`, `Bike_RedTailLight`, `Bike_Windscreen`, `Bike_MirrorGlass`, `SwingarmGroup`, `SteeringPivot`, `FrontWheelSpin`, `RearWheelSpin`)
        - `Rider_SkinnedMesh` (multi-material skinned mesh bound to the 18-bone rider skeleton)
        - `Pelvis` (root bone of the 18-bone rider armature)
          - `Spine_1` → `Spine_2` → `Chest`
            - `Neck` → `Head`
            - `UpperArm_L` → `Forearm_L` → `Hand_L`
            - `UpperArm_R` → `Forearm_R` → `Hand_R`
          - `Thigh_L` → `Shin_L` → `Foot_L`
          - `Thigh_R` → `Shin_R` → `Foot_R`

All rigid armor pieces (5-segment silver Y-spine armor, hip plates, shoulder pauldrons, forearm guards, calf/shin plates, boots, and full-face helmet with rear cyan strips) have `100%` single-bone rigid skin weights (`1, 0, 0, 0`) so they never stretch or deform like rubber, while the graphite/cobalt racing suit blends smoothly across joints. Analytical 2-bone Inverse Kinematics (`solveTwoBoneIK`) locks `Hand_L`/`Hand_R` to the handlebar grips and `Foot_L`/`Foot_R` to the footpegs across every pose.

### 3. PBR Materials & Texture Mapping (`textures/` & `asset_manifest.json`)
- `textures/bike_rider_basecolor.png` (`1024×1024`, sRGB)
- `textures/bike_rider_normal.png` (`1024×1024`, Linear, `+Y` glTF tangent-space normal)
- `textures/bike_rider_roughness.png` (`1024×1024`, Linear)
- `textures/bike_rider_metallic.png` (`1024×1024`, Linear)
- `textures/bike_rider_ao.png` (`1024×1024`, Linear)
- `textures/bike_rider_orm.png` (`1024×1024`, Linear packed: `R = Ambient Occlusion`, `G = Roughness`, `B = Metallic`)
- `textures/bike_rider_emissive.png` (`1024×1024`, sRGB: controlled cyan `#12e0ff` for twin angular rear taillights, rear helmet strips, and front V-headlights; crimson `#ff1e38` for the small center rear marker light)

### 4. Animation Clips & Gameplay State Mapping
All animations are **in-place** (no root motion that alters gameplay trajectories or hitboxes):
1. `StraightRide` (Images 1 & 2) → Normal straight riding (`p.air = 0, p.vx = 0, p.retract = 0`).
2. `LeanLeft` (Image 6) → Left lane change / lateral velocity (`p.vx < 0`).
3. `LeanRight` (Image 4) → Right lane change / lateral velocity (`p.vx > 0`).
4. `AirborneJump` (Image 5) → Airborne / jumping state (`p.air > 0`); conventional two-wheel motorcycle attitude with no wings or flight engines.
5. `DownSlide` (Image 3) → Primary Down state (`p.retract → 1`) sliding beneath overhead barriers (`Y = 0.95 m`). The motorcycle banks nearly horizontal (`~68°`) while the rider presses their chest against the tank, lowers head/shoulders, and tucks limbs tightly, reducing the true geometric height of the asset from `~1.44 m` to `~0.75 m` without scaling/shrinking the model or altering camera/hitboxes.
6. `LowTuck` (Image 7) → Upright aerodynamic low tuck used as a transitional pose entering/exiting `DownSlide` and during ground turbo boost, and exported as a standalone clip in `models/bike_rider.glb`.

### 5. Source Scripts & Rebuilding (`source/`)
```bash
node source/generate_bike_rider.mjs   # Generates textures/*.png, models/bike_rider.glb, and public/assets/vehicles/bike_rider.glb
node source/render_previews.mjs       # Reopens models/bike_rider.glb in headless Chromium WebGL2 and renders previews/*.png
```
> **Note on Blender CLI:** `blender` CLI is not installed in this Linux container environment. The complete executable Blender Python script is provided at `source/build_bike_rider_blender.py` (`blender -b -P source/build_bike_rider_blender.py`) to pack textures and save `source/bike_rider.blend` + `models/bike_rider.glb` on any machine with Blender 3.6+/4.x installed.

