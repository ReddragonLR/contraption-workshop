import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const PLANK_W = 190;
const PLANK_H = 14;
const BASE_H = 34;

export const seesaw: PartDefinition = {
  id: 'seesaw',
  name: 'Seesaw',
  category: 'mechanisms',
  description: 'A plank on a pivot. Tips under weight and flings things.',
  movableByPlayer: true,
  rotatable: true,
  width: PLANK_W,
  height: PLANK_H + BASE_H,
  footprint: { kind: 'rect', w: PLANK_W, h: PLANK_H + BASE_H },
  anchors: [
    // y = -10 lands on the plank centerline (plank sits above the base).
    { id: 'left', x: -PLANK_W / 2 + 8, y: -10 },
    { id: 'right', x: PLANK_W / 2 - 8, y: -10 },
  ],
  create(placement, ctx) {
    const rad = (placement.rotation * Math.PI) / 180;
    const group = ctx.nextGroup();
    // Pivot sits at the placement point; plank balances on top of the base.
    const px = placement.x;
    const py = placement.y - BASE_H / 2 + PLANK_H / 2;
    const plank = Matter.Bodies.rectangle(px, py, PLANK_W, PLANK_H, {
      angle: rad,
      density: 0.0022,
      friction: 0.5,
      restitution: 0.1,
      collisionFilter: { group },
    });
    attachShape(plank, { kind: 'rect', w: PLANK_W, h: PLANK_H, round: 5, ...inked(palette.wood), z: 1 });
    const base = Matter.Bodies.fromVertices(
      placement.x,
      placement.y + PLANK_H / 2,
      [
        [
          { x: 0, y: -BASE_H / 2 },
          { x: BASE_H * 0.7, y: BASE_H / 2 },
          { x: -BASE_H * 0.7, y: BASE_H / 2 },
        ],
      ],
      { isStatic: true, collisionFilter: { group } },
    );
    attachShape(base, {
      kind: 'poly',
      verts: [
        { x: 0, y: -BASE_H / 2 },
        { x: BASE_H * 0.7, y: BASE_H / 2 },
        { x: -BASE_H * 0.7, y: BASE_H / 2 },
      ],
      ...inked(palette.steelDark),
    });
    const pivot = Matter.Constraint.create({
      pointA: { x: px, y: py },
      bodyB: plank,
      pointB: { x: 0, y: 0 },
      length: 0,
      stiffness: 1,
    });
    return makeRuntime(seesaw, placement, [plank, base], [pivot]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, PLANK_W, PLANK_W * 0.5);
    g.scale(s, s);
    g.fillStyle = palette.steelDark;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.moveTo(0, -2);
    g.lineTo(24, 34);
    g.lineTo(-24, 34);
    g.closePath();
    g.fill();
    g.stroke();
    g.save();
    g.rotate(-0.16);
    g.fillStyle = palette.wood;
    g.beginPath();
    g.rect(-PLANK_W / 2, -PLANK_H / 2 - 2, PLANK_W, PLANK_H);
    g.fill();
    g.stroke();
    g.restore();
  },
};
