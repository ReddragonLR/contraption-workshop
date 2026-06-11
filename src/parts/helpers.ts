import Matter from 'matter-js';
import type { PartDefinition, PartRuntime, Placement, ShapeSpec } from './types';
import { palette, OUTLINE } from './palette';

interface CwPlugin {
  shape?: ShapeSpec;
  runtime?: PartRuntime;
}

export function cwPlugin(body: Matter.Body): CwPlugin {
  const plugin = body.plugin as { cw?: CwPlugin };
  if (!plugin.cw) plugin.cw = {};
  return plugin.cw;
}

/** Attach a visual shape spec to a body. */
export function attachShape(body: Matter.Body, shape: ShapeSpec): Matter.Body {
  cwPlugin(body).shape = shape;
  return body;
}

export function makeRuntime(
  def: PartDefinition,
  placement: Placement,
  bodies: Matter.Body[],
  constraints: Matter.Constraint[] = [],
  state: Record<string, unknown> = {},
): PartRuntime {
  const rt: PartRuntime = { def, placement, bodies, constraints, state };
  for (const b of bodies) cwPlugin(b).runtime = rt;
  return rt;
}

export function runtimeOf(body: Matter.Body): PartRuntime | undefined {
  // Compound children point at their parent's runtime.
  return cwPlugin(body).runtime ?? (body.parent !== body ? cwPlugin(body.parent).runtime : undefined);
}

/** Standard chunky-outline stroke options shared by most shapes. */
export function inked(fill: string): Pick<ShapeSpec, 'fill' | 'stroke' | 'strokeWidth'> {
  return { fill, stroke: palette.ink, strokeWidth: OUTLINE };
}

/** Icon helper: scale a part's nominal width/height into an icon tile. */
export function iconScale(g: CanvasRenderingContext2D, size: number, w: number, h: number): number {
  const s = (size * 0.72) / Math.max(w, h);
  g.lineWidth = OUTLINE / s;
  return s;
}

export function ballOptions(
  density: number,
  restitution: number,
  friction: number,
): Matter.IBodyDefinition {
  return {
    density,
    restitution,
    friction,
    frictionStatic: 0.5,
    frictionAir: 0.002,
  };
}
