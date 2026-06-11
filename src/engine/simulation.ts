import Matter from 'matter-js';
import type {
  PartRuntime,
  Placement,
  PowerNetwork,
  SimEventName,
  SimulationApi,
} from '../parts/types';
import { getPart } from '../parts/registry';
import { runtimeOf, attachShape } from '../parts/helpers';
import { fnv1a } from '../util/hash';

export const FIXED_DT_MS = 1000 / 60;

export interface WorldSpec {
  width: number;
  height: number;
  gravity: { x: number; y: number };
}

export interface BodyTransform {
  x: number;
  y: number;
  angle: number;
}

const BOUNDARY_THICKNESS = 120;

/**
 * The physics world for one run (or one frozen edit-mode preview).
 *
 * Determinism contract (PRD §6): a Simulation is always built fresh from a
 * placement list, advanced only by fixed-size steps, and never touched by
 * variable frame timing or unseeded randomness. Same placements ⇒ same
 * world, step for step.
 */
export class Simulation implements SimulationApi {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  readonly spec: WorldSpec;
  readonly gravity: { x: number; y: number };
  stepIndex = 0;

  private runtimes = new Map<string, PartRuntime>(); // by instanceId
  private tagIndex = new Map<string, PartRuntime>();
  private order: PartRuntime[] = [];
  private listeners = new Map<string, ((payload?: unknown) => void)[]>();
  private poweredTags = new Set<string>();
  private groupCounter = 0;

  readonly power: PowerNetwork = {
    turnOn: (tag) => {
      if (!this.poweredTags.has(tag)) {
        this.poweredTags.add(tag);
        this.emit('device-on', tag);
      }
    },
    isOn: (tag) => this.poweredTags.has(tag),
  };

  constructor(spec: WorldSpec, placements: Placement[]) {
    this.spec = spec;
    this.gravity = { ...spec.gravity };
    this.engine = Matter.Engine.create({
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 10, // ropes/pulleys need stiff chains (default 2)
      enableSleeping: false,
    });
    this.engine.gravity.x = spec.gravity.x;
    this.engine.gravity.y = spec.gravity.y;
    this.world = this.engine.world;

    this.addBoundary(spec);

    // Connectors (ropes) are created last so their endpoints already exist.
    const plain = placements.filter((p) => !getPart(p.partId).connector);
    const connectors = placements.filter((p) => getPart(p.partId).connector);
    for (const p of [...plain, ...connectors]) this.addPlacement(p);

    Matter.Events.on(this.engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) this.dispatchPair('start', pair);
    });
    Matter.Events.on(this.engine, 'collisionActive', (ev) => {
      for (const pair of ev.pairs) this.dispatchPair('active', pair);
    });
  }

  private addBoundary(spec: WorldSpec): void {
    const t = BOUNDARY_THICKNESS;
    const { width: w, height: h } = spec;
    const opts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.5,
      restitution: 0.05,
      label: 'boundary',
    };
    const walls = [
      Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts), // floor
      Matter.Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, opts), // ceiling
      Matter.Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, opts), // left
      Matter.Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, opts), // right
    ];
    for (const b of walls) {
      attachShape(b, { kind: 'rect', fill: 'transparent', invisible: true });
      Matter.World.add(this.world, b);
    }
  }

  private addPlacement(placement: Placement): void {
    const def = getPart(placement.partId);
    const rt = def.create(placement, {
      resolve: (idOrTag) => this.runtimeById(idOrTag),
      nextGroup: () => --this.groupCounter,
    });
    this.runtimes.set(placement.instanceId, rt);
    if (placement.tag) this.tagIndex.set(placement.tag, rt);
    this.order.push(rt);
    Matter.World.add(this.world, rt.bodies);
    if (rt.constraints.length) Matter.World.add(this.world, rt.constraints);
  }

  private dispatchPair(kind: 'start' | 'active', pair: Matter.Pair): void {
    const a = runtimeOf(pair.bodyA);
    const b = runtimeOf(pair.bodyB);
    if (kind === 'start') {
      this.emit('collision', pair);
      a?.def.onCollisionStart?.(a, pair.bodyA, pair.bodyB, pair, this);
      b?.def.onCollisionStart?.(b, pair.bodyB, pair.bodyA, pair, this);
    } else {
      a?.def.onCollisionActive?.(a, pair.bodyA, pair.bodyB, pair, this);
      b?.def.onCollisionActive?.(b, pair.bodyB, pair.bodyA, pair, this);
    }
  }

  /** Previous-step transforms, kept for render interpolation. */
  readonly prevTransforms = new Map<number, BodyTransform>();

  step(): void {
    this.prevTransforms.clear();
    for (const body of Matter.Composite.allBodies(this.world)) {
      this.prevTransforms.set(body.id, {
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
      });
    }
    for (const rt of this.order) rt.def.onBeforeStep?.(rt, this);
    Matter.Engine.update(this.engine, FIXED_DT_MS);
    this.stepIndex++;
  }

  // ── SimulationApi ────────────────────────────────────────────────

  dynamicBodies(): Matter.Body[] {
    return Matter.Composite.allBodies(this.world).filter((b) => !b.isStatic);
  }

  runtimeForBody(body: Matter.Body): PartRuntime | undefined {
    return runtimeOf(body);
  }

  runtimeById(idOrTag: string): PartRuntime | undefined {
    return this.runtimes.get(idOrTag) ?? this.tagIndex.get(idOrTag);
  }

  allRuntimes(): PartRuntime[] {
    return this.order;
  }

  removeConstraint(c: Matter.Constraint): void {
    Matter.World.remove(this.world, c);
  }

  removeBody(b: Matter.Body): void {
    Matter.World.remove(this.world, b);
  }

  cutRope(idOrTag: string): boolean {
    const rt = this.runtimeById(idOrTag);
    if (!rt || rt.def.id !== 'rope') return false;
    const cut = rt.state.cut as ((sim: SimulationApi) => boolean) | undefined;
    return cut ? cut(this) : false;
  }

  on(event: SimEventName, cb: (payload?: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
  }

  emit(event: SimEventName, payload?: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) cb(payload);
  }

  // ── Measurement ──────────────────────────────────────────────────

  /** Total kinetic energy (translational + rotational) of dynamic bodies. */
  kineticEnergy(): number {
    let ke = 0;
    for (const b of this.dynamicBodies()) {
      const v2 = b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y;
      ke += 0.5 * b.mass * v2 + 0.5 * b.inertia * b.angularVelocity * b.angularVelocity;
    }
    return ke;
  }

  /** Deterministic hash of all body transforms — the determinism-test probe. */
  snapshotHash(): string {
    const parts: string[] = [];
    for (const rt of this.order) {
      for (const b of rt.bodies) {
        parts.push(
          `${rt.placement.instanceId}:${b.position.x.toFixed(8)},${b.position.y.toFixed(8)},${b.angle.toFixed(8)},${b.velocity.x.toFixed(8)},${b.velocity.y.toFixed(8)}`,
        );
      }
    }
    return fnv1a(parts.join('|'));
  }

  destroy(): void {
    Matter.Events.off(this.engine, 'collisionStart');
    Matter.Events.off(this.engine, 'collisionActive');
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.listeners.clear();
  }
}
