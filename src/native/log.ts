/**
 * v3.0.11 in-game log — the game's own console, for phones where TikTok's vConsole cannot be
 * opened (Android) or the game fails before it loads. Keeps the last 150 console lines and
 * uncaught errors; shown by Settings → tap the version 5× → "Logs", or 5 quick taps in the
 * top-left corner on any screen (also the boot-error screen). No tt API, no network.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LogLine {
  t: number;
  lv: 'log' | 'warn' | 'error';
  msg: string;
}
export const LOG: LogLine[] = [];
let errors = 0;
export const logErrors = () => errors;

function text(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}${a.stack ? `\n${String(a.stack).split('\n').slice(0, 4).join('\n')}` : ''}`;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

export function pushLog(lv: LogLine['lv'], args: unknown[]) {
  const msg = args.map(text).join(' ').slice(0, 600);
  LOG.push({ t: Date.now(), lv, msg });
  if (lv === 'error') errors++;
  while (LOG.length > 150) LOG.shift();
}

const G: any = typeof (globalThis as any).GameGlobal !== 'undefined' ? (globalThis as any).GameGlobal : globalThis;
try {
  const c: any = typeof console !== 'undefined' ? console : (G.console = {});
  for (const lv of ['log', 'warn', 'error'] as const) {
    const orig = typeof c[lv] === 'function' ? c[lv].bind(c) : () => {};
    c[lv] = (...a: unknown[]) => {
      pushLog(lv, a);
      try {
        orig(...a);
      } catch {
        /* the runtime console itself failed */
      }
    };
  }
  if (typeof c.info === 'function') {
    const oi = c.info.bind(c);
    c.info = (...a: unknown[]) => {
      pushLog('log', a);
      oi(...a);
    };
  }
} catch {
  /* console is read-only here: the log stays empty, the game still runs */
}
// uncaught errors / rejections (where the runtime reports them through the global object)
try {
  const prev = G.onerror;
  G.onerror = (m: unknown, src?: unknown, line?: unknown, col?: unknown, err?: unknown) => {
    pushLog('error', [err ?? m, src ? `@${String(src).split('/').pop()}:${line}:${col}` : '']);
    return typeof prev === 'function' ? prev(m, src, line, col, err) : false;
  };
  G.addEventListener?.('unhandledrejection', (e: any) => pushLog('error', ['Unhandled promise:', e?.reason ?? e]));
} catch {
  /* ignore */
}
pushLog('log', ['log started']);
