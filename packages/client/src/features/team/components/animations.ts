import { PlayerAnimation } from "skinview3d";
import type { PlayerObject } from "skinview3d";

type AnimState =
  | "idle"
  | "turning"
  | "holding"
  | "returning"
  | "sneeze-windup"
  | "sneeze-snap"
  | "sneeze-hold"
  | "sneeze-recovery";

/**
 * Idle animation where characters occasionally glance around randomly,
 * then return to a neutral pose. Rarely, a character will sneeze and
 * cover their face with an arm — the whole body reacts.
 *
 * Each instance runs on its own random schedule so multiple characters
 * never move in sync. When given a position index, characters sometimes
 * turn to look toward a neighbor.
 */
export class LookAroundIdleAnimation extends PlayerAnimation {
  private readonly index: number;
  private readonly total: number;

  private state: AnimState = "idle";
  private stateStart = 0;
  private stateDuration: number;

  // Head interpolation
  private headY = 0;
  private headX = 0;
  private fromY = 0;
  private fromX = 0;
  private toY = 0;
  private toX = 0;

  constructor(index: number = 0, total: number = 1) {
    super();
    this.index = index;
    this.total = total;
    this.stateDuration = 2 + Math.random() * 6;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  private pickGlanceTarget(): { y: number; x: number } {
    const canLookLeft = this.index > 0;
    const canLookRight = this.index < this.total - 1;
    const hasNeighbor = canLookLeft || canLookRight;

    if (hasNeighbor && Math.random() < 0.4) {
      let direction: number;
      if (canLookLeft && canLookRight) {
        direction = Math.random() < 0.5 ? -1 : 1;
      } else {
        direction = canLookRight ? 1 : -1;
      }
      return {
        y: direction * (0.4 + Math.random() * 0.2),
        x: (Math.random() - 0.5) * 0.08,
      };
    }

    return {
      y: (Math.random() - 0.5) * 0.7,
      x: (Math.random() - 0.5) * 0.25,
    };
  }

  private enterState(state: AnimState) {
    this.state = state;
    this.stateStart = this.progress;

    switch (state) {
      case "idle":
        this.stateDuration = 4 + Math.random() * 6;
        break;
      case "turning": {
        this.fromY = this.headY;
        this.fromX = this.headX;
        const target = this.pickGlanceTarget();
        this.toY = target.y;
        this.toX = target.x;
        this.stateDuration = 0.8 + Math.random() * 0.7;
        break;
      }
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
      case "sneeze-windup":
        this.stateDuration = 1.5;
        break;
      case "sneeze-snap":
        this.stateDuration = 0.15;
        break;
      case "sneeze-hold":
        this.stateDuration = 0.8;
        break;
      case "sneeze-recovery":
        this.stateDuration = 1.5;
        break;
    }
  }

  protected animate(player: PlayerObject): void {
    const elapsed = this.progress - this.stateStart;
    const t = Math.min(elapsed / this.stateDuration, 1);

    // Defaults: breathing arms, neutral body & position
    const bt = this.progress * 1.5;
    let armLeftX = 0;
    let armLeftZ = Math.cos(bt) * 0.03 + 0.06;
    let armRightX = 0;
    let armRightZ = Math.cos(bt + Math.PI) * 0.03 - 0.06;
    let bodyX = 0;
    let posY = 0;
    let legLeftX = 0;
    let legRightX = 0;

    switch (this.state) {
      // ── Glance states ──────────────────────────────────────────────
      case "idle":
        if (t >= 1) {
          if (Math.random() < 0.08) {
            this.enterState("sneeze-windup");
          } else {
            this.enterState("turning");
          }
        }
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

      // ── Sneeze states ──────────────────────────────────────────────
      case "sneeze-windup": {
        // Building inhale: head tilts back, body leans back, rises slightly
        // Small pre-sneeze hitches via sine for "ah... ah..." effect
        const e = this.easeInOutCubic(t);
        const hitches = Math.sin(t * Math.PI * 3) * 0.06 * t;
        this.headX = -0.25 * e + hitches;
        bodyX = -0.06 * e;
        posY = 0.4 * e;
        armRightX = -0.3 * e;
        armRightZ = -0.06 + 0.16 * e;
        // Shoulders tense — arms pull in slightly
        armLeftZ = 0.06 - 0.04 * e;
        if (t >= 1) this.enterState("sneeze-snap");
        break;
      }

      case "sneeze-snap": {
        // ACHOO: head snaps forward, body lurches, drops down
        const e = this.easeInOutCubic(t);
        this.headX = -0.25 + 0.8 * e;               // -0.25 → 0.55
        bodyX = -0.06 + 0.26 * e;                    // -0.06 → 0.20
        posY = 0.4 - 1.0 * e;                        // 0.4 → -0.6 (dip)
        armRightX = -0.3 - 1.2 * e;                  // -0.3 → -1.5 (cover face)
        armRightZ = 0.1 + 0.2 * e;                   // inward
        armLeftX = -0.4 * e;                          // brace
        armLeftZ = 0.02 - 0.1 * e;                    // pull in
        legLeftX = 0.1 * e;                           // knees buckle
        legRightX = 0.1 * e;
        if (t >= 1) this.enterState("sneeze-hold");
        break;
      }

      case "sneeze-hold": {
        // Hunched over, arm covering face
        this.headX = 0.55;
        bodyX = 0.2;
        posY = -0.6;
        armRightX = -1.5;
        armRightZ = 0.3;
        armLeftX = -0.4;
        armLeftZ = -0.08;
        legLeftX = 0.1;
        legRightX = 0.1;
        if (t >= 1) this.enterState("sneeze-recovery");
        break;
      }

      case "sneeze-recovery": {
        // Straighten back up, ease everything to neutral
        const e = this.easeInOutCubic(t);
        this.headX = 0.55 * (1 - e);
        bodyX = 0.2 * (1 - e);
        posY = -0.6 * (1 - e);
        armRightX = -1.5 * (1 - e);
        armRightZ = 0.3 + (-0.36) * e;               // 0.3 → -0.06
        armLeftX = -0.4 * (1 - e);
        armLeftZ = -0.08 + (0.14 + Math.cos(bt) * 0.03) * e; // → breathing
        legLeftX = 0.1 * (1 - e);
        legRightX = 0.1 * (1 - e);
        if (t >= 1) {
          this.headX = 0;
          this.headY = 0;
          this.enterState("idle");
        }
        break;
      }
    }

    // Apply all rotations
    player.skin.head.rotation.y = this.headY;
    player.skin.head.rotation.x = this.headX;
    player.skin.body.rotation.y = this.headY * 0.2;
    player.skin.body.rotation.x = bodyX;
    player.skin.leftArm.rotation.x = armLeftX;
    player.skin.leftArm.rotation.z = armLeftZ;
    player.skin.rightArm.rotation.x = armRightX;
    player.skin.rightArm.rotation.z = armRightZ;
    player.skin.leftLeg.rotation.x = legLeftX;
    player.skin.rightLeg.rotation.x = legRightX;
    player.position.y = posY;
  }
}
