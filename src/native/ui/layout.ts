/** v3 native UI — safe-area insets (status bar / home indicator / TikTok capsule menu) */
import type { Gfx } from './gfx.ts';

export const SAFE = { top: 0, bottom: 0, menuBottom: 0, capL: 0, capTop: 0, capBottom: 0 };

/**
 * v3.0.8: the first row shares the line with TikTok's "… ×" capsule (top-right corner) instead of
 * sitting below it. `top` = top of a 44-tall row centred on the capsule, `right` = the x the row
 * must stay left of. Without a capsule: below the status bar, full width.
 */
export function capRow(g: Gfx) {
  if (!SAFE.capL) return { top: Math.max(SAFE.top, 0) + 6, right: g.W - 12, capped: false };
  const mid = (SAFE.capTop + SAFE.capBottom) / 2;
  return { top: Math.max(SAFE.top, mid - 22), right: Math.min(g.W - 12, SAFE.capL - 8), capped: true };
}
/** y just below the capsule (things on the right side go here) */
export function belowCap() {
  return SAFE.capBottom ? SAFE.capBottom + 6 : SAFE.menuBottom;
}

/** top inset: below the status bar and the TikTok "…  ×" capsule */
export function safeTop(_g: Gfx) {
  return Math.max(SAFE.top, SAFE.menuBottom);
}
export function safeBottom(_g: Gfx) {
  return SAFE.bottom;
}
/** content column (phones: full width; tablets: a centred 480 px column) */
export function column(g: Gfx) {
  const w = Math.min(g.W, 480);
  return { x: (g.W - w) / 2, w };
}
