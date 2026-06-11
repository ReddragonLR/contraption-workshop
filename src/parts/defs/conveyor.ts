import Matter from 'matter-js';
import type { PartDefinition, PartRuntime } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const W = 140;
const H = 24;
const ROLLER_R = 8;
const ROLLER_INSET = 14;
/** Surface speed in px/step per unit of the speed option. */
const SPEED_PX = 0.55;
/** Max tangential velocity change applied to a carried body per step. */
const MAX_NUDGE = 0.12;
const CHEVRON_SPACING = 22;

function dirOf(rt: PartRuntime): number {
  return rt.placement.options.direction === 'left' ? -1 : 1;
}

function speedOf(rt: PartRuntime): number {
  return Number(rt.placement.options.speed ?? 3);
}

function drawRollers(g: CanvasRenderingContext2D): void {
  g.fillStyle = palette.steel;
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.6;
  for (const x of [-(W / 2 - ROLLER_INSET), W / 2 - ROLLER_INSET]) {
    g.beginPath();
    g.arc(x, 0, ROLLER_R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

/** Chevron arrows along the belt, in body-local space. offset ∈ [0, spacing). */
function drawChevrons(g: CanvasRenderingContext2D, dir: number, offset: number): void {
  const half = W / 2 - ROLLER_INSET - ROLLER_R - 4;
  g.strokeStyle = palette.paper;
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  for (let x = -half - CHEVRON_SPACING + offset; x <= half; x += CHEVRON_SPACING) {
    if (x < -half || x > half) continue;
    g.moveTo(x - 4 * dir, -5);
    g.lineTo(x + 3 * dir, 0);
    g.lineTo(x - 4 * dir, 5);
  }
  g.stroke();
}

export const conveyor: PartDefinition = {
  id: 'conveyor',
  name: 'Conveyor Belt',
  category: 'mechanisms',
  description: 'Drags whatever rests on it along the belt. Pick direction and speed.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  footprint: { kind: 'rect', w: W, h: H },
  options: [
    {
      key: 'direction',
      label: 'Direction',
      type: 'choice',
      choices: [
        { value: 'right', label: 'Right' },
        { value: 'left', label: 'Left' },
      ],
      default: 'right',
    },
    { key: 'speed', label: 'Speed', type: 'number', min: 1, max: 5, step: 1, default: 3 },
  ],
  create(placement) {
    const body = Matter.Bodies.rectangle(placement.x, placement.y, W, H, {
      isStatic: true,
      angle: (placement.rotation * Math.PI) / 180,
      friction: 0.9,
      restitution: 0,
    });
    attachShape(body, {
      kind: 'rect',
      w: W,
      h: H,
      round: 8,
      ...inked(palette.conveyor),
      decorate: drawRollers,
    });
    return makeRuntime(conveyor, placement, [body], [], { phase: 0 });
  },
  onBeforeStep(rt) {
    // Deterministic chevron animation phase: advances with the belt surface.
    const phase = (rt.state.phase as number) + speedOf(rt) * SPEED_PX * dirOf(rt);
    rt.state.phase = ((phase % CHEVRON_SPACING) + CHEVRON_SPACING) % CHEVRON_SPACING;
  },
  onCollisionActive(rt, ownBody, otherBody) {
    if (otherBody.isStatic) return;
    const angle = ownBody.angle;
    // Belt-local "up" (away from the carrying surface; -y at rotation 0).
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    const relX = otherBody.position.x - ownBody.position.x;
    const relY = otherBody.position.y - ownBody.position.y;
    if (relX * nx + relY * ny <= 0) return; // touching from below or the side
    const dir = dirOf(rt);
    const tx = Math.cos(angle) * dir;
    const ty = Math.sin(angle) * dir;
    const target = speedOf(rt) * SPEED_PX;
    const v = otherBody.velocity;
    const vt = v.x * tx + v.y * ty;
    let dv = target - vt;
    if (dv > MAX_NUDGE) dv = MAX_NUDGE;
    else if (dv < -MAX_NUDGE) dv = -MAX_NUDGE;
    if (dv === 0) return;
    // Nudge along the tangent only; the normal component is preserved.
    Matter.Body.setVelocity(otherBody, { x: v.x + tx * dv, y: v.y + ty * dv });
  },
  drawOverlay(g, rt, view) {
    const { x, y, angle } = view.bodyTransform(rt.bodies[0]);
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    drawChevrons(g, dirOf(rt), rt.state.phase as number);
    g.restore();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.fillStyle = palette.conveyor;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    g.stroke();
    drawRollers(g);
    drawChevrons(g, 1, 6);
    // Bold direction arrow above the belt.
    g.strokeStyle = palette.ink;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-28, -H / 2 - 16);
    g.lineTo(26, -H / 2 - 16);
    g.moveTo(12, -H / 2 - 27);
    g.lineTo(26, -H / 2 - 16);
    g.lineTo(12, -H / 2 - 5);
    g.stroke();
  },
};
