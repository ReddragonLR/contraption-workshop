import Matter from 'matter-js';
import type { PartDefinition, PartRuntime, SimulationApi } from '../types';
import { makeRuntime, iconScale } from '../helpers';
import { palette } from '../palette';
import { rotateVec } from '../../util/math';

interface RopeEndBinding {
  body: Matter.Body;
  /** Anchor offset in the body's local frame. */
  offset: { x: number; y: number };
}

interface RopeState {
  severed: boolean;
  endA: RopeEndBinding;
  endB: RopeEndBinding;
  /** Static pulley wheels the rope is routed over, in order. */
  crowns: { body: Matter.Body; offset: { x: number; y: number } }[];
  /** Total rope length: Σ leg lengths at creation. */
  length: number;
  cut: (sim: SimulationApi) => boolean;
}

function anchorWorld(end: RopeEndBinding): Matter.Vector {
  const r = rotateVec(end.offset, end.body.angle);
  return { x: end.body.position.x + r.x, y: end.body.position.y + r.y };
}

function routePoints(state: RopeState): Matter.Vector[] {
  return [
    anchorWorld(state.endA),
    ...state.crowns.map((c) => ({
      x: c.body.position.x + c.offset.x,
      y: c.body.position.y + c.offset.y,
    })),
    anchorWorld(state.endB),
  ];
}

function pathLength(pts: Matter.Vector[]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return total;
}

const SOLVER_ITERATIONS = 3;
const POSITION_RELAX = 0.7;

/** Current rope polyline (for hit-testing and UI), or null if unbuilt/severed. */
export function ropeRoutePoints(rt: PartRuntime): Matter.Vector[] | null {
  const state = rt.state as unknown as RopeState;
  if (!state.endA || !state.endB || state.severed) return null;
  return routePoints(state);
}

/**
 * Rope: an inextensible tie between two part anchors, optionally routed over
 * pulleys (`link.via`). Implemented as a custom unilateral constraint on the
 * total path length |A→crown₁→…→B| ≤ L, solved with positional + velocity
 * corrections each step (PRD §7.1, §7.3). Ropes pull, never push; tension
 * transmits across pulleys exactly, for any mass ratio. Cutting severs it.
 */
export const rope: PartDefinition = {
  id: 'rope',
  name: 'Rope',
  category: 'mechanisms',
  description: 'Ties two parts together. Drape it over a pulley to lift things.',
  movableByPlayer: true,
  rotatable: false,
  width: 60,
  height: 60,
  footprint: { kind: 'none' },
  connector: true,
  create(placement, ctx) {
    const link = placement.link;
    if (!link) return makeRuntime(rope, placement, []);
    const a = bindEnd(ctx.resolve(link.a.ref), link.a.anchorId);
    const b = bindEnd(ctx.resolve(link.b.ref), link.b.anchorId);
    if (!a || !b) return makeRuntime(rope, placement, []);

    const crowns: RopeState['crowns'] = [];
    for (const ref of link.via ?? []) {
      const wheel = ctx.resolve(ref)?.bodies[0];
      if (wheel) {
        crowns.push({ body: wheel, offset: { x: 0, y: -(wheel.circleRadius ?? 20) - 3 } });
      }
    }

    const state = {
      severed: false,
      endA: a,
      endB: b,
      crowns,
      length: 0,
    } as RopeState;
    state.length = pathLength(routePoints(state));
    state.cut = (sim: SimulationApi): boolean => {
      if (state.severed) return false;
      state.severed = true;
      sim.emit('rope-cut', placement.tag ?? placement.instanceId);
      return true;
    };
    return makeRuntime(rope, placement, [], [], state as unknown as Record<string, unknown>);
  },
  onBeforeStep(rt) {
    const state = rt.state as unknown as RopeState;
    if (state.severed) return;
    const { endA, endB } = state;
    const invA = endA.body.isStatic ? 0 : 1 / endA.body.mass;
    const invB = endB.body.isStatic ? 0 : 1 / endB.body.mass;
    if (invA + invB === 0) return;

    for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
      const pts = routePoints(state);
      const c = pathLength(pts) - state.length;
      if (c <= 0) break; // slack — ropes never push

      // Gradient of the path length wrt each end = unit vector from its
      // neighboring route point toward the end.
      const pa = pts[0];
      const na = pts[1];
      const pb = pts[pts.length - 1];
      const nb = pts[pts.length - 2];
      const da = Math.hypot(pa.x - na.x, pa.y - na.y) || 1;
      const db = Math.hypot(pb.x - nb.x, pb.y - nb.y) || 1;
      const ra = { x: (pa.x - na.x) / da, y: (pa.y - na.y) / da };
      const rb = { x: (pb.x - nb.x) / db, y: (pb.y - nb.y) / db };

      // Positional correction (split by inverse mass).
      const lambda = (c * POSITION_RELAX) / (invA + invB);
      if (invA > 0) {
        Matter.Body.setPosition(endA.body, {
          x: endA.body.position.x - ra.x * lambda * invA,
          y: endA.body.position.y - ra.y * lambda * invA,
        });
      }
      if (invB > 0) {
        Matter.Body.setPosition(endB.body, {
          x: endB.body.position.x - rb.x * lambda * invB,
          y: endB.body.position.y - rb.y * lambda * invB,
        });
      }

      // Velocity correction: cancel separating (rope-lengthening) speed.
      const cdot =
        endA.body.velocity.x * ra.x +
        endA.body.velocity.y * ra.y +
        endB.body.velocity.x * rb.x +
        endB.body.velocity.y * rb.y;
      if (cdot > 0) {
        const j = cdot / (invA + invB);
        if (invA > 0) {
          Matter.Body.setVelocity(endA.body, {
            x: endA.body.velocity.x - ra.x * j * invA,
            y: endA.body.velocity.y - ra.y * j * invA,
          });
        }
        if (invB > 0) {
          Matter.Body.setVelocity(endB.body, {
            x: endB.body.velocity.x - rb.x * j * invB,
            y: endB.body.velocity.y - rb.y * j * invB,
          });
        }
      }
    }
  },
  drawOverlay(g, rt) {
    const state = rt.state as unknown as RopeState;
    if (state.severed || !state.endA) return;
    const pts = routePoints(state);
    const taut = pathLength(pts);
    const slack = Math.max(state.length - taut, 0);
    g.save();
    g.strokeStyle = palette.rope;
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const legSlack = slack / (pts.length - 1);
    for (let i = 0; i < pts.length - 1; i++) {
      const pa = pts[i];
      const pb = pts[i + 1];
      g.beginPath();
      g.moveTo(pa.x, pa.y);
      if (legSlack > 4) {
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2 + Math.min(legSlack * 0.6, 70);
        g.quadraticCurveTo(mx, my, pb.x, pb.y);
      } else {
        g.lineTo(pb.x, pb.y);
      }
      g.stroke();
    }
    g.fillStyle = palette.ink;
    for (const p of [pts[0], pts[pts.length - 1]]) {
      g.beginPath();
      g.arc(p.x, p.y, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },
  drawIcon(g, size) {
    const s = iconScale(g, size, 56, 56);
    g.scale(s, s);
    g.strokeStyle = palette.rope;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-22, -20);
    g.bezierCurveTo(10, -8, -16, 10, 8, 22);
    g.stroke();
    g.fillStyle = palette.ink;
    g.beginPath();
    g.arc(-22, -20, 4, 0, Math.PI * 2);
    g.arc(8, 22, 4, 0, Math.PI * 2);
    g.fill();
  },
};

function bindEnd(rt: PartRuntime | undefined, anchorId: string): RopeEndBinding | null {
  if (!rt || rt.bodies.length === 0) return null;
  const spec = rt.def.anchors?.find((x) => x.id === anchorId) ?? { id: 'center', x: 0, y: 0 };
  const body = rt.bodies[0];
  // Anchor specs are in part-local coords (rotation 0); the body was created
  // at the placement rotation, so convert to the body's local frame.
  const placeRad = (rt.placement.rotation * Math.PI) / 180;
  const world = rotateVec({ x: spec.x, y: spec.y }, placeRad);
  const local = rotateVec(
    {
      x: rt.placement.x + world.x - body.position.x,
      y: rt.placement.y + world.y - body.position.y,
    },
    -body.angle,
  );
  return { body, offset: { x: local.x, y: local.y } };
}
