import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const W = 150;
const H = 14;

function decorate(g: CanvasRenderingContext2D): void {
  g.strokeStyle = palette.woodDark;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-W / 2 + 8, 0);
  g.lineTo(W / 2 - 8, 0);
  g.stroke();
}

export const ramp: PartDefinition = {
  id: 'ramp',
  name: 'Ramp',
  category: 'structure',
  description: 'A wooden plank. Tilt it and things roll down.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  create(placement) {
    const body = Matter.Bodies.rectangle(placement.x, placement.y, W, H, {
      isStatic: true,
      angle: (placement.rotation * Math.PI) / 180,
      friction: 0.05,
      restitution: 0.1,
    });
    attachShape(body, { kind: 'rect', w: W, h: H, round: 6, ...inked(palette.wood), decorate });
    return makeRuntime(ramp, placement, [body]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, W * 0.5);
    g.scale(s, s);
    g.rotate((-18 * Math.PI) / 180);
    g.fillStyle = palette.wood;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    g.stroke();
    decorate(g);
  },
};
