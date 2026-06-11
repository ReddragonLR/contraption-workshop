import { beforeEach, describe, expect, it } from 'vitest';
import { registerAllParts } from '../../src/parts';
import { GameController, type SceneSetup } from '../../src/modes/controller';

registerAllParts();

function scene(): SceneSetup {
  return {
    id: 'test',
    title: 'Test Scene',
    world: { width: 960, height: 600, gravity: { x: 0, y: 1 } },
    placements: [],
    bin: [
      { partId: 'wall', count: 2 },
      { partId: 'basketball', count: 1 },
    ],
  };
}

describe('GameController placement rules (PRD §2, §9)', () => {
  let c: GameController;

  beforeEach(() => {
    c = new GameController();
    c.loadScene(scene(), 'sandbox');
  });

  it('places a part from the bin and decrements the count', () => {
    const p = c.placeFromBin(0, 300, 300);
    expect(p).not.toBeNull();
    expect(c.bin[0].count).toBe(1);
    expect(c.placements).toHaveLength(1);
    expect(c.placements[0].fromBin).toBe(true);
  });

  it('refuses to place when the bin slot is empty', () => {
    c.placeFromBin(1, 300, 300);
    expect(c.placeFromBin(1, 500, 300)).toBeNull();
    expect(c.placements).toHaveLength(1);
  });

  it('refuses overlapping placements and leaves the bin unchanged', () => {
    expect(c.placeFromBin(0, 300, 300)).not.toBeNull();
    expect(c.placeFromBin(0, 310, 305)).toBeNull(); // overlaps the first wall
    expect(c.bin[0].count).toBe(1);
    expect(c.placements).toHaveLength(1);
  });

  it('refuses placements outside the world bounds', () => {
    expect(c.canPlace('wall', 10, 300, 0)).toBe(false); // pokes through left edge
    expect(c.canPlace('wall', 480, 300, 0)).toBe(true);
  });

  it('moves a part only to valid spots', () => {
    const p = c.placeFromBin(0, 300, 300)!;
    expect(c.moveTo(p.instanceId, 500, 400)).toBe(true);
    expect(c.placementById(p.instanceId)!.x).toBe(500);
    const q = c.placeFromBin(0, 200, 200)!;
    expect(c.moveTo(q.instanceId, 500, 400)).toBe(false); // occupied
    expect(c.placementById(q.instanceId)!.x).toBe(200);
  });

  it('rotates only rotatable parts, validating the new footprint', () => {
    const wallP = c.placeFromBin(0, 300, 300)!;
    expect(c.rotateBy(wallP.instanceId, 15)).toBe(true);
    expect(c.placementById(wallP.instanceId)!.rotation).toBe(15);
    const ball = c.placeFromBin(1, 600, 300)!;
    expect(c.rotateBy(ball.instanceId, 15)).toBe(false); // balls don't rotate
  });

  it('removing a bin part returns it to its slot', () => {
    const p = c.placeFromBin(0, 300, 300)!;
    expect(c.bin[0].count).toBe(1);
    expect(c.remove(p.instanceId)).toBe(true);
    expect(c.bin[0].count).toBe(2);
    expect(c.placements).toHaveLength(0);
  });

  it('locked level parts cannot be moved or removed', () => {
    const s = scene();
    s.placements = [
      {
        instanceId: 'x',
        partId: 'bucket',
        x: 800,
        y: 520,
        rotation: 0,
        options: {},
        tag: 'bucket-1',
        locked: true,
        fromBin: false,
      },
    ];
    c.loadScene(s, 'puzzle');
    const placed = c.placements[0];
    expect(placed.locked).toBe(true);
    expect(c.moveTo(placed.instanceId, 400, 300)).toBe(false);
    expect(c.remove(placed.instanceId)).toBe(false);
  });

  it('editing is blocked while running; reset restores placements exactly', () => {
    const p = c.placeFromBin(0, 300, 300)!;
    c.run();
    expect(c.runState).toBe('running');
    expect(c.moveTo(p.instanceId, 500, 400)).toBe(false);
    expect(c.placeFromBin(0, 600, 300)).toBeNull();
    for (let i = 0; i < 60; i++) c.tickRun();
    c.reset();
    expect(c.runState).toBe('editing');
    const restored = c.placementById(p.instanceId)!;
    expect(restored.x).toBe(300);
    expect(restored.y).toBe(300);
  });
});
