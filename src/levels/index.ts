import type { LevelDef } from './types';
import { validateLevel } from './schema';

const modules = import.meta.glob('./data/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

let cache: LevelDef[] | null = null;

/** All shipped levels, validated, in id order (level-01, level-02, …). */
export function allLevels(): LevelDef[] {
  if (!cache) {
    cache = Object.values(modules)
      .map((m) => validateLevel(m.default))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return cache;
}

export function getLevel(id: string): LevelDef | undefined {
  return allLevels().find((l) => l.id === id);
}

export function nextLevelId(id: string): string | undefined {
  const list = allLevels();
  const i = list.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < list.length ? list[i + 1].id : undefined;
}
