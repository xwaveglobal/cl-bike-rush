/**
 * v3: what the platform the game runs on provides. The web build leaves it empty (browser APIs);
 * the native TikTok build (src/native/main.ts) fills it before the Game is created.
 */
export interface Platform {
  /** true in the native mini game (canvas UI, HS SDK) */
  native: boolean;
  /** v3.0.9: Android phone in the native build (lower render scale, lighter effects) */
  android?: boolean;
  /** the screen canvas the 3D view draws into (native: the runtime's first canvas) */
  canvas?: HTMLCanvasElement;
  /** share sheet of the platform — resolves true when shared */
  share?: (text: string) => Promise<boolean>;
  /** platform store — the items are delivered by the platform itself (never granted by the game) */
  buy?: (sku: string) => Promise<{ ok: boolean; delivered?: boolean; error?: string }>;
}

export const platform: Platform = { native: false };
