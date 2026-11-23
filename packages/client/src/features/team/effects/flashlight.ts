import { PlayerAnimation, type PlayerObject } from "skinview3d";
import { TeamEffect, type EffectContext } from "./core/effect";
import { fx, type FxFrame } from "./core/fx-layer";
import { clamp01, easeInOutCubic, easeOutCubic } from "./core/math";

const AIM_DURATION = 0.4;

export class FlashlightAimAnimation extends PlayerAnimation {
  protected animate(player: PlayerObject): void {
    const t = Math.min(this.progress / AIM_DURATION, 1);
    const e = easeOutCubic(t);

    player.skin.rightArm.rotation.x = -0.9 * e;
    player.skin.rightArm.rotation.z = 0.15 * e;

    player.skin.head.rotation.x = 0.2 * e;

    player.skin.body.rotation.y = -0.1 * e;
  }
}

const FADE_OUT_DURATION = 500;
const OVERLAY_OPACITY = 0.92;
const BEAM_SOURCE_HALF_WIDTH = 8;
const BEAM_TARGET_HALF_WIDTH = 80;
const BEAM_BLUR = 20;
const SPOT_RADIUS = 60;
const SCROLL_PX_PER_FRAME = 10;
const BEAM_EXTEND_DURATION = 2000;
const TARGET_GLOW =
  "0 0 10px rgba(255,255,255,0.9), 0 0 25px rgba(255,255,255,0.5)";

export class FlashlightBeam {
  private startTime: number | null = null;
  private fadeStart: number | null = null;

  constructor(
    private readonly source: HTMLElement,
    private readonly target: HTMLElement,
  ) {}

  start(): void {
    fx.paint(this.paint);
  }

  private paint = (ctx: CanvasRenderingContext2D, frame: FxFrame): boolean => {
    const { width: w, height: h, ratio, now } = frame;
    this.startTime ??= now;

    const fade =
      this.fadeStart === null
        ? 1
        : (1 - clamp01((now - this.fadeStart) / FADE_OUT_DURATION)) ** 2;
    if (fade <= 0) return false;

    const extendT = Math.min((now - this.startTime) / BEAM_EXTEND_DURATION, 1);
    const extendEased = easeInOutCubic(extendT);

    const srcRect = this.source.getBoundingClientRect();
    const sx = srcRect.left + srcRect.width * 0.35;
    const sy = srcRect.top + srcRect.height * 0.5;

    const tgtRect = this.target.getBoundingClientRect();
    const tx = tgtRect.left + tgtRect.width / 2 - 10;
    const ty = tgtRect.top + tgtRect.height / 2 + 8;

    const beamX = sx + (tx - sx) * extendEased;
    const beamY = sy + (ty - sy) * extendEased;

    ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_OPACITY * fade})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "destination-out";
    this.drawBeamCutout(ctx, ratio, sx, sy, beamX, beamY, extendEased);
    this.drawSpotCircle(ctx, ratio, beamX, beamY, extendEased);

    if (this.fadeStart !== null) return true;

    if (extendT < 1 && tgtRect.top > h * 0.7) {
      window.scrollBy({ top: SCROLL_PX_PER_FRAME, behavior: "instant" });
    }

    if (extendT > 0.95 && ty > 0 && ty < h) {
      this.target.style.textShadow = TARGET_GLOW;
      this.target.style.transition = "text-shadow 0.3s ease";
    }

    return true;
  };

  private drawBeamCutout(
    ctx: CanvasRenderingContext2D,
    ratio: number,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    progress: number,
  ) {
    const dist = Math.hypot(ex - sx, ey - sy);
    if (dist < 5) return;

    const angle = Math.atan2(ey - sy, ex - sx);
    const perp = angle + Math.PI / 2;

    const srcHalf = BEAM_SOURCE_HALF_WIDTH;
    const tgtHalf = BEAM_TARGET_HALF_WIDTH * progress;

    const cosP = Math.cos(perp);
    const sinP = Math.sin(perp);

    ctx.filter = `blur(${BEAM_BLUR * ratio}px)`;

    ctx.beginPath();
    ctx.moveTo(sx + cosP * srcHalf, sy + sinP * srcHalf);
    ctx.lineTo(ex + cosP * tgtHalf, ey + sinP * tgtHalf);
    ctx.lineTo(ex - cosP * tgtHalf, ey - sinP * tgtHalf);
    ctx.lineTo(sx - cosP * srcHalf, sy - sinP * srcHalf);
    ctx.closePath();

    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fill();
  }

  private drawSpotCircle(
    ctx: CanvasRenderingContext2D,
    ratio: number,
    x: number,
    y: number,
    progress: number,
  ) {
    const radius = SPOT_RADIUS * progress;
    if (radius < 3) return;

    ctx.filter = `blur(${(BEAM_BLUR + 8) * ratio}px)`;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  dispose(): void {
    if (this.fadeStart !== null) return;
    this.fadeStart = performance.now();
    this.target.style.textShadow = "";
    this.target.style.transition = "";
  }
}

const BEAM_DELAY_MS = 1000;
const BEAM_TARGET_ID = "footer-apply-link";

export class FlashlightHoverEffect extends TeamEffect {
  private readonly aim = new FlashlightAimAnimation();
  private timer: number | null;
  private beam: FlashlightBeam | null = null;

  constructor(context: EffectContext) {
    super(context);
    const canvas = context.viewer.canvas;
    const slot = canvas.closest<HTMLElement>('[role="img"]') ?? canvas;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      const target = document.getElementById(BEAM_TARGET_ID);
      if (!target) return;
      this.beam = new FlashlightBeam(slot, target);
      this.beam.start();
    }, BEAM_DELAY_MS);
  }

  protected animate(player: PlayerObject, delta: number): void {
    this.aim.update(player, delta);
  }

  protected onStop(): void {
    this.finish();
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.beam?.dispose();
    this.beam = null;
  }
}
