import type { Footprint, OptionValue, PartDefinition } from './types';

const defs = new Map<string, PartDefinition>();

export function registerPart(def: PartDefinition): void {
  if (defs.has(def.id)) throw new Error(`Duplicate part id: ${def.id}`);
  defs.set(def.id, def);
}

export function getPart(id: string): PartDefinition {
  const def = defs.get(id);
  if (!def) throw new Error(`Unknown part id: ${id}`);
  return def;
}

export function hasPart(id: string): boolean {
  return defs.has(id);
}

export function allParts(): PartDefinition[] {
  return [...defs.values()];
}

export function partFootprint(def: PartDefinition): Footprint {
  return def.footprint ?? { kind: 'rect', w: def.width, h: def.height };
}

export function defaultOptions(def: PartDefinition): Record<string, OptionValue> {
  const out: Record<string, OptionValue> = {};
  for (const opt of def.options ?? []) out[opt.key] = opt.default;
  return out;
}
