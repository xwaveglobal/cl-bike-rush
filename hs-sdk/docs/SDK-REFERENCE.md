# HS TikTok SDK — JavaScript

> **Building a native TikTok mini game (game.js + game.json)? Start with
> [INTEGRATE-WITH-AI.md](../INTEGRATE-WITH-AI.md)** — paste its prompt into your AI
> assistant; it wires `hs-game.js` for you, and `node hs-check.mjs <game folder>`
> checks the result. TikTok no longer accepts H5 games, so that is the path for
> new games. The rest of this page is the low-level SDK, for engines that need it.

One file. No dependencies, no build step, no npm.

```
hs-sdk.min.js           the SDK (named hs-tiktok-sdk.min.js before 1.1 — same SDK)
sample/index.html       open it in a browser to see everything working
```

The global it defines is still `HSTikTokSDK`.

**You need two things: login and purchases.** Ads, cloud save and missions are
optional — skip any of them.

---

## 1. Include

```js
// Mini game (game.js)
const HSTikTokSDK = require('./hs-sdk.min.js');

// Web page
<script src="./hs-sdk.min.js"></script>

// Bundler (Cocos, Laya, Phaser, webpack, Vite…)
import HSTikTokSDK from './hs-sdk.min.js';
```

---

## 2. Start

```js
function main() {
  HSTikTokSDK.init({
    gameId: '<your game id>',
    sdkKey: '<your sdk key>',
  });

  HSTikTokSDK.registerRewardHandler({
    onPurchaseRewardsGranted:  (productId, rewards) => grant(rewards),
    onPendingRewardsRecovered: (productId, rewards) => grant(rewards),
  });

  HSTikTokSDK.auth.login();
}

main();
```

⚠️ **Put this inside `main()`, not at the top of the file** — it crashes on
device otherwise.

⚠️ **Register the reward handler before `login()`** — otherwise a player can pay
and not receive their item.

---

## 3. Purchases

```js
// list what's for sale
const shop = await HSTikTokSDK.iap.getShopItems();
// → { success: true, data: [{ product_id, name, beans_cost, rewards }] }

// buy one
const r = await HSTikTokSDK.iap.buyProduct('hint_pack_15');
if (r.success) grant(r.data);
else           showMessage(r.error);
```

That's the whole required integration.

---

## Optional — ads

```js
const r = await HSTikTokSDK.ads.showAdsRemote('reward_revive');

if (r.success && r.completed) grantReward();
else showMessage(r.error_message);
```

⚠️ **Only grant on `completed`.** `success` means an ad played; `completed`
means they watched it to the end.

Ask us for your label names — they're configured on our side.

---

## Optional — cloud save

```js
const saveData = {
  isDirtyForCloud: false,
  serializeForCloud: () => ({ level, coins }),
  onCloudDataReceived: (json) => restore(JSON.parse(json)),
};

HSTikTokSDK.registerSyncProvider(saveData);   // before login

saveData.isDirtyForCloud = true;              // when progress changes
```

Saving and loading happen on their own. `onCloudDataReceived` runs at login, so
a returning player keeps their progress.

---

## Optional — missions

```js
const r = await HSTikTokSDK.missions.execute(HSTikTokSDK.MissionType.ShortcutMission);
if (r.status === 'Success') grantBonus();
```

`ShortcutMission` = add to home screen · `EntranceMission` = follow the profile.

---

## When something goes wrong

**Nothing throws.** Every call returns a result you can check.

```js
const r = await HSTikTokSDK.ads.showAdsRemote('reward_revive');
r.success        // did it work
r.error_code     // 11004 = ad limit reached, try later
r.error_message  // safe to show or log
```

Stuck? Send us this:

```js
console.log(HSTikTokSDK.platform, HSTikTokSDK.hostName, HSTikTokSDK.version);
```

---

## Try it now

Open `sample/index.html` in any browser. Login, shop, purchase, ads and saving
all run against a built-in fake — no TikTok setup needed.
