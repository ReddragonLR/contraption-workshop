import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, ballOptions, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const R = 25;

function decorate(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#1f2133';
  for (const [x, y] of [
    [-6, -7],
    [4, -10],
    [3, -1],
  ] as const) {
    g.beginPath();
    g.arc(x, y, 2.6, 0, Math.PI * 2);
    g.fill();
  }
}

export const bowlingBall: PartDefinition = {
  id: 'bowling-ball',
  name: 'Bowling Ball',
  category: 'balls',
  description: 'Heavy and unstoppable. Barely bounces, hits hard.',
  movableByPlayer: true,
  rotatable: false,
  width: R * 2,
  height: R * 2,
  footprint: { kind: 'circle', r: R },
  anchors: [{ id: 'center', x: 0, y: 0 }],
  create(placement) {
    const body = Matter.Bodies.circle(
      placement.x,
      placement.y,
      R,
      ballOptions(0.006, 0.08, 0.06),
    );
    attachShape(body, { kind: 'circle', r: R, ...inked(palette.bowling), decorate });
    return makeRuntime(bowlingBall, placement, [body]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, R * 2, R * 2);
    g.scale(s, s);
    g.fillStyle = palette.bowling;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    decorate(g);
  },
};
