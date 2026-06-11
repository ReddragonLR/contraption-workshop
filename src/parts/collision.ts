/**
 * Collision categories. Rope segments only collide with pulley wheels: ropes
 * transmit tension, drape over pulleys, and pass through everything else
 * (matching the original game's feel and keeping chains deterministic).
 */
export const CAT_DEFAULT = 0x0001;
export const CAT_ROPE = 0x0002;
export const CAT_PULLEY = 0x0004;

export const ropeFilter = { category: CAT_ROPE, mask: CAT_PULLEY };
export const pulleyFilter = { category: CAT_PULLEY, mask: CAT_ROPE | CAT_DEFAULT };
