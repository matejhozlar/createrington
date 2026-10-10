import { clamp, lerp, prefersReducedMotion } from "./math";

export type ParticleInit = {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gravity?: number;
  drag?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  colors: readonly string[];
  alpha?: number;
  fadeFrom?: number;
  additive?: boolean;
  delay?: number;
  floor?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  age: number;
  size: number;
  sizeEnd: number;
  colors: readonly string[];
  alpha: number;
  fadeFrom: number;
  floor: number;
};

type Flash = { color: string; alpha: number; life: number; age: number };

const MAX_PARTICLES = 1400;
const MAX_FRAME_DELTA = 0.05;
const FLOOR_BOUNCE = 0.2;
const FLOOR_SPLASH = 1.6;
const LAYER_Z_INDEX = 9998;

function stepParticles(particles: Particle[], delta: number): void {
  let kept = 0;
  for (const particle of particles) {
    particle.age += delta;
    if (particle.age >= particle.life) continue;
    if (particle.age > 0) {
      const retain = Math.exp(-particle.drag * delta);
      particle.vx *= retain;
      particle.vy = particle.vy * retain + particle.gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      if (particle.y > particle.floor) {
        const impact = Math.abs(particle.vy);
        particle.y = particle.floor;
        particle.vy *= -FLOOR_BOUNCE;
        particle.vx += (Math.random() - 0.5) * impact * FLOOR_SPLASH;
      }
    }
    particles[kept++] = particle;
  }
  particles.length = kept;
}

class FxLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly solid: Particle[] = [];
  private readonly glow: Particle[] = [];
  private readonly flashes: Flash[] = [];
  private frameId: number | null = null;
  private lastTime = 0;
  private lastScrollX = 0;
  private lastScrollY = 0;
  private ratio = 1;

  emit(init: ParticleInit): void {
    const pool = init.additive ? this.glow : this.solid;
    if (this.solid.length + this.glow.length >= MAX_PARTICLES) pool.shift();
    pool.push({
      x: init.x,
      y: init.y,
      vx: init.vx ?? 0,
      vy: init.vy ?? 0,
      gravity: init.gravity ?? 0,
      drag: init.drag ?? 0,
      life: init.life,
      age: -(init.delay ?? 0),
      size: init.size,
      sizeEnd: init.sizeEnd ?? init.size,
      colors: init.colors,
      alpha: init.alpha ?? 1,
      fadeFrom: init.fadeFrom ?? 0.6,
      floor: init.floor ?? Number.POSITIVE_INFINITY,
    });
    this.wake();
  }

  flash(color: string, alpha: number, life: number): void {
    if (prefersReducedMotion()) return;
    this.flashes.push({ color, alpha, life, age: 0 });
    this.wake();
  }

  clear(): void {
    this.solid.length = 0;
    this.glow.length = 0;
    this.flashes.length = 0;
    this.sleep();
  }

  private isEmpty(): boolean {
    return (
      this.solid.length === 0 &&
      this.glow.length === 0 &&
      this.flashes.length === 0
    );
  }

  private wake(): void {
    if (this.frameId !== null) return;
    if (!this.canvas) {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;z-index:${LAYER_Z_INDEX};pointer-events:none;`;
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
    }
    this.lastTime = performance.now();
    this.lastScrollX = window.scrollX;
    this.lastScrollY = window.scrollY;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private sleep(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }

  private syncSize(canvas: HTMLCanvasElement): void {
    this.ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * this.ratio);
    const height = Math.round(canvas.clientHeight * this.ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  private followScroll(): void {
    const shiftX = window.scrollX - this.lastScrollX;
    const shiftY = window.scrollY - this.lastScrollY;
    this.lastScrollX = window.scrollX;
    this.lastScrollY = window.scrollY;
    if (shiftX === 0 && shiftY === 0) return;
    for (const pool of [this.solid, this.glow]) {
      for (const particle of pool) {
        particle.x -= shiftX;
        particle.y -= shiftY;
        particle.floor -= shiftY;
      }
    }
  }

  private snap(value: number): number {
    return Math.round(value * this.ratio) / this.ratio;
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
  ): void {
    for (const particle of particles) {
      if (particle.age <= 0) continue;
      const t = particle.age / particle.life;
      const colorIndex = Math.min(
        Math.floor(t * particle.colors.length),
        particle.colors.length - 1,
      );
      const fade =
        t < particle.fadeFrom
          ? 1
          : 1 - (t - particle.fadeFrom) / (1 - particle.fadeFrom);
      const size = Math.max(
        this.snap(lerp(particle.size, particle.sizeEnd, t)),
        1 / this.ratio,
      );
      ctx.globalAlpha = clamp(particle.alpha * fade, 0, 1);
      ctx.fillStyle = particle.colors[colorIndex] as string;
      ctx.fillRect(
        this.snap(particle.x - size / 2),
        this.snap(particle.y - size / 2),
        size,
        size,
      );
    }
  }

  private drawFlashes(
    ctx: CanvasRenderingContext2D,
    delta: number,
    width: number,
    height: number,
  ): void {
    let kept = 0;
    for (const flash of this.flashes) {
      flash.age += delta;
      if (flash.age >= flash.life) continue;
      this.flashes[kept++] = flash;
      ctx.globalAlpha = flash.alpha * (1 - flash.age / flash.life) ** 2;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, width, height);
    }
    this.flashes.length = kept;
  }

  private tick = (now: number): void => {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) {
      this.frameId = null;
      return;
    }

    const delta = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DELTA);
    this.lastTime = now;
    this.syncSize(canvas);
    this.followScroll();

    const width = canvas.width / this.ratio;
    const height = canvas.height / this.ratio;

    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    stepParticles(this.solid, delta);
    stepParticles(this.glow, delta);
    ctx.globalCompositeOperation = "source-over";
    this.drawParticles(ctx, this.solid);
    ctx.globalCompositeOperation = "lighter";
    this.drawParticles(ctx, this.glow);

    ctx.globalCompositeOperation = "source-over";
    this.drawFlashes(ctx, delta, width, height);
    ctx.globalAlpha = 1;

    if (this.isEmpty()) {
      this.frameId = null;
      this.sleep();
      return;
    }
    this.frameId = requestAnimationFrame(this.tick);
  };
}

export const fx = new FxLayer();
