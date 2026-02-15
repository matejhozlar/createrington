import type { PlayerObject, SkinViewer as SkinViewerLib } from "skinview3d";
import { PlayerAnimation } from "skinview3d";

// ── Phase state machines ──────────────────────────────────────────

type HeadKickPhase = "vanish" | "head-fall" | "wait-kick" | "bounce" | "gone";
type KickPhase =
  | "turn"
  | "walk"
  | "wind-up"
  | "kick"
  | "recover"
  | "retreat"
  | "done";

// ── Timing ────────────────────────────────────────────────────────

const VANISH_DURATION = 0.4;
const HEAD_FALL_DURATION = 0.5;
const KICK_TIMEOUT_MS = 4000;
const FALL_DISTANCE = 22;

const TURN_DURATION = 0.3;
const WALK_DURATION = 0.6;
const WIND_UP_DURATION = 0.25;
const KICK_DURATION = 0.15;
const RECOVER_DURATION = 0.25;
const RETREAT_DURATION = 0.7;

const BOUNCE_SPEED = 200; // px/s
const HEAD_SPIN_SPEED = 1.5; // rad/s

// ── Easing ────────────────────────────────────────────────────────

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// ── HeadKick animation (imahomen) ─────────────────────────────────

export class HeadKickAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private phase: HeadKickPhase = "vanish";
  private phaseStart = 0;

  // Event cleanup
  private kickConnectHandler: (() => void) | null = null;
  private kickTimeout: number | null = null;

  // Bounce state
  private bounceX = 0;
  private bounceY = 0;
  private bounceVx = 0;
  private bounceVy = 0;
  private bounceStarted = false;
  private overflowHidden = false;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private originalParent: HTMLElement | null = null;

  constructor(viewer: SkinViewerLib) {
    super();
    this.viewer = viewer;
  }

  protected animate(player: PlayerObject, delta: number): void {
    const elapsed = this.progress - this.phaseStart;

    switch (this.phase) {
      // ── Body parts vanish in rapid stagger ────────────────
      case "vanish": {
        const t = Math.min(elapsed / VANISH_DURATION, 1);

        if (t > 0.05) player.skin.body.visible = false;
        if (t > 0.2) player.skin.leftArm.visible = false;
        if (t > 0.4) player.skin.rightArm.visible = false;
        if (t > 0.6) player.skin.leftLeg.visible = false;
        if (t > 0.8) player.skin.rightLeg.visible = false;

        if (t >= 1) {
          this.phase = "head-fall";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Head drops with gravity, small bounce ─────────────
      case "head-fall": {
        const t = Math.min(elapsed / HEAD_FALL_DURATION, 1);

        if (t < 0.7) {
          const fallT = t / 0.7;
          player.position.y = -FALL_DISTANCE * easeInQuad(fallT);
        } else if (t < 0.85) {
          const bounceT = (t - 0.7) / 0.15;
          player.position.y =
            -FALL_DISTANCE + 2 * Math.sin(bounceT * Math.PI);
        } else {
          const settleT = (t - 0.85) / 0.15;
          player.position.y =
            -FALL_DISTANCE + 0.5 * Math.sin(settleT * Math.PI);
        }

        if (t >= 1) {
          player.position.y = -FALL_DISTANCE;
          this.phase = "wait-kick";
          this.phaseStart = this.progress;
          this.requestKick();
        }
        break;
      }

      // ── Wait for kick connect event ───────────────────────
      case "wait-kick": {
        player.position.y = -FALL_DISTANCE;
        break;
      }

      // ── DVD bounce around viewport ────────────────────────
      case "bounce": {
        if (!this.bounceStarted) {
          this.initBounce(player);
        }

        this.bounceX += this.bounceVx * delta;
        this.bounceY += this.bounceVy * delta;

        const maxX = window.innerWidth - this.canvasWidth;
        const maxY = window.innerHeight - this.canvasHeight;

        if (this.bounceX <= 0) {
          this.bounceX = 0;
          this.bounceVx = Math.abs(this.bounceVx);
        } else if (this.bounceX >= maxX) {
          this.bounceX = maxX;
          this.bounceVx = -Math.abs(this.bounceVx);
        }

        if (this.bounceY <= 0) {
          this.bounceY = 0;
          this.bounceVy = Math.abs(this.bounceVy);
        } else if (this.bounceY >= maxY) {
          this.bounceY = maxY;
          this.bounceVy = -Math.abs(this.bounceVy);
        }

        this.viewer.canvas.style.transform = `translate(${this.bounceX}px, ${this.bounceY}px)`;

        // Slow tumbling rotation
        player.rotation.y += delta * HEAD_SPIN_SPEED;

        break;
      }

      case "gone":
        break;
    }
  }

  private requestKick() {
    this.kickConnectHandler = () => this.onKickConnect();
    document.addEventListener("team-kick-connect", this.kickConnectHandler);

    const rect = this.viewer.canvas.getBoundingClientRect();
    document.dispatchEvent(
      new CustomEvent("team-kick-request", {
        detail: { headCenterX: rect.left + rect.width / 2 },
      }),
    );

    this.kickTimeout = window.setTimeout(() => {
      this.kickTimeout = null;
      this.onKickConnect();
    }, KICK_TIMEOUT_MS);
  }

  private onKickConnect() {
    // Guard against double-call (event + timeout)
    if (this.phase !== "wait-kick") return;

    if (this.kickConnectHandler) {
      document.removeEventListener(
        "team-kick-connect",
        this.kickConnectHandler,
      );
      this.kickConnectHandler = null;
    }

    if (this.kickTimeout !== null) {
      clearTimeout(this.kickTimeout);
      this.kickTimeout = null;
    }

    this.phase = "bounce";
    this.phaseStart = this.progress;
  }

  private initBounce(player: PlayerObject) {
    this.bounceStarted = true;
    const canvas = this.viewer.canvas;
    const rect = canvas.getBoundingClientRect();

    this.bounceX = rect.left;
    this.bounceY = rect.top;
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    // Center the head in the canvas for bounce visibility
    player.position.y = -10;

    // Move canvas to body to avoid ancestor transforms breaking position:fixed
    this.originalParent = canvas.parentElement;
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "9999";
    canvas.style.pointerEvents = "none";
    canvas.style.transform = `translate(${this.bounceX}px, ${this.bounceY}px)`;

    // Initial velocity: left and upward (kicked from right by Cailin)
    this.bounceVx = -BOUNCE_SPEED * 0.83;
    this.bounceVy = -BOUNCE_SPEED * 0.56;

    document.documentElement.style.overflowX = "hidden";
    this.overflowHidden = true;
  }

  dispose() {
    // Clean up event listeners and timeout
    if (this.kickConnectHandler) {
      document.removeEventListener(
        "team-kick-connect",
        this.kickConnectHandler,
      );
      this.kickConnectHandler = null;
    }

    if (this.kickTimeout !== null) {
      clearTimeout(this.kickTimeout);
      this.kickTimeout = null;
    }

    // Restore body part visibility
    const skin = this.viewer.playerObject.skin;
    skin.body.visible = true;
    skin.leftArm.visible = true;
    skin.rightArm.visible = true;
    skin.leftLeg.visible = true;
    skin.rightLeg.visible = true;

    // Reset player position and rotation
    this.viewer.playerObject.position.set(0, 0, 0);
    this.viewer.playerObject.rotation.y = 0;

    const canvas = this.viewer.canvas;

    // Move canvas back to its original parent
    if (this.bounceStarted && this.originalParent) {
      if (canvas.parentElement === document.body) {
        document.body.removeChild(canvas);
      }
      this.originalParent.appendChild(canvas);
    }

    // Reset canvas styles from bounce
    if (this.bounceStarted) {
      canvas.style.position = "";
      canvas.style.left = "";
      canvas.style.top = "";
      canvas.style.transform = "";
      canvas.style.zIndex = "";
      canvas.style.pointerEvents = "";
    }

    // Restore overflow
    if (this.overflowHidden) {
      document.documentElement.style.overflowX = "";
      this.overflowHidden = false;
    }
  }
}

// ── Kick animation (Cailin05) ─────────────────────────────────────
// Cailin turns, walks toward imahomen's fallen head, kicks it,
// then retreats back to her original position.

export class KickAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private walkDistance: number;
  private phase: KickPhase = "turn";
  private phaseStart = 0;
  private connectDispatched = false;
  private slideStarted = false;
  private player: PlayerObject | null = null;

  constructor(viewer: SkinViewerLib, slideDistance: number) {
    super();
    this.viewer = viewer;
    // Stop slightly short so she kicks toward the head, not past it
    this.walkDistance = Math.max(slideDistance - 40, 0);
  }

  protected animate(player: PlayerObject): void {
    this.player = player;
    const elapsed = this.progress - this.phaseStart;

    switch (this.phase) {
      // ── Turn to face left (toward imahomen) ──────────────
      case "turn": {
        const t = Math.min(elapsed / TURN_DURATION, 1);
        const e = easeInOutCubic(t);

        player.rotation.y = (-Math.PI / 2) * e;

        // Natural step during turn
        const swing = Math.sin(t * Math.PI) * 0.3;
        player.skin.leftArm.rotation.x = swing;
        player.skin.rightArm.rotation.x = -swing;
        player.skin.leftLeg.rotation.x = Math.sin(t * Math.PI) * 0.15;
        player.skin.rightLeg.rotation.x = -Math.sin(t * Math.PI) * 0.15;

        if (t >= 1) {
          this.phase = "walk";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Walk toward imahomen (canvas slides left) ────────
      case "walk": {
        const t = Math.min(elapsed / WALK_DURATION, 1);

        if (!this.slideStarted) {
          this.slideStarted = true;
          const canvas = this.viewer.canvas;
          canvas.style.zIndex = "9999";
          canvas.style.pointerEvents = "none";
        }

        player.rotation.y = -Math.PI / 2;

        // Walking cycle
        const walkSpeed = 10;
        const legAmp = 0.5;
        const armAmp = 0.35;
        player.skin.leftLeg.rotation.x =
          Math.sin(this.progress * walkSpeed) * legAmp;
        player.skin.rightLeg.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * legAmp;
        player.skin.leftArm.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * armAmp;
        player.skin.rightArm.rotation.x =
          Math.sin(this.progress * walkSpeed) * armAmp;

        // Slide canvas left
        const slideProgress = easeInOutCubic(t);
        this.viewer.canvas.style.transform = `translateX(${-this.walkDistance * slideProgress}px)`;

        if (t >= 1) {
          player.skin.leftLeg.rotation.x = 0;
          player.skin.rightLeg.rotation.x = 0;
          player.skin.leftArm.rotation.x = 0;
          player.skin.rightArm.rotation.x = 0;
          this.phase = "wind-up";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Wind-up: lean forward, pull kicking leg back ─────
      case "wind-up": {
        const t = Math.min(elapsed / WIND_UP_DURATION, 1);
        const e = easeInOutCubic(t);

        player.rotation.y = -Math.PI / 2;

        // Lean forward slightly
        player.skin.body.rotation.x = 0.15 * e;
        // Look down at head
        player.skin.head.rotation.x = 0.2 * e;
        // Pull right leg back for kick (positive = backward in skinview3d)
        player.skin.rightLeg.rotation.x = 0.4 * e;
        // Left leg plants firmly
        player.skin.leftLeg.rotation.x = -0.05 * e;
        // Arms counterbalance
        player.skin.leftArm.rotation.x = -0.2 * e;
        player.skin.rightArm.rotation.x = 0.3 * e;

        if (t >= 1) {
          this.phase = "kick";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Kick: right leg swings forward hard ───────────────
      case "kick": {
        const t = Math.min(elapsed / KICK_DURATION, 1);
        const e = easeOutQuad(t);

        player.rotation.y = -Math.PI / 2;
        player.skin.body.rotation.x = 0.15;
        player.skin.head.rotation.x = 0.2;

        // Right leg swings forward (from +0.4 to -1.5, negative = forward)
        player.skin.rightLeg.rotation.x = 0.4 - 1.9 * e;
        player.skin.leftLeg.rotation.x = -0.05;

        // Arms follow through
        player.skin.leftArm.rotation.x = -0.2 - 0.3 * e;
        player.skin.rightArm.rotation.x = 0.3 - 0.6 * e;

        if (t >= 1 && !this.connectDispatched) {
          this.connectDispatched = true;
          document.dispatchEvent(new CustomEvent("team-kick-connect"));
          this.phase = "recover";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Recover: leg returns, body straightens ───────────
      case "recover": {
        const t = Math.min(elapsed / RECOVER_DURATION, 1);
        const e = easeInOutCubic(t);

        player.rotation.y = -Math.PI / 2;
        player.skin.body.rotation.x = 0.15 * (1 - e);
        player.skin.head.rotation.x = 0.2 * (1 - e);
        player.skin.rightLeg.rotation.x = -1.5 * (1 - e);
        player.skin.leftLeg.rotation.x = -0.05 * (1 - e);
        player.skin.leftArm.rotation.x = -0.5 * (1 - e);
        player.skin.rightArm.rotation.x = -0.3 * (1 - e);

        if (t >= 1) {
          this.phase = "retreat";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Retreat: walk back, turn toward camera ───────────
      case "retreat": {
        const t = Math.min(elapsed / RETREAT_DURATION, 1);
        const e = easeInOutCubic(t);

        // Rotate back toward camera
        player.rotation.y = (-Math.PI / 2) * (1 - e);

        // Walking cycle that fades out as she turns
        const walkSpeed = 10;
        const fade = 1 - e;
        const legAmp = 0.4 * fade;
        const armAmp = 0.3 * fade;
        player.skin.leftLeg.rotation.x =
          Math.sin(this.progress * walkSpeed) * legAmp;
        player.skin.rightLeg.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * legAmp;
        player.skin.leftArm.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * armAmp;
        player.skin.rightArm.rotation.x =
          Math.sin(this.progress * walkSpeed) * armAmp;

        // Slide canvas back
        this.viewer.canvas.style.transform = `translateX(${-this.walkDistance * (1 - e)}px)`;

        if (t >= 1) {
          // Ensure everything is zeroed
          player.rotation.y = 0;
          player.skin.body.rotation.x = 0;
          player.skin.head.rotation.x = 0;
          player.skin.leftLeg.rotation.x = 0;
          player.skin.rightLeg.rotation.x = 0;
          player.skin.leftArm.rotation.x = 0;
          player.skin.rightArm.rotation.x = 0;
          this.viewer.canvas.style.transform = "";

          this.phase = "done";
          document.dispatchEvent(new CustomEvent("team-kick-done"));
        }
        break;
      }

      case "done":
        break;
    }
  }

  dispose() {
    if (this.player) {
      this.player.rotation.y = 0;
      this.player.skin.body.rotation.x = 0;
      this.player.skin.head.rotation.x = 0;
      this.player.skin.leftLeg.rotation.x = 0;
      this.player.skin.rightLeg.rotation.x = 0;
      this.player.skin.leftArm.rotation.x = 0;
      this.player.skin.rightArm.rotation.x = 0;
    }

    if (this.slideStarted) {
      const canvas = this.viewer.canvas;
      canvas.style.transform = "";
      canvas.style.zIndex = "";
      canvas.style.pointerEvents = "";
    }
  }
}
