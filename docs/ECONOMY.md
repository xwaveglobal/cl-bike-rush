# Sky Roadster — economy (v1, SUPERSEDED)

> ⚠️ Replaced by `docs/GAME-DESIGN.md` (v2, locked 2026-10-22). Kept only as a record of the v1 code still in the repo.

Three currencies:

| Currency | Earned by | Spent on |
|---|---|---|
| **Coins** (soft) | runs, track rewards, cups, daily check-in, quests, perks, rewarded ads, IAP | cars, upgrades, single items, continues |
| **Rank stars / X-points** (`bolts`) | every run, cups (×2 on the live cup track) | nothing — they set the **class** D → AAA, which gates cars, tracks 11–20 and start boosts |
| **Real money** (IAP) | — | coin packs, bundles, Starter Pack, XWAVE Pass, Remove Ads |

The loop: **race → coins + stars → class up → unlock the next car / tracks → harder tracks pay more**. Real money is a shortcut on coins and items. It can never buy class or rank (see `server/README.md`: X-points are server-authoritative once online).

## Earning (per finished track, NORMAL)

Finishing a track pays the coins collected, the speed-level bonus (×1.25 NORMAL, ×1.6 HARD), and `reward × stars / 3`.

| Tracks | Track reward | Typical coins per 3★ run | Item bonus (2–3★) |
|---|---|---|---|
| 1–5 (worlds) | 300–600 | 450–900 | track 5: +1 Roadster |
| 6–10 (remix 1) | 500–950 | 750–1,400 | +Roadster, + SOS from 800 |
| 11–15 (remix 2, class A) | 650–1,300 | 1,000–1,900 | + HYPER at 3★ from 900 |
| 16–20 (remix 3, class A) | 850–1,700 | 1,300–2,500 | + Shield at 3★ from 1,200 |

Endless is always HARD (score ×1.3, coins ×1.6). Cups pay 100–3,000 coins × division (plus HYPER / Roadster and trophies), so climbing class pays off.

Track unlocks: the previous track's best score must reach ≈1.5 points per metre of that track. Tracks 11–20 also need class A (the "Rank A gate").

## Spending

| Sink | Price | ≈ runs of play at the matching stage |
|---|---|---|
| Volt (Rare, class C) | 2,500 | 4–5 |
| Phantom (Epic, class B) | 6,000 | 7–8 |
| Inferno (Legendary, class A) | 12,000 | 9–10 |
| Nexus (Mythic, class AA) | 25,000 | 12–15 |
| Upgrade level 1 → 5 (each of 3) | 150 → 1,970 (≈4,800 total) | 1 → 3 per level |
| Single items (`ITEM_PRICE`) | Roadster 400 · HYPER 1,200 · SOS 350 · Shield 300 · Turbo 150 · Magnet 180 · ×2 260 · Life 400 | ≈ 1 run each |
| Continue | 300, doubles each use (max 2) | — |

Cars need **class and coins**, and unlock in order. Coins alone never skip ahead.

## Why buy (IAP value per US$)

Coins are priced at about **1,200 coins / $** (0.99 pack), and the bigger packs add bonus coins. Every bundle is priced to beat the coin packs at item prices, so a player who wants items gets more by buying the bundle:

| Product | Price | Coin value | Value / $ |
|---|---|---|---|
| 1,200 coins | $0.99 | 1,200 | 1,212 |
| 6,500 coins | $4.99 | 6,500 | 1,303 |
| 14,000 coins | $9.99 | 14,000 | 1,401 |
| 32,000 coins | $19.99 | 32,000 | 1,601 |
| Sky Escape ×4 | $0.99 | 1,400 | 1,414 |
| Jump Bundle (5 Roadster + 2 HYPER) | $2.99 | 4,400 | 1,472 |
| Mythic HYPER ×5 | $3.99 | 6,000 | 1,504 |
| Starter Pack (one time) | $1.99 | 5,400 + no ads | 2,714 |
| XWAVE Pass 30 days (300 coins + 1 Roadster / day) | $4.99 | 21,000 | 4,208 |

The shop shows each bundle's coin value ("worth N coins"). The item card offers "Buy 1" for coins next to "Bundles · better value".

## Tuning knobs

- `src/meta/Daily.ts`: `ITEM_PRICE`, `CHECKIN`, quests, `UNLOCK_BOOSTS`
- `src/meta/Shop.ts`: `PRODUCTS`
- `src/gameplay/Courses.ts`: track rewards and unlock score
- `src/config.ts`: `TRACK_ITEM_BONUS`, `LEFTOVER_POINTS`, `LEVELS`
- `src/render/Vehicle.ts`: `SKINS` (car price / class / score bonus)
- `src/meta/Events.ts`: cup prizes
