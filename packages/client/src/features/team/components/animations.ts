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
  | "scratch-lower"
  | "jacks-ready"
  | "jacks"
  | "peek-lean"
  | "peek-scan"
  | "peek-startle"
  | "peek-recovery"
  | "trip-lurch"
  | "trip-catch"
  | "trip-look"
  | "trip-recovery";

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
 *  - **Jumping jacks** — 5 full jumping jacks with arms and legs spreading
 *  - **Peeking** — leans forward curiously, scans, then startles back
 *  - **Tripping** — lurches forward, catches balance, looks around embarrassed

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

      // Jumping jacks
      case "jacks-ready":
        this.stateDuration = 0.4;
        break;
      case "jacks":
        this.stateDuration = 4.0; // 5 jacks × 0.8s each
        break;

      // Peeking at viewer
      case "peek-lean":
        this.stateDuration = 1.2;
        break;
      case "peek-scan":
        this.stateDuration = 1.5 + Math.random() * 1.0;
        break;
      case "peek-startle":
        this.stateDuration = 0.2;
        break;
      case "peek-recovery":
        this.stateDuration = 1.0;
        break;

      // Tripping
      case "trip-lurch":
        this.stateDuration = 0.2;
        break;
      case "trip-catch":
        this.stateDuration = 0.3;
        break;
      case "trip-look":
        this.stateDuration = 1.8 + Math.random() * 0.7;
        break;
      case "trip-recovery":
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
    let legLeftZ = 0;
    let legRightZ = 0;

    switch (this.state) {
      // ── Idle ────────────────────────────────────────────────────
      case "idle":
        if (t >= 1) {
          const roll = Math.random();
          if (roll < 0.05) this.enterState("sneeze-windup");
          else if (roll < 0.12) this.enterState("nod-drooping");
          else if (roll < 0.2) this.enterState("stretch-up");
          else if (roll < 0.28) this.enterState("scratch-raise");
          else if (roll < 0.45) this.enterState("shift-lean");
          else if (roll < 0.52) this.enterState("jacks-ready");
          else if (roll < 0.58) this.enterState("peek-lean");
          else if (roll < 0.62) this.enterState("trip-lurch");
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
        armRightZ = 0.3 + -0.36 * e;
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
        this.headX = 0.45 - 0.6 * e; // 0.45 → -0.15
        bodyX = 0.06 - 0.09 * e; // 0.06 → -0.03
        posY = 0.2 * e; // slight jump up
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
        armLeftZ = 0.06 + 0.15 * e; // slightly outward
        armRightX = -2.8 * e;
        armRightZ = -0.06 - 0.15 * e; // slightly outward
        this.headX = -0.2 * e; // look up
        bodyX = -0.08 * e; // lean back
        posY = 0.3 * e; // rise on toes
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
        bodyZ = d * 0.06 * e; // lean sideways
        headZ = d * -0.04 * e; // head tilts opposite for balance
        // Bend the leg on the side we lean toward
        if (d > 0) {
          legRightX = 0.15 * e;
        } else {
          legLeftX = 0.15 * e;
        }
        posY = -0.15 * e; // dip from bent knee
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
        armRightZ = 0.5 * e; // inward toward head
        this.headY = -0.12 * e; // turn toward hand
        headZ = 0.08 * e; // tilt toward hand
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

      // ── Jumping jacks ──────────────────────────────────────────
      case "jacks-ready": {
        // Quick knee bend to prep for jumping
        const e = this.easeInOutCubic(t);
        legLeftX = 0.15 * e; // bend knees
        legRightX = 0.15 * e;
        posY = -0.3 * e; // dip down
        armLeftZ = 0.06 + 0.1 * e; // arms drift out slightly
        armRightZ = -0.06 - 0.1 * e;
        if (t >= 1) this.enterState("jacks");
        break;
      }

      case "jacks": {
        // 5 bumps via raised cosine, with fade-out over the last ~2 jacks
        const raw = (1 - Math.cos(t * 2 * Math.PI * 5)) / 2;
        const fade = t < 0.6 ? 1 : 1 - this.easeInOutCubic((t - 0.6) / 0.4);
        const jack = raw * fade;
        // Arms swing from sides to overhead V
        armLeftX = -2.8 * jack;
        armLeftZ = 0.06 + 0.6 * jack;
        armRightX = -2.8 * jack;
        armRightZ = -0.06 - 0.6 * jack;
        // Legs spread apart
        legLeftZ = 0.3 * jack;
        legRightZ = -0.3 * jack;
        // Jump up (sqrt for snappier peak, larger magnitude)
        posY = 1.5 * Math.sqrt(jack);
        // Slight look-up at peak
        this.headX = -0.1 * jack;
        if (t >= 1) {
          this.headX = 0;
          this.enterState("idle");
        }
        break;
      }

      // ── Peek at viewer ────────────────────────────────────────
      case "peek-lean": {
        // Lean forward curiously, head tilts to one side
        const e = this.easeInOutCubic(t);
        bodyX = 0.25 * e; // lean forward
        this.headX = 0.15 * e; // look forward/down
        headZ = 0.12 * e; // curious head tilt
        // Arms drift back for balance
        armLeftX = 0.3 * e;
        armRightX = 0.3 * e;
        posY = -0.2 * e; // slight crouch
        if (t >= 1) this.enterState("peek-scan");
        break;
      }

      case "peek-scan": {
        // Hold the lean, slowly scan left-right like looking past the screen
        const scan = Math.sin(t * Math.PI * 2) * 0.2;
        bodyX = 0.25;
        this.headX = 0.15;
        this.headY = scan;
        headZ = 0.12;
        armLeftX = 0.3;
        armRightX = 0.3;
        posY = -0.2;
        if (t >= 1) this.enterState("peek-startle");
        break;
      }

      case "peek-startle": {
        // Oh no, caught looking! Snap backward, arms flail up
        const e = this.easeOut(t);
        bodyX = 0.25 - 0.4 * e; // 0.25 → -0.15
        this.headX = 0.15 - 0.35 * e; // 0.15 → -0.2
        this.headY = this.headY * (1 - e); // snap head forward
        headZ = 0.12 * (1 - e);
        armLeftX = 0.3 - 1.8 * e; // fling arms up
        armLeftZ = 0.06 + 0.3 * e; // spread out
        armRightX = 0.3 - 1.8 * e;
        armRightZ = -0.06 - 0.3 * e;
        posY = -0.2 + 0.5 * e; // jump back up
        if (t >= 1) this.enterState("peek-recovery");
        break;
      }

      case "peek-recovery": {
        // Settle back to neutral, sheepish
        const e = this.easeInOutCubic(t);
        bodyX = -0.15 * (1 - e);
        this.headX = -0.2 * (1 - e);
        this.headY = 0;
        armLeftX = -1.5 * (1 - e);
        armLeftZ = 0.36 + (Math.cos(bt) * 0.03 + 0.06 - 0.36) * e;
        armRightX = -1.5 * (1 - e);
        armRightZ = -0.36 + (Math.cos(bt + Math.PI) * 0.03 - 0.06 + 0.36) * e;
        posY = 0.3 * (1 - e);
        if (t >= 1) {
          this.headX = 0;
          this.headY = 0;
          this.enterState("idle");
        }
        break;
      }

      // ── Tripping / stumble ────────────────────────────────────
      case "trip-lurch": {
        // Sudden forward pitch, leg catches
        const e = this.easeOut(t);
        bodyX = 0.35 * e; // pitch forward hard
        this.headX = 0.3 * e; // head follows
        posY = -0.3 * e; // stumble down
        legLeftX = 0.4 * e; // leg shoots forward to catch
        // Arms flail forward
        armLeftX = -0.8 * e;
        armLeftZ = 0.06 + 0.2 * e;
        armRightX = -0.6 * e;
        armRightZ = -0.06 - 0.15 * e;
        if (t >= 1) this.enterState("trip-catch");
        break;
      }

      case "trip-catch": {
        // Snap upright, overcorrect backward, arms spread for balance
        const e = this.easeOut(t);
        bodyX = 0.35 - 0.45 * e; // 0.35 → -0.1
        this.headX = 0.3 - 0.45 * e; // 0.3 → -0.15
        posY = -0.3 + 0.4 * e; // -0.3 → 0.1
        legLeftX = 0.4 - 0.25 * e; // relax catch leg
        // Arms spread wide for balance
        armLeftX = -0.8 - 0.2 * e; // -0.8 → -1.0
        armLeftZ = 0.26 + 0.4 * e; // spread out wide
        armRightX = -0.6 - 0.4 * e; // -0.6 → -1.0
        armRightZ = -0.21 - 0.45 * e; // spread out wide
        if (t >= 1) this.enterState("trip-look");
        break;
      }

      case "trip-look": {
        // Hold recovered pose, look around nervously
        const scan = Math.sin(t * Math.PI * 3) * 0.3;
        const armSettle = Math.min(t * 2, 1); // arms slowly lower over first half
        bodyX = -0.1;
        this.headX = -0.15;
        this.headY = scan;
        posY = 0.1;
        legLeftX = 0.15;
        // Arms gradually come down from spread
        armLeftX = -1.0 + 0.5 * armSettle;
        armLeftZ = 0.66 - 0.3 * armSettle;
        armRightX = -1.0 + 0.5 * armSettle;
        armRightZ = -0.66 + 0.3 * armSettle;
        if (t >= 1) this.enterState("trip-recovery");
        break;
      }

      case "trip-recovery": {
        // Settle back to neutral
        const e = this.easeInOutCubic(t);
        bodyX = -0.1 * (1 - e);
        this.headX = -0.15 * (1 - e);
        this.headY = this.headY * (1 - e);
        posY = 0.1 * (1 - e);
        legLeftX = 0.15 * (1 - e);
        armLeftX = -0.5 * (1 - e);
        armLeftZ = 0.36 + (Math.cos(bt) * 0.03 + 0.06 - 0.36) * e;
        armRightX = -0.5 * (1 - e);
        armRightZ = -0.36 + (Math.cos(bt + Math.PI) * 0.03 - 0.06 + 0.36) * e;
        if (t >= 1) {
          this.headX = 0;
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
    player.skin.leftLeg.rotation.z = legLeftZ;
    player.skin.rightLeg.rotation.x = legRightX;
    player.skin.rightLeg.rotation.z = legRightZ;
    player.position.y = posY;
  }
}
