/**
 * v3 native: ask the player for a short text (pilot name). The mini game has no <input>:
 * tt.showModal with an editable field (allowed API), else the browser prompt (desktop preview).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const GameGlobal: any;

export function askText(title: string, current: string, max = 14): Promise<string | null> {
  const G: any = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
  const T = G.tt;
  return new Promise((resolve) => {
    const done = (v: unknown) => resolve(typeof v === 'string' ? v.slice(0, max) : null);
    try {
      if (T?.showModal) {
        T.showModal({
          title,
          content: current,
          editable: true,
          placeholderText: current || title,
          showCancel: true,
          success: (r: any) => done(r && r.confirm ? (typeof r.content === 'string' ? r.content : null) : null),
          fail: () => fallback(),
        });
        return;
      }
    } catch {
      /* fall through */
    }
    fallback();
    function fallback() {
      try {
        done(typeof G.prompt === 'function' ? G.prompt(title, current) : null);
      } catch {
        done(null);
      }
    }
  });
}
