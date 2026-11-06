export type Rgb = readonly [number, number, number];

export function mix(a: Rgb, b: Rgb, t: number): string {
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * t);
  return `rgb(${channel(a[0], b[0])}, ${channel(a[1], b[1])}, ${channel(a[2], b[2])})`;
}

export function rgb([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function hash(n: number, seed: number): number {
  const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("pick from empty list");
  return item;
}
