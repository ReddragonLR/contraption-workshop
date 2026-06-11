import Matter from 'matter-js';
import type { PartDefinition } from '../types';
import { attachShape, iconScale, makeRuntime } from '../helpers';
import { palette, OUTLINE } from '../palette';
import { rotateVec } from '../../util/math';

const W = 96;
const H = 84;
const T = 9; // wall thickness

/**
 * Open-top container built from three static bodies (two slightly splayed
 * sides + base). The interior is left clear so balls can drop in; win zones
 * are defined by the level, usually inside the bucket mouth.
 */
export const bucket: PartDefinition = {
  id: 'bucket',
  name: 'Bucket',
  category: 'containers',
  description: 'Catches whatever falls in. A classic place for a ball to end up.',
  movableByPlayer: true,
  rotatable: false,
  width: W,
  height: H,
  anchors: [
    { id: 'rim-left', x: -W / 2 + T / 2, y: -H / 2 },
    { id: 'rim-right', x: W / 2 - T / 2, y: -H / 2 },
  ],
  create(placement) {
    const rad = (placement.rotation * Math.PI) / 180;
    const splay = 0.06;
    const mk = (lx: number, ly: number, w: number, h: number, angle: number, fill: string) => {
      const world = rotateVec({ x: lx, y: ly }, rad);
      const body = Matter.Bodies.rectangle(placement.x + world.x, placement.y + world.y, w, h, {
        isStatic: true,
        angle: rad + angle,
        friction: 0.4,
        restitution: 0.05,
      });
      attachShape(body, {
        kind: 'rect',
        w,
        h,
        round: 3,
        fill,
        stroke: palette.ink,
        strokeWidth: OUTLINE,
      });
      return body;
    };
    const bodies = [
      mk(0, H / 2 - T / 2, W - T, T, 0, palette.bucketDark),
      mk(-W / 2 + T / 2, 0, T, H, -splay, palette.bucket),
      mk(W / 2 - T / 2, 0, T, H, splay, palette.bucket),
    ];
    return makeRuntime(bucket, placement, bodies);
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, W, H);
    g.scale(s, s);
    g.fillStyle = palette.bucket;
    g.strokeStyle = palette.ink;
    g.beginPath();
    g.moveTo(-W / 2, -H / 2);
    g.lineTo(-W / 2 + 10, H / 2);
    g.lineTo(W / 2 - 10, H / 2);
    g.lineTo(W / 2, -H / 2);
    g.lineTo(W / 2 - T, -H / 2);
    g.lineTo(W / 2 - T - 7, H / 2 - T);
    g.lineTo(-W / 2 + T + 7, H / 2 - T);
    g.lineTo(-W / 2 + T, -H / 2);
    g.closePath();
    g.fill();
    g.stroke();
  },
};
