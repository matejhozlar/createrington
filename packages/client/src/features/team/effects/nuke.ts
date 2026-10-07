import { PlayerAnimation, type PlayerObject } from "skinview3d";
import { TeamEffect, type EffectContext } from "./core/effect";
import { fx } from "./core/fx-layer";
import {
  bump,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  lerp,
  prefersReducedMotion,
  rand,
  span,
} from "./core/math";
import {
  applyJoints,
  capturePose,
  joints,
  mixJoints,
  mixToRest,
  resetPlayer,
  REST_JOINTS,
  symmetric,
  type Joints,
  type Pose,
} from "./core/pose";
import { flinchOthers } from "./core/reactions";
import {
  groundPoint,
  headPoint,
  pixelsPerUnit,
  type Point,
} from "./core/screen";
import { stage, type GuestAnimation, type GuestHandle } from "./core/stage";

const RISE_SECONDS = 0.8;
const BRACE_AT = 1.45;
const FLOAT_END = 2.05;
const SLAM_SECONDS = 0.2;
const DETONATE_AT = FLOAT_END + SLAM_SECONDS;
const LANDING_SECONDS = 0.6;
const LAUGH_START = DETONATE_AT + LANDING_SECONDS;
const RISE_UNITS = 17;
const STAND_DOWN_SECONDS = 0.4;
const GLARE_HEAD_X = -0.1;
const BLAST_SECONDS = 1.1;
const BLAST_GRAVITY = 900;
const BLAST_SAMPLES = 10;
const RESPAWN_STAGGER_MS = 55;
const CLOUD_HEIGHT_UNITS = 58;
const CLOUD_SEED_SCALE = 0.1;
const CLOUD_DRAG = 2.3;

const FIREBALL = [
  "#fff4c7",
  "#ffcb52",
  "#ff8c26",
  "#cb451b",
  "#5c4b46",
  "#3c3634",
] as const;
const GROUND_SURGE = ["#ffe3ab", "#dba269", "#91715a", "#5f5651"] as const;

const FLOAT = joints({
  headX: -0.25,
  bodyX: -0.12,
  rightArmX: -2.9,
  rightArmZ: -0.16,
  leftArmX: 0.12,
  leftArmZ: 0.2,
  leftLegX: 0.6,
  rightLegX: -0.05,
});

const THROW = joints({
  headX: 0.3,
  bodyX: 0.5,
  rightArmX: -0.45,
  rightArmZ: -0.06,
  leftArmX: 0.7,
  leftArmZ: 0.3,
  leftLegX: -0.5,
  rightLegX: 0.5,
});

const LANDED = joints({
  headX: 0.45,
  bodyX: 0.48,
  rightArmX: -0.7,
  rightArmZ: 0,
  leftArmX: 0.9,
  leftArmZ: 0.5,
  leftLegX: -0.95,
  rightLegX: 0.7,
  posY: -5,
});

const LAUGH = symmetric({
  headX: -0.42,
  bodyX: -0.14,
  armX: -0.38,
  armZ: 0.26,
});

class FlailAnimation extends PlayerAnimation implements GuestAnimation {
  private readonly seed = Math.random() * 10;

  protected animate(player: PlayerObject): void {
    const time = this.progress * 17 + this.seed;
    const skin = player.skin;
    skin.head.rotation.x = -0.3 + Math.sin(time * 0.7) * 0.2;
    skin.leftArm.rotation.x = -2.2 + Math.sin(time) * 0.7;
    skin.rightArm.rotation.x = -2.2 + Math.sin(time + 2.1) * 0.7;
    skin.leftArm.rotation.z = 0.6 + Math.sin(time * 1.3) * 0.3;
    skin.rightArm.rotation.z = -0.6 - Math.sin(time * 1.1) * 0.3;
    skin.leftLeg.rotation.x = Math.sin(time * 0.9) * 0.7;
    skin.rightLeg.rotation.x = Math.sin(time * 0.9 + Math.PI) * 0.7;
    skin.leftLeg.rotation.z = 0.2;
    skin.rightLeg.rotation.z = -0.2;
  }
}

function emitCloudPuff(
  at: Point,
  unit: number,
  shapeX: number,
  shapeY: number,
): void {
  const reachX = shapeX * CLOUD_HEIGHT_UNITS * unit;
  const reachY = shapeY * CLOUD_HEIGHT_UNITS * unit;
  const travel = 1 - CLOUD_SEED_SCALE;
  fx.emit({
    x: at.x + reachX * CLOUD_SEED_SCALE,
    y: at.y + reachY * CLOUD_SEED_SCALE,
    vx: reachX * travel * CLOUD_DRAG + rand(-3, 3) * unit,
    vy: reachY * travel * CLOUD_DRAG + rand(-3, 3) * unit,
    drag: CLOUD_DRAG,
    gravity: -3 * unit,
    life: rand(1.7, 2.5),
    size: rand(3.2, 4.4) * unit,
    sizeEnd: rand(6, 8) * unit,
    colors: FIREBALL,
    alpha: 0.95,
    fadeFrom: 0.6,
    delay: rand(0, 0.12),
  });
}

function mushroomCloud(at: Point, unit: number): void {
  for (let index = 0; index < 44; index++) {
    emitCloudPuff(at, unit, rand(-0.14, 0.14), -rand(0, 0.92));
  }
  for (let index = 0; index < 90; index++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    emitCloudPuff(
      at,
      unit,
      Math.cos(angle) * radius * 0.52,
      -1 + Math.sin(angle) * radius * 0.26,
    );
  }
  for (let index = 0; index < 22; index++) {
    const side = index % 2 === 0 ? 1 : -1;
    emitCloudPuff(at, unit, side * rand(0.2, 0.36), -rand(0.66, 0.8));
  }
  for (let index = 0; index < 36; index++) {
    const side = index % 2 === 0 ? 1 : -1;
    fx.emit({
      x: at.x,
      y: at.y - rand(0, 3) * unit,
      vx: side * rand(40, 150) * unit,
      vy: -rand(0, 14) * unit,
      drag: 2.8,
      gravity: -5 * unit,
      life: rand(0.9, 1.6),
      size: rand(2.5, 3.5) * unit,
      sizeEnd: rand(5, 7) * unit,
      colors: GROUND_SURGE,
      alpha: 0.85,
      fadeFrom: 0.35,
    });
  }
}

function blastKeyframes(directionX: number, directionY: number): Keyframe[] {
  const speed = rand(1150, 1450);
  const spin = Math.sign(directionX || 1) * rand(380, 900);
  const frames: Keyframe[] = [];
  for (let sample = 0; sample <= BLAST_SAMPLES; sample++) {
    const progress = sample / BLAST_SAMPLES;
    const time = progress * BLAST_SECONDS;
    const x = directionX * speed * time;
    const y = directionY * speed * time + 0.5 * BLAST_GRAVITY * time * time;
    frames.push({
      translate: `${x.toFixed(0)}px ${y.toFixed(0)}px`,
      rotate: `${(spin * time).toFixed(0)}deg`,
      opacity: 1 - span(progress, 0.55, 1),
    });
  }
  return frames;
}

export class NukeEffect extends TeamEffect {
  private readonly unit: number;
  private readonly risePx: number;
  private readonly blasts: Array<{ card: HTMLElement; animation: Animation }> =
    [];
  private guests: GuestHandle[] = [];
  private lift = 0;
  private braced = false;
  private detonated = false;
  private stopPose: Pose | null = null;
  private stopLift = 0;

  constructor(context: EffectContext) {
    super(context);
    this.unit = pixelsPerUnit(this.viewer);
    this.risePx = RISE_UNITS * this.unit;
    if (this.card) this.card.style.zIndex = "9999";
    stage.focus(this.username, () => headPoint(this.viewer));
  }

  protected animate(player: PlayerObject): void {
    if (this.stoppedAt === null) this.play(player);
    else this.standDown(player);
  }

  protected onStop(): void {
    this.stopPose = capturePose(this.viewer.playerObject);
    this.stopLift = this.lift;
    stage.blur(this.username);
    this.releaseGuests();
    this.respawnOthers();
  }

  dispose(): void {
    stage.blur(this.username);
    this.releaseGuests();
    for (const blast of this.blasts) blast.animation.cancel();
    this.blasts.length = 0;
    resetPlayer(this.viewer.playerObject);
    this.viewer.canvas.style.transform = "";
    if (this.card) this.card.style.zIndex = "";
  }

  private setLift(lift: number): void {
    this.lift = lift;
    this.viewer.canvas.style.transform = `translateY(${(-lift).toFixed(1)}px)`;
  }

  private releaseGuests(): void {
    for (const guest of this.guests) guest.cancel();
    this.guests = [];
  }

  private play(player: PlayerObject): void {
    const time = this.progress;
    const airborne = time < DETONATE_AT;

    const rise = easeOutCubic(span(time, 0, RISE_SECONDS));
    const slam = easeInCubic(span(time, FLOAT_END, DETONATE_AT));
    const landing = span(time, DETONATE_AT, LAUGH_START);
    const stand = easeInOutCubic(span(landing, 0.45, 1));
    const lookUp = easeOutCubic(span(landing, 0.2, 0.6));
    const laugh = easeInOutCubic(
      span(time, LAUGH_START - 0.15, LAUGH_START + 0.25),
    );
    const tremble = airborne
      ? span(time, FLOAT_END - 0.6, FLOAT_END) * (1 - slam)
      : 0;
    const chuckle =
      Math.sin(time * 13.5) * (0.6 + 0.4 * Math.sin(time * 1.1)) * laugh;

    let pose: Joints;
    if (airborne) {
      pose = mixJoints(mixJoints(REST_JOINTS, FLOAT, rise), THROW, slam);
      const bob = Math.sin(time * 3) * 5 * rise * (1 - slam);
      this.setLift(this.risePx * rise * (1 - slam) + bob);
    } else {
      pose = mixJoints(LANDED, LAUGH, stand);
      pose.headX = lerp(pose.headX, GLARE_HEAD_X, lookUp * (1 - stand));
    }

    pose.headX += chuckle * 0.06;
    pose.headZ = Math.sin(time * 90) * tremble * 0.03;
    pose.bodyX += chuckle * 0.09;
    pose.bodyZ = Math.sin(time * 3.4) * 0.04 * laugh;
    pose.leftArmX += chuckle * 0.05;
    pose.rightArmX += chuckle * 0.05;
    pose.posY += Math.abs(chuckle) * 0.35;
    applyJoints(player, pose);

    const stretch = 0.14 * bump(span(time, FLOAT_END, DETONATE_AT + 0.02));
    const squash = airborne
      ? 0
      : 0.2 * (1 - easeOutBack(span(landing, 0, 0.3)));
    player.scale.set(
      1 - stretch * 0.4 + squash * 0.5,
      1 + stretch - squash,
      1 - stretch * 0.4 + squash * 0.5,
    );
    player.position.x = Math.sin(time * 77) * tremble * 0.3;
    player.position.y -= 16 * squash;

    if (time >= BRACE_AT && !this.braced) {
      this.braced = true;
      this.guests = flinchOthers(
        this.username,
        groundPoint(this.viewer),
        Number.POSITIVE_INFINITY,
        DETONATE_AT - BRACE_AT,
      );
    }

    if (!airborne && !this.detonated) this.detonate();
  }

  private detonate(): void {
    this.detonated = true;
    this.setLift(0);
    stage.blur(this.username);
    if (this.card) this.card.style.zIndex = "";

    const unit = this.unit;
    const ground = groundPoint(this.viewer);

    fx.flash("#ffffff", 0.9, 0.5);
    mushroomCloud(ground, unit);
    stage.shake(10, 600);
    this.blastOthers(ground);
  }

  private blastOthers(origin: Point): void {
    this.releaseGuests();
    const instant = prefersReducedMotion();
    for (const member of stage.others(this.username)) {
      const card = member.card;
      if (!card || member.isBusy()) continue;

      const rect = card.getBoundingClientRect();
      const offsetX = rect.left + rect.width / 2 - origin.x;
      const offsetY = rect.top + rect.height / 2 - origin.y;
      const distance = Math.hypot(offsetX, offsetY) || 1;
      const directionY = Math.min(offsetY / distance, -0.45);
      const directionX =
        Math.sign(offsetX || 1) * Math.sqrt(1 - directionY * directionY);

      const animation = card.animate(
        instant
          ? [{ opacity: 1 }, { opacity: 0 }]
          : blastKeyframes(directionX, directionY),
        {
          duration: instant ? 200 : BLAST_SECONDS * 1000,
          delay: instant ? 0 : distance / 2.6,
          fill: "forwards",
          easing: "linear",
        },
      );
      this.blasts.push({ card, animation });

      const guest = member.playGuest(() => new FlailAnimation());
      if (guest) this.guests.push(guest);
    }
  }

  private respawnOthers(): void {
    this.blasts.forEach(({ card, animation }, index) => {
      animation.cancel();
      if (prefersReducedMotion()) return;
      card.animate(
        [
          { opacity: 0, translate: "0 -36px" },
          { opacity: 1, translate: "0 0" },
        ],
        {
          duration: 360,
          delay: index * RESPAWN_STAGGER_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.3, 1.25)",
          fill: "backwards",
        },
      );
    });
    this.blasts.length = 0;
  }

  private standDown(player: PlayerObject): void {
    const t = span(
      this.progress - (this.stoppedAt ?? 0),
      0,
      STAND_DOWN_SECONDS,
    );
    const eased = easeInOutCubic(t);
    if (this.stopPose) mixToRest(player, this.stopPose, eased);
    this.setLift(this.stopLift * (1 - eased));
    if (t >= 1) this.finish();
  }
}
