import type Matter from 'matter-js';
import type { Simulation } from './simulation';
import { FIXED_DT_MS } from './simulation';
import { rectContains, type Rect } from '../util/math';

/** Goal definitions (PRD §8). Composites nest arbitrarily. */
export type GoalDef =
  | { type: 'object-in-zone'; objectTag: string; zone: Rect; sustainMs?: number; description: string }
  | { type: 'device-on'; deviceTag: string; description: string }
  | { type: 'objects-collide'; tagA: string; tagB: string; description: string }
  | { type: 'all-of'; goals: GoalDef[]; description: string }
  | { type: 'any-of'; goals: GoalDef[]; description: string };

const DEFAULT_SUSTAIN_MS = 300;

interface NodeState {
  goal: GoalDef;
  won: boolean;
  sustainedMs: number;
  children: NodeState[];
}

/**
 * Evaluates a goal tree against a running simulation, once per fixed step.
 * Leaf wins latch (a popped condition can't un-win), so chain-reaction
 * machines don't lose credit when the world keeps moving.
 */
export class WinDetector {
  private root: NodeState;
  private collidedPairs = new Set<string>();

  constructor(
    goal: GoalDef,
    private sim: Simulation,
  ) {
    this.root = this.buildNode(goal);
    sim.on('collision', (payload) => {
      const pair = payload as Matter.Pair;
      const ta = this.sim.runtimeForBody(pair.bodyA)?.placement.tag;
      const tb = this.sim.runtimeForBody(pair.bodyB)?.placement.tag;
      if (ta && tb) {
        this.collidedPairs.add(`${ta}::${tb}`);
        this.collidedPairs.add(`${tb}::${ta}`);
      }
    });
  }

  private buildNode(goal: GoalDef): NodeState {
    const children =
      goal.type === 'all-of' || goal.type === 'any-of'
        ? goal.goals.map((g) => this.buildNode(g))
        : [];
    return { goal, won: false, sustainedMs: 0, children };
  }

  tick(): 'pending' | 'won' {
    this.evalNode(this.root);
    return this.root.won ? 'won' : 'pending';
  }

  private evalNode(node: NodeState): boolean {
    if (node.won) return true;
    const g = node.goal;
    switch (g.type) {
      case 'object-in-zone': {
        const rt = this.sim.runtimeById(g.objectTag);
        const body = rt?.bodies[0];
        if (body && rectContains(g.zone, body.position)) {
          node.sustainedMs += FIXED_DT_MS;
          if (node.sustainedMs >= (g.sustainMs ?? DEFAULT_SUSTAIN_MS)) node.won = true;
        } else {
          node.sustainedMs = 0;
        }
        break;
      }
      case 'device-on': {
        const rt = this.sim.runtimeById(g.deviceTag);
        if (this.sim.power.isOn(g.deviceTag) || rt?.state.isOn === true) node.won = true;
        break;
      }
      case 'objects-collide': {
        if (this.collidedPairs.has(`${g.tagA}::${g.tagB}`)) node.won = true;
        break;
      }
      case 'all-of': {
        // Evaluate every child each tick so sustain timers keep counting.
        let all = true;
        for (const c of node.children) if (!this.evalNode(c)) all = false;
        node.won = all;
        break;
      }
      case 'any-of': {
        let any = false;
        for (const c of node.children) if (this.evalNode(c)) any = true;
        node.won = any;
        break;
      }
    }
    return node.won;
  }
}
