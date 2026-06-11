import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { allLevels } from '../../src/levels';
import { levelToScene } from '../../src/levels/loader';
import { GameController } from '../../src/modes/controller';
import { solutions } from './solutions';

registerAllParts();

const MAX_STEPS = 3600; // 60s at 60Hz — the in-game run cap

/**
 * Every shipped level must be solvable via its documented solution, played
 * through the exact same code path the game uses (controller placement
 * validation → fresh simulation → win/settle detection). PRD §13.1/§14.
 */
describe('level solvability (PRD §14)', () => {
  for (const lvl of allLevels()) {
    it(`${lvl.id} (“${lvl.title}”) is solvable with the documented solution`, () => {
      const solution = solutions[lvl.id];
      expect(solution, `missing solution for ${lvl.id} in solutions.ts`).toBeDefined();

      const c = new GameController();
      c.loadScene(levelToScene(lvl), 'puzzle');

      for (const part of solution) {
        // The solution must be reachable by a real player: snapped to the
        // placement grid and rotation steps.
        expect(part.x % 10, `${lvl.id}: ${part.partId} x off-grid`).toBe(0);
        expect(part.y % 10, `${lvl.id}: ${part.partId} y off-grid`).toBe(0);
        expect((part.rotation ?? 0) % 15, `${lvl.id}: ${part.partId} rotation off-step`).toBe(0);

        const slot = c.bin.findIndex((s) => s.partId === part.partId && s.count > 0);
        expect(slot, `${lvl.id}: no bin stock for ${part.partId}`).toBeGreaterThanOrEqual(0);
        const placed = c.placeFromBin(slot, part.x, part.y, part.rotation ?? 0);
        expect(
          placed,
          `${lvl.id}: ${part.partId} cannot be placed at (${part.x},${part.y})`,
        ).not.toBeNull();
        for (const [key, value] of Object.entries(part.options ?? {})) {
          c.setOption(placed!.instanceId, key, value);
        }
      }

      c.run();
      let steps = 0;
      while (c.runState === 'running' && steps < MAX_STEPS) {
        c.tickRun();
        steps++;
      }
      expect(
        c.runState,
        `${lvl.id}: machine ${c.runState === 'settled' ? 'settled' : 'timed out'} after ${steps} steps without winning`,
      ).toBe('won');
    });
  }
});
