const KEY = 'cw-progress-v1';

/** Which levels the player has solved (PRD §3: localStorage persistence). */
export function solvedLevels(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { solved?: string[] };
    return new Set(Array.isArray(parsed.solved) ? parsed.solved : []);
  } catch {
    return new Set();
  }
}

export function markSolved(levelId: string): void {
  const solved = solvedLevels();
  solved.add(levelId);
  localStorage.setItem(KEY, JSON.stringify({ solved: [...solved].sort() }));
}

export function clearProgress(): void {
  localStorage.removeItem(KEY);
}
