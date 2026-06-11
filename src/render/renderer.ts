import Matter from 'matter-js';
import type { Simulation, BodyTransform } from '../engine/simulation';
import type { DrawView, ShapeSpec } from '../parts/types';
import { cwPlugin } from '../parts/helpers';
import { lerp, lerpAngle, type Vec2 } from '../util/math';

export interface RendererOptions {
  showGrid: boolean;
  gridSize: number;
}

/**
 * Canvas renderer, fully decoupled from the physics step (PRD §5/§6).
 * Reads body transforms (interpolated between the previous and current
 * physics step by `alpha`) and draws each body's attached ShapeSpec.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private worldW = 960;
  private worldH = 600;
  private scale = 1;
  opts: RendererOptions = { showGrid: false, gridSize: 20 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
  }

  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.fit();
  }

  /** Fit the canvas to its CSS box, accounting for devicePixelRatio. */
  fit(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.scale = (rect.width / this.worldW) * dpr;
  }

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const cssScale = rect.width / this.worldW;
    return { x: (clientX - rect.left) / cssScale, y: (clientY - rect.top) / cssScale };
  }

  render(sim: Simulation | null, alpha: number, overlay?: (g: CanvasRenderingContext2D) => void): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // Paper background + frame.
    g.fillStyle = '#f6f1e3';
    g.fillRect(0, 0, this.worldW, this.worldH);
    if (this.opts.showGrid) this.drawGrid(g);

    if (sim) {
      const view = this.makeView(sim, alpha);
      const bodies = Matter.Composite.allBodies(sim.world);
      const entries: { body: Matter.Body; shape: ShapeSpec }[] = [];
      for (const body of bodies) {
        const shape = cwPlugin(body).shape;
        if (shape && !shape.invisible) entries.push({ body, shape });
      }
      entries.sort((a, b) => (a.shape.z ?? 0) - (b.shape.z ?? 0));
      for (const { body, shape } of entries) this.drawBody(g, body, shape, view);
      for (const rt of sim.allRuntimes()) rt.def.drawOverlay?.(g, rt, view);
    }

    overlay?.(g);

    // Inner frame so the bounded scene reads as a box.
    g.strokeStyle = 'rgba(45,42,38,0.55)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, this.worldW - 4, this.worldH - 4);
  }

  makeView(sim: Simulation, alpha: number): DrawView {
    const prev = sim.prevTransforms;
    return {
      alpha,
      bodyTransform(body: Matter.Body): BodyTransform {
        const p = prev.get(body.id);
        if (!p || alpha >= 1) {
          return { x: body.position.x, y: body.position.y, angle: body.angle };
        }
        return {
          x: lerp(p.x, body.position.x, alpha),
          y: lerp(p.y, body.position.y, alpha),
          angle: lerpAngle(p.angle, body.angle, alpha),
        };
      },
    };
  }

  private drawGrid(g: CanvasRenderingContext2D): void {
    const s = this.opts.gridSize;
    g.strokeStyle = 'rgba(45,42,38,0.07)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = s; x < this.worldW; x += s) {
      g.moveTo(x, 0);
      g.lineTo(x, this.worldH);
    }
    for (let y = s; y < this.worldH; y += s) {
      g.moveTo(0, y);
      g.lineTo(this.worldW, y);
    }
    g.stroke();
  }

  private drawBody(
    g: CanvasRenderingContext2D,
    body: Matter.Body,
    shape: ShapeSpec,
    view: DrawView,
  ): void {
    const t = view.bodyTransform(body);
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    drawShape(g, shape);
    g.restore();
  }
}

export function drawShape(g: CanvasRenderingContext2D, shape: ShapeSpec): void {
  g.fillStyle = shape.fill;
  if (shape.stroke) {
    g.strokeStyle = shape.stroke;
    g.lineWidth = shape.strokeWidth ?? 2;
  }
  g.beginPath();
  if (shape.kind === 'circle') {
    g.arc(0, 0, shape.r ?? 10, 0, Math.PI * 2);
  } else if (shape.kind === 'rect') {
    const w = shape.w ?? 10;
    const h = shape.h ?? 10;
    if (shape.round) {
      g.roundRect(-w / 2, -h / 2, w, h, shape.round);
    } else {
      g.rect(-w / 2, -h / 2, w, h);
    }
  } else if (shape.kind === 'poly' && shape.verts && shape.verts.length > 2) {
    g.moveTo(shape.verts[0].x, shape.verts[0].y);
    for (let i = 1; i < shape.verts.length; i++) g.lineTo(shape.verts[i].x, shape.verts[i].y);
    g.closePath();
  }
  g.fill();
  if (shape.stroke) g.stroke();
  shape.decorate?.(g);
}
