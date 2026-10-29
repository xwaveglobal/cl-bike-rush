# HS SDK kit — START HERE

This folder adds the HS SDK (rewards, ads, cloud save, shop, TikTok missions)
to a **native TikTok mini game** (`game.js` + `game.json`), and lets HS turn the
same game into an Android app later.

## You (the developer): 3 steps

1. Open your game project in your AI tool (Claude Code, Codex, Gemini, Cursor…)
   with this folder available to it.
2. Tell it: **"Read README.md in the hs-sdk folder and integrate the kit into
   my game."** It will ask you a few questions first.
3. When it is done, run the check it tells you about and fix every ❌.

No registration is needed while you are drafting — see
[INTEGRATE-WITH-AI.md](INTEGRATE-WITH-AI.md) "When do I register?".

---

## You (the AI assistant): your instructions

You are integrating this kit into the user's native TikTok mini game. Do this,
in order:

1. **Read [INTEGRATE-WITH-AI.md](INTEGRATE-WITH-AI.md) completely.** The fenced
   prompt in its "Step 1" is your task specification — follow it exactly
   (THE MODEL, API, TIKTOK REVIEW, RULES, WHEN DONE).
2. **Ask the user before writing any code — in ONE message, each question
   with your recommended answer** — and wait for the answers:
   - SAVE: `cloud` (recommended) or `local`
   - their HS Game ID and SDK key — or "none yet" (then leave them empty; the
     game runs offline until they register)
   - the questions under "BEFORE YOU WRITE CODE" in that prompt (Q1 save
     conflict screen + summary field, Q2 shop + ad moments, Q3 a sign-in button)
   Ask nothing else about platforms: the same code runs on TikTok and in the
   Android app, and `HSGame.has()` decides which buttons show where. Never ask
   which UI is "for TikTok" or "for Google Play", nor about ad providers,
   prices, login methods or Google Play setup — HS handles those.
   Never ask for, accept or write the TikTok **Client Secret** anywhere.
3. **Copy exactly two files next to the game's `game.js`:** `hs-game.js` and
   `hs-sdk.min.js` (from this folder). Never edit them. Copy nothing else into
   the game folder — this kit folder must stay OUTSIDE it, because everything
   in the game folder is uploaded to TikTok.
4. Integrate as the prompt says, then write `<game folder>.hs-dashboard.json`
   NEXT TO the game folder.
5. Run `node <this folder>/hs-check.mjs <game folder>` and fix every ❌ FAIL.
   Report the ⚠️ WARN lines to the user.
6. Self-check by hand: run `node <this folder>/web/hs-web.mjs preview <game folder>`,
   open the link it prints and click through ads, the shop and "Fresh install"
   (TikTok and Android, switch at the top) — or tell the user to. Everything
   in it is fake and offline.
7. Give the user the summary the prompt asks for ("WHEN DONE" → B).

**When the game already uses the kit** (a `hs-game.js` is next to its
`game.js`) and the user brings a NEW kit ("update the HS kit", "use the new
zip"…) — this is an UPGRADE, not a new integration:

1. Compare versions: the first line of each `hs-game.js` (`hs-game.js 3.x.y`),
   and `INTEGRATE-WITH-AI.md` → "What changed" for every version in between.
2. Replace `hs-game.js` and `hs-sdk.min.js` in the game folder with the ones
   from this folder. Do NOT re-integrate, restyle or rewrite working code.
3. Change game code only where "What changed" says a game must (an "Action"
   line), and update `<game folder>.hs-dashboard.json` the same way.
4. Run `hs-check` (0 ❌), tell the user what changed, and — if they send an
   Android build package — run `web/hs-web.mjs pack` again.

An upgrade asks none of the integration questions (SAVE, Q1–Q3): those were
answered the first time. The app's details and icon are already next to the
game folder (`<game>.android.json` or `android.json`, `<game>.icon-512.png`
or `icon-512.png`) — reuse them; ask only whether `version_name` goes up for
this release (e.g. 1.0.0 → 1.0.1). A game written in the older style
(`HSGame.save()` / `onLoad`) keeps working: an upgrade never moves it to
`HSGame.profile()` — that is a separate change, only when the user asks.

**When the user wants to upload to TikTok** ("build tiktok", "prepare the
TikTok upload", "pack for TikTok"…):

1. Check `project.config.json` in the game folder has `"appid"`: the TikTok
   **App ID** from the TikTok developer portal. If it is missing, ask the user
   for it (INTEGRATE-WITH-AI.md, step 0). Never ask for the Client Secret.
2. Run `node <this folder>/web/hs-web.mjs pack <game folder> --tiktok` and fix
   every ❌ it reports, then run it again. It writes `<game folder>-tiktok.zip`
   NEXT TO the game folder.
3. Tell the user how to upload that zip (the tool prints it): TikTok developer
   portal → the app → **Code version** → **Add code asset**, or TikTok's CLI
   from the game folder (`ttmg upload`). Do not upload it yourself.

**When the user wants the Android version** ("prepare the Android build",
"package for HS"…):

1. Ask for the app's details and write them NEXT TO the game folder as
   `<game folder>.android.json`:
   `{ "app_name", "package_name" (optional), "version_name", "privacy_policy_url", "contact_email" }`
   (rules: INTEGRATE-WITH-AI.md, step 5).
2. Ask for the app icon: a 512×512 PNG with a solid background. Save it next to
   the game folder as `<game folder>.icon-512.png`.
3. Run `node <this folder>/web/hs-web.mjs pack <game folder>` and fix what it
   reports. It writes `<game folder>-android.zip` — tell the user to send that
   one file to their HS contact.

Do not use the low-level SDK API directly (`HSTikTokSDK.*`) — the game talks
to `hs-game.js` only. [docs/SDK-REFERENCE.md](docs/SDK-REFERENCE.md) is for
engines that cannot use the kit, not for this task.

---

## What is in this folder

| File | |
|---|---|
| `INTEGRATE-WITH-AI.md` | the full guide + the AI prompt (steps 0–5) |
| `hs-game.js`, `hs-sdk.min.js` | the kit — the only two files that go into the game |
| `hs-check.mjs` | checks an integrated game (TikTok + Android), offline |
| `DASHBOARD-CONFIG.md` | the HS dashboard data: rewards, ad places, items, products |
| `web/` | `node web/hs-web.mjs preview <game folder>` (see it on a fake phone, TikTok or Android, offline) · `… pack <game folder> --tiktok` (the zip to upload to TikTok) · `… pack <game folder>` (the Android package for HS) |
| `docs/SDK-REFERENCE.md`, `sample/` | the low-level SDK, for other engines |

TikTok upload: tell your AI **"build tiktok"**. It checks the game and writes
`<game>-tiktok.zip` for the TikTok developer portal (INTEGRATE-WITH-AI.md, step 2b).

Android version: no code change. Tell your AI **"prepare the Android build"**,
then send the `<game>-android.zip` it makes to your HS contact
(INTEGRATE-WITH-AI.md, step 5).
