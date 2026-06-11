export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate angles along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function rectContains(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Rotate a point around the origin by `rad` radians. */
export function rotateVec(p: Vec2, rad: number): Vec2 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Snap a value to the nearest multiple of `step`. */
export function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/**
 * Test whether a point lies inside an oriented box (center cx,cy; full size w,h;
 * rotated by `rad`). Used for wind fields and oriented hit tests.
 */
export function orientedBoxContains(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rad: number,
  p: Vec2,
): boolean {
  const local = rotateVec({ x: p.x - cx, y: p.y - cy }, -rad);
  return Math.abs(local.x) <= w / 2 && Math.abs(local.y) <= h / 2;
}
