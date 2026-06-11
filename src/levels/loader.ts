import type { LevelDef, LevelPartEntry } from './types';
import type { SceneSetup } from '../modes/controller';
import type { Placement } from '../parts/types';
import { defaultOptions, getPart } from '../parts/registry';

function entryToPlacement(entry: LevelPartEntry, locked: boolean, index: number): Placement {
  const def = getPart(entry.partId);
  return {
    instanceId: `lvl-${index}`, // re-issued by the controller on load
    partId: entry.partId,
    x: entry.x,
    y: entry.y,
    rotation: entry.rotation ?? 0,
    options: { ...defaultOptions(def), ...entry.options },
    tag: entry.tag,
    locked,
    fromBin: false,
    link: entry.link,
  };
}

/** Turn validated level JSON into a controller scene (PRD §8 → §5). */
export function levelToScene(def: LevelDef): SceneSetup {
  let i = 0;
  const placements = [
    ...def.fixedParts.map((e) => entryToPlacement(e, !(e.movable === true), i++)),
    ...def.placedParts.map((e) => entryToPlacement(e, false, i++)),
  ];
  return {
    id: def.id,
    title: def.title,
    world: {
      width: def.world.width,
      height: def.world.height,
      gravity: def.world.gravity,
    },
    placements,
    bin: def.bin.map((slot) => ({ partId: slot.partId, count: slot.count, options: slot.options })),
    goal: def.goal,
    goalDescription: def.goal.description,
    hint: def.hint,
  };
}
