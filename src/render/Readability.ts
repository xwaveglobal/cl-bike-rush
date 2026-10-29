import type { WorldId } from '../gameplay/Spawner.ts';

/**
 * VISUAL READABILITY SYSTEM — one profile per world.
 *
 * Hierarchy (most → least prominent):
 *   1 obstacles & threats  (red/orange hazard outlines, never dimmed)
 *   2 safe lanes           (green arrows / cyan cues on the road)
 *   3 player vehicle
 *   4 collectibles         (gold)
 *   5 decorations          (lane glow, rails, holograms — toned down where they compete)
 *   6 background           (sky, fog, buildings)
 *
 * Colour language: red/orange = danger · yellow = warning · cyan/blue = navigation ·
 * green = safe opening · gold = collectible · purple = special mechanic.
 */
export interface ReadabilityProfile {
  /** road lane-marking glow (emissive) */
  roadGlow: number;
  /** road base brightness (1 = texture as-is) */
  roadTone: number;
  /** road reflectiveness (neon reflections) */
  roadEnv: number;
  /** side rail / ring glow multiplier */
  rails: number;
  /** obstacle hazard outline colour + opacity */
  edge: number;
  edgeOpacity: number;
  /** extra emissive lift on dark obstacle metal so it separates from a dark road */
  hazardLift: number;
  /** base bloom strength (before the comfort factor) */
  bloom: number;
}

export const READABILITY: Record<WorldId, ReadabilityProfile> = {
  // Future City: clean separation, holograms kept away from the road
  city: { roadGlow: 0.5, roadTone: 1, roadEnv: 0.22, rails: 0.85, edge: 0xff7a3a, edgeOpacity: 0.8, hazardLift: 0.08, bloom: 0.3 },
  // Neon Tunnel: dark road + dark obstacles → strong orange hazard outlines, lighter obstacle metal, fewer reflections
  tunnel: { roadGlow: 0.42, roadTone: 1.18, roadEnv: 0.1, rails: 0.55, edge: 0xff6a1a, edgeOpacity: 1, hazardLift: 0.32, bloom: 0.26 },
  // Cloud City: bright scene → lane glow −55 %, neutral road, obstacles dominant via deep orange outlines
  cloud: { roadGlow: 0.27, roadTone: 0.86, roadEnv: 0.12, rails: 0.45, edge: 0xd8461a, edgeOpacity: 1, hazardLift: 0.05, bloom: 0.18 },
  // Orbital highway: bright rims so dark rocks never blend into space
  space: { roadGlow: 0.48, roadTone: 1.08, roadEnv: 0.15, rails: 0.7, edge: 0xffa03a, edgeOpacity: 1, hazardLift: 0.25, bloom: 0.28 },
  // Megacity: busy skyline → keep road glow moderate, hazards outlined
  mega: { roadGlow: 0.45, roadTone: 1, roadEnv: 0.18, rails: 0.75, edge: 0xff7a3a, edgeOpacity: 0.9, hazardLift: 0.12, bloom: 0.28 },
  // Bonus roads: daylight scenes → calm road glow, strong hazard outlines
  desert: { roadGlow: 0.3, roadTone: 0.92, roadEnv: 0.14, rails: 0.5, edge: 0xd8461a, edgeOpacity: 1, hazardLift: 0.08, bloom: 0.2 },
  forest: { roadGlow: 0.32, roadTone: 0.95, roadEnv: 0.14, rails: 0.55, edge: 0xff6a1a, edgeOpacity: 1, hazardLift: 0.1, bloom: 0.2 },
  country: { roadGlow: 0.3, roadTone: 0.92, roadEnv: 0.14, rails: 0.5, edge: 0xd8461a, edgeOpacity: 1, hazardLift: 0.08, bloom: 0.2 },
  sea: { roadGlow: 0.34, roadTone: 0.95, roadEnv: 0.16, rails: 0.55, edge: 0xff6a1a, edgeOpacity: 1, hazardLift: 0.1, bloom: 0.22 },
  // v2.1 Endless ladder worlds
  harbor: { roadGlow: 0.46, roadTone: 1.05, roadEnv: 0.16, rails: 0.75, edge: 0xff7a3a, edgeOpacity: 0.95, hazardLift: 0.2, bloom: 0.28 },
  solar: { roadGlow: 0.3, roadTone: 0.9, roadEnv: 0.14, rails: 0.5, edge: 0xd8461a, edgeOpacity: 1, hazardLift: 0.06, bloom: 0.2 },
  canyon: { roadGlow: 0.42, roadTone: 1.05, roadEnv: 0.15, rails: 0.65, edge: 0xffa03a, edgeOpacity: 1, hazardLift: 0.18, bloom: 0.28 },
  belt: { roadGlow: 0.48, roadTone: 1.08, roadEnv: 0.15, rails: 0.7, edge: 0xffa03a, edgeOpacity: 1, hazardLift: 0.25, bloom: 0.28 },
  storm: { roadGlow: 0.45, roadTone: 1.1, roadEnv: 0.12, rails: 0.7, edge: 0xffb03a, edgeOpacity: 1, hazardLift: 0.28, bloom: 0.26 },
  volcano: { roadGlow: 0.4, roadTone: 1.1, roadEnv: 0.12, rails: 0.6, edge: 0xffe060, edgeOpacity: 1, hazardLift: 0.3, bloom: 0.3 },
  ice: { roadGlow: 0.32, roadTone: 0.9, roadEnv: 0.18, rails: 0.55, edge: 0xff6a1a, edgeOpacity: 1, hazardLift: 0.1, bloom: 0.24 },
};

/** Eye-comfort preset (Settings → Comfort visuals, on by default). */
export const COMFORT = {
  bloomMul: 0.55,
  turboBloom: 0.06,
  flashOpacity: 0.3,
  pulse: 0.35,
};
