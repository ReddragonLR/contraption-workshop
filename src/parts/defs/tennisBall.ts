import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, ballOptions, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const R = 13;

function decorate(g: CanvasRenderingContext2D): void {
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(-R * 1.05, 0, R * 1.25, -Math.PI * 0.28, Math.PI * 0.28);
  g.stroke();
  g.beginPath();
  g.arc(R * 1.05, 0, R * 1.25, Math.PI * 0.72, Math.PI * 1.28);
  g.stroke();
}

export const tennisBall: PartDefinition = {
  id: 'tennis-ball',
  name: 'Tennis Ball',
  category: 'balls',
  description: 'Light and very bouncy. Easily pushed by wind.',
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
      ballOptions(0.0008, 0.85, 0.03),
    );
    attachShape(body, { kind: 'circle', r: R, ...inked(palette.tennis), decorate });
    return makeRuntime(tennisBall, placement, [body]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, R * 2, R * 2);
    g.scale(s, s);
    g.fillStyle = palette.tennis;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    decorate(g);
  },
};
