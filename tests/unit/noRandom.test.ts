import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SIM_DIRS = ['src/engine', 'src/parts', 'src/levels', 'src/util'];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => join(e.parentPath, e.name));
}

describe('determinism guard (PRD §6)', () => {
  it('no Math.random anywhere in simulation-affecting code', () => {
    const offenders: string[] = [];
    for (const dir of SIM_DIRS) {
      let files: string[];
      try {
        files = listFiles(dir);
      } catch {
        continue; // directory may not exist yet
      }
      for (const file of files) {
        if (/Math\.random/.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
