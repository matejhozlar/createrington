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
  | "sneeze-recovery"
  | "nod-drooping"
  | "nod-snap"
  | "nod-recovery"
  | "stretch-up"
  | "stretch-hold"
  | "stretch-down"
  | "shift-lean"
  | "shift-hold"
  | "shift-return"
  | "scratch-raise"
  | "scratch-loop"
  | "scratch-lower";

/**
 * Rich idle animation for team page characters. Combines several
 * behaviours picked at random:
 *
 *  - **Glancing** — look in a random direction or toward a neighbor
 *  - **Sneezing** — full-body sneeze with arm covering face
 *  - **Nodding off** — head droops forward, snaps back startled
 *  - **Stretching** — arms overhead, body leans back
 *  - **Shifting weight** — sways to one side, one knee bends
 *  - **Scratching head** — arm goes up, small scratch motion
 *
 * Each instance runs on its own random schedule so multiple
 * characters never move in sync.
 */
export class LookAroundIdleAnimation extends PlayerAnimation {
  private readonly index: number;
  private readonly total: number;

  private state: AnimState = "idle";
  private stateStart = 0;
  private stateDuration: number;

  // Head interpolation (used by glance states)
  private headY = 0;
  private headX = 0;
  private fromY = 0;
  private fromX = 0;
  private toY = 0;
  private toX = 0;

  // Weight-shift direction (1 = right, -1 = left)
  private shiftDir = 1;

  constructor(index: number = 0, total: number = 1) {
    super();
    this.index = index;
    this.total = total;
    this.stateDuration = 2 + Math.random() * 6;
  }

  // ── Easing helpers ───────────────────────────────────────────────

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  private easeIn(t: number): number {
    return t * t;
  }

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  // ── Glance target ────────────────────────────────────────────────

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

  // ── State machine ────────────────────────────────────────────────

  private enterState(state: AnimState) {
    this.state = state;
    this.stateStart = this.progress;

    switch (state) {
      case "idle":
        this.stateDuration = 4 + Math.random() * 6;
        break;

      // Glance
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

      // Sneeze
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

      // Nod off
      case "nod-drooping":
        this.stateDuration = 2.5;
        break;
      case "nod-snap":
        this.stateDuration = 0.15;
        break;
      case "nod-recovery":
        this.stateDuration = 1.0;
        break;

      // Stretch
      case "stretch-up":
        this.stateDuration = 1.2;
        break;
      case "stretch-hold":
        this.stateDuration = 1.0 + Math.random() * 0.5;
        break;
      case "stretch-down":
        this.stateDuration = 1.5;
        break;

      // Shift weight
      case "shift-lean":
        this.shiftDir = Math.random() < 0.5 ? 1 : -1;
        this.stateDuration = 0.8;
        break;
      case "shift-hold":
        this.stateDuration = 2 + Math.random() * 2;
        break;
      case "shift-return":
        this.stateDuration = 0.8;
        break;

      // Scratch head
      case "scratch-raise":
        this.stateDuration = 0.6;
        break;
      case "scratch-loop":
        this.stateDuration = 1.2 + Math.random() * 0.6;
        break;
      case "scratch-lower":
        this.stateDuration = 0.8;
        break;
    }
  }

  // ── Animate ──────────────────────────────────────────────────────

  protected animate(player: PlayerObject): void {
    const elapsed = this.progress - this.stateStart;
    const t = Math.min(elapsed / this.stateDuration, 1);

    // Defaults: breathing arms, neutral everything else
    const bt = this.progress * 1.5;
    let armLeftX = 0;
    let armLeftZ = Math.cos(bt) * 0.03 + 0.06;
    let armRightX = 0;
    let armRightZ = Math.cos(bt + Math.PI) * 0.03 - 0.06;
    let bodyX = 0;
    let bodyZ = 0;
    let headZ = 0;
    let posY = 0;
    let legLeftX = 0;
    let legRightX = 0;

    switch (this.state) {
      // ── Idle ────────────────────────────────────────────────────
      case "idle":
        if (t >= 1) {
          const roll = Math.random();
          if (roll < 0.05) this.enterState("sneeze-windup");
          else if (roll < 0.12) this.enterState("nod-drooping");
          else if (roll < 0.20) this.enterState("stretch-up");
          else if (roll < 0.28) this.enterState("scratch-raise");
          else if (roll < 0.45) this.enterState("shift-lean");
          else this.enterState("turning");
        }
        break;

      // ── Glance ─────────────────────────────────────────────────
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

      // ── Sneeze ─────────────────────────────────────────────────
      case "sneeze-windup": {
        const e = this.easeInOutCubic(t);
        const hitches = Math.sin(t * Math.PI * 3) * 0.06 * t;
        this.headX = -0.25 * e + hitches;
        bodyX = -0.06 * e;
        posY = 0.4 * e;
        armRightX = -0.3 * e;
        armRightZ = -0.06 + 0.16 * e;
        armLeftZ = 0.06 - 0.04 * e;
        if (t >= 1) this.enterState("sneeze-snap");
        break;
      }

      case "sneeze-snap": {
        const e = this.easeInOutCubic(t);
        this.headX = -0.25 + 0.8 * e;
        bodyX = -0.06 + 0.26 * e;
        posY = 0.4 - 1.0 * e;
        armRightX = -0.3 - 1.2 * e;
        armRightZ = 0.1 + 0.2 * e;
        armLeftX = -0.4 * e;
        armLeftZ = 0.02 - 0.1 * e;
        legLeftX = 0.1 * e;
        legRightX = 0.1 * e;
        if (t >= 1) this.enterState("sneeze-hold");
        break;
      }

      case "sneeze-hold": {
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
        const e = this.easeInOutCubic(t);
        this.headX = 0.55 * (1 - e);
        bodyX = 0.2 * (1 - e);
        posY = -0.6 * (1 - e);
        armRightX = -1.5 * (1 - e);
        armRightZ = 0.3 + (-0.36) * e;
        armLeftX = -0.4 * (1 - e);
        armLeftZ = -0.08 + (0.14 + Math.cos(bt) * 0.03) * e;
        legLeftX = 0.1 * (1 - e);
        legRightX = 0.1 * (1 - e);
        if (t >= 1) {
          this.headX = 0;
          this.headY = 0;
          this.enterState("idle");
        }
        break;
      }

      // ── Nod off ────────────────────────────────────────────────
      case "nod-drooping": {
        // Head slowly droops forward (ease-in: starts slow, accelerates)
        const e = this.easeIn(t);
        this.headX = 0.45 * e;
        bodyX = 0.06 * e;
        // Arms relax downward slightly
        armLeftZ = 0.06 + 0.04 * e;
        armRightZ = -0.06 - 0.04 * e;
        if (t >= 1) this.enterState("nod-snap");
        break;
      }

      case "nod-snap": {
        // Startled awake: head snaps back, overshoots
        const e = this.easeOut(t);
        this.headX = 0.45 - 0.6 * e;             // 0.45 → -0.15
        bodyX = 0.06 - 0.09 * e;                  // 0.06 → -0.03
        posY = 0.2 * e;                            // slight jump up
        armLeftZ = 0.1 - 0.04 * e;
        armRightZ = -0.1 + 0.04 * e;
        if (t >= 1) this.enterState("nod-recovery");
        break;
      }

      case "nod-recovery": {
        // Settle back to neutral, small head shake
        const e = this.easeInOutCubic(t);
        const shake = Math.sin(t * Math.PI * 4) * 0.08 * (1 - t);
        this.headX = -0.15 * (1 - e);
        this.headY = shake;
        bodyX = -0.03 * (1 - e);
        posY = 0.2 * (1 - e);
        if (t >= 1) {
          this.headX = 0;
          this.headY = 0;
          this.enterState("idle");
        }
        break;
      }

      // ── Stretch ────────────────────────────────────────────────
      case "stretch-up": {
        // Arms overhead, body leans back, rises on toes
        const e = this.easeInOutCubic(t);
        armLeftX = -2.8 * e;
        armLeftZ = 0.06 + 0.15 * e;               // slightly outward
        armRightX = -2.8 * e;
        armRightZ = -0.06 - 0.15 * e;             // slightly outward
        this.headX = -0.2 * e;                     // look up
        bodyX = -0.08 * e;                         // lean back
        posY = 0.3 * e;                            // rise on toes
        if (t >= 1) this.enterState("stretch-hold");
        break;
      }

      case "stretch-hold": {
        // Hold with slight sway
        const sway = Math.sin(this.progress * 2) * 0.02;
        armLeftX = -2.8;
        armLeftZ = 0.21 + sway;
        armRightX = -2.8;
        armRightZ = -0.21 - sway;
        this.headX = -0.2;
        bodyX = -0.08;
        posY = 0.3;
        if (t >= 1) this.enterState("stretch-down");
        break;
      }

      case "stretch-down": {
        // Relax everything back
        const e = this.easeInOutCubic(t);
        armLeftX = -2.8 * (1 - e);
        armLeftZ = 0.21 + (Math.cos(bt) * 0.03 + 0.06 - 0.21) * e;
        armRightX = -2.8 * (1 - e);
        armRightZ = -0.21 + (Math.cos(bt + Math.PI) * 0.03 - 0.06 + 0.21) * e;
        this.headX = -0.2 * (1 - e);
        bodyX = -0.08 * (1 - e);
        posY = 0.3 * (1 - e);
        if (t >= 1) {
          this.headX = 0;
          this.enterState("idle");
        }
        break;
      }

      // ── Shift weight ───────────────────────────────────────────
      case "shift-lean": {
        const d = this.shiftDir;
        const e = this.easeInOutCubic(t);
        bodyZ = d * 0.06 * e;                     // lean sideways
        headZ = d * -0.04 * e;                    // head tilts opposite for balance
        // Bend the leg on the side we lean toward
        if (d > 0) {
          legRightX = 0.15 * e;
        } else {
          legLeftX = 0.15 * e;
        }
        posY = -0.15 * e;                         // dip from bent knee
        if (t >= 1) this.enterState("shift-hold");
        break;
      }

      case "shift-hold": {
        const d = this.shiftDir;
        bodyZ = d * 0.06;
        headZ = d * -0.04;
        if (d > 0) {
          legRightX = 0.15;
        } else {
          legLeftX = 0.15;
        }
        posY = -0.15;
        if (t >= 1) this.enterState("shift-return");
        break;
      }

      case "shift-return": {
        const d = this.shiftDir;
        const e = this.easeInOutCubic(t);
        bodyZ = d * 0.06 * (1 - e);
        headZ = d * -0.04 * (1 - e);
        if (d > 0) {
          legRightX = 0.15 * (1 - e);
        } else {
          legLeftX = 0.15 * (1 - e);
        }
        posY = -0.15 * (1 - e);
        if (t >= 1) this.enterState("idle");
        break;
      }

      // ── Scratch head ───────────────────────────────────────────
      case "scratch-raise": {
        // Right arm goes up to head, head tilts
        const e = this.easeInOutCubic(t);
        armRightX = -2.0 * e;
        armRightZ = 0.5 * e;                      // inward toward head
        this.headY = -0.12 * e;                   // turn toward hand
        headZ = 0.08 * e;                         // tilt toward hand
        if (t >= 1) this.enterState("scratch-loop");
        break;
      }

      case "scratch-loop": {
        // Small scratch oscillation
        const scratchMotion = Math.sin(this.progress * 10) * 0.12;
        armRightX = -2.0 + scratchMotion;
        armRightZ = 0.5;
        this.headY = -0.12;
        headZ = 0.08;
        if (t >= 1) this.enterState("scratch-lower");
        break;
      }

      case "scratch-lower": {
        // Arm comes back down, head straightens
        const e = this.easeInOutCubic(t);
        armRightX = -2.0 * (1 - e);
        armRightZ = 0.5 * (1 - e) + (Math.cos(bt + Math.PI) * 0.03 - 0.06) * e;
        this.headY = -0.12 * (1 - e);
        headZ = 0.08 * (1 - e);
        if (t >= 1) {
          this.headY = 0;
          this.enterState("idle");
        }
        break;
      }
    }

    // Apply all rotations
    player.skin.head.rotation.x = this.headX;
    player.skin.head.rotation.y = this.headY;
    player.skin.head.rotation.z = headZ;
    player.skin.body.rotation.x = bodyX;
    player.skin.body.rotation.y = this.headY * 0.2;
    player.skin.body.rotation.z = bodyZ;
    player.skin.leftArm.rotation.x = armLeftX;
    player.skin.leftArm.rotation.z = armLeftZ;
    player.skin.rightArm.rotation.x = armRightX;
    player.skin.rightArm.rotation.z = armRightZ;
    player.skin.leftLeg.rotation.x = legLeftX;
    player.skin.rightLeg.rotation.x = legRightX;
    player.position.y = posY;
  }
}
