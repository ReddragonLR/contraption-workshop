import type { LevelDef } from '../levels/types';

const KEY = 'cw-editor-levels-v1';

/** Editor-authored levels, persisted in localStorage (PRD §3). */
export function savedCustomLevels(): LevelDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, LevelDef>;
    return Object.values(parsed).sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

export function getCustomLevel(id: string): LevelDef | undefined {
  return savedCustomLevels().find((l) => l.id === id);
}

export function saveCustomLevel(def: LevelDef): void {
  const all = Object.fromEntries(savedCustomLevels().map((l) => [l.id, l]));
  all[def.id] = def;
  // Throws on quota/private-mode; the editor surfaces this to the user.
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteCustomLevel(id: string): void {
  const all = Object.fromEntries(savedCustomLevels().map((l) => [l.id, l]));
  delete all[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function customLevelId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `custom-${slug || 'untitled'}`;
}
