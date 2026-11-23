import { context2d, createCanvas } from "@/lib/canvas";
import { clamp } from "@/lib/math";
import type { Input } from "./input";
import type { Particles } from "./particles";
import { BASE_SPEED, MAX_SPEED } from "./run";
import type { SkinParts } from "./skin";
import type { Obstacle } from "./spawner";
import type { PitKind, Sprite } from "./sprites";
import { rand, smoothstep, type Rgb } from "./util";
import { screenX, screenY, type View } from "./view";

type Range = readonly [number, number];

export type Facing = "front" | "turning" | "side";

type DeathCause = "hit" | PitKind;

type Pose = {
  nearLeg: number;
  farLeg: number;
  nearKnee: number;
  farKnee: number;
  nearArm: number;
  farArm: number;
  nearElbow: number;
  farElbow: number;
  lean: number;
  headTilt: number;
  slide: number;
  bob: number;
  frontArm: number;
  breathe: number;
};

export type Bounds = {
  left: number;
  right: number;
  bottom: number;
  top: number;
};

export type Stride = {
  speed: number;
  x: number;
  dust: Rgb;
  input: Input;
  particles: Particles;
};

const TWO_PI = Math.PI * 2;

const CANVAS_W = 48;
const CANVAS_H = 56;
const ORIGIN_X = 20;
const ORIGIN_Y = 50;

const STAND_HIT = { x: -3, w: 6, h: 30 };
const SLIDE_HIT = { x: -10, w: 22, h: 11 };

const GRAVITY = 560;
const VOID_GRAVITY = GRAVITY * 0.5;
const JUMP_VELOCITY = 190;
const HOLD_GRAVITY = 0.5;
const HOLD_MAX = 0.2;
const FAST_FALL = 2.2;
const FALL_BLEND_START = 0.25;

const STRIDE_BASE = 44;
const STRIDE_PER_SPEED = 0.1;
const LEG_SWING = 0.8;
const KNEE_BEND = 1.1;
const ARM_SWING = 0.55;
const ELBOW_BEND = 1.3;
const ELBOW_PUMP = 0.2;
const RUN_BOB = 0.7;
const SLIDE_DROP = 8;
const SLIDE_RECOVERY = 8;
const LEAN_MIN = 0.08;
const LEAN_MAX = 0.34;
const LEAN_RAMP = 1.4;
const HEAD_FOLLOW = 0.6;

const BREATH_RATE = 2.1;
const BREATH_DEPTH = 0.35;
const IDLE_ARM_SWAY = 0.04;
const FIRST_GLANCE_AT = 2;
const GLANCE_DURATION = 1.2;
const GLANCE_ANGLE: Range = [0.12, 0.22];
const GLANCE_INTERVAL: Range = [1.8, 4.5];

const TURN_DURATION = 0.22;
const MIN_SQUEEZE = 0.02;
const POSE_RATE = 14;
const DEATH_POSE_RATE = 9;
const SQUASH_DURATION = 0.14;
const SQUASH = 0.18;
const STRETCH = 0.08;
const STRETCH_NARROW = 0.6;

const RUN_DUST = 1;
const RUN_DUST_INTERVAL = 0.11;
const SLIDE_DUST = 2;
const SLIDE_DUST_INTERVAL = 0.05;
const LANDING_DUST = 6;

const DEATH_FLASH = 0.4;
const FLASH_BLINK = 0.08;
const DEATH_SLIDE = 0.12;
const LAVA_SINK = 9;
const LAVA_SINK_LIMIT = -12;
const VOID_FALL_LIMIT = -80;
const LAVA_SPLASH = 14;
const LAVA_SPLASH_HEIGHT = 4;
const FIRE_INTERVAL = 0.06;
const FIRE_SPREAD = 3;
const FIRE_HEIGHT = 6;
const FIRE_COLOR: Rgb = [255, 150, 40];
const HIT_FLASH = "rgba(255, 70, 70, 0.55)";
const LAVA_FLASH = "rgba(255, 160, 40, 0.6)";

const RUN_POSE: Pose = {
  nearLeg: 0,
  farLeg: 0,
  nearKnee: 0,
  farKnee: 0,
  nearArm: 0,
  farArm: 0,
  nearElbow: 0,
  farElbow: 0,
  lean: 0,
  headTilt: 0,
  slide: 0,
  bob: 0,
  frontArm: 0,
  breathe: 0,
};

const LEAP_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: -0.7,
  nearKnee: -1.3,
  farLeg: 1.1,
  farKnee: -1,
  nearArm: 0.9,
  nearElbow: 0.6,
  farArm: 2.4,
  farElbow: 0.3,
  lean: 0.15,
  headTilt: -0.15,
};

const FALL_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 0.6,
  nearKnee: -0.5,
  farLeg: 0.25,
  farKnee: -0.5,
  nearArm: 0.6,
  nearElbow: 0.6,
  farArm: 1.5,
  farElbow: 0.5,
  lean: 0.1,
  headTilt: 0.1,
};

const SLIDE_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 1.35,
  nearKnee: -0.2,
  farLeg: 1.25,
  farKnee: -0.05,
  nearArm: -1.65,
  nearElbow: -0.3,
  farArm: 0.74,
  farElbow: 0.4,
  lean: -1.15,
  headTilt: 0.9,
  slide: 1,
};

const DEATH_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 0.5,
  nearKnee: -0.4,
  farLeg: -0.4,
  farKnee: -0.9,
  nearArm: -1.4,
  nearElbow: -0.3,
  farArm: -1.1,
  farElbow: -0.4,
  lean: -0.45,
  headTilt: 0.35,
};

const PLUNGE_POSE: Pose = {
  ...RUN_POSE,
  nearArm: 2.9,
  farArm: 2.9,
  nearElbow: 0.1,
  farElbow: 0.1,
  headTilt: 0.2,
};

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  for (const key of Object.keys(out) as (keyof Pose)[]) {
    out[key] = a[key] + (b[key] - a[key]) * t;
  }
  return out;
}

export class Player {
  y = 0;
  vy = 0;
  grounded = true;
  facing: Facing;
  turnT = 0;
  squashT = 0;
  deathT = 0;
  deathCause: DeathCause | null = null;
  pose: Pose = { ...RUN_POSE };

  private holdT = 0;
  private phase = 0;
  private dustT = 0;
  private glanceAngle = 0;
  private glanceAt = FIRST_GLANCE_AT;
  private glanceT = -1;
  private deathAnchor: number | null = null;
  private deathSlideT = 0;
  private fireT = 0;

  constructor(facing: Facing) {
    this.facing = facing;
  }

  get sinking(): boolean {
    return this.deathCause !== null && this.deathCause !== "hit";
  }

  idle(time: number, dt: number): void {
    const breath = Math.sin(time * BREATH_RATE);
    this.pose.breathe = breath * BREATH_DEPTH;
    this.pose.frontArm = breath * IDLE_ARM_SWAY;
    if (this.glanceT < 0) {
      if (time >= this.glanceAt) {
        this.glanceT = 0;
        this.glanceAngle =
          (Math.random() < 0.5 ? -1 : 1) * rand(...GLANCE_ANGLE);
      }
      return;
    }
    this.glanceT += dt;
    const t = this.glanceT / GLANCE_DURATION;
    if (t >= 1) {
      this.glanceT = -1;
      this.glanceAt = time + rand(...GLANCE_INTERVAL);
      this.pose.headTilt = 0;
    } else {
      this.pose.headTilt = this.glanceAngle * Math.sin(t * Math.PI);
    }
  }

  run(dt: number, { speed, x, dust, input, particles }: Stride): void {
    if (this.facing === "turning") {
      this.turnT += dt;
      if (this.turnT >= TURN_DURATION) this.facing = "side";
    }

    if (input.takeJump() && this.grounded && this.facing === "side") {
      this.vy = -JUMP_VELOCITY;
      this.grounded = false;
      this.holdT = 0;
    }

    if (!this.grounded) {
      let gravity = GRAVITY;
      if (this.vy < 0 && input.jumpHeld && this.holdT < HOLD_MAX) {
        gravity *= HOLD_GRAVITY;
        this.holdT += dt;
      }
      if (input.downHeld) gravity *= FAST_FALL;
      this.vy += gravity * dt;
      this.y -= this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.squashT = SQUASH_DURATION;
        particles.dust(x, dust, LANDING_DUST);
      }
    }
    this.squashT = Math.max(0, this.squashT - dt);

    if (this.grounded) {
      const stride = STRIDE_BASE + speed * STRIDE_PER_SPEED;
      this.phase = (this.phase + (speed / stride) * dt * TWO_PI) % TWO_PI;
    }

    if (!this.grounded) {
      const fall = clamp(
        (this.vy + JUMP_VELOCITY * FALL_BLEND_START) /
          (JUMP_VELOCITY * (1 - FALL_BLEND_START)),
        0,
        1,
      );
      this.approach(mixPose(LEAP_POSE, FALL_POSE, fall), POSE_RATE * dt);
      return;
    }
    if (input.downHeld) {
      this.approach(SLIDE_POSE, POSE_RATE * dt);
      this.dustT += dt;
      if (this.dustT >= SLIDE_DUST_INTERVAL) {
        this.dustT = 0;
        particles.dust(x, dust, SLIDE_DUST);
      }
      return;
    }

    this.stride(speed, dt);
    this.dustT += dt;
    if (this.dustT >= RUN_DUST_INTERVAL) {
      this.dustT = 0;
      particles.dust(x, dust, RUN_DUST);
    }
  }

  bounds(x: number, sliding: boolean): Bounds {
    const hit = this.grounded && sliding ? SLIDE_HIT : STAND_HIT;
    const left = x + hit.x;
    return {
      left,
      right: left + hit.w,
      bottom: this.y,
      top: this.y + hit.h,
    };
  }

  die(obstacle: Obstacle, x: number, particles: Particles): DeathCause {
    const cause = obstacle.sprite.pit ?? "hit";
    this.deathCause = cause;
    this.deathAnchor =
      cause === "hit" ? null : obstacle.x + obstacle.sprite.w / 2;
    this.deathSlideT = 0;
    if (cause !== "hit") this.vy = Math.max(0, this.vy);
    this.deathT = 0;
    this.fireT = 0;
    if (cause === "lava") {
      particles.sparkle(
        this.deathAnchor ?? x,
        LAVA_SPLASH_HEIGHT,
        LAVA_SPLASH,
        FIRE_COLOR,
      );
    }
    return cause;
  }

  updateDead(dt: number, x: number, particles: Particles): void {
    this.deathT += dt;
    if (this.deathCause === "hit") {
      this.approach(DEATH_POSE, DEATH_POSE_RATE * dt);
      return;
    }
    this.deathSlideT = Math.min(1, this.deathSlideT + dt / DEATH_SLIDE);
    this.approach(PLUNGE_POSE, DEATH_POSE_RATE * dt);
    if (this.deathCause === "void") {
      this.vy += VOID_GRAVITY * dt;
      this.y = Math.max(VOID_FALL_LIMIT, this.y - this.vy * dt);
      return;
    }
    this.y = Math.max(LAVA_SINK_LIMIT, this.y - LAVA_SINK * dt);
    this.fireT += dt;
    if (this.fireT >= FIRE_INTERVAL) {
      this.fireT = 0;
      particles.sparkle(
        x + this.offset(x) + rand(-FIRE_SPREAD, FIRE_SPREAD),
        rand(0, FIRE_HEIGHT),
        1,
        FIRE_COLOR,
      );
    }
  }

  offset(x: number): number {
    if (this.deathAnchor === null) return 0;
    return (this.deathAnchor - x) * smoothstep(0, 1, this.deathSlideT);
  }

  flash(): string | null {
    if (this.deathCause === null || this.deathCause === "void") return null;
    if (this.deathT >= DEATH_FLASH) return null;
    if (Math.floor(this.deathT / FLASH_BLINK) % 2 !== 0) return null;
    return this.deathCause === "lava" ? LAVA_FLASH : HIT_FLASH;
  }

  private stride(speed: number, dt: number): void {
    const near = this.phase;
    const far = this.phase + Math.PI;
    const speedNorm = (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    const p = this.pose;
    p.nearLeg = Math.sin(near) * LEG_SWING;
    p.farLeg = Math.sin(far) * LEG_SWING;
    p.nearKnee = -KNEE_BEND * Math.max(0, Math.cos(near));
    p.farKnee = -KNEE_BEND * Math.max(0, Math.cos(far));
    p.nearArm = -Math.sin(near) * ARM_SWING;
    p.farArm = -Math.sin(far) * ARM_SWING;
    p.nearElbow = ELBOW_BEND + ELBOW_PUMP * Math.sin(near);
    p.farElbow = ELBOW_BEND + ELBOW_PUMP * Math.sin(far);
    p.lean =
      LEAN_MIN + (LEAN_MAX - LEAN_MIN) * Math.min(1, speedNorm * LEAN_RAMP);
    p.headTilt = -p.lean * HEAD_FOLLOW;
    p.bob = Math.abs(Math.cos(this.phase)) * RUN_BOB;
    p.slide = Math.max(0, p.slide - dt * SLIDE_RECOVERY);
  }

  private approach(target: Pose, amount: number): void {
    const k = Math.min(1, amount);
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      this.pose[key] += (target[key] - this.pose[key]) * k;
    }
  }
}

function limb(
  pc: CanvasRenderingContext2D,
  part: Sprite,
  px: number,
  py: number,
  angle: number,
  length: number,
  width = 4,
): void {
  pc.save();
  pc.translate(px, py);
  pc.rotate(-angle);
  pc.drawImage(part, -width / 2, 0, width, length);
  pc.restore();
}

function jointedLimb(
  pc: CanvasRenderingContext2D,
  part: Sprite,
  px: number,
  py: number,
  upper: number,
  lower: number,
): void {
  const width = part.width;
  const half = part.height / 2;
  pc.save();
  pc.translate(px, py);
  pc.rotate(-upper);
  pc.drawImage(part, 0, 0, width, half, -width / 2, 0, width, half);
  pc.translate(0, half - 0.5);
  pc.rotate(-lower);
  pc.drawImage(part, 0, half, width, half, -width / 2, 0, width, half + 0.5);
  pc.restore();
}

function drawFront(
  pc: CanvasRenderingContext2D,
  skin: SkinParts,
  p: Pose,
): void {
  const { front, armWidth: aw } = skin;
  pc.drawImage(front.rightLeg, -4, -12, 4, 12);
  pc.drawImage(front.leftLeg, 0, -12, 4, 12);
  pc.save();
  pc.translate(0, -p.breathe);
  pc.drawImage(front.body, -4, -24, 8, 12);
  limb(pc, front.rightArm, -4 - aw / 2, -24, p.frontArm, 12, aw);
  limb(pc, front.leftArm, 4 + aw / 2, -24, -p.frontArm, 12, aw);
  pc.save();
  pc.translate(0, -24);
  pc.rotate(p.headTilt);
  pc.drawImage(front.head, -4, -8, 8, 8);
  pc.restore();
  pc.restore();
}

function drawSide(
  pc: CanvasRenderingContext2D,
  skin: SkinParts,
  p: Pose,
): void {
  const { side } = skin;
  const hipY = -12 + SLIDE_DROP * p.slide;

  pc.save();
  pc.translate(0, -p.bob);

  jointedLimb(pc, side.farLeg, 0, hipY, p.farLeg, p.farKnee);

  pc.save();
  pc.translate(0, hipY);
  pc.rotate(p.lean);
  jointedLimb(pc, side.farArm, 0, -12, p.farArm, p.farElbow);
  pc.drawImage(side.body, -2, -12, 4, 12);
  pc.restore();

  jointedLimb(pc, side.nearLeg, 0, hipY, p.nearLeg, p.nearKnee);

  pc.save();
  pc.translate(0, hipY);
  pc.rotate(p.lean);
  pc.save();
  pc.translate(0, -12);
  pc.rotate(p.headTilt);
  pc.drawImage(side.head, -4, -8, 8, 8);
  pc.restore();
  jointedLimb(pc, side.nearArm, 0, -12, p.nearArm, p.nearElbow);
  pc.restore();

  pc.restore();
}

export class PlayerRig {
  private readonly canvas = createCanvas(1, 1);
  private readonly ctx = context2d(this.canvas);

  resize(texel: number): void {
    this.canvas.width = CANVAS_W * texel;
    this.canvas.height = CANVAS_H * texel;
  }

  draw(
    view: View,
    player: Player,
    skin: SkinParts,
    x: number,
    tint: string | null,
  ): void {
    const { texel } = view;
    const pc = this.ctx;
    const { width, height } = this.canvas;
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, width, height);
    pc.imageSmoothingEnabled = false;

    const squash = player.squashT / SQUASH_DURATION;
    const stretch =
      !player.grounded && player.vy < 0
        ? (-player.vy / JUMP_VELOCITY) * STRETCH
        : 0;
    const scaleX = 1 + SQUASH * squash - stretch * STRETCH_NARROW;
    const scaleY = 1 - SQUASH * squash + stretch;
    pc.setTransform(
      texel * scaleX,
      0,
      0,
      texel * scaleY,
      ORIGIN_X * texel,
      ORIGIN_Y * texel,
    );

    if (player.facing === "front") {
      drawFront(pc, skin, player.pose);
    } else if (player.facing === "turning") {
      const t = player.turnT / TURN_DURATION;
      const squeeze = Math.max(MIN_SQUEEZE, Math.abs(Math.cos(t * Math.PI)));
      pc.scale(squeeze, 1);
      if (t < 0.5) drawFront(pc, skin, player.pose);
      else drawSide(pc, skin, player.pose);
    } else {
      drawSide(pc, skin, player.pose);
    }

    if (tint) {
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalCompositeOperation = "source-atop";
      pc.fillStyle = tint;
      pc.fillRect(0, 0, width, height);
      pc.globalCompositeOperation = "source-over";
    }

    view.ctx.drawImage(
      this.canvas,
      screenX(view, x + player.offset(x)) - ORIGIN_X * texel,
      screenY(view, player.y) - ORIGIN_Y * texel,
    );
  }
}
