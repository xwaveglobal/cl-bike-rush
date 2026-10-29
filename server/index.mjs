// Sky Roadster — game server (no dependencies, Node 18+).
//
//  • Players / scores / boards  (same API as RemotePlayerStore in src/net/PlayerStore.ts)
//  • Accounts + cloud save: guest token → sign in with email code, Google or Apple → progress follows the account
//  • Server-authoritative EXP: POST /runs re-computes EXP (server/core.mjs); saves can never raise EXP bests
//
// Run:  node server/index.mjs        (data in server/data.json; swap for schema.sql tables in production)
// Env:  PORT=8787  PUBLIC_URL=https://api.example.com  ALLOWED_RETURN=https://game.example.com,https://claude.ai
//       GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//       APPLE_CLIENT_ID (Services ID) / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY (PEM, \n escaped ok)
//       RESEND_API_KEY + MAIL_FROM  (email codes; without them the code is printed in the console = dev mode)
//       DEV_CODES=1  (also return the email code in the API answer — local testing only!)
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { verifyRun, clampSave, summary, normEmail, validEmail, rankOf, RANKS } from './core.mjs';

/** most EXP a pre-cloud (unverified) save may bring in once */
const LEGACY_CAP = { endless: RANKS.AAA + 6000, track2: RANKS.SSS };

const FILE = new URL('./data.json', import.meta.url);
const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
const ALLOWED_RETURN = (process.env.ALLOWED_RETURN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SECRET = process.env.STATE_SECRET ?? crypto.randomBytes(32).toString('hex');

let db = { players: {}, scores: {}, accounts: {}, identities: {}, sessions: {}, saves: {}, runs: [], codes: {} };
try {
  db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch {
  /* new database */
}
let dirty = false;
const touch = () => (dirty = true);
setInterval(() => {
  if (dirty) {
    fs.writeFileSync(FILE, JSON.stringify(db));
    dirty = false;
  }
}, 2000);

// ------------------------------------------------------------------ helpers
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS' };
const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json', ...CORS });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const html = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};
const read = (req) =>
  new Promise((ok) => {
    let b = '';
    req.on('data', (c) => {
      b += c;
      if (b.length > 2e6) req.destroy(); // saves are small; refuse huge bodies
    });
    req.on('end', () => {
      const t = req.headers['content-type'] ?? '';
      if (t.includes('application/x-www-form-urlencoded')) return ok(Object.fromEntries(new URLSearchParams(b)));
      try {
        ok(JSON.parse(b || '{}'));
      } catch {
        ok({});
      }
    });
  });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = () => crypto.randomBytes(9).toString('base64url');
const rows = (board) => Object.values(db.scores).filter((s) => s.board === board && db.players[s.playerId]).sort((a, b) => b.score - a.score || a.at - b.at);

function newAccount() {
  const id = `a_${newId()}`;
  db.accounts[id] = { id, created: Date.now(), email: null, providers: [], verified: { expBest: 0, exp2Best: 0, expWeek: 0, week: '' } };
  touch();
  return db.accounts[id];
}
function newSession(accountId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[sha(token)] = { accountId, at: Date.now() };
  touch();
  return token;
}
function accountOf(req) {
  const h = req.headers.authorization ?? '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = t && db.sessions[sha(t)];
  return s ? db.accounts[s.accountId] ?? null : null;
}
/** sign in with an identity (email:x, google:sub, apple:sub): attach it to the guest account, or switch to its owner */
function signIn(identity, guest, email, provider) {
  let id = db.identities[identity];
  if (!id) {
    // first time this identity is seen: it adopts the guest's account (keeps the progress made as a guest)
    const acc = guest ?? newAccount();
    db.identities[identity] = acc.id;
    if (email && !acc.email) acc.email = email;
    if (!acc.providers.includes(provider)) acc.providers.push(provider);
    id = acc.id;
    touch();
  }
  const acc = db.accounts[id];
  return { token: newSession(id), account: me(acc), switched: !!guest && guest.id !== id };
}
const me = (a) => ({ accountId: a.id, email: a.email, providers: a.providers, rank: rankOf(a.verified.expBest, a.verified.exp2Best), verified: a.verified });
const isoWeek = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
};

// signed OAuth state (return URL + guest session) — survives the round trip through Google / Apple
const signState = (o) => {
  const p = Buffer.from(JSON.stringify({ ...o, t: Date.now() })).toString('base64url');
  return `${p}.${crypto.createHmac('sha256', SECRET).update(p).digest('base64url')}`;
};
const readState = (s) => {
  const [p, sig] = String(s ?? '').split('.');
  if (!p || sig !== crypto.createHmac('sha256', SECRET).update(p).digest('base64url')) return null;
  const o = JSON.parse(Buffer.from(p, 'base64url').toString());
  return Date.now() - o.t < 15 * 60000 ? o : null;
};
const okReturn = (u) => {
  try {
    const url = new URL(u);
    return !ALLOWED_RETURN.length || ALLOWED_RETURN.some((a) => url.origin === new URL(a).origin);
  } catch {
    return false;
  }
};
/** end of an OAuth popup / redirect: hand the token to the game window */
function finishOAuth(res, state, result) {
  const back = state?.ret && okReturn(state.ret) ? state.ret : '';
  const payload = JSON.stringify({ xw_auth: result.token ?? null, error: result.error ?? null });
  html(
    res,
    200,
    `<!doctype html><meta charset="utf-8"><title>Sky Roadster</title><body style="background:#0b1436;color:#fff;font:16px system-ui;text-align:center;padding-top:30vh">Signing in…<script>
var d=${payload};
try{if(window.opener){window.opener.postMessage(d,'*');window.close();}}catch(e){}
var b=${JSON.stringify(back)};
if(b){location.replace(b+(b.indexOf('#')<0?'#':'&')+(d.xw_auth?'xw_auth='+encodeURIComponent(d.xw_auth):'xw_error='+encodeURIComponent(d.error||'failed')));}
else document.body.textContent=d.xw_auth?'Signed in — you can close this window.':'Sign-in failed.';
</script>`,
  );
}

// Apple client secret: an ES256 JWT signed with the team's private key
function appleSecret() {
  const key = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const head = Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.APPLE_KEY_ID })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + 3000, aud: 'https://appleid.apple.com', sub: process.env.APPLE_CLIENT_ID })).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}
// id_token payload (read only after a direct, authenticated code exchange over TLS with the provider)
const jwtPayload = (t) => JSON.parse(Buffer.from(String(t).split('.')[1] ?? '', 'base64url').toString() || '{}');

async function sendCode(email, code) {
  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? 'Sky Roadster <noreply@example.com>', to: email, subject: `Sky Roadster code: ${code}`, text: `Your Sky Roadster sign-in code is ${code}. It expires in 10 minutes.` }),
    });
  } else console.log(`[dev] email code for ${email}: ${code}`);
}

// ------------------------------------------------------------------ routes
http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204);
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const path = `/${parts.join('/')}`;
    try {
      // ---------------- accounts
      if (path === '/auth/guest' && req.method === 'POST') {
        const acc = newAccount();
        return send(res, 200, { token: newSession(acc.id), account: me(acc) });
      }
      if (path === '/me' && req.method === 'GET') {
        const a = accountOf(req);
        return a ? send(res, 200, me(a)) : send(res, 401, { error: 'sign in' });
      }
      if (path === '/auth/logout' && req.method === 'POST') {
        const t = (req.headers.authorization ?? '').slice(7);
        if (t) delete db.sessions[sha(t)];
        touch();
        return send(res, 200, {});
      }
      if (path === '/auth/email/start' && req.method === 'POST') {
        const { email } = await read(req);
        const e = normEmail(email);
        if (!validEmail(e)) return send(res, 400, { error: 'Enter a valid email' });
        const old = db.codes[e];
        if (old && Date.now() - old.at < 50000) return send(res, 429, { error: 'Wait a minute before asking for a new code' });
        const code = String(crypto.randomInt(100000, 1000000));
        db.codes[e] = { hash: sha(code), at: Date.now(), tries: 0 };
        touch();
        await sendCode(e, code);
        return send(res, 200, { ok: true, ...(process.env.DEV_CODES === '1' ? { devCode: code } : {}) });
      }
      if (path === '/auth/email/verify' && req.method === 'POST') {
        const { email, code } = await read(req);
        const e = normEmail(email);
        const c = db.codes[e];
        if (!c || Date.now() - c.at > 10 * 60000) return send(res, 400, { error: 'Code expired — ask for a new one' });
        if (++c.tries > 5) return send(res, 429, { error: 'Too many tries — ask for a new code' });
        touch();
        if (sha(String(code ?? '').trim()) !== c.hash) return send(res, 400, { error: 'Wrong code' });
        delete db.codes[e];
        return send(res, 200, signIn(`email:${e}`, accountOf(req), e, 'email'));
      }
      // OAuth: the game opens  /auth/<provider>/start?return=<game url>&guest=<token>  in a popup (or redirects)
      if ((path === '/auth/google/start' || path === '/auth/apple/start') && req.method === 'GET') {
        const google = path.includes('google');
        const ret = url.searchParams.get('return') ?? '';
        if (!okReturn(ret)) return html(res, 400, 'Return address not allowed (ALLOWED_RETURN).');
        const state = signState({ ret, guest: url.searchParams.get('guest') ?? '' });
        if (google) {
          if (!process.env.GOOGLE_CLIENT_ID) return finishOAuth(res, { ret }, { error: 'Google sign-in is not set up on the server' });
          const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${PUBLIC_URL}/auth/google/callback`, response_type: 'code', scope: 'openid email', state, prompt: 'select_account' });
          res.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
          return res.end();
        }
        if (!process.env.APPLE_CLIENT_ID) return finishOAuth(res, { ret }, { error: 'Apple sign-in is not set up on the server' });
        const q = new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID, redirect_uri: `${PUBLIC_URL}/auth/apple/callback`, response_type: 'code', response_mode: 'form_post', scope: 'email', state });
        res.writeHead(302, { location: `https://appleid.apple.com/auth/authorize?${q}` });
        return res.end();
      }
      if (path === '/auth/google/callback' && req.method === 'GET') {
        const state = readState(url.searchParams.get('state'));
        if (!state) return finishOAuth(res, null, { error: 'Sign-in expired, try again' });
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: url.searchParams.get('code') ?? '', client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: `${PUBLIC_URL}/auth/google/callback`, grant_type: 'authorization_code' }),
        }).then((x) => x.json());
        const p = jwtPayload(r.id_token);
        if (!p.sub || p.aud !== process.env.GOOGLE_CLIENT_ID) return finishOAuth(res, state, { error: 'Google sign-in failed' });
        const guest = state.guest ? accountOf({ headers: { authorization: `Bearer ${state.guest}` } }) : null;
        return finishOAuth(res, state, signIn(`google:${p.sub}`, guest, p.email_verified ? normEmail(p.email) : null, 'google'));
      }
      if (path === '/auth/apple/callback' && req.method === 'POST') {
        const body = await read(req);
        const state = readState(body.state);
        if (!state) return finishOAuth(res, null, { error: 'Sign-in expired, try again' });
        const r = await fetch('https://appleid.apple.com/auth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code: body.code ?? '', client_id: process.env.APPLE_CLIENT_ID ?? '', client_secret: appleSecret(), redirect_uri: `${PUBLIC_URL}/auth/apple/callback`, grant_type: 'authorization_code' }),
        }).then((x) => x.json());
        const p = jwtPayload(r.id_token);
        if (!p.sub || p.aud !== process.env.APPLE_CLIENT_ID) return finishOAuth(res, state, { error: 'Apple sign-in failed' });
        const guest = state.guest ? accountOf({ headers: { authorization: `Bearer ${state.guest}` } }) : null;
        return finishOAuth(res, state, signIn(`apple:${p.sub}`, guest, p.email ? normEmail(p.email) : null, 'apple'));
      }

      // ---------------- cloud save
      if (path === '/save') {
        const a = accountOf(req);
        if (!a) return send(res, 401, { error: 'sign in' });
        const cur = db.saves[a.id] ?? null;
        if (req.method === 'GET') return send(res, 200, cur ? { save: cur.save, rev: cur.rev, at: cur.at, summary: summary(cur.save) } : null);
        if (req.method === 'PUT') {
          const { save, rev } = await read(req);
          const curRev = cur?.rev ?? 0;
          // another device saved in between: the client must choose (no silent overwrite)
          if ((Number(rev) || 0) !== curRev) return send(res, 409, { save: cur?.save ?? null, rev: curRev, at: cur?.at ?? 0, summary: summary(cur?.save) });
          // one-time import of progress made before cloud save existed (first save of a fresh account)
          if (!cur && !a.verified.expBest && !a.verified.exp2Best && !a.legacy && save && typeof save === 'object') {
            a.legacy = true;
            a.verified.expBest = Math.min(Number(save.expBest) || 0, LEGACY_CAP.endless);
            a.verified.exp2Best = Math.min(Number(save.exp2Best) || 0, LEGACY_CAP.track2);
          }
          const clean = clampSave(save, a.verified);
          if (!clean) return send(res, 400, { error: 'bad save' });
          db.saves[a.id] = { save: clean, rev: curRev + 1, at: Date.now() };
          touch();
          return send(res, 200, { rev: curRev + 1, at: db.saves[a.id].at, verified: a.verified });
        }
      }
      // ---------------- verified runs (the only way EXP grows)
      if (path === '/runs' && req.method === 'POST') {
        const a = accountOf(req);
        if (!a) return send(res, 401, { error: 'sign in' });
        const run = await read(req);
        const v = verifyRun(run);
        db.runs.push({ accountId: a.id, at: Date.now(), ...run, accepted: v.exp, why: v.why ?? null });
        if (db.runs.length > 50000) db.runs.splice(0, db.runs.length - 50000);
        if (v.ok) {
          const wk = isoWeek();
          if (a.verified.week !== wk) {
            a.verified.week = wk;
            a.verified.expWeek = 0;
          }
          if (run.variant === 'track2') a.verified.exp2Best = Math.max(a.verified.exp2Best, v.exp);
          else a.verified.expBest = Math.max(a.verified.expBest, v.exp);
          a.verified.expWeek = Math.max(a.verified.expWeek, v.exp);
          // boards use the verified numbers
          const pid = run.playerId ? String(run.playerId) : a.id;
          for (const [board, score] of [['all', a.verified.expBest], [`week:${wk}`, a.verified.expWeek]]) {
            const k = `${board}|${pid}`;
            if (!db.scores[k] || score > db.scores[k].score) db.scores[k] = { board, playerId: pid, score, at: Date.now() };
          }
        }
        touch();
        return send(res, v.ok ? 200 : 422, { accepted: v.exp, verified: a.verified, rank: rankOf(a.verified.expBest, a.verified.exp2Best), why: v.why ?? null });
      }

      // ---------------- players / boards (PlayerStore API)
      if (parts[0] === 'players' && parts[1]) {
        if (req.method === 'GET') return send(res, 200, db.players[parts[1]] ?? null);
        if (req.method === 'PUT') {
          const p = await read(req);
          // EXP / class are server-owned: ignore what the client claims, keep profile fields only
          const { name, country, avatar, color } = p;
          const old = db.players[parts[1]];
          if (old?.isBot) return send(res, 403, { error: 'read only' });
          db.players[parts[1]] = { ...(old ?? {}), name: String(name ?? '').slice(0, 20), country, avatar, color, isBot: false, id: parts[1] };
          touch();
          return send(res, 200, {});
        }
      }
      if (parts[0] === 'scores' && req.method === 'POST') {
        // scores only come from verified runs (POST /runs); bots are seeded on the server, never by a client
        return send(res, 403, { error: 'scores come from /runs' });
      }
      if (parts[0] === 'boards' && parts[1]) {
        const r = rows(parts[1]);
        if (parts[2] === 'rank' && parts[3]) {
          const i = r.findIndex((x) => x.playerId === parts[3]);
          return send(res, 200, i < 0 ? null : { rank: i + 1, total: r.length });
        }
        const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 100));
        return send(res, 200, r.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1, player: db.players[s.playerId] })));
      }
      if (path === '/health') return send(res, 200, { ok: true, accounts: Object.keys(db.accounts).length });
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 500, { error: String(e) });
    }
  })
  .listen(PORT, () => console.log(`Sky Roadster server on http://localhost:${PORT}`));
