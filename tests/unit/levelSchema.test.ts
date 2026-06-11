import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { allLevels } from '../../src/levels';
import { validateLevel } from '../../src/levels/schema';
import { levelToScene } from '../../src/levels/loader';
import { getPart } from '../../src/parts/registry';

registerAllParts();

const baseLevel = () => ({
  id: 'test-level',
  title: 'Test',
  version: 1,
  world: { width: 960, height: 600, gravity: { x: 0, y: 1 } },
  goal: {
    type: 'object-in-zone',
    objectTag: 'ball-1',
    zone: { x: 100, y: 100, w: 50, h: 50 },
    description: 'Do the thing.',
  },
  fixedParts: [{ partId: 'basketball', x: 100, y: 80, tag: 'ball-1' }],
  placedParts: [],
  bin: [{ partId: 'ramp', count: 2 }],
});

describe('level schema (PRD §8, §13.1)', () => {
  it('all shipped levels validate and reference only registered parts', () => {
    const levels = allLevels();
    expect(levels.length).toBeGreaterThanOrEqual(3);
    for (const lvl of levels) {
      for (const entry of [...lvl.fixedParts, ...lvl.placedParts]) {
        expect(() => getPart(entry.partId)).not.toThrow();
      }
      const scene = levelToScene(lvl);
      expect(scene.placements.length).toBe(lvl.fixedParts.length + lvl.placedParts.length);
      expect(scene.goal).toBeDefined();
    }
  });

  it('round-trips a level through serialize → validate unchanged', () => {
    for (const lvl of allLevels()) {
      const roundTripped = validateLevel(JSON.parse(JSON.stringify(lvl)));
      expect(roundTripped).toEqual(lvl);
    }
  });

  it('rejects unknown part ids', () => {
    const bad = baseLevel();
    bad.fixedParts.push({ partId: 'rocket-launcher', x: 10, y: 10, tag: 'r' });
    expect(() => validateLevel(bad)).toThrow(/unknown partId "rocket-launcher"/);
  });

  it('rejects a goal pointing at a missing tag', () => {
    const bad = baseLevel();
    bad.goal.objectTag = 'nope';
    expect(() => validateLevel(bad)).toThrow(/objectTag "nope" not found/);
  });

  it('rejects zones outside the world', () => {
    const bad = baseLevel();
    bad.goal.zone = { x: 900, y: 550, w: 200, h: 100 };
    expect(() => validateLevel(bad)).toThrow(/zone extends outside/);
  });

  it('rejects duplicate tags and bad bin counts', () => {
    const bad = baseLevel();
    bad.fixedParts.push({ partId: 'wall', x: 300, y: 300, tag: 'ball-1' });
    bad.bin.push({ partId: 'ramp', count: -1 });
    expect(() => validateLevel(bad)).toThrow(/duplicate tag/);
    expect(() => validateLevel(bad)).toThrow(/count must be a non-negative integer/);
  });

  it('rejects rope links referencing unknown tags', () => {
    const bad = baseLevel();
    bad.fixedParts.push({
      partId: 'rope',
      x: 0,
      y: 0,
      tag: 'rope-1',
      link: { a: { ref: 'ghost', anchorId: 'center' }, b: { ref: 'ball-1', anchorId: 'center' } },
    } as never);
    expect(() => validateLevel(bad)).toThrow(/link ref "ghost"/);
  });
});
