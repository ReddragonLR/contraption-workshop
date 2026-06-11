import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, ballOptions, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const R = 22;

function decorate(g: CanvasRenderingContext2D): void {
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-R, 0);
  g.lineTo(R, 0);
  g.moveTo(0, -R);
  g.lineTo(0, R);
  g.moveTo(-R * 0.78, -R * 0.62);
  g.quadraticCurveTo(0, -R * 0.1, R * 0.78, -R * 0.62);
  g.moveTo(-R * 0.78, R * 0.62);
  g.quadraticCurveTo(0, R * 0.1, R * 0.78, R * 0.62);
  g.stroke();
}

export const basketball: PartDefinition = {
  id: 'basketball',
  name: 'Basketball',
  category: 'balls',
  description: 'Medium weight, good bounce. Rolls happily down ramps.',
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
      ballOptions(0.0012, 0.6, 0.04),
    );
    attachShape(body, { kind: 'circle', r: R, ...inked(palette.basketball), decorate });
    return makeRuntime(basketball, placement, [body]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, R * 2, R * 2);
    g.scale(s, s);
    g.fillStyle = palette.basketball;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    decorate(g);
  },
};
