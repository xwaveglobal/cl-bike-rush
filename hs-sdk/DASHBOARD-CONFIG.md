# HS dashboard — the data your game runs on

The game reports **moments** by key (`claim('mission_a')`, `showAd('revive')`,
`share()`). Everything those moments do is data here. Change it any time;
players get it at their next start.

| What | Where | Example |
|---|---|---|
| **Ad units** — the ids TikTok gave you | Edit Game → Ad placements | `ad7635013883317733396`, rewarded |
| **Places, rewards, items** | Ads Config → **Edit raw JSON** (same JSON as Edit Game → IAA Config) | below |
| **Products** | Products → Import JSON | below |

Your partner's AI writes all of it into `<game>.hs-dashboard.json` and
`hs-check` validates it against the build before you paste.

---

## Places, rewards, items — one JSON

```json
{
  "placements": [
    { "label": "revive",    "ads": [ { "id": "ad7635013883317733396", "config": { "cooldown": 30 } } ] },
    { "label": "level_win", "ads": [ { "id": "ad7635205496211589141" } ] }
  ],
  "rewards": {
    "mission_a":       { "hint": 2, "revive": 1, "$limit": "once" },
    "daily_gift":      { "coins": 50, "$limit": "daily" },
    "revive":          { "revive": 1 },
    "share":           { "hint": 3, "$limit": "daily" },
    "tiktok_shortcut": { "hint": 3 },
    "tiktok_profile":  { "hint": 3 }
  },
  "items": {
    "hint":      { "category": "consumable", "name": "Hint",       "icon": "https://cdn.example.com/hint.png" },
    "coins":     { "category": "currency",   "name": "Coins" },
    "skin_gold": { "category": "skin",       "name": "Gold rings", "image": "https://cdn.example.com/gold.png" }
  }
}
```

**`placements`** — one per ad moment. `label` = the name in the code,
`showAd('revive')`, exactly (lowercase). `ads` = a waterfall of your ad unit
ids: the first one active and not cooling down is shown. A unit's type
(rewarded / interstitial) comes from Edit Game; the game does not care.
**No placement = no ad** at that moment — that is how you switch one off.

**`rewards`** — what a key gives: `{ "item": count }`. Optional `"$limit"`:
`"once"`, `"daily"`, or none (every time). Built in: `share` is daily,
`tiktok_*` once. The reward of an ad place has the place's name (`revive`).
`"key": null` switches a default reward off.

**`items`** — what each item is: `category`, `name`, `icon`/`image` (display).
An item that is a **number field of the game's profile** (`hint`, `coins`…) is
added to it automatically. Other items (a skin unlock…) need game code. So the
dashboard can change any amount and move known items between keys freely; a
brand-new item needs a build.

> Keep `rewards` and `items` at the top level, next to `placements`. Keys
> added inside a placement are dropped when the Ads Config builder saves.

**`features`** (optional) — switch a feature off for this game without a
build: `"features": { "share": false }`. Names: `tiktok_missions`, `share`,
`ads`, `shop`, `cloud`. The game's buttons follow (`HSGame.has(name)`). A
feature can only be switched off here — what a platform cannot do stays off.

## The Android version is its own HS game

HS registers it (its own Game ID + SDK key, injected into the app at build) and
fills its dashboard: the same `rewards` / `items` JSON, with **AppLovin MAX**
unit ids in `placements` instead of TikTok `ad…` ids. Its products carry a
`google_id` (below); an app built without Google Play billing hides its shop.

## Products

```json
[
  { "id": 1, "name": "Hint pack",      "beans_cost": 10, "rewards": { "hint": 15 } },
  { "id": 2, "name": "Gold skin pack", "beans_cost": 50, "rewards": { "skin_gold": 1, "coins": 200 },
    "consumable": false, "icon": "https://cdn.example.com/gold.png", "badge": "NEW" }
]
```

`id` a number, unique per game (re-importing an id updates it) ·
`beans_cost` the price · `rewards` like above · `"consumable": false` for a
product bought once for good (a skin, No Ads) — from the start, the Android
version needs it · any other field (`icon`, `badge`, `sort`…) reaches the shop
screen as-is.

**Android game (Google Play):** add `"google_id": "coins_200"` — the product id
created in Play Console (Monetize with Play → Products → In-app products), with
its price there. `"consumable": false` for a permanent unlock (a skin; Google
keeps it owned and restores it), default `true` (coins, hints — can be bought
again). A product shows in the app only when it exists in BOTH places; the
price shown is Google's. Rewards stay remote here.

The order for an Android game (HS does it; the partner's code never changes):

1. The partner's `<game>.hs-dashboard.json` products (no `google_id`) → import
   them into the **Android** HS game too. The TikTok game sells for Beans now;
   the Android shop stays hidden.
2. Build the `.aab` with billing and upload it to a Play testing track —
   Google unlocks in-app products only after that.
3. Create the products in Play Console. The product id there can never be
   changed or reused.
4. Re-import the Android game's products with `"google_id"` (the Play product
   id, exactly) and `"consumable"` (`false` for a permanent unlock — set before
   anyone buys). The shop appears at the next start — no new build.

## What works without a new build — and what does not

| ✅ Dashboard only | ❌ Needs a new build |
|---|---|
| change any amount or limit | a moment the code never reports (a new `claim` / `showAd` key) |
| switch an ad place on / off, its waterfall, cooldown | a brand-new item (not a profile field the game has) |
| a new reward key for a moment the code already reports | new UI, new game logic |
| new products, prices, badges — with items the game already has | |

`hs-check` lists the keys, places and categories a build supports, and fails
any reward this build cannot give.

> Remote images (`icon`, `image`) may need their domain allowed in the TikTok
> developer console; the game should fall back to a built-in icon.
