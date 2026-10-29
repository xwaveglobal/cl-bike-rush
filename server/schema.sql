-- Sky Roadster — game database (PostgreSQL; works in SQLite with minor type changes).
-- server/index.mjs keeps the same data in data.json for local testing.

-- ---------------------------------------------------------------- accounts (v2.3 cloud save)
CREATE TABLE accounts (
  id           TEXT PRIMARY KEY,               -- 'a_<random>'; every install starts as a guest account
  email        TEXT,                           -- verified email (email code / Google / Apple), may be NULL
  providers    TEXT[] NOT NULL DEFAULT '{}',   -- email | google | apple
  exp_best     INTEGER NOT NULL DEFAULT 0,     -- server-verified best EXP on Endless (rank D → AAA)
  exp2_best    INTEGER NOT NULL DEFAULT 0,     -- server-verified best EXP on Mega Rush (S / SS / SSS)
  exp_week     INTEGER NOT NULL DEFAULT 0,
  week         TEXT NOT NULL DEFAULT '',       -- '2026-W43'
  legacy       BOOLEAN NOT NULL DEFAULT FALSE, -- pre-cloud progress imported once
  created_at   BIGINT NOT NULL
);

-- one row per sign-in identity → account ('email:a@b.co', 'google:<sub>', 'apple:<sub>')
CREATE TABLE identities (
  identity    TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
);

-- session tokens are stored hashed (sha-256)
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  BIGINT NOT NULL
);

-- the whole game save (JSON) per account; rev increases on every write (conflict check)
CREATE TABLE saves (
  account_id  TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  save        JSONB NOT NULL,
  rev         INTEGER NOT NULL,
  at          BIGINT NOT NULL
);

-- pending email sign-in codes (hashed, 10 minutes, 5 tries)
CREATE TABLE email_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  at         BIGINT NOT NULL,
  tries      INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------- leaderboards
CREATE TABLE players (
  id          TEXT PRIMARY KEY,            -- 'p-<install id>' for real players, 'bot-<hash>' for bots
  name        TEXT NOT NULL,
  avatar      INTEGER NOT NULL DEFAULT 0,
  flag        TEXT NOT NULL DEFAULT '',
  is_bot      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  BIGINT NOT NULL,
  last_seen   BIGINT NOT NULL
);

-- best verified EXP per (player, board); board = 'all' | 'week:2026-W43'
CREATE TABLE scores (
  board      TEXT NOT NULL,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  at         BIGINT NOT NULL,
  PRIMARY KEY (board, player_id)
);
CREATE INDEX scores_board_rank ON scores (board, score DESC, at ASC);

-- every finished EXP race as reported, with what the server accepted (anti-cheat review, analytics)
CREATE TABLE runs (
  id          BIGSERIAL PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  variant     TEXT NOT NULL,               -- endless | track2
  level       TEXT NOT NULL,               -- easy | normal | hard
  distance    INTEGER NOT NULL,
  seconds     INTEGER NOT NULL,
  exp_claimed INTEGER NOT NULL,
  exp_accepted INTEGER NOT NULL,           -- 0 = rejected (reason in why)
  why         TEXT,
  at          BIGINT NOT NULL
);
