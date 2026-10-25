# Sky Roadster game server

`server/index.mjs` — one file, no dependencies (Node 18+). Rules shared with the game live in `server/core.mjs`
(checked against `src/config.ts` by `npm test` → `tests/server.test.ts`).

What it does:
- **Accounts + cloud save** — every install becomes a guest account on first contact. Signing in with an
  **email code**, **Google** or **Apple** attaches that identity, so a reinstall / new phone gets the same progress back.
- **Server-authoritative EXP** — the client reports each finished EXP race (`POST /runs`); the server re-computes
  EXP from distance × rate, rejects impossible speeds and keeps the verified best. A save can never raise EXP / rank.
- **Leaderboards** — boards are filled only from verified runs.

## Run locally
```
DEV_CODES=1 node server/index.mjs            # http://localhost:8787, data in server/data.json
# game:  http://localhost:5173/?api=http://localhost:8787
```
`DEV_CODES=1` shows the email code in the game (testing only). Without a mail key the code is printed in the console.

## Go live
1. Host the server (any Node host / VPS / container) behind HTTPS, e.g. `https://api.skyroadster.com`.
2. Put `CLOUD.api = 'https://api.skyroadster.com'` in `src/config.ts` and rebuild the game.
3. Environment:

| Variable | What |
|---|---|
| `PORT` | listen port (default 8787) |
| `PUBLIC_URL` | the server's public https address (OAuth callbacks) |
| `ALLOWED_RETURN` | comma list of game origins allowed after sign-in, e.g. `https://skyroadster.com` |
| `STATE_SECRET` | random string (signs the OAuth state) |
| `RESEND_API_KEY`, `MAIL_FROM` | send email codes through Resend (or replace `sendCode()` with your mailer) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud → OAuth client (Web). Redirect URI: `PUBLIC_URL/auth/google/callback` |
| `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Apple Developer → Sign in with Apple. Return URL: `PUBLIC_URL/auth/apple/callback` |

4. Swap `data.json` for the tables in `schema.sql` (PostgreSQL) when traffic grows — the routes stay the same.

## API
| Method | Path | Auth | Body / result |
|---|---|---|---|
| POST | /auth/guest | – | → `{ token, account }` |
| POST | /auth/email/start | guest | `{ email }` → `{ ok }` (code by mail) |
| POST | /auth/email/verify | guest | `{ email, code }` → `{ token, account, switched }` |
| GET | /auth/google/start, /auth/apple/start | – | `?return=<game url>&guest=<token>` → provider → back to the game with the token |
| GET | /me | ✓ | account |
| POST | /auth/logout | ✓ | |
| GET | /save | ✓ | `{ save, rev, at, summary }` or null |
| PUT | /save | ✓ | `{ save, rev }` → `{ rev }`; **409** + server copy if another device saved first |
| POST | /runs | ✓ | `{ variant, level, distance, seconds, exp }` → `{ accepted, verified, rank }` |
| GET | /boards/:board?limit=100 | – | ranked rows (`all`, `week:2026-W43`) |
| GET | /boards/:board/rank/:playerId | – | `{ rank, total }` |
| PUT | /players/:id | – | profile only (name, country, avatar) |

`switched: true` = that email / Google / Apple already belonged to another account; the game then loads that
account's save (a fresh phone takes it automatically; a phone with its own progress asks which one to keep).
