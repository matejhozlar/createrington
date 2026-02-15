import { PlayerAnimation, type PlayerObject } from "skinview3d";

// ── Aim animation (3D character pose) ────────────────────────────

const AIM_DURATION = 0.4;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export class FlashlightAimAnimation extends PlayerAnimation {
  protected animate(player: PlayerObject): void {
    const t = Math.min(this.progress / AIM_DURATION, 1);
    const e = easeOutCubic(t);

    // Right arm extends forward-down (holding flashlight)
    player.skin.rightArm.rotation.x = -0.9 * e;
    player.skin.rightArm.rotation.z = 0.15 * e;

    // Head looks slightly down toward the beam target
    player.skin.head.rotation.x = 0.2 * e;

    // Body turns slightly
    player.skin.body.rotation.y = -0.1 * e;
  }
}

// ── Flashlight beam effect (DOM canvas overlay) ──────────────────

const FADE_OUT_DURATION = 500;
const OVERLAY_OPACITY = 0.92;
const BEAM_SOURCE_HALF_WIDTH = 8;
const BEAM_TARGET_HALF_WIDTH = 80;
const BEAM_BLUR = 20;
const SPOT_RADIUS = 60;
const SCROLL_PX_PER_FRAME = 10;
const BEAM_EXTEND_DURATION = 2000;

export class FlashlightEffect {
  private canvasOverlay: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sourceElement: HTMLCanvasElement;
  private animationId: number | null = null;
  private disposed = false;
  private startTime = 0;

  constructor(sourceElement: HTMLCanvasElement) {
    this.sourceElement = sourceElement;
  }

  start() {
    const overlay = document.createElement("canvas");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9998;
      pointer-events: none;
      transition: opacity ${FADE_OUT_DURATION}ms ease-out;
    `;
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    this.canvasOverlay = overlay;
    this.ctx = ctx;
    this.startTime = performance.now();
    document.body.appendChild(overlay);

    this.animationId = requestAnimationFrame(this.render);
  }

  private render = (now: number) => {
    if (this.disposed) return;

    const ctx = this.ctx!;
    const overlay = this.canvasOverlay!;

    const w = window.innerWidth;
    const h = window.innerHeight;
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }

    // Beam extension progress (0 → 1 over BEAM_EXTEND_DURATION)
    const elapsed = now - this.startTime;
    const extendT = Math.min(elapsed / BEAM_EXTEND_DURATION, 1);
    const extendEased = easeInOutCubic(extendT);

    // Source: character's right hand area (right arm = left side in viewer)
    const srcRect = this.sourceElement.getBoundingClientRect();
    const sx = srcRect.left + srcRect.width * 0.35;
    const sy = srcRect.top + srcRect.height * 0.5;

    // Target: Apply link in footer
    const applyLink = document.querySelector<HTMLAnchorElement>(
      'footer a[href="/apply-to-join"]',
    );
    if (!applyLink) {
      this.animationId = requestAnimationFrame(this.render);
      return;
    }

    const tgtRect = applyLink.getBoundingClientRect();
    // Offset to compensate for cone+blur shifting the visual center right-up
    const tx = tgtRect.left + tgtRect.width / 2 - 10;
    const ty = tgtRect.top + tgtRect.height / 2 + 8;

    // Interpolate beam endpoint from source toward target
    const beamX = sx + (tx - sx) * extendEased;
    const beamY = sy + (ty - sy) * extendEased;

    // ── Draw ──────────────────────────────────────────────────────

    ctx.clearRect(0, 0, w, h);

    // Dark overlay
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_OPACITY})`;
    ctx.fillRect(0, 0, w, h);

    // Cut out beam cone
    this.drawBeamCutout(ctx, sx, sy, beamX, beamY, extendEased);

    // Spotlight circle where beam currently ends
    this.drawSpotCircle(ctx, beamX, beamY, extendEased);

    // ── Scroll (synced to beam extension) ────────────────────────

    if (extendT < 1 && tgtRect.top > h * 0.7) {
      window.scrollBy({ top: SCROLL_PX_PER_FRAME, behavior: "instant" });
    }

    // Glow on Apply link once beam has reached it
    if (extendT > 0.95 && ty > 0 && ty < h) {
      applyLink.style.textShadow =
        "0 0 10px rgba(255,255,255,0.9), 0 0 25px rgba(255,255,255,0.5)";
      applyLink.style.transition = "text-shadow 0.3s ease";
    }

    this.animationId = requestAnimationFrame(this.render);
  };

  /** Cuts a soft-edged cone out of the dark overlay. */
  private drawBeamCutout(
    ctx: CanvasRenderingContext2D,
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

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.filter = `blur(${BEAM_BLUR}px)`;

    ctx.beginPath();
    ctx.moveTo(sx + cosP * srcHalf, sy + sinP * srcHalf);
    ctx.lineTo(ex + cosP * tgtHalf, ey + sinP * tgtHalf);
    ctx.lineTo(ex - cosP * tgtHalf, ey - sinP * tgtHalf);
    ctx.lineTo(sx - cosP * srcHalf, sy - sinP * srcHalf);
    ctx.closePath();

    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fill();

    ctx.restore();
  }

  /** Bright spot where the beam currently ends. */
  private drawSpotCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
  ) {
    const radius = SPOT_RADIUS * progress;
    if (radius < 3) return;

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.filter = `blur(${BEAM_BLUR + 8}px)`;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  dispose() {
    this.disposed = true;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Remove glow from Apply link
    const applyLink = document.querySelector<HTMLAnchorElement>(
      'footer a[href="/apply-to-join"]',
    );
    if (applyLink) {
      applyLink.style.textShadow = "";
      applyLink.style.transition = "";
    }

    const overlay = this.canvasOverlay;
    if (!overlay) return;
    this.canvasOverlay = null;

    // Fade out then remove
    overlay.style.opacity = "0";
    overlay.addEventListener(
      "transitionend",
      () => overlay.remove(),
      { once: true },
    );
    setTimeout(() => overlay.remove(), FADE_OUT_DURATION + 100);
  }
}
