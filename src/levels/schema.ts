import type { GoalDef, LevelDef, LevelPartEntry } from './types';
import { hasPart } from '../parts/registry';

/**
 * Hand-written runtime validator (PRD §8). Throws a single Error listing
 * every problem found, so level authors get all feedback at once.
 */
export function validateLevel(data: unknown): LevelDef {
  const errors: string[] = [];
  const lvl = data as LevelDef;

  if (typeof lvl !== 'object' || lvl === null) {
    throw new Error('Level must be an object');
  }
  if (typeof lvl.id !== 'string' || !lvl.id) errors.push('id must be a non-empty string');
  if (typeof lvl.title !== 'string' || !lvl.title) errors.push('title must be a non-empty string');
  if (typeof lvl.version !== 'number') errors.push('version must be a number');

  if (typeof lvl.world !== 'object' || lvl.world === null) {
    errors.push('world is required');
  } else {
    const { width, height, gravity } = lvl.world;
    if (!Number.isFinite(width) || width < 400 || width > 2400) {
      errors.push('world.width must be 400–2400');
    }
    if (!Number.isFinite(height) || height < 300 || height > 1600) {
      errors.push('world.height must be 300–1600');
    }
    if (
      typeof gravity !== 'object' ||
      gravity === null ||
      !Number.isFinite(gravity.x) ||
      !Number.isFinite(gravity.y)
    ) {
      errors.push('world.gravity must have numeric x and y');
    }
  }

  const fixed = Array.isArray(lvl.fixedParts) ? lvl.fixedParts : [];
  const placed = Array.isArray(lvl.placedParts) ? lvl.placedParts : [];
  if (!Array.isArray(lvl.fixedParts)) errors.push('fixedParts must be an array');
  if (!Array.isArray(lvl.placedParts)) errors.push('placedParts must be an array');

  const tags = new Set<string>();
  const checkEntry = (entry: LevelPartEntry, where: string): void => {
    if (typeof entry.partId !== 'string' || !hasPart(entry.partId)) {
      errors.push(`${where}: unknown partId "${entry.partId}"`);
    }
    if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      errors.push(`${where}: x and y must be numbers`);
    }
    if (entry.rotation !== undefined && !Number.isFinite(entry.rotation)) {
      errors.push(`${where}: rotation must be a number`);
    }
    if (entry.tag !== undefined) {
      if (typeof entry.tag !== 'string' || !entry.tag) {
        errors.push(`${where}: tag must be a non-empty string`);
      } else if (tags.has(entry.tag)) {
        errors.push(`${where}: duplicate tag "${entry.tag}"`);
      } else {
        tags.add(entry.tag);
      }
    }
    if (entry.link) {
      for (const end of ['a', 'b'] as const) {
        const e = entry.link[end];
        if (!e || typeof e.ref !== 'string' || typeof e.anchorId !== 'string') {
          errors.push(`${where}: link.${end} needs ref and anchorId`);
        }
      }
    }
  };
  fixed.forEach((p, i) => checkEntry(p, `fixedParts[${i}]`));
  placed.forEach((p, i) => checkEntry(p, `placedParts[${i}]`));

  // Rope link refs must resolve to a tag in this level.
  for (const entry of [...fixed, ...placed]) {
    if (!entry.link) continue;
    for (const end of ['a', 'b'] as const) {
      const ref = entry.link[end]?.ref;
      if (ref && !tags.has(ref)) {
        errors.push(`link ref "${ref}" does not match any tagged part`);
      }
    }
    for (const ref of entry.link.via ?? []) {
      if (!tags.has(ref)) errors.push(`link via ref "${ref}" does not match any tagged part`);
    }
  }

  if (!Array.isArray(lvl.bin)) {
    errors.push('bin must be an array');
  } else {
    lvl.bin.forEach((slot, i) => {
      if (typeof slot.partId !== 'string' || !hasPart(slot.partId)) {
        errors.push(`bin[${i}]: unknown partId "${slot.partId}"`);
      }
      if (!Number.isInteger(slot.count) || slot.count < 0) {
        errors.push(`bin[${i}]: count must be a non-negative integer`);
      }
    });
  }

  if (typeof lvl.goal !== 'object' || lvl.goal === null) {
    errors.push('goal is required');
  } else {
    validateGoal(lvl.goal, tags, lvl.world, errors, 'goal');
  }

  if (errors.length) {
    throw new Error(`Invalid level "${(lvl as { id?: string }).id ?? '?'}":\n- ${errors.join('\n- ')}`);
  }
  return {
    ...lvl,
    fixedParts: fixed,
    placedParts: placed,
  };
}

function validateGoal(
  goal: GoalDef,
  tags: Set<string>,
  world: LevelDef['world'] | undefined,
  errors: string[],
  path: string,
): void {
  if (typeof goal.description !== 'string' || !goal.description) {
    errors.push(`${path}.description is required`);
  }
  switch (goal.type) {
    case 'object-in-zone': {
      if (!tags.has(goal.objectTag)) {
        errors.push(`${path}: objectTag "${goal.objectTag}" not found among tagged parts`);
      }
      const z = goal.zone;
      if (!z || ![z.x, z.y, z.w, z.h].every(Number.isFinite) || z.w <= 0 || z.h <= 0) {
        errors.push(`${path}: zone must be {x,y,w,h} with positive size`);
      } else if (world && (z.x < 0 || z.y < 0 || z.x + z.w > world.width || z.y + z.h > world.height)) {
        errors.push(`${path}: zone extends outside the world`);
      }
      if (goal.sustainMs !== undefined && (!Number.isFinite(goal.sustainMs) || goal.sustainMs < 0)) {
        errors.push(`${path}: sustainMs must be a non-negative number`);
      }
      break;
    }
    case 'device-on':
      if (!tags.has(goal.deviceTag)) {
        errors.push(`${path}: deviceTag "${goal.deviceTag}" not found among tagged parts`);
      }
      break;
    case 'objects-collide':
      if (!tags.has(goal.tagA)) errors.push(`${path}: tagA "${goal.tagA}" not found`);
      if (!tags.has(goal.tagB)) errors.push(`${path}: tagB "${goal.tagB}" not found`);
      break;
    case 'all-of':
    case 'any-of':
      if (!Array.isArray(goal.goals) || goal.goals.length === 0) {
        errors.push(`${path}: goals must be a non-empty array`);
      } else {
        goal.goals.forEach((g, i) => validateGoal(g, tags, world, errors, `${path}.goals[${i}]`));
      }
      break;
    default:
      errors.push(`${path}: unknown goal type "${(goal as { type?: string }).type}"`);
  }
}
