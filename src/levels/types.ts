import type { GoalDef } from '../engine/winDetect';
import type { OptionValue } from '../parts/types';

/** Level JSON schema (PRD §8). Pure data — validated by schema.ts. */
export interface LevelPartEntry {
  partId: string;
  x: number;
  y: number;
  rotation?: number;
  tag?: string;
  /** fixedParts only: explicitly mark a fixed part as movable. */
  movable?: boolean;
  options?: Record<string, OptionValue>;
  /** Rope endpoints, referencing other entries by tag; via = pulley tags to route over. */
  link?: {
    a: { ref: string; anchorId: string };
    b: { ref: string; anchorId: string };
    via?: string[];
  };
}

export interface LevelBinEntry {
  partId: string;
  count: number;
  options?: Record<string, OptionValue>;
}

export interface LevelDef {
  id: string;
  title: string;
  version: number;
  world: {
    width: number;
    height: number;
    gravity: { x: number; y: number };
    airPressure?: number;
  };
  goal: GoalDef;
  fixedParts: LevelPartEntry[];
  placedParts: LevelPartEntry[];
  bin: LevelBinEntry[];
  hint?: string;
}

export type { GoalDef };
