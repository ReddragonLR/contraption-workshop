import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, inked, makeRuntime } from '../helpers';
import { palette } from '../palette';

const W = 72;
const H = 20;
const BASE_H = 10;
const PLATE_W = 52;
const PLATE_H = 8;
// Part-local offsets along the local y axis (before rotation).
const BASE_OFF = H / 2 - BASE_H / 2; // base slab sits in the lower half
const PLATE_OFF = -H / 2 + PLATE_H / 2; // plate rides slightly raised on top

function decorateBase(g: CanvasRenderingContext2D): void {
  // Mounting bolts on the steel slab.
  g.fillStyle = palette.steelDark;
  for (const x of [-W / 2 + 7, W / 2 - 7]) {
    g.beginPath();
    g.arc(x, 0, 1.8, 0, Math.PI * 2);
    g.fill();
  }
}

export const button: PartDefinition = {
  id: 'button',
  name: 'Button',
  category: 'mechanisms',
  description: 'A pressure plate. Anything landing on it switches its wired device on.',
  movableByPlayer: true,
  rotatable: true,
  width: W,
  height: H,
  footprint: { kind: 'rect', w: W, h: H },
  options: [
    {
      key: 'powers',
      label: 'Powers device (tag)',
      type: 'choice',
      choices: [{ value: '', label: '(none)' }],
      default: '',
    },
  ],
  create(placement) {
    const rad = (placement.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const at = (dy: number) => ({ x: placement.x - dy * sin, y: placement.y + dy * cos });
    const basePos = at(BASE_OFF);
    const platePos = at(PLATE_OFF);
    const base = Matter.Bodies.rectangle(basePos.x, basePos.y, W, BASE_H, {
      isStatic: true,
      angle: rad,
      friction: 0.6,
      restitution: 0.05,
    });
    attachShape(base, {
      kind: 'rect',
      w: W,
      h: BASE_H,
      round: 2,
      ...inked(palette.steel),
      decorate: decorateBase,
    });
    const plate = Matter.Bodies.rectangle(platePos.x, platePos.y, PLATE_W, PLATE_H, {
      isStatic: true,
      angle: rad,
      friction: 0.5,
      restitution: 0.05,
    });
    attachShape(plate, { kind: 'rect', w: PLATE_W, h: PLATE_H, round: 3, ...inked(palette.button), z: 1 });
    return makeRuntime(button, placement, [base, plate], [], { pressed: false });
  },
  onCollisionStart(rt, _ownBody, otherBody, _pair, sim) {
    if (otherBody.isStatic || rt.state.pressed) return;
    rt.state.pressed = true;
    sim.emit('button-press', rt.placement.tag ?? rt.placement.instanceId);
    const powers = rt.placement.options.powers;
    if (typeof powers === 'string' && powers !== '') sim.power.turnOn(powers);
  },
  drawOverlay(g, rt, view) {
    if (!rt.state.pressed) return;
    // Pressed look: a small green indicator light glows on the base slab.
    const t = view.bodyTransform(rt.bodies[0]);
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.fillStyle = palette.win;
    g.strokeStyle = palette.ink;
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.fillStyle = palette.steel;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-W / 2, BASE_OFF - BASE_H / 2, W, BASE_H);
    g.fill();
    g.stroke();
    g.save();
    g.translate(0, BASE_OFF);
    decorateBase(g);
    g.restore();
    g.fillStyle = palette.button;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.rect(-PLATE_W / 2, -H / 2, PLATE_W, PLATE_H);
    g.fill();
    g.stroke();
  },
};
