# Fix list — after v2.0.8 (owner review 2026-10-22)

Status: **DONE in v2.1.0** (2026-10-22). G2 note: new per-world obstacles are new LOOKS on the existing fair hitboxes (crate / barrier / beam); no new hitbox types were added.

## A. Gameplay / logic
- **A1. Special trước khi đua** — Retry also opens the choice. Replace the long popup with ONE big "SPECIAL" button (icon of the chosen item) on the pre-race step → opens the **Magic Bag** popup to pick; items you don't own have a **Buy with coins** area at the bottom of the same popup.
- **A2.** Bonus Retry after the event closed must not start (check `bonusState()` on retry / start).
- **A3. Hearts**: keep hearts. Every EXP race starts with **1 heart**; a **heart pickup** appears on the road about **every 1,000 EXP** (max 3 hearts). A heart absorbs a crash (respawn, no ad). Out of hearts → revive by ad (max 2) → 3rd → Start.
- **A4.** Bonus showcase specials (Wall Run / Sky Rail / Tunnel Rider): the real car position must follow the visual — coins under the road are not collected by a car on the wall / in the air (coins in its path fly to it: magnet on), obstacles it passes are smashed with sparks instead of going through the body.
- **A5.** Phase Ghost: no blinking — car turns into a steady translucent blue "hologram" for the effect.
- **A6.** Cars bought with coins in v1 above the player's rank: re-lock (rank-only rule) and refund their v1 price as coins once.
- **A7.** Turbo pickups rarer (harder to get: fewer, often in a lane next to an obstacle).
- **A8.** Specials cheaper (proposal: SOS 1,200 · Roadster 1,800 · HYPER 4,000) — owner to confirm numbers.
- **A9.** Bonus obstacles themed per place (replace the neon props): desert = rocks / cactus / oil barrels / pickup trucks; forest = logs / fallen trees / wooden barriers; country = hay bales / fences / tractors; sea = buoys / crates / boats on the causeway.
- Kept as is (owner): revive by ad adds EXP; turbo adds EXP.

## B. Text cut / squeezed (375×640, EN/DE/FR)
- **B1.** Special tiles: "Roadster Ju…" cut and "×1" on top of the name → count at the bottom corner.
- **B2.** Special descriptions clamped → short lines ("Rocket up before a crash", "Hop a whole block", "Fly over a long stretch").
- **B3.** Locked special tiles: 2-line ~9 px names → icon + short name (Tunnel / Wall / Ghost / Rail).
- **B4.** Profile "Car: XWAVE …" → just "Zenith".
- **B5.** "Watch ad · Revive" button too tight, DE "Werbung · Weiter" cut → smaller button text.
- **B6.** Bonus closed: "OPENS 02:00 AM · IN 17M" 2 huge lines → button "Opens 02:00", countdown in a small line.
- **B7.** EXP & rank guide: speed rule box breaks into 4 lines; S-tier note wraps → one short line each.
- **B8.** Endless card: "… D → AAA · NORMAL" splits → speed level as a small tag.
- **B9.** Profile: "HOW EXP WORKS", "BEST EXP", "THIS WEEK" wrap → "EXP guide", "Best", "Week".
- **B10.** Tutorial needs scrolling in German (624 > 602 px).

## C. Needs scrolling
- **C1.** Daily: missions are below the fold → 7-day check-in as a compact grid (4 + 3) so missions fit.

## D. Leftover v1 text / buttons
- **D1.** Home Shop tag "−80%" (old Starter Pack) → remove.
- **D2.** Profile: "CUPS" button + "Trophies" row; bag row "Your items · when to use them" → remove Cups/Trophies, bag row "Specials · 1 per race".
- **D3.** Home Bonus strip lost its time line → "OPEN · 42m left" / "Next 02:00".
- **D4.** Tutorial "Roadster guide" link; Roadster tile "Tap ROADSTER: clear 2 rows" → "Your special: tap to jump a block".
- **D5.** Settings "JUMP GUIDE" → remove (or "Specials guide").
- **D6.** Game Over with 0 coins: "Coins — +0" + "No coins to double" → hide both.
- **D7.** Lock toast says "Track 2" → "Mega Rush".
- **D8.** Item info cards still say "Equip" / "pick up on the road" → v2 wording.

## E. Layout / notices
- **E1.** Home: the Bonus "OPEN" tag sits right under the Daily button → move it onto the Bonus button.
- **E2.** Special popup rules = 3 lines → one line "Stored in your bag · 1 per race".
- **E3.** RANK GATE strip hidden by notices → strip below the notice lane; other notices wait while in a gate.
- **E4.** Rank-up notice queued behind "new best" / "new car" → rank-up first, the others merged into one line.
- **E5.** Game Over weekly rank "Week #32,172" looks odd at low EXP → show "Top x %" or hide under 1,000 EXP.

## F. Owner screenshots, round 2 (iPhone, artifact)
- **F1. Bug:** after finishing the training, back on Home all buttons are missing.
- **F2.** New logo → `docs/assets-inbox/logo-sky-roadster-v2.png` (2172×724 RGBA, sharp). Replace the home / result logo.
- **F3. Pilot card (rival + own):** remove Trophies; **new avatar set** (current helmets look bad); car name cut ("XWAVE In…") → short name; the EXP shield icon is hard to read → a clearer icon (e.g. "EXP" badge text or a speedometer); show **Average EXP** instead of Best EXP *(open: does the leaderboard / rank also use average, or stay on best run? see questions)*.
- **F4. Daily:** remove points + chests (coins only); add more daily missions related to v2 (EXP, ranks, specials, Bonus, distance, power-ups); **remove Near Miss from the whole game** (pop, stat, quest, result tile) — nobody understands it.
- **F5. Tracks 3–5:** not "Coming soon" — they unlock at **S / SS / SSS** (show the rank badge on each card).
- **F6. Practice (item info card):** "Practice it" = a practice road for **that special only** (SOS / Roadster / HYPER), no basic left/right/up/down steps, and **no shield pickups** in the practice. Item card text: shorter, v2 rules (no "spot the purple rocket on the road", no "win it in Cups").
- **F7. Profile:** nicer Magic Bag icon; much less text; remove Cups (= D2).
- **F8. Result screen:** title **"END"** instead of "GAME OVER"; no "how to avoid" tip; emphasise **this race's EXP**, the **rank reached** and the **leaderboard position**; minimal text.
- **F9. Revive popup:** no "how to avoid" tip, minimal text, focus on the button + revives left.
- **F10. Cars:** the car in `docs/assets-inbox/car-rank-C-rear.png` (1536×1024, background is a baked-in checkerboard → must be cut out) becomes the **rank C** car. Cars for **B and above are black silhouettes** (not visible until unlocked). Ladder becomes D Zenith · C new car · B · A · AA · AAA.

## Owner answers (2026-10-22 02:11)
1. **Average EXP** only on OTHER pilots' cards; the player's own profile shows **best** only. Rank / leaderboard stay on best run.
2. Special prices OK: **SOS 1,200 · Roadster 1,800 · HYPER 4,000**.
3. Rank-C car name: Claude picks → **XWAVE Vega**. B → AAA stay Volt · Phantom · Inferno · Nexus.

## G. Endless variety (owner request 02:11)
- **G1. No repeats before AAA.** Today 5 worlds loop every 5 km (≈ 2 min). New: a **12-world ladder** tied to EXP (same minutes on every speed level) — **2 worlds per rank phase**, each ending in that phase's rank gate; only after AAA does the ladder start again.
  - D: Future City → Neon Harbor · C: Cloud City → Solar Farms · B: Neon Tunnel → Crystal Canyon · A: Space Zone → Asteroid Belt · AA: XWAVE Megacity → Storm Front · AAA: Volcano Core → Aurora Ice.
  - 7 new sceneries (Neon Harbor, Solar Farms, Crystal Canyon, Asteroid Belt, Storm Front, Volcano Core, Aurora Ice).
- **G2. New obstacles per phase** (signature of each rank, all through the fairness validator; built on the existing low / high / full / moving hitboxes so `ObstacleRules.ts` stays the single source):
  - C: road-works barrier + cone line (low), sign gantry (high).
  - B: rolling container (moving lane block), double laser fence.
  - A: lane-switching truck (sweeps 2 lanes, like the sliding platform), drop-gate.
  - AA: crusher pillars (full block, alternating), storm debris.
  - AAA: lava jets / ice walls (timed open lane), mixed combos.
## (answered) questions
1. F3 "Average EXP": shown on the pilot card only, or should rank / leaderboard use average too? (Design today: rank = best single run.)
2. A8 special prices: SOS 1,200 · Roadster 1,800 · HYPER 4,000 OK?
3. F10: name of the rank-C car? Cars B → AAA keep Volt / Phantom / Inferno / Nexus?

## H. Round 3 — training (owner 2026-10-22 06:30) — done v2.2.0
- **H1.** No ad after a training / practice ends (`afterResults` must skip the interstitial when the finished run was training).
- **H2.** Basic training: no Shield pickup on the road (remove the shield at 412 m), and its hint "Road power-ups: Shield, …" → mention only Magnet / Turbo / ×2.
- **H3.** Basic training: remove the coin line at the very end (600–630 m) — the road just runs out to the finish.
- **H4.** Training end card (basic + every special practice): add a **Home** button.
- Found while checking (Claude):
- **H5.** After a special practice, "Replay training" restarts the BASIC training → should replay the same practice (Roadster / HYPER / SOS).
- **H6.** During training the HUD shows "EXP 0" and the daily-mission strip ("Play 3 races") — training earns nothing → hide the EXP box value / show "TRAINING", hide the mission strip.
- **H7.** The end card text says "Race Endless" even after a special practice → for practices show "Back to the bag" / "Race" + "Home".

## I. Round 4 — Bonus redesign (owner 2026-10-22 06:34) — done v2.2.0
- **I1.** A Bonus road lasts **5 minutes** (finish line at 5 min of non-stop driving), **one play per event** (after the finish / end, the card shows "Played · next at hh:mm").
- **I2.** **Normal items appear as usual** on Bonus roads (Magnet, Shield, Turbo, ×2 coins, hearts).
- **I3.** **Special items appear only now and then (probability)**, not as a parade. Coin-bought specials (SOS / Roadster / HYPER) are a rare drop.
- **I4. Every special has its own situation ("set piece")** — the pickup appears just before it and, once picked up, fires by itself into that situation. The set piece is spawned **only after the pickup is collected** (miss it → nothing special happens, the road stays fair):
  - **Roadster** → a wall of cars across all lanes right after → auto-hop over the cars.
  - **HYPER** → one big obstacle (mega gate / truck convoy) → auto long flight over it.
  - **SOS** → a dense convoy filling the road → auto rocket up, glide down behind it.
  - **Tunnel Rider** → appears **only on Bonus roads that have a tunnel**, just before the tunnel → the car drives upside-down on the tunnel roof through it.
  - **Wall Run** → a row blocked in every lane → the car runs along the side wall past it.
  - **Sky Rail** → a rail gantry over a busy stretch → the car hooks the rail and glides over it.
  - **Phase Ghost** → a laser-fence / mixed obstacle zone → the car turns into a hologram and passes through.
- **I5.** Bonus roads get **tunnel sections** (needed for Tunnel Rider): e.g. rock tunnel in the desert, tree tunnel in the forest, barn/haystack tunnel in the country, sea tunnel on the causeway.
- **I6.** Bonus coin reward re-balanced for 5 minutes (finish bonus + coins on the road), still coins only.

## J. Round 5 — leaderboard (owner 2026-10-22 06:47) — done v2.2.0
- **J1.** Sample bots: only a **few AAA** at the very top; the rest spread over D → AA (realistic pyramid: many D/C, fewer B/A, a handful of AA, very few AAA).
- **J2.** Row layout, left → right: **position with a label** ("#12" in a "RANK" pill; top 3 = gold / silver / bronze) · avatar · name + flag · rank-class badge · **EXP value with the EXP badge** on the right.
- **J3.** Make the two numbers impossible to confuse: **position** = "#…" (lower is better, #1 best) vs **EXP** = number with the EXP badge (higher is better). Column header line: "RANK · PILOT · EXP".
- **J4.** The **YOU** row gets a glowing outline (stands out).
- **J5.** YOU row today shows the rank class twice (corner on the avatar + separate D badge) → keep one.
- **J6.** Far-down positions (e.g. #33,051) → show "#33,051" with "Top 14%" underneath so a low position still reads as progress.

## K. Round 6 — EXP & rank guide (owner 2026-10-22 06:48) — done v2.2.0
- **K1.** Remove the minutes columns (Hard / Normal / Easy). Table = **RANK · EXP · UNLOCKS**.
- **K2.** "Unlocks" per rank (icon + short name):
  D Zenith · C XWAVE Vega · B Volt · A Phantom · AA Inferno ·
  AAA Nexus + Mega Rush + AAA specials (Tunnel / Wall / Ghost / Rail) ·
  S Ocean Drive · SS Volcano Run · SSS Aurora Peak.
- **K3.** Keep only the EXP conversion line (EXP = metres × Hard 2 · Normal 1.15 · Easy 1) and "EXP can't be bought"; the S/SS/SSS note is covered by the table.

## L. Round 7 — Magic Bag (owner 2026-10-22 06:50) — done v2.2.0
- **L1.** Re-organise "what's in my bag": an **"In your bag"** row that always shows all 3 specials (SOS · Roadster · HYPER) with their count (×0 greyed out), so it is obvious what you own; "Get with coins" below; AAA teasers last.
- **L2.** Starting items: **1 HYPER + 2 Roadster** for new players (existing players get the difference once as a gift).
- **L3.** Tapping an owned special (pre-race pick) opens a **confirm popup**: "Take Roadster into this race?" → [Take it] / [Cancel].
- **L4.** The empty option reads clearly: **"Race without a special"** (instead of "None").
- **L5.** (07:03) Buying is **separate** from the bag: the bag shows only what you own + a **"Buy items"** button; tapping it opens a **Buy popup** (SOS / Roadster / HYPER with coin prices). After buying, back to the bag.

## M. Round 8 — Home, Missions, first Play (owner 2026-10-22 06:59) — done v2.2.0
- **M1.** Language button only in **Settings** (remove it from the Home top bar).
- **M2.** Home profile chip: the avatar must not cover text; show name + rank badge + EXP cleanly (today "#33,045 EXP ⋮" is cut).
- **M3.** **Missions back as their own screen** (separate from Daily, like v1): auto-collect switch (on by default); when off, finished missions wait in a list with a Claim button each + "Claim all".
- **M4.** Write many fun scenarios for both:
  - *Daily* (4 a day, reset at midnight, coins): pass a rank gate · reach the 2nd world of a rank · clear a car block with a special · pick up 2 hearts in one race · finish a Bonus road · 3 races on Hard · 1,000 EXP without losing a heart · grab a Turbo and keep it to the end · fly through 10 rings · drive 8 km in one race …
  - *Missions* (long career chains, 3 active, tiers with growing rewards + a pilot level): reach rank C → B → A → AA → AAA · drive 50 / 200 / 1,000 km in total · visit all 12 Endless worlds · finish 5 / 20 / 50 Bonus roads · use 10 / 50 specials · collect 5k / 25k / 100k coins · unlock every car · beat your best EXP 10 times …
- **M5.** Remove the line explaining Easy / Normal / Hard under the speed selector.
- **M6.** Remove the Bonus strip on Home (the Bonus button on the left rail is enough).
- **M7.** Bigger **Play** button.
- **M8.** First Play: show the **training card** first (what you will learn) with **Start training** and **Skip**; Skip goes straight to the track list.

## N. Round 9 — Garage (owner 2026-10-22 07:02) — done v2.2.0
- **N1.** Move the 3D car lower in the garage so the info panel does not cover it.
- **N2.** Car thumbnails must show the real in-race car: the Zenith "In use" card still shows the old studio art (blue exhaust flames) → rebuild the Zenith thumb from the in-race rear render (same style as Vega's), and keep thumbs in sync with each car's race sprite.
- **N3.** After the last car (Nexus, AAA) add a **"MORE"** card: more cars that unlock beyond AAA (S / SS / SSS) — shown as locked silhouettes with the rank badge, tap → "Reach rank S on Mega Rush".

## O. Round 10 — modal spacing (owner 2026-10-22 07:05)
- **O1.** Every popup card (training complete, revive, END, bonus, item card, special pick, profile…): text and buttons sit too close → consistent vertical rhythm (gap between title / text / buttons, comfortable line height).
- (= H4) Training complete card needs a **Home** button.

Owner 07:05: "rà soát sửa toàn bộ" → fix H–O now.

## P. Round 11 — entry reward, share, Endless FINISH card (owner 2026-10-22 07:09)
- **P1.** Entry Reward card: tapping a step box opens the profile panel (steps 1–3 all lead to the profile).
- **P2.** Share card: tapping the car (arrow) captures that image and opens the share sheet with it.
- **P3.** Endless end screen titled **FINISH**. From rank **C** up, a special "brag" card (big rank shield, EXP, car, glow) built to be shared; below C keep the normal card.
- **P4.** Share button must really share (Web Share with the image; fallback download + copy link).
- **P5.** Check every button's action works.

## Q. Round 12 — profile (owner 2026-10-22 07:15)
- **Q1.** Profile: remove the "week" line; show the rank (e.g. D) and the EXP **very big** so players feel how important / cool they are.
- **Q2.** From rank **A** the avatar gets a glowing outline; higher ranks get stronger special effects (AA gold pulse, AAA rotating neon ring, S/SS/SSS flame/aurora ring + sparkles).

## R. Round 13 — END screen (owner 2026-10-22 07:18)
- **R1.** Distance / Best boxes: borders drawn inside a bordered box → overlapping frames; flatten to one clean row.
- **R2.** "EXP guide" link on the END screen does nothing → must open the guide on top of the result.
- (Claude) "Top 100% this week" is meaningless for a weak run → hide the position chip when it is worse than Top 50%.

## S. Round 14 — car glow (owner 2026-10-22 07:21)
- **S1.** After Turbo / Shield end, the car keeps a glowing outline → the outline must show only while a power-up that needs it is active (no glow for Magnet / ×2).

## T. Round 15 — rings & mystery boxes (owner 2026-10-22 07:22)
- **T1.** Flying through an energy RING gives a random reward (coins or a road power-up).
- **T2.** Random **mystery boxes** on the road (coins / power-up / heart).
- **T3.** Combine difficulty and item placement for tricks: boxes sit where you must hop over a barrier or duck under a beam at the right moment to grab them.

## U. Round 16 — beat your best (owner 2026-10-22 07:25)
- **U1.** During a race show the **Best EXP** ever next to the run EXP, so there is a target to chase.
- **U2.** When the run gets close to the best: a short, non-blocking encouragement ("1,000 EXP to your best!", "So close!").
- **U3.** When the best is beaten: a celebration ("YOU BEAT YOURSELF!") that never gets in the way of driving.

## V. Round 17 — Roadster jump feel (owner 2026-10-22 07:27)
- **V1.** Roadster jump (training and set pieces): spacing tuned so the jump clears **4 car rows** exactly.
- **V2.** At the end of the jump, while the car rolls in the air: short **slow motion** + a slow camera swing — a "wow" moment.

## W. Round 18 (owner 2026-10-22 07:31–07:32)
- **W1.** When Turbo ends, the road speed must go back to the speed level the player chose (Easy / Normal / Hard).
- **W2.** "Double score" → **Double EXP** (×2 EXP while it lasts).
- **W3.** Item pickup notices are too big → smaller.

## X. Round 19 (owner 2026-10-22 07:36)
- **X1.** Speed levels faster: Easy +5 %, Normal +10 %, Hard +15 % (EXP per metre re-calibrated so the minutes per rank stay as designed).

**H–X: all done in v2.2.0.**

## Y. Round 20 (owner 2026-10-22 07:47)
- **Y1.** Flying through a RING = **Double COIN** for a while (not a random reward, not EXP).
- **Y2.** Share card: the car looks bad (thumbnail box) → transparent in-race render; the SHARE header text is cut / misplaced; Save image can't work inside the artifact → hide it there.
- **Y3.** Special pick popup: lines still too close → more spacing.
- **Y4.** Share popup: "SHARED TODAY · BACK TOMORROW" cut and the tap hand covers the text; sharing the game link must work (falls back to copying the link).
- **Y5.** Add-to-screen popup: Share / Copy Link / More / Add tiles must do something.
- **Y6.** Normal and Hard another **+10 %** speed (EXP re-calibrated).

**Y: done in v2.2.2.**

## Z. Round 21 (owner 2026-10-22 08:17)
- **Z1.** Bonus card: lines still too close.
- **Z2.** Coins: main road +20 %; Bonus road only ~10 % more coins than the main road.
- **Z3.** Bonus: a few fewer items. **Z4.** Mystery boxes only now and then.
- **Z5.** Celebration when finishing a Bonus road.
- **Z6.** Quitting a race half-way to Home must not show the result screen.
- **Z7.** Speed levels (Easy / Normal / Hard) are critical: check for bugs, make them clearly different and smooth.
- **Z8.** Show the speed level (EASY / NORMAL / HARD) on the race HUD.
- **Z9.** Race HUD shows the next goal (next rank + EXP needed).
- **Z10.** End-screen ad: **+20 % coins**, not ×2.
- **Z11.** Leaderboard row: the badge after the name looks broken.
- **Z12.** Car pictures (brag card, share card): use the clean transparent in-race car, no stretched thumbnail; nicer layout.

**Z: done in v2.2.3.**

## AA. Round 22 (owner 2026-10-22 08:35)
- **AA1.** Retry buttons don't restart the race (check every Retry).
- **AA2.** Race HUD: reset at the start of each race (no old values); make clear which rank THIS race has reached; keep the player's own rank (profile) visible during the race.
- **AA3.** Normal FINISH card: rank and EXP stand out more; Share must work.
- **AA4.** Main road (EXP road) must feel as fun as v1: compare v1's coin layout and obstacle rhythm and bring that feel back.
- **AA5.** (08:37) Pause → Home must still show THIS race's result screen (the race ends and counts), then Home from there. (replaces Z6)

**AA: done in v2.2.4.**

## AB. Round 23 (owner 09:03) — done v2.2.5
- Avatar on Home shows the all-time rank; buttons in the glossy style of the side buttons; PLAY stands out.
- (09:06) Same glossy style for the buttons on every other screen — done v2.2.6.
- (09:09) Home buttons exactly like the reference shot (style + colours) — done v2.2.7.
- (09:12) Home exactly like the owner's mock-up image — done v2.2.8.
- (09:16) Side tiles smaller + same size, balanced fonts (tiles, speed, bottom row) — done v2.2.9.
- (09:18) Side tiles a bit smaller, equal squares; softer borders incl. the bottom row — done v2.2.10.
- (09:21) Easy / Normal / Hard in different colours, default Normal — done v2.2.11.
