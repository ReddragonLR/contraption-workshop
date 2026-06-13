import type { GameController } from '../modes/controller';
import type { Renderer } from '../render/renderer';
import type { BinDragStart } from './toolbox';
import { getPart } from '../parts/registry';
import { drawGhost } from './ghost';
import { showToast } from './toast';
import { pointSegmentDist, rotateVec, snap, type Vec2 } from '../util/math';
import { palette } from '../parts/palette';

const ANCHOR_PICK_RADIUS = 26;
const ROPE_VIA_RADIUS = 32;

interface AnchorHit {
  instanceId: string;
  anchorId: string;
  x: number;
  y: number;
}

interface RopeFlow {
  slotIndex: number;
  a: AnchorHit | null;
  cursor: Vec2 | null;
}

const GRID = 10;
const ROT_STEP = 15;
const CLICK_SLOP = 5;

interface DragState {
  kind: 'bin' | 'move';
  partId: string;
  rotation: number;
  /** bin drags */
  slotIndex?: number;
  /** move drags */
  instanceId?: string;
  origX?: number;
  origY?: number;
  origRotation?: number;
  /** current pointer position in world coords (null until over canvas) */
  wx: number | null;
  wy: number | null;
  moved: boolean;
  startClientX: number;
  startClientY: number;
}

export interface PointerHooks {
  onRun(): void;
  onStop(): void;
  onReset(): void;
}

/**
 * All canvas interaction: drag-from-bin, drag-to-move, click-select, wheel /
 * keyboard rotation, delete, run shortcuts (PRD §9 Controls).
 */
export class PointerInput {
  /** While true (editor zone-drawing), canvas input is handed elsewhere. */
  suspended = false;
  private drag: DragState | null = null;
  private toolbar: HTMLElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private wrap: HTMLElement,
    private controller: GameController,
    private renderer: Renderer,
    private hooks: PointerHooks,
  ) {
    this.toolbar = this.buildToolbar();
    canvas.addEventListener('pointerdown', this.onCanvasDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKey);
    controller.on('change', () => this.positionToolbar());
    controller.on('runState', () => this.positionToolbar());
  }

  private ropeFlow: RopeFlow | null = null;

  /** Entry point for drags that begin on a toolbox tile. */
  beginBinDrag(start: BinDragStart): void {
    if (getPart(start.partId).connector) {
      // Ropes aren't dragged — they're tied between two anchor points.
      this.ropeFlow = { slotIndex: start.slotIndex, a: null, cursor: null };
      this.controller.select(null);
      showToast('Tie the rope: click the first anchor point (◎).');
      return;
    }
    this.drag = {
      kind: 'bin',
      partId: start.partId,
      slotIndex: start.slotIndex,
      rotation: 0,
      wx: null,
      wy: null,
      moved: false,
      startClientX: start.clientX,
      startClientY: start.clientY,
    };
  }

  /** All tie-able anchor points in the current scene (world coords). */
  private anchorPoints(): AnchorHit[] {
    const out: AnchorHit[] = [];
    for (const p of this.controller.placements) {
      const def = getPart(p.partId);
      if (def.connector || !def.anchors?.length) continue;
      const rad = (p.rotation * Math.PI) / 180;
      for (const a of def.anchors) {
        const w = rotateVec({ x: a.x, y: a.y }, rad);
        out.push({ instanceId: p.instanceId, anchorId: a.id, x: p.x + w.x, y: p.y + w.y });
      }
    }
    return out;
  }

  private nearestAnchor(wx: number, wy: number): AnchorHit | null {
    let best: AnchorHit | null = null;
    let bestD = ANCHOR_PICK_RADIUS;
    for (const a of this.anchorPoints()) {
      const d = Math.hypot(a.x - wx, a.y - wy);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  private handleRopeClick(wx: number, wy: number): void {
    const flow = this.ropeFlow!;
    const hit = this.nearestAnchor(wx, wy);
    if (!hit) {
      showToast('No anchor there — click a part’s ◎ anchor point (Esc cancels).');
      return;
    }
    if (!flow.a) {
      flow.a = hit;
      showToast('Now click the second anchor point.');
      return;
    }
    if (hit.instanceId === flow.a.instanceId) {
      showToast('Pick an anchor on a different part.');
      return;
    }
    // Route over any pulleys sitting near the line between the two anchors.
    const via = this.controller.placements
      .filter((p) => p.partId === 'pulley')
      .map((p) => ({
        ref: p.tag ?? p.instanceId,
        t:
          ((p.x - flow.a!.x) * (hit.x - flow.a!.x) + (p.y - flow.a!.y) * (hit.y - flow.a!.y)) /
          (Math.hypot(hit.x - flow.a!.x, hit.y - flow.a!.y) ** 2 || 1),
        d: pointSegmentDist({ x: p.x, y: p.y }, flow.a!, hit),
      }))
      .filter((c) => c.d < ROPE_VIA_RADIUS && c.t > 0.02 && c.t < 0.98)
      .sort((a, b) => a.t - b.t)
      .map((c) => c.ref);
    const placed = this.controller.placeRope(
      flow.slotIndex,
      {
        a: { ref: flow.a.instanceId, anchorId: flow.a.anchorId },
        b: { ref: hit.instanceId, anchorId: hit.anchorId },
        via: via.length ? via : undefined,
      },
      snap((flow.a.x + hit.x) / 2, GRID),
      snap((flow.a.y + hit.y) / 2, GRID),
    );
    this.ropeFlow = null;
    if (placed) {
      showToast(via.length ? 'Rope tied — routed over the pulley!' : 'Rope tied.');
    } else {
      showToast('Could not tie the rope there.');
    }
  }

  /** Overlay drawn by the renderer each frame (world space). */
  drawOverlay = (g: CanvasRenderingContext2D): void => {
    this.drawSelection(g);
    this.drawRopeFlow(g);
    const d = this.drag;
    if (d && d.wx !== null && d.wy !== null) {
      const valid = this.controller.canPlace(d.partId, d.wx, d.wy, d.rotation, d.instanceId);
      drawGhost(g, d.partId, d.wx, d.wy, d.rotation, valid);
    }
  };

  private drawRopeFlow(g: CanvasRenderingContext2D): void {
    const flow = this.ropeFlow;
    if (!flow) return;
    g.save();
    for (const a of this.anchorPoints()) {
      const isA = flow.a && a.instanceId === flow.a.instanceId && a.anchorId === flow.a.anchorId;
      g.strokeStyle = isA ? palette.win : palette.rope;
      g.fillStyle = 'rgba(246,241,227,0.85)';
      g.lineWidth = isA ? 3.5 : 2.5;
      g.beginPath();
      g.arc(a.x, a.y, isA ? 10 : 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = palette.ink;
      g.beginPath();
      g.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    if (flow.a && flow.cursor) {
      g.strokeStyle = palette.rope;
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      g.beginPath();
      g.moveTo(flow.a.x, flow.a.y);
      g.lineTo(flow.cursor.x, flow.cursor.y);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  private drawSelection(g: CanvasRenderingContext2D): void {
    const sel = this.selectedRuntimeBounds();
    if (!sel) return;
    g.save();
    g.strokeStyle = palette.win;
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(sel.x - 6, sel.y - 6, sel.w + 12, sel.h + 12);
    g.setLineDash([]);
    g.restore();
  }

  private selectedRuntimeBounds(): { x: number; y: number; w: number; h: number } | null {
    const c = this.controller;
    if (!c.selectedId || !c.sim) return null;
    const rt = c.sim.runtimeById(c.selectedId);
    if (!rt || rt.bodies.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of rt.bodies) {
      minX = Math.min(minX, b.bounds.min.x);
      minY = Math.min(minY, b.bounds.min.y);
      maxX = Math.max(maxX, b.bounds.max.x);
      maxY = Math.max(maxY, b.bounds.max.y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // ── Selection toolbar (rotate / delete) ──────────────────────────

  private buildToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'sel-toolbar hidden';
    bar.innerHTML = `
      <button data-act="ccw" title="Rotate left ([)" aria-label="Rotate left">⟲</button>
      <button data-act="cw" title="Rotate right (])" aria-label="Rotate right">⟳</button>
      <button data-act="del" title="Remove (Delete)" aria-label="Remove part">✕</button>
    `;
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    bar.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      const id = this.controller.selectedId;
      if (!act || !id) return;
      if (act === 'ccw') this.tryRotate(id, -ROT_STEP);
      if (act === 'cw') this.tryRotate(id, ROT_STEP);
      if (act === 'del' && !this.controller.remove(id)) showToast('This part belongs to the level.');
    });
    this.wrap.appendChild(bar);
    return bar;
  }

  private tryRotate(id: string, delta: number): void {
    const p = this.controller.placementById(id);
    if (!p) return;
    if (!getPart(p.partId).rotatable) {
      showToast(`${getPart(p.partId).name} doesn't rotate.`);
      return;
    }
    if (p.locked) {
      showToast('This part is bolted down.');
      return;
    }
    if (!this.controller.rotateBy(id, delta)) showToast('No room to rotate it there.');
  }

  positionToolbar(): void {
    const c = this.controller;
    const sel = this.selectedRuntimeBounds();
    const p = c.selectedId ? c.placementById(c.selectedId) : null;
    const show = !!sel && !!p && !p.locked && c.editing && !this.drag;
    this.toolbar.classList.toggle('hidden', !show);
    if (!show || !sel) return;
    const topLeft = this.renderer.worldToScreen(sel.x + sel.w / 2, sel.y);
    this.toolbar.style.left = `${this.canvas.offsetLeft + topLeft.x}px`;
    this.toolbar.style.top = `${this.canvas.offsetTop + topLeft.y - 8}px`;
  }

  // ── Pointer events ───────────────────────────────────────────────

  private onCanvasDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.suspended) return;
    const c = this.controller;
    const w = this.renderer.screenToWorld(e.clientX, e.clientY);
    if (!c.editing) return;
    if (this.ropeFlow) {
      this.handleRopeClick(w.x, w.y);
      return;
    }
    const hit = c.hitTest(w.x, w.y);
    if (hit && !hit.locked) {
      this.drag = {
        kind: 'move',
        partId: hit.partId,
        instanceId: hit.instanceId,
        rotation: hit.rotation,
        origX: hit.x,
        origY: hit.y,
        origRotation: hit.rotation,
        wx: snap(hit.x, GRID),
        wy: snap(hit.y, GRID),
        moved: false,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      c.select(hit.instanceId);
    } else {
      c.select(hit ? hit.instanceId : null);
    }
    this.positionToolbar();
  };

  private onMove = (e: PointerEvent): void => {
    if (this.suspended) return;
    if (this.ropeFlow) {
      const w = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.ropeFlow.cursor = w;
      return;
    }
    const d = this.drag;
    if (!d) return;
    if (
      Math.abs(e.clientX - d.startClientX) > CLICK_SLOP ||
      Math.abs(e.clientY - d.startClientY) > CLICK_SLOP
    ) {
      d.moved = true;
    }
    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (inside) {
      const w = this.renderer.screenToWorld(e.clientX, e.clientY);
      d.wx = snap(w.x, GRID);
      d.wy = snap(w.y, GRID);
    } else {
      d.wx = null;
      d.wy = null;
    }
    if (d.moved) this.toolbar.classList.add('hidden');
  };

  private onUp = (): void => {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const c = this.controller;
    if (d.kind === 'bin') {
      if (d.wx === null || d.wy === null) return; // dropped outside: cancel
      const placed = c.placeFromBin(d.slotIndex!, d.wx, d.wy, d.rotation);
      if (!placed) showToast("It won't fit there — try an open spot.");
    } else if (d.kind === 'move' && d.moved) {
      const ok =
        d.wx !== null &&
        d.wy !== null &&
        c.updateTransform(d.instanceId!, d.wx, d.wy, d.rotation);
      if (!ok) {
        showToast("It won't fit there — snapped back.");
        c.emit('change', undefined); // redraw at original spot
      }
    }
    this.positionToolbar();
  };

  private onWheel = (e: WheelEvent): void => {
    const c = this.controller;
    const d = this.drag;
    const delta = e.deltaY > 0 ? ROT_STEP : -ROT_STEP;
    if (d && getPart(d.partId).rotatable) {
      e.preventDefault();
      d.rotation = (((d.rotation + delta) % 360) + 360) % 360;
    } else if (c.selectedId && c.editing) {
      e.preventDefault();
      this.tryRotate(c.selectedId, delta);
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    const c = this.controller;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (c.runState === 'running') this.hooks.onStop();
        else this.hooks.onRun();
        break;
      case 'r':
      case 'R':
        this.hooks.onReset();
        break;
      case 'Delete':
      case 'Backspace':
        if (c.selectedId && c.editing) {
          if (!c.remove(c.selectedId)) showToast('This part belongs to the level.');
        }
        break;
      case '[':
        if (c.selectedId && c.editing) this.tryRotate(c.selectedId, -ROT_STEP);
        break;
      case ']':
        if (c.selectedId && c.editing) this.tryRotate(c.selectedId, ROT_STEP);
        break;
      case 'Escape':
        if (this.ropeFlow) {
          this.ropeFlow = null;
          showToast('Rope cancelled.');
        }
        this.drag = null;
        c.select(null);
        this.positionToolbar();
        break;
    }
  };
}
