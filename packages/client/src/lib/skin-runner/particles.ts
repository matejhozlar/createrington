import { rand, rgba, type Rgb } from "./util";
import { screenX, screenY, type View } from "./view";

type Range = readonly [number, number];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: Rgb;
  gravity: number;
};

type Emitter = {
  life: Range;
  vx: Range;
  vy: Range;
  smallChance: number;
  gravity: number;
};

const DUST: Emitter = {
  life: [0.25, 0.45],
  vx: [-30, -8],
  vy: [8, 34],
  smallChance: 0.6,
  gravity: 90,
};

const SPARK: Emitter = {
  life: [0.4, 0.8],
  vx: [-14, 6],
  vy: [6, 26],
  smallChance: 0.5,
  gravity: -12,
};

const DUST_TRAIL: Range = [1, 4];
const DUST_RISE: Range = [0, 1.5];
const SPARK_JITTER = 2;
const PEAK_ALPHA = 0.9;

export class Particles {
  private readonly reducedMotion: () => boolean;
  private list: Particle[] = [];

  constructor(reducedMotion: () => boolean) {
    this.reducedMotion = reducedMotion;
  }

  dust(x: number, color: Rgb, count: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      this.emit(DUST, x - rand(...DUST_TRAIL), rand(...DUST_RISE), color);
    }
  }

  sparkle(x: number, y: number, count: number, color: Rgb): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      this.emit(
        SPARK,
        x + rand(-SPARK_JITTER, SPARK_JITTER),
        Math.max(0, y + rand(-SPARK_JITTER, SPARK_JITTER)),
        color,
      );
    }
  }

  update(dt: number, step: number): void {
    for (const p of this.list) {
      p.x += p.vx * dt - step;
      p.y += p.vy * dt;
      p.vy -= p.gravity * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0 && p.y >= 0);
  }

  draw(view: View): void {
    const { ctx, texel } = view;
    for (const p of this.list) {
      ctx.fillStyle = rgba(p.color, (p.life / p.maxLife) * PEAK_ALPHA);
      ctx.fillRect(
        screenX(view, p.x),
        screenY(view, p.y),
        p.size * texel,
        p.size * texel,
      );
    }
  }

  private emit(emitter: Emitter, x: number, y: number, color: Rgb): void {
    const life = rand(...emitter.life);
    this.list.push({
      x,
      y,
      vx: rand(...emitter.vx),
      vy: rand(...emitter.vy),
      life,
      maxLife: life,
      size: Math.random() < emitter.smallChance ? 1 : 2,
      color,
      gravity: emitter.gravity,
    });
  }
}
