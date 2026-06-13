import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { allLevels } from '../../src/levels';
import { levelToScene } from '../../src/levels/loader';
import { GameController } from '../../src/modes/controller';
import type { SolutionPart } from './solutions/types';

registerAllParts();

const MAX_STEPS = 3600; // 60s at 60Hz — the in-game run cap

const modules = import.meta.glob('./solutions/level-*.ts', { eager: true }) as Record<
  string,
  { levelId: string; solution: SolutionPart[] }
>;
const solutions = Object.fromEntries(
  Object.values(modules).map((m) => [m.levelId, m.solution]),
);

function runToCompletion(c: GameController): number {
  c.run();
  let steps = 0;
  while (c.runState === 'running' && steps < MAX_STEPS) {
    c.tickRun();
    steps++;
  }
  return steps;
}

/**
 * Every shipped level must be solvable via its documented solution, played
 * through the exact same code path the game uses (controller placement
 * validation → fresh simulation → win/settle detection) — and must NOT solve
 * itself with an empty bin. PRD §13.1/§14.
 */
describe('level solvability (PRD §14)', () => {
  for (const lvl of allLevels()) {
    it(`${lvl.id} (“${lvl.title}”) is solvable with the documented solution`, () => {
      const solution = solutions[lvl.id];
      expect(solution, `missing tests/unit/solutions/${lvl.id}.ts`).toBeDefined();

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

      const steps = runToCompletion(c);
      expect(
        c.runState,
        `${lvl.id}: machine ${c.runState === 'settled' ? 'settled' : 'timed out'} after ${steps} steps without winning`,
      ).toBe('won');
    });

    it(`${lvl.id} does not solve itself with an empty bin`, () => {
      const c = new GameController();
      c.loadScene(levelToScene(lvl), 'puzzle');
      runToCompletion(c);
      expect(c.runState, `${lvl.id} won with no parts placed — too easy`).not.toBe('won');
    });
  }
});
