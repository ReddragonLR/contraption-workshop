import type { SceneSetup } from './controller';
import { allParts } from '../parts/registry';

const SANDBOX_COUNT = 10;

/** Freeform mode: an empty scene, the full parts bin, no goal (PRD §3). */
export function sandboxScene(): SceneSetup {
  return {
    id: 'sandbox',
    title: 'Sandbox',
    world: { width: 960, height: 600, gravity: { x: 0, y: 1 } },
    placements: [],
    bin: allParts()
      .filter((d) => d.movableByPlayer)
      .map((d) => ({ partId: d.id, count: SANDBOX_COUNT })),
    goalDescription: 'No goal — just build!',
  };
}
