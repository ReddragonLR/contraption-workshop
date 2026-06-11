import type Matter from 'matter-js';

export type PartCategory = 'structure' | 'balls' | 'mechanisms' | 'containers';

export type OptionValue = string | number | boolean;

export interface ConfigOptionSpec {
  key: string;
  label: string;
  type: 'boolean' | 'choice' | 'number';
  choices?: { value: OptionValue; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  default: OptionValue;
}

/** Named rope attachment point, in part-local coordinates (before rotation). */
export interface AnchorSpec {
  id: string;
  x: number;
  y: number;
}

/** Collision footprint used for placement-overlap validation. */
export type Footprint =
  | { kind: 'rect'; w: number; h: number }
  | { kind: 'circle'; r: number }
  | { kind: 'none' }; // connectors (ropes) skip overlap validation

/**
 * A part placed in the scene. This is the design-time source of truth: the
 * running physics world is always rebuilt from the placement list, which is
 * what makes Reset exact and runs deterministic.
 */
export interface Placement {
  instanceId: string;
  partId: string;
  x: number;
  y: number;
  /** Degrees, clockwise (canvas convention). */
  rotation: number;
  options: Record<string, OptionValue>;
  /** Stable identifier used by goals and rope endpoints. */
  tag?: string;
  /** Fixed level geometry: cannot be moved or removed by the player. */
  locked: boolean;
  /** Placed from the bin by the player: deleting it returns it to the bin. */
  fromBin: boolean;
  /** Index of the bin slot this part came from (for returning it). */
  binSlot?: number;
  /** Rope endpoints (connector parts only). */
  link?: { a: RopeEnd; b: RopeEnd };
}

export interface RopeEnd {
  /** instanceId or tag of the part this rope end ties to. */
  ref: string;
  anchorId: string;
}

/** Visual description of one physics body; the renderer draws these generically. */
export interface ShapeSpec {
  kind: 'rect' | 'circle' | 'poly';
  w?: number;
  h?: number;
  r?: number;
  /** Local-space vertices for kind 'poly'. */
  verts?: { x: number; y: number }[];
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** Corner radius for rects. */
  round?: number;
  /** Draw order; higher draws later. Default 0. */
  z?: number;
  invisible?: boolean;
  /** Extra detail drawn in body-local space after the base shape. */
  decorate?: (g: CanvasRenderingContext2D) => void;
}

export interface PartRuntime {
  placement: Placement;
  def: PartDefinition;
  bodies: Matter.Body[];
  constraints: Matter.Constraint[];
  /** Mutable per-run state (popped, pressed, powered, contact sets…). */
  state: Record<string, unknown>;
}

/** Simple boolean power network: buttons turn tags on; devices poll them. */
export interface PowerNetwork {
  turnOn(tag: string): void;
  isOn(tag: string): boolean;
}

/** The surface behavior hooks may use. Implemented by engine/Simulation. */
export interface SimulationApi {
  engine: Matter.Engine;
  world: Matter.World;
  gravity: { x: number; y: number };
  stepIndex: number;
  power: PowerNetwork;
  dynamicBodies(): Matter.Body[];
  runtimeForBody(body: Matter.Body): PartRuntime | undefined;
  runtimeById(idOrTag: string): PartRuntime | undefined;
  allRuntimes(): PartRuntime[];
  removeConstraint(c: Matter.Constraint): void;
  removeBody(b: Matter.Body): void;
  /** Sever a rope runtime mid-span (scissors/flame; also exposed for tests). */
  cutRope(idOrTag: string): boolean;
  emit(event: SimEventName, payload?: unknown): void;
}

export type SimEventName =
  | 'collision'
  | 'bounce'
  | 'balloon-pop'
  | 'rope-cut'
  | 'device-on'
  | 'button-press';

export interface CreateContext {
  /** Resolve another placement's runtime by instanceId or tag (for connectors). */
  resolve(idOrTag: string): PartRuntime | undefined;
  /** Fresh negative collision group (bodies sharing it never collide). */
  nextGroup(): number;
}

/** Read access to interpolated transforms, for part overlay drawing. */
export interface DrawView {
  alpha: number;
  bodyTransform(body: Matter.Body): { x: number; y: number; angle: number };
}

export interface PartDefinition {
  id: string;
  name: string;
  category: PartCategory;
  description: string;
  movableByPlayer: boolean;
  rotatable: boolean;
  /** Nominal size at rotation 0 (toolbox tiles, ghost preview, footprint default). */
  width: number;
  height: number;
  footprint?: Footprint;
  anchors?: AnchorSpec[];
  options?: ConfigOptionSpec[];
  /** Connectors (ropes) are created after all other parts so endpoints resolve. */
  connector?: boolean;
  create(placement: Placement, ctx: CreateContext): PartRuntime;
  onBeforeStep?(rt: PartRuntime, sim: SimulationApi): void;
  onCollisionStart?(
    rt: PartRuntime,
    ownBody: Matter.Body,
    otherBody: Matter.Body,
    pair: Matter.Pair,
    sim: SimulationApi,
  ): void;
  onCollisionActive?(
    rt: PartRuntime,
    ownBody: Matter.Body,
    otherBody: Matter.Body,
    pair: Matter.Pair,
    sim: SimulationApi,
  ): void;
  /** Part-specific flourishes drawn after generic bodies (rope curve, fan wind…). */
  drawOverlay?(g: CanvasRenderingContext2D, rt: PartRuntime, view: DrawView): void;
  /** Toolbox icon, drawn into a size×size tile around its center. */
  drawIcon(g: CanvasRenderingContext2D, size: number): void;
}
