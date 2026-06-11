import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';
import { pulleyFilter } from '../collision';

const R = 20;

/**
 * A fixed wheel that redirects ropes. Rope segments collide with the wheel
 * groove and drape over it, so a falling weight on one side lifts whatever
 * hangs from the other (PRD §7.1, §7.3).
 */
export const pulley: PartDefinition = {
  id: 'pulley',
  name: 'Pulley',
  category: 'mechanisms',
  description: 'Redirects a rope. Weight goes down, cargo goes up.',
  movableByPlayer: true,
  rotatable: false,
  width: R * 2 + 8,
  height: R * 2 + 8,
  footprint: { kind: 'circle', r: R + 3 },
  create(placement) {
    const wheel = Matter.Bodies.circle(placement.x, placement.y, R, {
      isStatic: true,
      friction: 0.01,
      restitution: 0,
      collisionFilter: { ...pulleyFilter },
    });
    attachShape(wheel, {
      kind: 'circle',
      r: R,
      ...inked(palette.pulley),
      decorate(g) {
        g.fillStyle = palette.ink;
        g.beginPath();
        g.arc(0, 0, 4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(45,42,38,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, R - 4, 0, Math.PI * 2);
        g.stroke();
      },
    });
    // Housing bar above the crown: blocks balls from riding over the wheel
    // (rope segments don't collide with it — their mask is pulley-only).
    const bracket = Matter.Bodies.rectangle(placement.x, placement.y - R - 9, R * 2 + 14, 6, {
      isStatic: true,
      friction: 0.2,
      restitution: 0.05,
    });
    attachShape(bracket, { kind: 'rect', w: R * 2 + 14, h: 6, round: 3, ...inked(palette.steelDark) });
    return makeRuntime(pulley, placement, [wheel, bracket]);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, R * 2, R * 2);
    g.scale(s, s);
    g.fillStyle = palette.pulley;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = palette.ink;
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = palette.rope;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-R, -26);
    g.lineTo(-R, 6);
    g.moveTo(R, -26);
    g.lineTo(R, 6);
    g.stroke();
  },
};
