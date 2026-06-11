import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const W = 100;
const H = 26;

function decorate(g: CanvasRenderingContext2D): void {
  // Brick courses.
  g.strokeStyle = palette.brickDark;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-W / 2, 0);
  g.lineTo(W / 2, 0);
  for (const x of [-W / 4, 0, W / 4]) {
    g.moveTo(x, -H / 2);
    g.lineTo(x, 0);
  }
  for (const x of [-W * 0.375, -W / 8, W / 8, W * 0.375]) {
    g.moveTo(x, 0);
    g.lineTo(x, H / 2);
  }
  g.stroke();
}

export const wall: PartDefinition = {
  id: 'wall',
  name: 'Brick Wall',
  category: 'structure',
  description: 'A solid brick slab. Blocks and supports everything.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  create(placement) {
    const body = Matter.Bodies.rectangle(placement.x, placement.y, W, H, {
      isStatic: true,
      angle: (placement.rotation * Math.PI) / 180,
      friction: 0.6,
      restitution: 0.1,
    });
    attachShape(body, { kind: 'rect', w: W, h: H, round: 3, ...inked(palette.brick), decorate });
    return makeRuntime(wall, placement, [body]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.fillStyle = palette.brick;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    g.stroke();
    decorate(g);
  },
};
