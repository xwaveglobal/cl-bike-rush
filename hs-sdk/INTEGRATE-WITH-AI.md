# Add the HS SDK to your TikTok mini game — with your AI assistant

For **native** TikTok mini games (a `game.js` + `game.json` package drawn on a
canvas). TikTok no longer accepts H5 games.

**One game, two platforms.** You build the TikTok mini game. HS can pack the
**same files** into an Android app (Google Play) later — no second version to
write. The kit tells the game what each platform has (`HSGame.has(...)`), so
the TikTok-only parts (Entry / Launch Reward) hide themselves on Android, and
the shop or ads appear only once they exist.

**How it works, in one picture**

```
your game                          HS kit                               HS dashboard (no new build)
─────────                          ──────                               ─────────────────────────────
progress → HSGame.profile({...})   saved on the phone (+ cloud)         rewards:  mission_a → { hint: 2 }
mission done → claim('mission_a') ─┐                                     placements: revive → TikTok ad ids
ad moment    → showAd('revive')   ─┼─► looks up the key ─► profile      items:    hint → { name, icon }
share button → share({...})       ─┤   (dashboard, else your            products: Gold pack → { coins: 200 }
purchase     → (automatic)        ─┘    defaults)          (+2 hint → the "hint" field)
```

Your game only says **"this moment happened"** (a key) and keeps its progress
in **one profile**. What a moment is worth, and whether an ad shows there at
all, is data you can change any time. Saving, cloud, and "same account on two
phones" are handled for you.

You need:

1. **The kit** next to your `game.js`: `hs-game.js` and `hs-sdk.min.js`
   (called `hs-tiktok-sdk.min.js` before 1.1 — replace the old one).
2. **Node.js**, to run the check (step 2) and the preview (step 5).
3. **Nothing registered yet.** Drafts and prototypes need no TikTok app and no
   HS registration — see "When do I register?" below.

### When do I register?

| Stage | Register? | What works |
|---|---|---|
| **Draft / prototype** (any number of them) | ❌ no — leave gameId / sdkKey empty | the whole game; progress saved on the device; rewards from your DEFAULTS; `hs-check`; the preview (step 5). Login, cloud, the shop and real ads are off. |
| **Ready to test on TikTok** | ✅ once per game: a TikTok app + an HS game (step 0) | everything: login, cloud save, ads, shop, dashboard config |
| **Android version** | ❌ not you — HS registers it (step 5) | — |

Each **platform is its own HS game** with its own Game ID and SDK key: you
register the TikTok one; HS registers the Android one when it builds the app.

---

## Step 0 — register (only when the game is ready for TikTok)

Create the game's app in the **TikTok developer console** first. You need its
**App ID**, **Client Key** and **Client Secret**.

1. HS dashboard → **Games** → **Add Game**.
2. Fill in — all four are required:

   | Field | What to put | Used for |
   |---|---|---|
   | Game Name | anything you like, e.g. `Rotate Rings` | the dashboard |
   | Game ID | your TikTok **App ID** — numbers only, e.g. `7618488811156293643` | identifies the game everywhere |
   | Client Key | the TikTok **Client Key** of the app | TikTok login and payments |
   | Client Secret | the TikTok **Client Secret** of the app | TikTok login, payments and TikTok's notifications — stays on HS's server |

3. Save. The dashboard shows your **SDK key** (`sk_live_…`) — copy it. It is
   also in the Games list later (click it to copy).
4. Put the **Game ID** and **SDK key** into `game.js` (`HSGame.start({ gameId, sdkKey })`).
   Every online feature needs both: without them the game still runs, offline.

> 🔒 The **Client Secret** goes into the dashboard **only** — never into
> `game.js`, the prompt below, a chat, or a screenshot. Everything in `game.js`
> is public. The SDK key and Game ID are fine in `game.js`: they identify the
> game, they are not secrets.

Also put the **App ID** (or Client Key, as your TikTok CLI asks) into your
game's `project.config.json` → `"appid"`.

---

## Step 1 — let your AI do the integration

**Easiest:** give your AI tool (Claude Code, Codex, Gemini, Cursor…) this kit
folder — keep it next to your game folder, **not inside it** — and say:
*"Read README.md in the hs-sdk folder and integrate the kit into my game."*
It reads this guide, asks you the questions below, and does the rest.

**Or by hand:** copy everything in the box below and paste it to your AI.

Open your game folder in Claude Code / Cursor / your AI tool. Fill in the SAVE
line. Game ID and SDK key: from step 0 — or leave them empty while drafting and
add them later (NEVER the Client Secret).

````text
Integrate the HS TikTok SDK kit into my native TikTok mini game.
hs-game.js and hs-sdk.min.js are already next to game.js — do NOT edit them.

gameId: <PASTE GAME ID, or leave empty while drafting>
sdkKey: <PASTE SDK KEY, or leave empty while drafting>
SAVE: cloud            <- cloud (this account on any phone; default) | local (this phone only)

BEFORE YOU WRITE CODE — ask me these in ONE message, each with your
recommended answer, so I can reply "ok" or change one. Wait for my answers.
  SAVE  cloud (recommended): progress follows the player to a new phone ·
        local: progress stays on this phone only.
  Never ask me about what HSGame decides by itself: which buttons are for
  TikTok or for Android (HSGame.has() decides), the ad provider, prices,
  login method, or Google Play setup. Those are HS's job, not mine.
 Q1 (SAVE: cloud only) A player may play as a guest first, then log in to an
    account that already has its own saved progress. HSGame then asks the
    player which progress to keep ("Account" / "This phone"). How should the
    question look?
      a) the system popup HSGame shows by itself (no work, plain look) — recommended
      b) my own screen in the game's style (you build it with
         HSGame.on('accountConflict', ...) — see the API below)
    Also: which ONE profile field best shows progress in that question
    (e.g. level)? It goes into profile options as summary: '<field>'.
 Q2 Will the game ever SELL things (now or later)? Recommend yes when the game
    already has something worth selling (hints, lives, No Ads, skins), else no.
    yes → write the shop now
    (it stays hidden until products exist, rule 13) · no → no shop code at all.
    And at which moments may an ad show (level end, revive, double reward…)?
    Suggest the usual ones for this game and let me confirm.
 Q3 (SAVE: cloud only) Players are signed in silently when the platform can
    (TikTok; Android when Google sign-in is set up). A player who is not stays
    a guest with device saves. Show a "Sign in to save your progress" button
    for them (e.g. in Settings)? yes → build it with HSGame.login() (see API) ·
    no → silent sign-in only (recommended for a first version).

THE MODEL
1. ALL of the player's progress lives in ONE profile object owned by HSGame.
   The game reads it and changes it only through the profile API. HSGame saves
   it on the phone and (SAVE: cloud) in the cloud, and restores it on a new
   phone. Never use localStorage or tt.setStorageSync for progress.
2. My game never decides what a reward is worth. It only reports that a
   moment happened, by KEY. The HS dashboard (or my defaults when offline)
   decides what the key gives, and HSGame adds it to the profile.
3. The same files run on TikTok AND in an Android app made from them. The game
   never asks which platform it is on: every feature button is shown only when
   HSGame.has('<feature>') is true. Ads and payments are HSGame's job on both.

API (hs-game.js) — use only this:

  var HSGame = require('./hs-game.js');            // top of game.js

  // 1. The profile — FIRST, before anything else uses progress.
  var profile = HSGame.profile({                   // every field with its starting value
    level: 1, best_score: 0, coins: 0, hint: 3,    // numbers that rewards can add to
    sound: true                                    // settings
  }, {
    save: 'cloud',                                 // from the SAVE line
    local: ['sound'],                              // settings that stay on this phone
    merge: { level: 'max', best_score: 'max' },    // fields that only go up: 'max'
    summary: 'level'                               // from my answer to Q1
  });
  profile.get('coins');  profile.add('coins', -10);  profile.set('level', 4);  profile.update({...});
  profile.on('coins', function (now, before) { redrawCoins(now); });   // redraw UI here, nowhere else

  // 2. Start, once.
  HSGame.start({
    gameId: '', sdkKey: '',                        // from the lines above — empty while drafting
    defaults: DEFAULTS                             // see "DEFAULTS" below
  }).then(function () { showMainMenu(); });       // claims work after this resolves
  // A game with no menu starts playing at once, from the profile — never wait
  // for start(); only claim() needs it (before that it returns null).

  // 3. Moments.
  HSGame.claim(key)              // a moment completed -> its reward is added to the profile.
                                  // Returns the items (for a "+2 hints" toast) or null.
                                  // Never for ad places or "share" — those pay themselves.
  HSGame.available(key)          // true if claim(key) would give something now ("!" badge)
  HSGame.rewards(key)            // { hint: 2 } — to show "Reward: 2 hints" before it is earned
                                  // (items only — never "$limit"; null when the key gives nothing)

  HSGame.showAd(place)           // show the ad set up for this place. Promise:
                                  //   null = no ad / closed early,  {} = ad done, no reward,
                                  //   {...} = ad done and reward added
                                  // An ad that only lets the player go on (revive, skip a
                                  // level) needs NO reward entry: watched = {} → continue.
  HSGame.canShowAd(place)        // show/hide a "watch ad" button — ask every time it is drawn

  HSGame.share({ title, subtitle, imageUrl })   // share sheet. Promise: null = not shared,
                                                 //   {} = shared, no reward here, {...} = shared + reward
                                                 //   of key "share" (once a day) added
  HSGame.canShare()

  // ANY action can feed the game's OWN tasks — share, ad, level, login days…:
  // the game counts, decides when the task is complete, then claims its key.
  //   HSGame.share({...}).then(function (r) {
  //     if (r) { profile.add('shares_today', 1); if (profile.get('shares_today') === 3) HSGame.claim('task_share_3'); }
  //   });
  // What task_share_3 gives (or nothing, or nothing on one platform) is dashboard data.

  HSGame.tiktokMission.start('profile')     // TikTok's own missions: the button sends the player
  HSGame.tiktokMission.start('shortcut')    // off; the reward (keys tiktok_profile / tiktok_shortcut)
  HSGame.tiktokMission.done('profile')      // is added when TikTok confirms. done(): hide the "!"

  HSGame.shop()                  // Promise: [{ product_id, name, description, beans_cost, items, ...icon/badge }]
                                  // A dashboard product's "id" arrives as product_id, its "rewards" as items.
                                  // Buy with HSGame.buy(p.product_id).
                                  // Android adds price ("₫25,000", Google's own text) + currency:
                                  //   label = p.price || (p.beans_cost + ' Beans')   — never compute a price yourself.
  HSGame.buy(productId)          // Promise: { ok, error, delivered } — the items are added by HSGame.
                                  // ok && !delivered: paid, arrives at next start — say so.
                                  // A permanent unlock the player has (No Ads, a skin): show "Owned", no buy button.

  HSGame.has(feature)            // is this feature on HERE, now? Ask every time you draw the button:
                                  //   'tiktok_missions' Entry + Launch Reward (TikTok only)
                                  //   'share'  'ads'  'shop'  'cloud'
  HSGame.on('pause',  function () { muteMusic(); freezeGame(); })   // an ad, a purchase or the app
  HSGame.on('resume', function () { unmuteMusic(); unfreezeGame(); }) // went away — and came back

  HSGame.item(id)                // { category, name, icon } — name/icon for any item, from the dashboard
  HSGame.on('given', function (items, from) { toast(items); })   // after ANY reward
  // Q3 = yes only. Draw it while HSGame.canSignIn (a guest, or an Android device account that can still sign in to Google):
  //   button "Sign in to save your progress" → HSGame.login().then(function (r) { if (r.loggedIn) toast('Saved to your account'); });
  HSGame.on('otherDevice', function () {           // SAVE: cloud — this account was opened on another phone
    showMessage('Playing on another device', 'Play here', function () { HSGame.takeOver(); });
  });
  // Q1 = b only. info = { field: 'level', device: 3, account: 12 }. Call choose
  // exactly once: 'account' (default, safe) or 'device'. Uploads wait for it.
  HSGame.on('accountConflict', function (info, choose) {
    showChoice('This account already has ' + info.field + ' ' + info.account + '. This phone has ' + info.device + '.',
      ['Keep account', function () { choose('account'); }],
      ['Keep this phone', function () { choose('device'); }]);
  });

  // Only for an item that is NOT a number field of the profile (e.g. a skin unlock):
  //   HSGame.start({ ..., onGive: function (items, from) { unlock(items) } })
  // onGive gets ONLY those items; throw for anything unknown — nothing is lost.
  // A game in the older style (HSGame.save(progress), no profile): onGive adds
  // the items AND calls HSGame.save(progress) before it returns (RULE 15):
  //   onGive: function (items, from) { addItems(items); HSGame.save(progress()); }

DEFAULTS — write this object in game.js. It is also what I paste into the
dashboard, so keep it complete:

  var DEFAULTS = {
    rewards: {
      // key: { item: count, ..., "$limit": "once" | "daily" }   (no $limit = every time)
      // an item here is a NUMBER field of the profile (or handled in onGive)
      mission_a:       { hint: 2, $limit: 'once' },
      daily_gift:      { coins: 50, $limit: 'daily' },
      level_bonus:     { coins: 20 },                 // claim('level_bonus') at each level end
      double_coins:    { coins: 40 },                 // the reward of the ad place "double_coins"
      // no "revive" entry: that ad only lets the player go on (showAd → {} → continue)
      share:           { hint: 3, $limit: 'daily' },
      tiktok_shortcut: { hint: 3 },                    // opened from the home-screen icon (once)
      tiktok_profile:  { hint: 3 }                     // came in from the TikTok profile (once)
    },
    items: {
      // id: { category, name, icon? }
      hint:  { category: 'consumable', name: 'Hint' },
      coins: { category: 'currency',   name: 'Coins' }
    }
  };

TIKTOK REVIEW — required, or TikTok rejects the game
On the screen the player sees when the game opens (home / level select), show
three buttons, each with a small "!" badge until done, and each opening a popup
with numbered steps and the reward (HSGame.rewards(key)), like this:

  if (HSGame.has('tiktok_missions')) {
    "Entry Reward" → popup:  1. Go to your TikTok profile  2. Open "TikTok Minis"
                             3. Open this game from there  4. Come back and get the reward
                   button "Go" → HSGame.tiktokMission.start('profile')       // reward key tiktok_profile
    "Launch Reward" → popup: 1. Tap "Go"  2. Add the game to your home screen
                             3. Open the game from the new icon  4. Get the reward
                   button "Go" → HSGame.tiktokMission.start('shortcut')      // reward key tiktok_shortcut
    badge "!" while !HSGame.tiktokMission.done('profile') / done('shortcut'); hide the button when done
  }
  if (HSGame.has('share')) {
    "Share" → popup: "Share the game with friends" + reward → HSGame.share({ title, subtitle })
  }

Everything else on screen stays the game's own style. These buttons must not
cover the playing area.

RULES
 0. Keep MY game's design. Connect what the game already has — its rewards,
    its hints / lives / currency, its ad moments — to HSGame. Do NOT add new
    currencies, inventories, daily gifts, bonuses or screens the game does not
    have (the examples in this guide are examples, not a to-do list). Ideas
    that would earn more go into the ONE questions message as suggestions; build
    them only if I say yes. Only the TikTok review buttons (Entry Reward,
    Launch Reward, Share) are always added.
 1. Native only: no DOM, window, document, <script> or localStorage unless the
    game already shims them. Use only these tt APIs (they also exist in the
    Android app): createCanvas, createImage, loadFont, getSystemInfoSync,
    getMenuButtonBoundingClientRect, onTouchStart/Move/End/Cancel,
    createInnerAudioContext, createWebAudioContext, get/set/removeStorageSync,
    onShow/onHide, request, showToast/showModal/showLoading, vibrateShort/Long,
    setKeepScreenOn, requestAnimationFrame. Anything else: ask me first.
 2. ALL progress is in the profile, changed only with set/add/update. UI is
    redrawn in profile.on(...). Never keep a second copy of a value that is
    in the profile. Never write storage yourself.
 3. Fields that only go up (level, best_score, unlocked_count) use merge 'max'.
    Coins, hints and other things that are spent: leave the default.
 4. Keys and places: lowercase_snake_case, used EXACTLY the same in code and
    DEFAULTS, and WRITTEN IN THE CALL — HSGame.claim('daily_gift'),
    showAd('revive'), tiktokMission.start('profile'), has('share') — never a
    variable (the check and the dashboard JSON read them from the code). Put
    showAd('...') at the ad moments I confirmed in Q2. A place with no ad in
    the dashboard does nothing, so more places cost nothing.
    A claim key and an ad place are DIFFERENT names, even at the same moment:
    claim('level_bonus') + showAd('level_win'). A key that is an ad place is
    paid by showAd only — claim() refuses it.
 5. Every moment that could give a reward calls claim('key') — missions,
    quests, daily gifts, level bonuses, first win... after start() resolved.
    The game decides WHEN a moment is complete; never what it gives.
 6. Never add reward items yourself (not after claim, showAd, share or buy).
    HSGame adds them to the profile. Use return values only for messages and
    flow: showAd('revive').then(function (r) { r ? revive() : gameOver(); }).
 7. Never show an amount you typed: labels come from HSGame.rewards(key),
    names/icons from HSGame.item(id).
 8. SAVE: cloud needs the otherDevice message above. SAVE: local skips it.
 9. Never call tt.login, TTMinis.game.*, createRewardedVideoAd,
    createInterstitialAd, shareAppMessage, addShortcut or startEntranceMission.
    No secret other than the sdkKey in game.js — never ask for or write the
    TikTok Client Secret.
10. If start() fails or there are no credentials, the game must still play:
    the profile saves on the phone, rewards come from DEFAULTS, ads/shop/cloud
    are simply off.
11. Change as little as possible. Do not restyle or refactor unrelated code.
    If the game already saves progress somewhere, move it into the profile
    once on first start: read the old values, profile.update(...), then
    removeStorageSync the old keys — gone keys mean "already moved". This is
    the one storage call the game makes itself.
12. Every platform-dependent button — Entry / Launch Reward, Share, Shop, any
    "watch ad" button — is drawn only while HSGame.has('<feature>') (and, for
    an ad button, HSGame.canShowAd(place)) is true. Never test the platform
    yourself (no "if android", no user-agent checks).
13. Write the ad moments (Q2) and — if the game will ever sell things (Q2) —
    the shop, even with no ads or products yet: with nothing in the dashboard
    they stay hidden, and they appear the day ads / products are added — no
    new build. A game that will never sell: no shop code, no products.
14. HSGame.on('pause') mutes all sound and freezes the game (timers, physics,
    countdowns); HSGame.on('resume') undoes it. A frozen game must not lose
    a life or a run while an ad plays.
15. Only a game that uses HSGame.save(progress) instead of the profile: its
    onGive calls HSGame.save(progress) before it returns — in the same call,
    never later (level end, a timer, the next frame), and AFTER it added the
    items: a save made before the items are in counts the purchase as saved
    without them, and it is lost. A purchase is confirmed
    only once a save that holds it reached the cloud; an app killed before
    gets it credited again at the next start. hs-check fails a game that does
    not.

WHEN DONE
A. Write, NEXT TO the game folder (not inside it — it must not be uploaded to
   TikTok), a file named <game folder name>.hs-dashboard.json:
   {
     "iaa_config": {
       "placements": [ { "label": "<every place in the code>", "ads": [ { "id": "<AD UNIT ID>" } ] } ],
       "rewards": <DEFAULTS.rewards, as JSON>,
       "items":   <DEFAULTS.items, as JSON>
     },
     "products": [ { "id": 1, "name": "...", "description": "...", "beans_cost": 10,
                     "rewards": { "<item>": <count> }, "icon": "...", "badge": "..." } ]
   }
   (products only if Q2 = sells; one example product per kind you sell — otherwise
   leave "products" out). A product bought ONCE for good (No Ads, a skin, a level
   pack) also gets "consumable": false — Google Play then keeps it owned and
   restores it on a new phone. Never write "google_id": HS adds it when the
   product exists in Google Play.
B. List: the profile fields and their merge rule, every key and where it is
   claimed, every ad place, every item, and every change you made.
````

## Step 2 — run the check

```bash
node hs-check.mjs path/to/your-game-folder
```

Fix every ❌ (paste the line to your AI). The check runs your game in a fake
TikTok with your `<game>.hs-dashboard.json` as the dashboard, and tells you
whether **this build** can actually give every reward in it:

```
✅ PASS  native package (game.js, no index.html)
✅ PASS  SDK v1.0.7
✅ PASS  TikTok review: Entry Reward, Launch Reward and Share are in the code
✅ PASS  boots in the native runtime without errors
✅ PASS  SDK started (host: minigame)
✅ PASS  login over tt.request, with delivery confirmation
✅ PASS  a 3 s rewarded ad with no hide event completes (iOS case)
✅ PASS  this build can give: mission_a {"hint":2} · daily_gift {"coins":50} · revive {"revive":1}
✅ PASS  progress in HSGame.profile (device + cloud, one active device)
✅ PASS  progress uploads to the cloud: {"level":2,"coins":100,"hint":8}
✅ PASS  new phone: the profile was restored from the cloud
✅ PASS  Android: boots in the app runtime (web tt + HSNative) without errors
✅ PASS  Android: a rewarded ad through the app's ad provider completes
ℹ️  INFO  Android: has() → share, ads (TikTok missions, cloud and shop are off there)
```

Nothing is sent to TikTok or to us, and no file is changed. The last three
lines run your game the way the Android app will — a ❌ there means the
Android version would break.

## Step 2b — the TikTok upload zip

Tell your AI **"build tiktok"**, or run it yourself:

```bash
node web/hs-web.mjs pack path/to/your-game-folder --tiktok
```

It writes **`<game>-tiktok.zip`** next to the game folder, holding the game
folder's files at the zip root. It refuses to pack when:

| ❌ | fix |
|---|---|
| `project.config.json` has no real `"appid"` | the TikTok **App ID** (step 0). It must match the app you upload to |
| a key, keystore or `.env` file is in the folder | remove it. Everything in the folder is public |
| a symlink is in the folder | replace it with the real file. A link could pull in files from outside |
| `<game>.hs-dashboard.json`, `android.json` or the icon is in the folder | move it NEXT TO the folder |
| an empty (0-byte) file | TikTok refuses them: remove it or fill it |
| over 30 MB in all, or over 4 MB in the main package (each independent subpackage too) | TikTok's limits before compression: move assets into `game.json` → `"subpackages"` |
| `hs-check` fails on the TikTok side | fix as step 2. Android lines only warn here |

`node_modules`, `.git`, OS junk and `project.private.config.json` (your
DevTool's own settings) are left out.

Upload it: **TikTok developer portal → your app → Code version → Add code
asset** → the zip. That creates a preview version, which you submit for
review there. Or from the game folder with TikTok's CLI (Node 20+):
`npm i -g @ttmg/cli`, `ttmg login`, then `ttmg upload` (`ttmg dev` opens
DevTool to try it on a phone first).

## Step 3 — in the HS dashboard

See [DASHBOARD-CONFIG.md](DASHBOARD-CONFIG.md). In short:

1. **Edit Game → Ad placements**: add your TikTok ad unit ids (`ad…`).
2. Put those ids into `<game>.hs-dashboard.json` in place of `<AD UNIT ID>`,
   run the check again, then paste its `iaa_config` into **Ads Config → Edit raw JSON** → Save.
3. **Products → Import JSON**: paste `products`.

From then on you change amounts, switch ad places on/off, add reward keys for
moments the game already reports, and add products — all in the dashboard,
no new build.

**Needs a new build:** a new moment in the code, a new profile field or item
type, new UI.

## Step 4 — on a phone (iOS and Android)

- [ ] Ad at a place → watched to the end → reward; closed early → nothing.
- [ ] A place with no ad in the dashboard → nothing happens, game goes on.
- [ ] Change an amount in the dashboard, restart → the new amount.
- [ ] Share → reward; share again the same day → nothing.
- [ ] Add to home screen, open from the icon → reward, once.
- [ ] Delete the app, reinstall → progress and claimed rewards come back (SAVE: cloud).
- [ ] Open the game on a second phone with the same account → the first phone
      shows "Playing on another device"; "Play here" takes it back, nothing lost.
- [ ] Buy something, kill the app during payment, reopen → the items arrive once.
- [ ] An ad plays → the music stops and the game is frozen; after it, both come back.

## Step 5 — the Android version (optional)

The same game folder becomes a Google Play app. **You change no code and
register nothing** — HS does the Android side.

1. **See it first (optional).** On your computer:

   ```bash
   node web/hs-web.mjs preview path/to/your-game-folder
   ```

   It prints a link (`http://127.0.0.1:8090/`). Open it: the game runs in a
   phone-sized frame, with an inspector next to it. Switch between
   **TikTok Minis** and **Android app** at the top of the inspector:
   - TikTok: login, pay, ads, share and the two missions open **fake screens**;
     Android: ads, share and Google Play billing do, and there are no Entry /
     Launch Reward buttons (TikTok only);
   - you answer each screen by hand — "Watched to the end" / "Closed early" /
     "No fill", "Pay" / "Cancel" / "Pay, then the app dies", "Buy" /
     "Pending payment"…;
   - ad places, rewards, items and products come from your `<game>.hs-dashboard.json`;
   - the inspector shows what `HSGame` sees (logged in, `has()`…), the
     `hs-check` results, a log, the phone's storage and the fake cloud, and has
     one-click hard cases: fresh install, app to the background, +1 day,
     another phone logs in, a second phone, login fails, billing off.

   Nothing is sent to TikTok or HS — the page can only talk to a fake HS
   backend inside it. Ctrl+C stops it. `--platform android` opens it in
   Android mode; `--port` picks another port.

2. **Make the package for HS — tell your AI: "prepare the Android build".**
   It asks you for the app's details and the icon, then packs. Or by hand —
   put two files NEXT TO the game folder:

   ```
   <game>.android.json     the app's details:
     {
       "app_name": "Tap Tower",                  // name under the icon (max 30 characters)
       "package_name": "com.yourstudio.taptower", // optional — HS picks one if empty; can never change later
       "version_name": "1.0.0",                   // what players see
       "privacy_policy_url": "https://…",         // required by Google Play
       "contact_email": "you@studio.com"
     }
   <game>.icon-512.png     the app icon: 512×512 PNG, solid background (no transparency)
   ```

   then run:

   ```bash
   node web/hs-web.mjs pack path/to/your-game-folder
   ```

   It checks the details and the icon, refuses keys / keystores / `.env`
   files, runs `hs-check` (0 ❌ needed), and writes **`<game>-android.zip`**
   next to the game folder — game + dashboard JSON + icon + details. Send that
   one file to your HS contact. HS then:
   - registers the **Android game** in the HS dashboard (its own Game ID +
     SDK key, built into the app — you never put them in `game.js`),
   - sets up its ads (AppLovin) and rewards,
   - builds a test `.apk` for your phone, then the `.aab` for Google Play,
   - creates your products in Google Play (the price is set there) and links
     them in the HS dashboard. Google allows this only after the first upload,
     so the **first test build has no shop** — it appears on the phones at the
     next start once the products are linked. No new build, no code change.

Your `game.js` keeps the TikTok Game ID and SDK key; the app uses its own.

---

## What changed

For upgrading a game that already uses the kit (README → "When the game
already uses the kit"). Replace the two files, then do only the **Action**
lines of each version newer than the game's. A game in the older style
(`HSGame.save()` / `onLoad` / `onGive`, its own storage) stays that way: it is
still supported, and moving it to `HSGame.profile()` is not part of an upgrade.

**3.2.3, tools update** (hs-web 1.1.0; `hs-game.js` and the SDK unchanged)
- `node web/hs-web.mjs pack <game folder> --tiktok` makes the zip to upload
  to TikTok (step 2b). Your AI does it when you say "build tiktok".
  Action: none. Your game's two kit files stay as they are.

**3.2.3** (SDK 1.1.2)
- A change not yet in the cloud survives an app killed before the sync (or
  played offline): when no other phone wrote the cloud meanwhile, the next
  start hands `onLoad` this phone's last `save()` — not the older cloud copy —
  and uploads it; when another phone did, the cloud copy wins, as before —
  and a purchase that was only in this phone's lost copy is credited again
  (never lost; this can repeat each time another phone wrote the cloud first).
  Rewards, claims and purchases go up within about a second. Paid TikTok
  orders are confirmed only once an uploaded save holds them. `onLoad` may
  now also come at a start without network (this phone's last `save()` for
  the account that played here last); still at most once a session, except
  "Play here" or a sign-in to another account. Action: none for an `onLoad`
  that merges (keeps the further progress), as this guide writes it.
- Paid TikTok orders: delivery is confirmed (`mark_delivered`) 1–4 s after
  `buy()`, once the save holding the items is in the cloud. Action: none.
- Action, games with `HSGame.save()` (no profile): `onGive` calls
  `HSGame.save(progress)` before it returns (RULE 15) — run hs-check, it fails
  a game that saves later. A game that saves later gets a purchase credited
  again after a kill; one with `onLoad` that never calls `save()` keeps its
  orders unconfirmed — credited once, offered again at every login. Call
  `save()` in `onGive`.

**3.2.2** (SDK 1.1.1)
- Android: a pending Google payment that completes while the app is in the
  background is credited when the player comes back. Action: none.
- Action: products bought once for good (No Ads, a skin) get
  `"consumable": false` in `<game>.hs-dashboard.json`. `hs-check` warns otherwise.
- Action, only if the shop shows Beans alone: the price label becomes
  `p.price || (p.beans_cost + ' Beans')` (Android sends Google's price as
  `p.price`). A label that already uses `p.price` first is fine as it is.

**3.2.1** (SDK 1.1.1)
- Android: Google Play purchases through the same `HSGame.shop()` /
  `HSGame.buy()`; device accounts with cloud save, no sign-in screen.
  Action: none if the shop is written as in this guide.
- `HSGame.canSignIn` replaces `!HSGame.loggedIn` as the rule for showing a
  "Sign in" button. Action: only if the game has that button (Q3 = yes).

**3.2.0** (SDK 1.1.0) — the Android app. `HSGame.has()`, pause / resume,
`HSGame.platform`. Action: from 3.1, follow RULES 12 and 14.

---

**Version:** kit 3.2.3 · SDK `hs-sdk.min.js` 1.1.2 (both in this zip).
