import Matter from 'matter-js';
import type { PartDefinition, PartRuntime } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';
import { rotateVec } from '../../util/math';

const W = 120;
const BED_H = 10;
const BASE_H = 18;
const H = 30;
/** Bed centerline sits at the top edge of the part; frame directly below. */
const BED_OFFSET = -H / 2 + BED_H / 2;
const BASE_OFFSET = -H / 2 + BED_H + BASE_H / 2;

/** Approach speed along the bed normal must exceed this for the kick. */
const MIN_KICK_SPEED = 2;
const MAX_KICK = 2.5;
const KICK_FACTOR = 0.25;
/** Hard cap on total exit speed, px/step (PRD: no runaway bounce loops). */
const MAX_EXIT_SPEED = 16;
const FLASH_STEPS = 8;

interface TrampolineState {
  /** Overlay counter: >0 for a few steps after a bounce (bed drawn bowed). */
  flash: number;
  /** Bed's outward normal (local -Y rotated by placement angle). */
  normal: { x: number; y: number };
  /** Kicks recorded at collisionStart, applied after restitution resolves. */
  pending: { body: Matter.Body; kick: number }[];
}

function stateOf(rt: PartRuntime): TrampolineState {
  return rt.state as unknown as TrampolineState;
}

function legs(g: CanvasRenderingContext2D): void {
  g.strokeStyle = palette.ink;
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-W / 2 + 16, BASE_H / 2 - 3);
  g.lineTo(-W / 2 + 4, BASE_H / 2 + 11);
  g.moveTo(W / 2 - 16, BASE_H / 2 - 3);
  g.lineTo(W / 2 - 4, BASE_H / 2 + 11);
  g.stroke();
}

export const trampoline: PartDefinition = {
  id: 'trampoline',
  name: 'Trampoline',
  category: 'mechanisms',
  description: 'A springy bed that launches whatever lands on it back out.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  footprint: { kind: 'rect', w: W, h: H },
  create(placement) {
    const rad = (placement.rotation * Math.PI) / 180;
    const bedPos = rotateVec({ x: 0, y: BED_OFFSET }, rad);
    const bed = Matter.Bodies.rectangle(
      placement.x + bedPos.x,
      placement.y + bedPos.y,
      W,
      BED_H,
      {
        isStatic: true,
        angle: rad,
        label: 'trampoline-bed',
      },
    );
    // matter-js 0.20 Body.setStatic forces restitution 0 / friction 1 on
    // static bodies during creation (stashing the configured values in
    // _original), so the bed's bounciness must be assigned afterwards.
    bed.restitution = 0.93;
    bed.friction = 0.01;
    attachShape(bed, { kind: 'rect', w: W, h: BED_H, round: 5, ...inked(palette.ink), z: 1 });
    const basePos = rotateVec({ x: 0, y: BASE_OFFSET }, rad);
    const base = Matter.Bodies.rectangle(
      placement.x + basePos.x,
      placement.y + basePos.y,
      W,
      BASE_H,
      {
        isStatic: true,
        angle: rad,
        restitution: 0.1,
        friction: 0.5,
        label: 'trampoline-base',
      },
    );
    attachShape(base, {
      kind: 'rect',
      w: W,
      h: BASE_H,
      round: 4,
      ...inked(palette.trampoline),
      decorate: legs,
    });
    const normal = rotateVec({ x: 0, y: -1 }, rad);
    return makeRuntime(trampoline, placement, [bed, base], [], {
      flash: 0,
      normal,
      pending: [],
    });
  },
  onCollisionStart(rt, ownBody, otherBody, _pair, sim) {
    if (ownBody !== rt.bodies[0]) return; // only the bed is springy
    if (otherBody.isStatic) return;
    const s = stateOf(rt);
    const v = otherBody.velocity;
    const vn = v.x * s.normal.x + v.y * s.normal.y;
    if (vn >= -MIN_KICK_SPEED) return; // not approaching fast enough
    // collisionStart fires before the velocity resolver, so defer the kick
    // until next step's onBeforeStep — after the restitution bounce resolves.
    s.pending.push({ body: otherBody.parent, kick: Math.min(MAX_KICK, KICK_FACTOR * -vn) });
    // Clamp faster-than-cap impacts before the resolver sees them, so the
    // restitution bounce alone can never launch anything past the cap.
    const speed = Math.hypot(v.x, v.y);
    if (speed > MAX_EXIT_SPEED) {
      const k = MAX_EXIT_SPEED / speed;
      Matter.Body.setVelocity(otherBody.parent, { x: v.x * k, y: v.y * k });
    }
    s.flash = FLASH_STEPS;
    sim.emit('bounce', otherBody);
  },
  onBeforeStep(rt) {
    const s = stateOf(rt);
    if (s.flash > 0) s.flash--;
    if (s.pending.length === 0) return;
    for (const { body, kick } of s.pending) {
      let vx = body.velocity.x + s.normal.x * kick;
      let vy = body.velocity.y + s.normal.y * kick;
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_EXIT_SPEED) {
        vx *= MAX_EXIT_SPEED / speed;
        vy *= MAX_EXIT_SPEED / speed;
      }
      Matter.Body.setVelocity(body, { x: vx, y: vy });
    }
    s.pending.length = 0;
  },
  drawOverlay(g, rt, view) {
    const s = stateOf(rt);
    if (s.flash <= 0) return;
    const t = view.bodyTransform(rt.bodies[0]);
    const bow = s.flash * 1.1;
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.strokeStyle = palette.ink;
    g.lineWidth = BED_H;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-W / 2 + 4, 0);
    g.quadraticCurveTo(0, bow * 2, W / 2 - 4, 0);
    g.stroke();
    g.restore();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, 44);
    const outline = g.lineWidth;
    g.scale(s, s);
    g.strokeStyle = palette.ink;
    // Legs.
    g.lineWidth = 4.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-W / 2 + 16, 4);
    g.lineTo(-W / 2 + 4, 20);
    g.moveTo(W / 2 - 16, 4);
    g.lineTo(W / 2 - 4, 20);
    g.stroke();
    // Frame.
    g.lineWidth = outline;
    g.fillStyle = palette.trampoline;
    g.beginPath();
    g.rect(-W / 2, -11, W, BASE_H);
    g.fill();
    g.stroke();
    // Bed on top.
    g.fillStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, -20, W, BED_H);
    g.fill();
  },
};
