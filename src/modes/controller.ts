import Matter from 'matter-js';
import { Emitter } from '../store/emitter';
import { Simulation, type WorldSpec } from '../engine/simulation';
import { getPart, partFootprint } from '../parts/registry';
import { runtimeOf } from '../parts/helpers';
import { PlacementFactory } from '../parts/placements';
import type { OptionValue, Placement } from '../parts/types';
import { degToRad, pointSegmentDist } from '../util/math';
import { WinDetector, type GoalDef } from '../engine/winDetect';
import { SettleDetector } from '../engine/settle';
import { ropeRoutePoints } from '../parts/defs/rope';

export type RunState = 'editing' | 'running' | 'won' | 'settled';
export type Mode = 'puzzle' | 'sandbox' | 'editor';

export interface BinSlot {
  partId: string;
  count: number;
  options?: Record<string, OptionValue>;
}

/** Everything the controller needs to host a scene (level, sandbox, editor test). */
export interface SceneSetup {
  id: string;
  title: string;
  world: WorldSpec;
  placements: Placement[];
  bin: BinSlot[];
  goal?: GoalDef;
  goalDescription?: string;
  hint?: string;
}

export type ControllerAction = 'placed' | 'removed' | 'rotated' | 'moved' | 'denied';

export interface ControllerEvents extends Record<string, unknown> {
  /** Anything visible changed: placements, bin, selection, run state. */
  change: void;
  runState: RunState;
  scene: SceneSetup;
  toast: string;
  /** Editing actions, for SFX feedback. */
  action: ControllerAction;
  /** Forwarded simulation events while running (collision, pop, cut…). */
  simEvent: { name: string; payload?: unknown };
}

const MAX_RUN_MS = 60_000;

/**
 * Game state machine: Editing → Running → (Won | Settled) → Editing.
 * The placement list is the single source of truth; every run rebuilds a
 * fresh Simulation from it, which is what makes Reset exact (PRD §2, §6).
 */
export class GameController extends Emitter<ControllerEvents> {
  mode: Mode = 'puzzle';
  runState: RunState = 'editing';
  scene: SceneSetup | null = null;
  placements: Placement[] = [];
  bin: BinSlot[] = [];
  selectedId: string | null = null;
  sim: Simulation | null = null;
  /** Wall-clock-free run age in fixed steps (determinism-safe). */
  private runSteps = 0;
  private factory = new PlacementFactory();
  private winDetector: WinDetector | null = null;
  private settleDetector: SettleDetector | null = null;
  /** True once the current run has been won (latched until next edit). */
  private wonLatch = false;

  loadScene(scene: SceneSetup, mode: Mode = this.mode): void {
    this.mode = mode;
    this.scene = scene;
    this.factory = new PlacementFactory();
    // Re-issue placements through the factory so instanceIds are unique & stable.
    this.placements = scene.placements.map((p) =>
      this.factory.make(p.partId, p.x, p.y, {
        rotation: p.rotation,
        options: p.options,
        tag: p.tag,
        locked: p.locked,
        fromBin: false,
        link: p.link,
      }),
    );
    this.bin = scene.bin.map((s) => ({ ...s }));
    this.selectedId = null;
    this.setRunState('editing');
    this.rebuildEditSim();
    this.emit('scene', scene);
    this.emit('change', undefined);
  }

  private setRunState(rs: RunState): void {
    if (this.runState === rs) return;
    this.runState = rs;
    this.emit('runState', rs);
  }

  private rebuildEditSim(): void {
    if (!this.scene) return;
    this.sim?.destroy();
    this.sim = new Simulation(this.scene.world, this.placements);
  }

  // ── Editing operations (only valid while editing) ────────────────

  get editing(): boolean {
    return this.runState === 'editing';
  }

  placementById(instanceId: string): Placement | undefined {
    return this.placements.find((p) => p.instanceId === instanceId);
  }

  /**
   * Validate that a part footprint fits at (x, y, rotation): fully inside the
   * world, not overlapping any other solid part.
   */
  canPlace(partId: string, x: number, y: number, rotation: number, ignoreId?: string): boolean {
    if (!this.scene || !this.sim) return false;
    const def = getPart(partId);
    const fp = partFootprint(def);
    if (fp.kind === 'none') return true;
    const candidate =
      fp.kind === 'circle'
        ? Matter.Bodies.circle(x, y, fp.r)
        : Matter.Bodies.rectangle(x, y, fp.w, fp.h, { angle: degToRad(rotation) });
    const { width, height } = this.scene.world;
    const b = candidate.bounds;
    if (b.min.x < 0 || b.min.y < 0 || b.max.x > width || b.max.y > height) return false;
    for (const body of Matter.Composite.allBodies(this.sim.world)) {
      if (body.isSensor || body.label === 'boundary') continue;
      const rt = runtimeOf(body);
      if (!rt) continue;
      if (ignoreId && rt.placement.instanceId === ignoreId) continue;
      if (partFootprint(rt.def).kind === 'none') continue; // ropes don't block
      if (Matter.Collision.collides(candidate, body)) return false;
    }
    return true;
  }

  placeFromBin(slotIndex: number, x: number, y: number, rotation = 0): Placement | null {
    if (!this.editing) return null;
    const slot = this.bin[slotIndex];
    if (!slot || slot.count <= 0) return null;
    if (!this.canPlace(slot.partId, x, y, rotation)) {
      this.emit('action', 'denied');
      return null;
    }
    const placement = this.factory.make(slot.partId, x, y, {
      rotation,
      options: slot.options,
      fromBin: true,
    });
    placement.binSlot = slotIndex;
    this.placements.push(placement);
    slot.count--;
    this.rebuildEditSim();
    this.selectedId = placement.instanceId;
    this.emit('action', 'placed');
    this.emit('change', undefined);
    return placement;
  }

  /** Place a connector (rope) from the bin, tying two anchors together. */
  placeRope(
    slotIndex: number,
    link: NonNullable<Placement['link']>,
    x: number,
    y: number,
  ): Placement | null {
    if (!this.editing) return null;
    const slot = this.bin[slotIndex];
    if (!slot || slot.count <= 0 || !getPart(slot.partId).connector) return null;
    if (link.a.ref === link.b.ref) return null;
    const placement = this.factory.make(slot.partId, x, y, {
      options: slot.options,
      fromBin: true,
      link,
    });
    placement.binSlot = slotIndex;
    this.placements.push(placement);
    slot.count--;
    this.rebuildEditSim();
    this.emit('action', 'placed');
    this.emit('change', undefined);
    return placement;
  }

  moveTo(instanceId: string, x: number, y: number): boolean {
    const p = this.placementById(instanceId);
    return p ? this.updateTransform(instanceId, x, y, p.rotation) : false;
  }

  /** Atomically move + rotate (used when a drag also rotated the part). */
  updateTransform(instanceId: string, x: number, y: number, rotation: number): boolean {
    if (!this.editing) return false;
    const p = this.placementById(instanceId);
    if (!p || p.locked) return false;
    if (!this.canPlace(p.partId, x, y, rotation, instanceId)) {
      this.emit('action', 'denied');
      return false;
    }
    p.x = x;
    p.y = y;
    p.rotation = rotation;
    this.rebuildEditSim();
    this.emit('action', 'moved');
    this.emit('change', undefined);
    return true;
  }

  rotateBy(instanceId: string, deltaDeg: number): boolean {
    if (!this.editing) return false;
    const p = this.placementById(instanceId);
    if (!p || p.locked) return false;
    if (!getPart(p.partId).rotatable) return false;
    const next = (((p.rotation + deltaDeg) % 360) + 360) % 360;
    if (!this.canPlace(p.partId, p.x, p.y, next, instanceId)) {
      this.emit('action', 'denied');
      return false;
    }
    p.rotation = next;
    this.rebuildEditSim();
    this.emit('action', 'rotated');
    this.emit('change', undefined);
    return true;
  }

  setOption(instanceId: string, key: string, value: OptionValue): boolean {
    if (!this.editing) return false;
    const p = this.placementById(instanceId);
    if (!p || p.locked) return false;
    p.options[key] = value;
    this.rebuildEditSim();
    this.emit('change', undefined);
    return true;
  }

  /** Remove a player-placed part, returning it to its bin slot. */
  remove(instanceId: string): boolean {
    if (!this.editing) return false;
    const p = this.placementById(instanceId);
    if (!p || !p.fromBin) return false;
    this.placements = this.placements.filter((q) => q.instanceId !== instanceId);
    // Ropes tied to this part vanish with it — including ropes merely routed
    // over it (link.via, e.g. a deleted pulley). via refs may be tag or id.
    this.placements = this.placements.filter((q) => {
      const link = q.link;
      const tied =
        !!link &&
        (link.a.ref === instanceId ||
          link.b.ref === instanceId ||
          (link.via ?? []).some((v) => v === instanceId || v === p.tag));
      if (tied && q.fromBin && q.binSlot !== undefined && this.bin[q.binSlot]) {
        this.bin[q.binSlot].count++;
      }
      return !tied;
    });
    if (p.binSlot !== undefined && this.bin[p.binSlot]) this.bin[p.binSlot].count++;
    if (this.selectedId === instanceId) this.selectedId = null;
    this.rebuildEditSim();
    this.emit('action', 'removed');
    this.emit('change', undefined);
    return true;
  }

  select(instanceId: string | null): void {
    if (this.selectedId === instanceId) return;
    this.selectedId = instanceId;
    this.emit('change', undefined);
  }

  /** Hit-test a world point against placed parts (including rope lines). */
  hitTest(x: number, y: number): Placement | null {
    if (!this.sim) return null;
    const bodies = Matter.Query.point(
      Matter.Composite.allBodies(this.sim.world).filter((b) => b.label !== 'boundary'),
      { x, y },
    );
    for (const body of bodies) {
      const rt = runtimeOf(body);
      if (rt) return rt.placement;
    }
    // Ropes have no bodies — test against their polylines.
    for (const rt of this.sim.allRuntimes()) {
      if (rt.def.id !== 'rope') continue;
      const pts = ropeRoutePoints(rt);
      if (!pts) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        if (pointSegmentDist({ x, y }, pts[i], pts[i + 1]) < 8) return rt.placement;
      }
    }
    return null;
  }

  // ── Run control ──────────────────────────────────────────────────

  run(): void {
    if (!this.scene || this.runState === 'running') return;
    this.selectedId = null;
    this.sim?.destroy();
    this.sim = new Simulation(this.scene.world, this.placements);
    for (const name of ['collision', 'bounce', 'balloon-pop', 'rope-cut', 'device-on', 'button-press'] as const) {
      this.sim.on(name, (payload) => this.emit('simEvent', { name, payload }));
    }
    this.runSteps = 0;
    this.wonLatch = false;
    this.winDetector = this.scene.goal ? new WinDetector(this.scene.goal, this.sim) : null;
    this.settleDetector = new SettleDetector();
    this.setRunState('running');
    this.emit('change', undefined);
  }

  stop(): void {
    if (this.runState === 'editing') return;
    this.setRunState('editing');
    this.rebuildEditSim();
    this.emit('change', undefined);
  }

  /** Reset = stop: the world is always rebuilt from untouched placements. */
  reset(): void {
    this.stop();
  }

  /** Advance one fixed physics step while running; evaluates win/settle. */
  tickRun(): void {
    if (this.runState !== 'running' || !this.sim) return;
    this.sim.step();
    this.runSteps++;
    if (this.winDetector?.tick() === 'won') {
      this.wonLatch = true;
      this.setRunState('won');
      this.emit('change', undefined);
      return;
    }
    const elapsedMs = (this.runSteps * 1000) / 60;
    if (
      this.mode === 'puzzle' &&
      (this.settleDetector!.tick(this.sim, elapsedMs) || elapsedMs >= MAX_RUN_MS)
    ) {
      this.setRunState('settled');
      this.emit('change', undefined);
    }
  }

  get won(): boolean {
    return this.wonLatch;
  }
}
