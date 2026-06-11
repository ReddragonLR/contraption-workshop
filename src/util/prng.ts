/**
 * Deterministic seeded PRNG (mulberry32). The simulation must never use the
 * built-in unseeded RNG (PRD §6); any code needing jitter takes one of these,
 * seeded from level data, so replays are identical.
 */
export type Prng = () => number;

export function mulberry32(seed: number): Prng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
