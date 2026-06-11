import Matter from 'matter-js';
import type { PartDefinition, PartRuntime, SimulationApi } from '../types';
import { attachShape, iconScale, inked, makeRuntime, runtimeOf } from '../helpers';
import { palette } from '../palette';

const R = 22;
const W = 46;
const H = 60;
const KNOT_Y = 26;
const STRING_LEN = 16;

/** Net upward ≈ 0.9g: buoyancy cancels gravity (1.0) plus 0.9 lift. */
const BUOYANCY_FACTOR = 1.9;

/** Part ids whose touch pops a balloon (stretch interaction matrix). */
const SHARP = new Set(['candle-flame', 'match', 'pin']);

/** Pop the balloon: remove its body and announce it. Returns false if already popped. */
export function popBalloon(rt: PartRuntime, sim: SimulationApi): boolean {
  if (rt.state.popped) return false;
  rt.state.popped = true;
  for (const b of rt.bodies) sim.removeBody(b);
  sim.emit('balloon-pop', rt.placement.tag);
  return true;
}

function decorate(g: CanvasRenderingContext2D): void {
  // Knot triangle at the bottom.
  g.fillStyle = palette.balloon;
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(0, R - 2);
  g.lineTo(-5, R + 6);
  g.lineTo(5, R + 6);
  g.closePath();
  g.fill();
  g.stroke();
  // Glossy highlight.
  g.fillStyle = 'rgba(255, 255, 255, 0.55)';
  g.beginPath();
  g.ellipse(-R * 0.38, -R * 0.42, R * 0.3, R * 0.18, -0.6, 0, Math.PI * 2);
  g.fill();
}

export const balloon: PartDefinition = {
  id: 'balloon',
  name: 'Balloon',
  category: 'mechanisms',
  description: 'Lighter than air. Floats up, hugs ceilings, and rides the wind.',
  movableByPlayer: true,
  rotatable: false,
  width: W,
  height: H,
  footprint: { kind: 'circle', r: R },
  anchors: [{ id: 'knot', x: 0, y: KNOT_Y }],
  create(placement) {
    const body = Matter.Bodies.circle(placement.x, placement.y, R, {
      angle: (placement.rotation * Math.PI) / 180,
      density: 0.00018,
      frictionAir: 0.018,
      restitution: 0.4,
      friction: 0.05,
      frictionStatic: 0.5,
    });
    attachShape(body, { kind: 'circle', r: R, ...inked(palette.balloon), decorate });
    return makeRuntime(balloon, placement, [body], [], { popped: false });
  },
  onBeforeStep(rt, sim) {
    if (rt.state.popped) return;
    const body = rt.bodies[0];
    Matter.Body.applyForce(body, body.position, {
      x: 0,
      y: -body.mass * 0.001 * sim.gravity.y * BUOYANCY_FACTOR,
    });
  },
  onCollisionStart(rt, _ownBody, otherBody, _pair, sim) {
    const other = runtimeOf(otherBody);
    if (other && SHARP.has(other.def.id)) popBalloon(rt, sim);
  },
  drawOverlay(g, rt, view) {
    if (rt.state.popped) return;
    const body = rt.bodies[0];
    const t = view.bodyTransform(body);
    // The string trails behind horizontal motion and kinks with vertical
    // motion — both derived from velocity, fully deterministic.
    const trail = Math.max(-9, Math.min(9, -body.velocity.x * 2.4));
    const kink = Math.max(-2, Math.min(2, body.velocity.y * 0.6));
    g.strokeStyle = palette.ink;
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(t.x, t.y + KNOT_Y);
    for (let i = 1; i <= 4; i++) {
      const f = i / 4;
      const wave = (i % 2 === 0 ? 1 : -1) * kink * f;
      g.lineTo(t.x + trail * f * f + wave, t.y + KNOT_Y + STRING_LEN * f);
    }
    g.stroke();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.translate(0, -8);
    g.fillStyle = palette.balloon;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.ellipse(0, 0, R * 0.92, R * 1.08, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    decorate(g);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, R + 5);
    g.quadraticCurveTo(5, R + 13, -2, R + 20);
    g.stroke();
  },
};
