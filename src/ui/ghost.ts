import type { OptionValue, Placement } from '../parts/types';
import { getPart, defaultOptions } from '../parts/registry';
import { cwPlugin } from '../parts/helpers';
import { drawShape } from '../render/renderer';
import { palette } from '../parts/palette';

/**
 * Draw a translucent preview of a part at a candidate position by creating
 * its bodies off-world and rendering their shape specs. Green/red ring
 * communicates placement validity (PRD §9).
 */
export function drawGhost(
  g: CanvasRenderingContext2D,
  partId: string,
  x: number,
  y: number,
  rotation: number,
  valid: boolean,
  options?: Record<string, OptionValue>,
): void {
  const def = getPart(partId);
  const fake: Placement = {
    instanceId: '__ghost__',
    partId,
    x,
    y,
    rotation,
    options: { ...defaultOptions(def), ...options },
    locked: false,
    fromBin: false,
  };
  g.save();
  g.globalAlpha = 0.55;
  try {
    const rt = def.create(fake, { resolve: () => undefined, nextGroup: () => -9999 });
    for (const body of rt.bodies) {
      const shape = cwPlugin(body).shape;
      if (!shape || shape.invisible) continue;
      g.save();
      g.translate(body.position.x, body.position.y);
      g.rotate(body.angle);
      drawShape(g, shape);
      g.restore();
    }
  } catch {
    // Connector parts can't preview without endpoints; fall through to ring.
  }
  g.globalAlpha = 0.95;
  g.strokeStyle = valid ? palette.win : palette.danger;
  g.lineWidth = 2.5;
  g.setLineDash([7, 5]);
  const rw = Math.max(def.width, 30) + 18;
  const rh = Math.max(def.height, 30) + 18;
  g.strokeRect(x - rw / 2, y - rh / 2, rw, rh);
  g.setLineDash([]);
  if (!valid) {
    g.strokeStyle = palette.danger;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x - 10, y - 10);
    g.lineTo(x + 10, y + 10);
    g.moveTo(x + 10, y - 10);
    g.lineTo(x - 10, y + 10);
    g.stroke();
  }
  g.restore();
}
