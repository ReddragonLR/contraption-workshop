import type { GameController, Mode } from './modes/controller';
import type { FixedLoop } from './engine/loop';
import type { OptionValue } from './parts/types';

/**
 * Build-safe test hooks for Playwright (PRD §13.2). Only installed when the
 * page is loaded with ?test=1, so production users never see it and E2E can
 * drive the real app without pixel-picking.
 */
export interface GameTestApi {
  getRunState(): string;
  getMode(): string;
  getPlacements(): {
    instanceId: string;
    partId: string;
    x: number;
    y: number;
    rotation: number;
    tag?: string;
    locked: boolean;
    fromBin: boolean;
  }[];
  getBin(): { partId: string; count: number }[];
  placePart(partId: string, x: number, y: number, rotation?: number): string | null;
  move(instanceId: string, x: number, y: number): boolean;
  rotate(instanceId: string, deltaDeg: number): boolean;
  remove(instanceId: string): boolean;
  setOption(instanceId: string, key: string, value: OptionValue): boolean;
  run(): void;
  stop(): void;
  reset(): void;
  setSpeed(speed: number): void;
  isWon(): boolean;
  bodyPosition(tagOrId: string): { x: number; y: number } | null;
  /** Extended by later milestones (levels, progress, editor). */
  extras: Record<string, unknown>;
}

declare global {
  interface Window {
    __GAME__?: GameTestApi;
  }
}

export function testModeEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('test');
}

export function installTestApi(controller: GameController, loop: FixedLoop): GameTestApi | null {
  if (!testModeEnabled()) return null;
  const api: GameTestApi = {
    getRunState: () => controller.runState,
    getMode: () => controller.mode,
    getPlacements: () =>
      controller.placements.map((p) => ({
        instanceId: p.instanceId,
        partId: p.partId,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        tag: p.tag,
        locked: p.locked,
        fromBin: p.fromBin,
      })),
    getBin: () => controller.bin.map((s) => ({ partId: s.partId, count: s.count })),
    placePart: (partId, x, y, rotation = 0) => {
      const slot = controller.bin.findIndex((s) => s.partId === partId && s.count > 0);
      if (slot < 0) return null;
      return controller.placeFromBin(slot, x, y, rotation)?.instanceId ?? null;
    },
    move: (id, x, y) => controller.moveTo(id, x, y),
    rotate: (id, d) => controller.rotateBy(id, d),
    remove: (id) => controller.remove(id),
    setOption: (id, key, value) => controller.setOption(id, key, value),
    run: () => controller.run(),
    stop: () => controller.stop(),
    reset: () => controller.reset(),
    setSpeed: (speed) => {
      loop.speed = speed;
    },
    isWon: () => controller.won,
    bodyPosition: (tagOrId) => {
      const rt = controller.sim?.runtimeById(tagOrId);
      const b = rt?.bodies[0];
      return b ? { x: b.position.x, y: b.position.y } : null;
    },
    extras: {},
  };
  window.__GAME__ = api;
  return api;
}

export type { Mode };
