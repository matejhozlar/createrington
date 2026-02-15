import { PlayerAnimation } from "skinview3d";
import type { PlayerObject } from "skinview3d";

type GlanceState = "idle" | "turning" | "holding" | "returning";

/**
 * Idle animation where characters occasionally glance around randomly,
 * then return to a neutral pose. Each instance runs on its own random
 * schedule so multiple characters never move in sync.
 */
export class LookAroundIdleAnimation extends PlayerAnimation {
  private state: GlanceState = "idle";
  private stateStart = 0;
  private stateDuration: number;

  // Current and interpolation targets for head rotation
  private headY = 0;
  private headX = 0;
  private fromY = 0;
  private fromX = 0;
  private toY = 0;
  private toX = 0;

  constructor() {
    super();
    // Random initial idle so characters don't all glance at the same time
    this.stateDuration = 2 + Math.random() * 6;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  private enterState(state: GlanceState) {
    this.state = state;
    this.stateStart = this.progress;

    switch (state) {
      case "idle":
        this.stateDuration = 4 + Math.random() * 6;
        break;
      case "turning":
        this.fromY = this.headY;
        this.fromX = this.headX;
        this.toY = (Math.random() - 0.5) * 0.7;
        this.toX = (Math.random() - 0.5) * 0.25;
        this.stateDuration = 0.8 + Math.random() * 0.7;
        break;
      case "holding":
        this.stateDuration = 1 + Math.random() * 2.5;
        break;
      case "returning":
        this.fromY = this.headY;
        this.fromX = this.headX;
        this.toY = 0;
        this.toX = 0;
        this.stateDuration = 0.8 + Math.random() * 0.7;
        break;
    }
  }

  protected animate(player: PlayerObject): void {
    const elapsed = this.progress - this.stateStart;
    const t = Math.min(elapsed / this.stateDuration, 1);

    switch (this.state) {
      case "idle":
        if (t >= 1) this.enterState("turning");
        break;

      case "turning": {
        const e = this.easeInOutCubic(t);
        this.headY = this.fromY + (this.toY - this.fromY) * e;
        this.headX = this.fromX + (this.toX - this.fromX) * e;
        if (t >= 1) this.enterState("holding");
        break;
      }

      case "holding":
        if (t >= 1) {
          // Small chance to chain another glance instead of returning
          if (Math.random() < 0.25) {
            this.enterState("turning");
          } else {
            this.enterState("returning");
          }
        }
        break;

      case "returning": {
        const e = this.easeInOutCubic(t);
        this.headY = this.fromY + (this.toY - this.fromY) * e;
        this.headX = this.fromX + (this.toX - this.fromX) * e;
        if (t >= 1) {
          this.headY = 0;
          this.headX = 0;
          this.enterState("idle");
        }
        break;
      }
    }

    // Apply head rotation
    player.skin.head.rotation.y = this.headY;
    player.skin.head.rotation.x = this.headX;

    // Body follows head subtly
    player.skin.body.rotation.y = this.headY * 0.2;

    // Subtle arm breathing (always active)
    const bt = this.progress * 1.5;
    player.skin.leftArm.rotation.z = Math.cos(bt) * 0.03 + 0.06;
    player.skin.rightArm.rotation.z = Math.cos(bt + Math.PI) * 0.03 - 0.06;
  }
}
