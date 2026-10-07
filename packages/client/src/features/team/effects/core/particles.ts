import { fx } from "./fx-layer";
import { rand } from "./math";
import type { Point } from "./screen";

export const SMOKE = ["#f4f4f4", "#d2d2d2", "#a0a0a0", "#707070"] as const;
export const DUST = ["#ddd2bb", "#bcae93", "#8f8571"] as const;
export const FLAME = [
  "#fff7d1",
  "#ffdb4d",
  "#ff9d21",
  "#ea531b",
  "#7c2b13",
] as const;

export function poof(
  at: Point,
  unit: number,
  count = 10,
  colors: readonly string[] = SMOKE,
): void {
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(8, 30) * unit;
    fx.emit({
      x: at.x + Math.cos(angle) * rand(0, 2) * unit,
      y: at.y + Math.sin(angle) * rand(0, 2) * unit,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6 * unit,
      drag: 3.4,
      gravity: -9 * unit,
      life: rand(0.35, 0.75),
      size: rand(1.8, 3) * unit,
      sizeEnd: 0.5 * unit,
      colors,
      alpha: 0.92,
      fadeFrom: 0.5,
    });
  }
}

export function dustBurst(
  at: Point,
  unit: number,
  count: number,
  power = 1,
): void {
  for (let index = 0; index < count; index++) {
    const side = index % 2 === 0 ? 1 : -1;
    fx.emit({
      x: at.x + side * rand(0, 3) * unit,
      y: at.y - rand(0, 1.5) * unit,
      vx: side * rand(18, 70) * unit * power,
      vy: -rand(2, 16) * unit * power,
      drag: 4.2,
      gravity: -5 * unit,
      life: rand(0.45, 1.05),
      size: rand(1.4, 2.4) * unit,
      sizeEnd: rand(2.8, 4.4) * unit,
      colors: DUST,
      alpha: 0.7,
      fadeFrom: 0.2,
    });
  }
}
