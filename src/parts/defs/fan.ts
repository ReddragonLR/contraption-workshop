import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';
import { TAU, clamp, degToRad, orientedBoxContains } from '../../util/math';

const W = 48;
const H = 66;
/** How far the wind field extends from the fan face, px. */
const REACH = 280;
/** Wind field height (perpendicular to the blow axis), px. */
const FIELD_H = 80;
/** Distance from the fan center to the blowing face (+X side), px. */
const FACE = W / 2;
/** Peak wind force at the face. NOT mass-scaled: light parts fly, heavy parts creep. */
const FORCE = 0.00065;
/** Falloff floor: even at the far edge of the field the wind keeps 25% strength. */
const MIN_FALLOFF = 0.25;
/** Bodies already moving downwind faster than this are not pushed (px/step). */
const MAX_WIND_SPEED = 9;
/** Blade spin per step while on, radians. */
const SPIN = 0.55;
/** Blade hub position in body-local space (above the dark base). */
const HUB_X = 2;
const HUB_Y = -10;

function decorate(g: CanvasRenderingContext2D): void {
  // Dark pedestal base.
  g.fillStyle = palette.steelDark;
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(-15, H / 2 - 15);
  g.lineTo(15, H / 2 - 15);
  g.lineTo(20, H / 2 - 2);
  g.lineTo(-20, H / 2 - 2);
  g.closePath();
  g.fill();
  g.stroke();
  // Grille slats on the blowing (+X) face.
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.4;
  g.beginPath();
  for (const x of [13, 17.5, 22]) {
    g.moveTo(x, HUB_Y - 14);
    g.lineTo(x, HUB_Y + 14);
  }
  g.stroke();
  // Hub.
  g.fillStyle = palette.steel;
  g.beginPath();
  g.arc(HUB_X, HUB_Y, 5.5, 0, TAU);
  g.fill();
  g.stroke();
}

function drawBlades(g: CanvasRenderingContext2D, phase: number): void {
  g.strokeStyle = palette.ink;
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = phase + (i * TAU) / 3;
    g.moveTo(HUB_X + Math.cos(a) * 6, HUB_Y + Math.sin(a) * 6);
    g.lineTo(HUB_X + Math.cos(a) * 15, HUB_Y + Math.sin(a) * 15);
  }
  g.stroke();
}

export const fan: PartDefinition = {
  id: 'fan',
  name: 'Fan',
  category: 'mechanisms',
  description: 'Blows a steady wind along its face. Light things fly, heavy things creep.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  footprint: { kind: 'rect', w: W, h: H },
  options: [{ key: 'startsOn', label: 'Starts on', type: 'boolean', default: true }],
  create(placement) {
    const body = Matter.Bodies.rectangle(placement.x, placement.y, W, H, {
      isStatic: true,
      angle: degToRad(placement.rotation),
      friction: 0.4,
      restitution: 0.1,
    });
    attachShape(body, { kind: 'rect', w: W, h: H, round: 10, ...inked(palette.fan), decorate });
    return makeRuntime(fan, placement, [body], [], {
      isOn: placement.options.startsOn === true,
      phase: 0,
    });
  },
  onBeforeStep(rt, sim) {
    const placement = rt.placement;
    // Recomputed every step so a button can switch the fan on mid-run (power latches).
    const isOn =
      placement.options.startsOn === true ||
      sim.power.isOn(placement.tag ?? placement.instanceId);
    rt.state.isOn = isOn;
    if (!isOn) return;
    rt.state.phase = ((rt.state.phase as number) + SPIN) % TAU;

    const rad = degToRad(placement.rotation);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const faceX = placement.x + dx * FACE;
    const faceY = placement.y + dy * FACE;
    const boxX = placement.x + dx * (REACH / 2 + FACE);
    const boxY = placement.y + dy * (REACH / 2 + FACE);
    for (const body of sim.dynamicBodies()) {
      if (!orientedBoxContains(boxX, boxY, REACH, FIELD_H, rad, body.position)) continue;
      // Skip bodies already riding the wind at full speed.
      if (body.velocity.x * dx + body.velocity.y * dy > MAX_WIND_SPEED) continue;
      const dist = (body.position.x - faceX) * dx + (body.position.y - faceY) * dy;
      const f = FORCE * clamp(1 - dist / REACH, MIN_FALLOFF, 1);
      Matter.Body.applyForce(body, body.position, { x: dx * f, y: dy * f });
    }
  },
  drawOverlay(g, rt, view) {
    if (rt.state.isOn !== true) return;
    const { x, y, angle } = view.bodyTransform(rt.bodies[0]);
    const phase = rt.state.phase as number;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    drawBlades(g, phase);
    // Faint wind streaks drifting downwind, fading along the field.
    const drift = (phase / TAU) * 70;
    g.strokeStyle = palette.steel;
    g.lineCap = 'round';
    g.lineWidth = 2;
    for (const [row, lane] of [
      [-22, 0],
      [0, 1],
      [22, 2],
    ] as const) {
      const sx = FACE + 8 + ((drift + lane * 47) % (REACH - 40));
      g.globalAlpha = 0.3 * clamp(1 - sx / REACH, 0.1, 1);
      g.beginPath();
      g.moveTo(sx, row);
      g.lineTo(sx + 26, row);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.fillStyle = palette.fan;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    g.stroke();
    decorate(g);
    drawBlades(g, 0.6);
  },
};
