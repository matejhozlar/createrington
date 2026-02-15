import type { PlayerObject, SkinViewer as SkinViewerLib } from "skinview3d";
import { PlayerAnimation } from "skinview3d";

// ── Phase state machine ──────────────────────────────────────────

type MoonwalkPhase = "turn" | "head-snap" | "hold" | "moonwalk" | "gone";

const TURN_DURATION = 1.2;
const HEAD_SNAP_DURATION = 0.2;
const HOLD_DURATION = 1.0;
const MOONWALK_DURATION = 2.0;

// Head snaps back ~60° (not the full 90°) for an angled side-eye stare
const HEAD_SNAP_AMOUNT = Math.PI / 3;

// ── Easing helpers ───────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ── Moonwalk animation ───────────────────────────────────────────

export class MoonwalkAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private phase: MoonwalkPhase = "turn";
  private phaseStart = 0;

  // Canvas slide-out state
  private slideStarted = false;
  private slideDistance = 0;
  private overflowHidden = false;

  constructor(viewer: SkinViewerLib) {
    super();
    this.viewer = viewer;
  }

  protected animate(player: PlayerObject): void {
    const elapsed = this.progress - this.phaseStart;

    switch (this.phase) {
      // ── Spin 270° the long way, head turns with body ──────
      case "turn": {
        const t = Math.min(elapsed / TURN_DURATION, 1);
        const e = easeInOutCubic(t);

        // 270° positive rotation (the long way around to face left)
        player.rotation.y = ((3 * Math.PI) / 2) * e;

        // Natural arm swing — more cycles for the longer spin
        const armSwing = Math.sin(t * Math.PI * 2) * 0.4;
        player.skin.leftArm.rotation.x = armSwing;
        player.skin.rightArm.rotation.x = -armSwing;

        // Stepping during spin
        player.skin.leftLeg.rotation.x = Math.sin(t * Math.PI * 2) * 0.25;
        player.skin.rightLeg.rotation.x = -Math.sin(t * Math.PI * 2) * 0.25;

        if (t >= 1) {
          this.phase = "head-snap";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Head snaps back toward viewer (not fully — side-eye) ──
      case "head-snap": {
        const t = Math.min(elapsed / HEAD_SNAP_DURATION, 1);
        const e = easeOutQuad(t);

        player.rotation.y = (3 * Math.PI) / 2;

        // Snap head back partway — angled stare, not dead-on
        player.skin.head.rotation.y = HEAD_SNAP_AMOUNT * e;
        // Creepy tilt
        player.skin.head.rotation.z = 0.12 * e;

        // Arms settle
        player.skin.leftArm.rotation.x = 0;
        player.skin.rightArm.rotation.x = 0;
        player.skin.leftLeg.rotation.x = 0;
        player.skin.rightLeg.rotation.x = 0;

        if (t >= 1) {
          this.phase = "hold";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Hold the creepy angled stare ───────────────────────
      case "hold": {
        const t = Math.min(elapsed / HOLD_DURATION, 1);

        player.rotation.y = (3 * Math.PI) / 2;
        player.skin.head.rotation.y = HEAD_SNAP_AMOUNT;
        player.skin.head.rotation.z = 0.12;

        // Subtle breathing sway on arms
        const breathe = Math.sin(this.progress * 3) * 0.03;
        player.skin.leftArm.rotation.z = breathe + 0.06;
        player.skin.rightArm.rotation.z = breathe - 0.06;

        player.skin.leftArm.rotation.x = 0;
        player.skin.rightArm.rotation.x = 0;
        player.skin.leftLeg.rotation.x = 0;
        player.skin.rightLeg.rotation.x = 0;

        if (t >= 1) {
          this.phase = "moonwalk";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Moonwalk off the right edge ────────────────────────
      // Legs walk left (where she's facing) but canvas slides
      // right — the classic moonwalk illusion from profile view.
      case "moonwalk": {
        const t = Math.min(elapsed / MOONWALK_DURATION, 1);

        if (!this.slideStarted) {
          this.slideStarted = true;
          const canvas = this.viewer.canvas;
          const rect = canvas.getBoundingClientRect();
          this.slideDistance =
            window.innerWidth - rect.left + rect.width + 100;
          canvas.style.zIndex = "9999";
          canvas.style.pointerEvents = "none";

          // Hide horizontal overflow to prevent scrollbar
          document.documentElement.style.overflowX = "hidden";
          this.overflowHidden = true;
        }

        player.rotation.y = (3 * Math.PI) / 2;

        // Head maintains the angled stare
        player.skin.head.rotation.y = HEAD_SNAP_AMOUNT;
        player.skin.head.rotation.z = 0.12;

        // Walking leg cycle (visible from profile view)
        const walkSpeed = 8;
        const legAmplitude = 0.6;
        const armAmplitude = 0.4;
        player.skin.leftLeg.rotation.x =
          Math.sin(this.progress * walkSpeed) * legAmplitude;
        player.skin.rightLeg.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * legAmplitude;

        // Opposite arm swing
        player.skin.leftArm.rotation.x =
          Math.sin(this.progress * walkSpeed + Math.PI) * armAmplitude;
        player.skin.rightArm.rotation.x =
          Math.sin(this.progress * walkSpeed) * armAmplitude;

        // Slide canvas to the right (opposite of walking direction)
        const slideProgress = easeInOutCubic(t);
        this.viewer.canvas.style.transform = `translateX(${this.slideDistance * slideProgress}px)`;

        if (t >= 1) {
          this.phase = "gone";
          this.phaseStart = this.progress;
        }
        break;
      }

      // ── Off-screen, hold position ──────────────────────────
      case "gone": {
        player.rotation.y = (3 * Math.PI) / 2;
        player.skin.head.rotation.y = HEAD_SNAP_AMOUNT;
        break;
      }
    }
  }

  dispose() {
    // Reset player rotation and position
    this.viewer.playerObject.rotation.y = 0;
    this.viewer.playerObject.position.set(0, 0, 0);

    // Reset head rotation
    const skin = this.viewer.playerObject.skin;
    skin.head.rotation.y = 0;
    skin.head.rotation.z = 0;

    // Reset canvas styles from slide-out
    if (this.slideStarted) {
      const canvas = this.viewer.canvas;
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
