import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { PlacementFactory } from '../../src/parts/placements';
import { Simulation } from '../../src/engine/simulation';
import { WinDetector, type GoalDef } from '../../src/engine/winDetect';

registerAllParts();

const WORLD = { width: 960, height: 600, gravity: { x: 0, y: 1 } };

describe('WinDetector (PRD §8, §13.1)', () => {
  it('object-in-zone fires only after sustainMs', () => {
    const f = new PlacementFactory();
    // Ball rests on the floor inside the zone from the start.
    const sim = new Simulation(WORLD, [f.make('basketball', 480, 570, { tag: 'ball-1' })]);
    const goal: GoalDef = {
      type: 'object-in-zone',
      objectTag: 'ball-1',
      zone: { x: 400, y: 500, w: 160, h: 100 },
      sustainMs: 500, // 30 fixed steps
      description: 'test',
    };
    const det = new WinDetector(goal, sim);
    let wonAt = -1;
    for (let i = 0; i < 120; i++) {
      sim.step();
      if (det.tick() === 'won') {
        wonAt = i;
        break;
      }
    }
    expect(wonAt).toBeGreaterThanOrEqual(29); // not before the sustain window
    expect(wonAt).toBeLessThan(60); // but soon after it
    sim.destroy();
  });

  it('object-in-zone resets the sustain timer when the object leaves', () => {
    const f = new PlacementFactory();
    // Ball falls from high up, passing THROUGH a mid-air zone quickly.
    const sim = new Simulation(WORLD, [f.make('basketball', 480, 60, { tag: 'ball-1' })]);
    const goal: GoalDef = {
      type: 'object-in-zone',
      objectTag: 'ball-1',
      zone: { x: 440, y: 200, w: 80, h: 60 },
      sustainMs: 2000,
      description: 'test',
    };
    const det = new WinDetector(goal, sim);
    for (let i = 0; i < 600; i++) {
      sim.step();
      expect(det.tick()).toBe('pending'); // falls through, never sustains 2s
    }
    sim.destroy();
  });

  it('objects-collide fires on contact and latches', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('basketball', 480, 100, { tag: 'a' }),
      f.make('bowling-ball', 480, 540, { tag: 'b' }),
    ]);
    const goal: GoalDef = { type: 'objects-collide', tagA: 'a', tagB: 'b', description: 'test' };
    const det = new WinDetector(goal, sim);
    let won = false;
    for (let i = 0; i < 300 && !won; i++) {
      sim.step();
      won = det.tick() === 'won';
    }
    expect(won).toBe(true);
    // Latched: stays won even after they separate.
    for (let i = 0; i < 60; i++) {
      sim.step();
      expect(det.tick()).toBe('won');
    }
    sim.destroy();
  });

  it('all-of requires every sub-goal; any-of requires one', () => {
    const f = new PlacementFactory();
    const sim = new Simulation(WORLD, [
      f.make('basketball', 480, 100, { tag: 'a' }),
      f.make('bowling-ball', 480, 540, { tag: 'b' }),
    ]);
    const collide: GoalDef = { type: 'objects-collide', tagA: 'a', tagB: 'b', description: 'c' };
    const impossible: GoalDef = {
      type: 'object-in-zone',
      objectTag: 'a',
      zone: { x: 0, y: 0, w: 10, h: 10 },
      description: 'i',
    };
    const all = new WinDetector({ type: 'all-of', goals: [collide, impossible], description: 'x' }, sim);
    const any = new WinDetector({ type: 'any-of', goals: [collide, impossible], description: 'y' }, sim);
    let anyWon = false;
    for (let i = 0; i < 300; i++) {
      sim.step();
      expect(all.tick()).toBe('pending');
      if (any.tick() === 'won') anyWon = true;
    }
    expect(anyWon).toBe(true);
    sim.destroy();
  });
});
