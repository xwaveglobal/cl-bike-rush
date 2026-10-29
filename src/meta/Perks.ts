/**
 * v3.0.11 home reward buttons (Entry · Launch · Share): which ones show, and where.
 * Pure logic (no DOM, no SDK) so tests can run it in Node; src/native/hs.ts feeds it HSGame's
 * state, src/native/ui/screens.ts draws the result.
 */
export type PerkKind = 'share' | 'entry' | 'launch';

export interface PerkState {
  /** HSGame.start() resolved — before that nothing shows (no flash of an exhausted reward) */
  started: boolean;
  hasShare: boolean;
  hasMissions: boolean;
  /** a share reward is configured (HSGame.rewards('share') not null) */
  shareRewarded: boolean;
  /** HSGame.available('share'): a share reward can still be earned now ($limit honoured) */
  shareAvailable: boolean;
  /** HSGame.tiktokMission.done(...) — honours the key's $limit, so "daily" comes back */
  entryDone: boolean;
  launchDone: boolean;
}

export function perkVisible(kind: PerkKind, s: PerkState): boolean {
  if (!s.started) return false;
  if (kind === 'share') return s.hasShare && (!s.shareRewarded || s.shareAvailable);
  if (!s.hasMissions) return false;
  return kind === 'entry' ? !s.entryDone : !s.launchDone;
}

/** rail order, top to bottom */
export const PERK_ORDER: PerkKind[] = ['share', 'entry', 'launch'];

/**
 * y of each visible tile: the visible tiles are centred in the block of 3 slots, so 3 fill it,
 * 2 sit balanced around its middle, 1 sits in the middle, 0 = nothing drawn.
 */
export function perkLayout(visible: PerkKind[], top: number, slot = 60, tile = 50): Record<PerkKind, number | null> {
  const out: Record<PerkKind, number | null> = { share: null, entry: null, launch: null };
  const list = PERK_ORDER.filter((k) => visible.includes(k));
  const block = 2 * slot + tile;
  const used = list.length ? (list.length - 1) * slot + tile : 0;
  const y0 = top + (block - used) / 2;
  list.forEach((k, i) => (out[k] = y0 + i * slot));
  return out;
}
