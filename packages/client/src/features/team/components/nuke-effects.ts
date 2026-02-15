import type { PlayerObject, SkinViewer as SkinViewerLib } from "skinview3d";
import { PlayerAnimation } from "skinview3d";

type NukePhase = "rise" | "float" | "fall" | "laugh";

const RISE_DURATION = 0.8;
const FLOAT_DURATION = 1.4;
const FALL_DURATION = 0.25;
const RISE_PX = 80;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInQuad(t: number): number {
  return t * t;
}

export class NukeAnimation extends PlayerAnimation {
  private viewer: SkinViewerLib;
  private phase: NukePhase = "rise";
  private phaseStart = 0;
  private detonated = false;
  private styleApplied = false;
  private overflowHidden = false;
  private cardEl: HTMLElement | null = null;

  constructor(viewer: SkinViewerLib) {
    super();
    this.viewer = viewer;
  }

  protected animate(player: PlayerObject): void {
    const elapsed = this.progress - this.phaseStart;

    if (!this.styleApplied) {
      this.styleApplied = true;
      const canvas = this.viewer.canvas;
      canvas.style.pointerEvents = "none";
      this.cardEl = canvas.closest("button");
      if (this.cardEl) {
        this.cardEl.style.zIndex = "9999";
        this.cardEl.style.overflow = "visible";
      }
      document.documentElement.style.overflowX = "hidden";
      this.overflowHidden = true;
    }

    switch (this.phase) {
      case "rise": {
        const t = Math.min(elapsed / RISE_DURATION, 1);
        const e = easeOutCubic(t);

        this.viewer.canvas.style.transform = `translateY(${-RISE_PX * e}px)`;

        player.skin.rightArm.rotation.x = -2.8 * e;
        player.skin.rightArm.rotation.z = -0.15 * e;
        player.skin.leftArm.rotation.x = 0.1 * e;
        player.skin.leftArm.rotation.z = 0.15 * e;
        player.skin.leftLeg.rotation.x = 0.6 * e;
        player.skin.rightLeg.rotation.x = -0.05 * e;
        player.skin.body.rotation.x = -0.1 * e;
        player.skin.head.rotation.x = -0.2 * e;

        if (t >= 1) {
          this.phase = "float";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "float": {
        const t = Math.min(elapsed / FLOAT_DURATION, 1);

        const bob = Math.sin(this.progress * 3) * 5;
        this.viewer.canvas.style.transform = `translateY(${-RISE_PX + bob}px)`;

        player.skin.rightArm.rotation.x = -2.8;
        player.skin.rightArm.rotation.z = -0.15;
        player.skin.leftArm.rotation.x = 0.1;
        player.skin.leftArm.rotation.z = 0.15;
        player.skin.leftLeg.rotation.x = 0.6;
        player.skin.rightLeg.rotation.x = -0.05;
        player.skin.body.rotation.x = -0.1;
        player.skin.head.rotation.x = -0.2;

        if (t >= 1) {
          this.phase = "fall";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "fall": {
        const t = Math.min(elapsed / FALL_DURATION, 1);
        const e = easeInQuad(t);

        this.viewer.canvas.style.transform = `translateY(${-RISE_PX * (1 - e)}px)`;

        player.skin.rightArm.rotation.x = -2.8 * (1 - e);
        player.skin.rightArm.rotation.z = -0.15 * (1 - e);
        player.skin.leftArm.rotation.x = 0.1 * (1 - e);
        player.skin.leftArm.rotation.z = 0.15 * (1 - e);
        player.skin.leftLeg.rotation.x = 0.6 * (1 - e);
        player.skin.rightLeg.rotation.x = -0.05 * (1 - e);
        player.skin.body.rotation.x = -0.1 * (1 - e);
        player.skin.head.rotation.x = -0.2 * (1 - e);

        if (t >= 1 && !this.detonated) {
          this.detonated = true;
          this.viewer.canvas.style.transform = "";
          document.dispatchEvent(new CustomEvent("team-nuke-detonate"));
          this.phase = "laugh";
          this.phaseStart = this.progress;
        }
        break;
      }

      case "laugh": {
        const bounce = Math.sin(this.progress * 14) * 0.1;
        player.skin.body.rotation.x = -0.15 + bounce;

        const headBob = Math.sin(this.progress * 14) * 0.06;
        player.skin.head.rotation.x = -0.4 + headBob;

        const armPump = Math.sin(this.progress * 14) * 0.05;
        player.skin.leftArm.rotation.x = -0.4 + armPump;
        player.skin.rightArm.rotation.x = -0.4 + armPump;
        player.skin.leftArm.rotation.z = 0.25;
        player.skin.rightArm.rotation.z = -0.25;

        player.skin.body.rotation.z = Math.sin(this.progress * 3.5) * 0.04;

        player.skin.leftLeg.rotation.x = 0;
        player.skin.rightLeg.rotation.x = 0;

        break;
      }
    }
  }

  dispose() {
    const player = this.viewer.playerObject;
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);

    if (this.styleApplied) {
      this.viewer.canvas.style.transform = "";
      this.viewer.canvas.style.pointerEvents = "";
      if (this.cardEl) {
        this.cardEl.style.zIndex = "";
        this.cardEl.style.overflow = "";
        this.cardEl = null;
      }
    }

    if (this.overflowHidden) {
      document.documentElement.style.overflowX = "";
      this.overflowHidden = false;
    }

    document.dispatchEvent(new CustomEvent("team-nuke-reset"));
  }
}
