import type { PlayerObject, SkinViewer as SkinViewerLib } from "skinview3d";
import { PlayerAnimation } from "skinview3d";
import hulkSkinUrl from "@/assets/skins/hulk.png";

// ── Hulk transformation animation ────────────────────────────────────

type HulkPhase = "anger" | "transform" | "grow" | "idle";

const ANGER_DURATION = 0.8;
const TRANSFORM_DURATION = 1.2;
const GROW_DURATION = 1.6;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export class HulkAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private phase: HulkPhase = "anger";
  private phaseStart = 0;
  private skinSwapped = false;
  private styleApplied = false;
  private cardEl: HTMLElement | null = null;

  constructor(viewer: SkinViewerLib) {
    super();
    this.viewer = viewer;
  }

  protected animate(player: PlayerObject, _delta: number): void {
    const elapsed = this.progress - this.phaseStart;

    switch (this.phase) {
      case "anger": {
        const t = Math.min(elapsed / ANGER_DURATION, 1);
        const e = easeInOutCubic(t);

        // Lean back hard — torso tilts backward
        player.skin.body.rotation.x = -0.25 * e;

        // Head tilts back (angry look-up / roar)
        player.skin.head.rotation.x = -0.4 * e;

        // Arms go to wide A-position — stiff, angled out
        player.skin.leftArm.rotation.x = -0.15 * e;
        player.skin.leftArm.rotation.z = 0.5 * e;
        player.skin.rightArm.rotation.x = -0.15 * e;
        player.skin.rightArm.rotation.z = -0.5 * e;

        // Fists clench inward
        player.skin.leftArm.rotation.y = 0.15 * e;
        player.skin.rightArm.rotation.y = -0.15 * e;

        // Legs spread wide, slight crouch
        player.skin.leftLeg.rotation.x = 0.1 * e;
        player.skin.leftLeg.rotation.z = 0.12 * e;
        player.skin.rightLeg.rotation.x = 0.1 * e;
        player.skin.rightLeg.rotation.z = -0.12 * e;

        // Sink down slightly as body tenses
        player.position.y = -1 * e;

        // Early tremor that builds — body starts fighting the transformation
        if (t > 0.4) {
          const tremor = (t - 0.4) / 0.6; // 0→1 over last 60%
          const shakeAmt = tremor * 0.15;
          player.position.x = Math.sin(this.progress * 50) * shakeAmt;
          player.position.z = Math.cos(this.progress * 37) * shakeAmt * 0.5;
        }

        if (t >= 1) {
          this.phase = "transform";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "transform": {
        const t = Math.min(elapsed / TRANSFORM_DURATION, 1);

        // Swap skin partway through — the transformation "hits"
        if (!this.skinSwapped && t > 0.35) {
          this.skinSwapped = true;
          this.viewer.loadSkin(hulkSkinUrl);
        }

        // Hold angry pose, arms widen further as rage builds
        const spread = 1 + t * 0.3;
        player.skin.body.rotation.x = -0.25;
        player.skin.head.rotation.x = -0.4;
        player.skin.leftArm.rotation.x = -0.15;
        player.skin.leftArm.rotation.z = 0.5 * spread;
        player.skin.leftArm.rotation.y = 0.15;
        player.skin.rightArm.rotation.x = -0.15;
        player.skin.rightArm.rotation.z = -0.5 * spread;
        player.skin.rightArm.rotation.y = -0.15;
        player.skin.leftLeg.rotation.x = 0.1;
        player.skin.leftLeg.rotation.z = 0.12;
        player.skin.rightLeg.rotation.x = 0.1;
        player.skin.rightLeg.rotation.z = -0.12;

        // Crouch lower as power builds — coiling before the explosion
        player.position.y = -1 - t * 1;

        // Violent shake that intensifies dramatically
        const shakeIntensity = 0.15 + t * t * 0.8;
        player.position.x = Math.sin(this.progress * 80) * shakeIntensity;
        player.position.z = Math.cos(this.progress * 60) * shakeIntensity * 0.5;

        // Head shakes independently for extra intensity
        player.skin.head.rotation.z = Math.sin(this.progress * 90) * t * 0.08;

        if (t >= 1) {
          this.phase = "grow";
          this.phaseStart = this.progress;
          player.position.x = 0;
          player.position.z = 0;
          player.skin.head.rotation.z = 0;
        }
        break;
      }

      case "grow": {
        const t = Math.min(elapsed / GROW_DURATION, 1);

        // Apply canvas styles on first grow frame
        if (!this.styleApplied) {
          this.styleApplied = true;
          const canvas = this.viewer.canvas;
          canvas.style.pointerEvents = "none";

          // Lift z-index to the card button so it stacks above sibling cards
          this.cardEl = canvas.closest("button");
          if (this.cardEl) {
            this.cardEl.style.zIndex = "9999";
          }
        }

        // Scale canvas from 1x to 3x — slow start, explosive finish
        const scaleProgress = easeOutCubic(t);
        const scale = 1 + 2 * scaleProgress;
        this.viewer.canvas.style.transform = `scale(${scale})`;

        // Rise back up from crouch as hulk stands tall
        const riseT = easeOutCubic(Math.min(t * 2, 1));
        player.position.y = -2 + 2 * riseT;

        // Pose opens up — arms go wider, body straightens to power stance
        const poseT = easeInOutCubic(Math.min(t * 1.5, 1));
        player.skin.body.rotation.x = -0.25 + 0.1 * poseT;
        player.skin.head.rotation.x = -0.4 + 0.15 * poseT;
        player.skin.leftArm.rotation.x = -0.15;
        player.skin.leftArm.rotation.z = 0.65 - 0.15 * poseT;
        player.skin.leftArm.rotation.y = 0.15;
        player.skin.rightArm.rotation.x = -0.15;
        player.skin.rightArm.rotation.z = -0.65 + 0.15 * poseT;
        player.skin.rightArm.rotation.y = -0.15;
        player.skin.leftLeg.rotation.x = 0.1;
        player.skin.leftLeg.rotation.z = 0.12;
        player.skin.rightLeg.rotation.x = 0.1;
        player.skin.rightLeg.rotation.z = -0.12;

        // Vibration fades out during growth
        const shakeDecay = Math.max(1 - t * 1.5, 0) * 0.4;
        player.position.x = Math.sin(this.progress * 60) * shakeDecay;
        player.position.z = Math.cos(this.progress * 45) * shakeDecay * 0.4;

        if (t >= 1) {
          this.phase = "idle";
          this.phaseStart = this.progress;
          player.position.x = 0;
          player.position.z = 0;
        }
        break;
      }

      case "idle": {
        // Breathing cycle — slow oscillation
        const breathe = Math.sin(this.progress * 2.5);

        // Body sways with breathing
        player.skin.body.rotation.x = -0.15 + breathe * 0.05;

        // Head bobs with breathing
        player.skin.head.rotation.x = -0.25 - breathe * 0.03;

        // Arms drift in/out with breathing
        player.skin.leftArm.rotation.x = -0.15;
        player.skin.leftArm.rotation.z = 0.5 + breathe * 0.04;
        player.skin.leftArm.rotation.y = 0.15;
        player.skin.rightArm.rotation.x = -0.15;
        player.skin.rightArm.rotation.z = -0.5 - breathe * 0.04;
        player.skin.rightArm.rotation.y = -0.15;

        player.skin.leftLeg.rotation.x = 0.1;
        player.skin.leftLeg.rotation.z = 0.12;
        player.skin.rightLeg.rotation.x = 0.1;
        player.skin.rightLeg.rotation.z = -0.12;

        player.position.y = 0;

        break;
      }
    }
  }

  dispose() {
    // Reset player state
    const player = this.viewer.playerObject;
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);

    // Reset canvas styles
    if (this.styleApplied) {
      const canvas = this.viewer.canvas;
      canvas.style.transform = "";
      canvas.style.pointerEvents = "";

      if (this.cardEl) {
        this.cardEl.style.zIndex = "";
        this.cardEl = null;
      }
    }
  }
}
