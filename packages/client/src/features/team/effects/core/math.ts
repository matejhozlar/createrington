export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

export function span(time: number, start: number, end: number): number {
  return clamp01((time - start) / (end - start));
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function damp(
  current: number,
  target: number,
  rate: number,
  delta: number,
): number {
  return lerp(current, target, 1 - Math.exp(-rate * delta));
}

export function shortestAngle(from: number, to: number): number {
  const turn = Math.PI * 2;
  return ((((to - from) % turn) + turn + Math.PI) % turn) - Math.PI;
}

export function bump(t: number): number {
  return Math.sin(clamp01(t) * Math.PI);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function easeOutBack(t: number, overshoot = 1.70158): number {
  const shifted = t - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export function easeInBack(t: number, overshoot = 1.70158): number {
  return (overshoot + 1) * t ** 3 - overshoot * t ** 2;
}

export function easeOutElastic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * Math.PI * 2) / 3) + 1;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
