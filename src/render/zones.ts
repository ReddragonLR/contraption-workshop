import type { GoalDef } from '../engine/winDetect';
import type { Rect } from '../util/math';
import { palette } from '../parts/palette';

/** Collect every object-in-zone rectangle from a goal tree. */
export function goalZones(goal: GoalDef | undefined): Rect[] {
  if (!goal) return [];
  switch (goal.type) {
    case 'object-in-zone':
      return [goal.zone];
    case 'all-of':
    case 'any-of':
      return goal.goals.flatMap((g) => goalZones(g));
    default:
      return [];
  }
}

/** Dashed target marker so players can see where things must end up. */
export function drawGoalZones(g: CanvasRenderingContext2D, zones: Rect[], stepIndex: number): void {
  if (!zones.length) return;
  g.save();
  for (const z of zones) {
    g.fillStyle = 'rgba(232, 163, 61, 0.10)';
    g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = palette.brass;
    g.lineWidth = 2.5;
    g.setLineDash([10, 7]);
    g.lineDashOffset = -((stepIndex * 0.3) % 17);
    g.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    g.setLineDash([]);
    // Corner star so the target reads even over busy scenes.
    g.fillStyle = palette.brass;
    g.font = '16px sans-serif';
    g.fillText('★', z.x + 5, z.y + 18);
  }
  g.restore();
}
