import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MANIFEST, type AssetEntry } from './manifest.ts';
import type { Audio } from '../audio/Audio.ts';

/**
 * Loads optional replacement files listed in the manifest. Anything without a
 * `file`, or that fails, keeps its procedural version — the game never blocks
 * on a missing asset.
 */
export class AssetLoader {
  models = new Map<string, THREE.Group>();
  private gltf = new GLTFLoader();

  async loadAll(audio: Audio, onProgress?: (k: number) => void) {
    const withFiles = MANIFEST.filter((e) => e.file);
    let done = 0;
    await Promise.all(
      withFiles.map(async (e) => {
        try {
          await this.load(e, audio);
        } catch (err) {
          console.warn(`[assets] ${e.id}: using procedural fallback`, err);
        }
        onProgress?.(++done / Math.max(1, withFiles.length));
      }),
    );
    onProgress?.(1);
  }

  private async load(e: AssetEntry, audio: Audio) {
    if (!e.file) return;
    if (e.kind === 'audio') {
      await audio.loadOverride(e.id, e.file);
    } else if (e.kind === 'model') {
      const g = await this.gltf.loadAsync(e.file);
      this.models.set(e.id, g.scene);
    }
  }

  /** Returns a clone of a loaded replacement model, or null to use procedural. */
  model(id: string): THREE.Object3D | null {
    const m = this.models.get(id);
    return m ? m.clone(true) : null;
  }
}
