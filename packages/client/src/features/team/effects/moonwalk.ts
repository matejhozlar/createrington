import type { PlayerObject } from "skinview3d";
import { TeamEffect, type EffectContext } from "./core/effect";
import {
  bump,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  lerp,
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
  type Pose,
} from "./core/pose";
import { headPoint } from "./core/screen";
import { stage } from "./core/stage";

const WIND_UP_END = 0.16;
const SPIN_END = 0.8;
const POSE_END = 1.28;
const SNAP_END = 1.45;
const GLIDE_START = 1.95;
const WIND_UP_ANGLE = -0.32;
const SPIN_ANGLE = 3.5 * Math.PI;
const HEAD_SNAP = Math.PI / 3;
const HEAD_TILT = 0.14;
const GLIDE_SPEED = 340;
const GLIDE_RAMP_SECONDS = 0.3;
const STEP_SECONDS = 0.62;
const LEG_SWING = 0.38;
const HEEL_LIFT = 1.1;
const LEG_REST_Y = -12;
const EXIT_MARGIN_PX = 70;
const WATCH_AFTER_EXIT_SECONDS = 0.6;
const RETURN_SECONDS = 0.55;
const UNWIND_SECONDS = 0.42;

const SPIN_POSE = symmetric({ armX: -0.2, armZ: 1.05, legZ: 0.05, posY: 0.6 });

const TOE_STAND = joints({
  headX: 0.3,
  bodyX: 0.06,
  leftArmX: -2.55,
  leftArmZ: -0.3,
  rightArmX: 0.45,
  rightArmZ: -0.25,
  leftLegX: -0.55,
  rightLegX: 0.05,
  posY: 1.2,
});

const STARE = joints({
  headY: HEAD_SNAP,
  headZ: HEAD_TILT,
  bodyX: 0.14,
  leftArmZ: 0.1,
  rightArmZ: -0.1,
});

function slideLeg(phase: number): { angle: number; lift: number } {
  if (phase < 0.5) {
    return { angle: lerp(-LEG_SWING, LEG_SWING, phase * 2), lift: 0 };
  }
  const pop = (phase - 0.5) * 2;
  return {
    angle: lerp(LEG_SWING, -LEG_SWING, easeInOutSine(pop)),
    lift: Math.sin(pop * Math.PI) * HEEL_LIFT,
  };
}

export class MoonwalkEffect extends TeamEffect {
  private offset = 0;
  private exitDistance = 0;
  private gliding = false;
  private gone = false;
  private goneAt = 0;
  private stopPose: Pose | null = null;
  private stopOffset = 0;

  constructor(context: EffectContext) {
    super(context);
    if (this.card) this.card.style.zIndex = "9999";
    stage.focus(this.username, () => headPoint(this.viewer));
  }

  protected animate(player: PlayerObject): void {
    if (this.stoppedAt === null) this.play(player);
    else this.comeBack(player);
  }

  protected onStop(): void {
    this.stopPose = capturePose(this.viewer.playerObject);
    this.stopOffset = this.offset;
    stage.blur(this.username);
    this.viewer.canvas.style.visibility = "";
  }

  dispose(): void {
    stage.blur(this.username);
    resetPlayer(this.viewer.playerObject);
    const canvas = this.viewer.canvas;
    canvas.style.transform = "";
    canvas.style.visibility = "";
    if (this.card) this.card.style.zIndex = "";
  }

  private setOffset(offset: number): void {
    this.offset = offset;
    this.viewer.canvas.style.transform = `translateX(${offset.toFixed(1)}px)`;
  }

  private play(player: PlayerObject): void {
    const time = this.progress;
    const skin = player.skin;

    const windUp = easeOutCubic(span(time, 0, WIND_UP_END));
    const spin = 1 - (1 - span(time, WIND_UP_END, SPIN_END)) ** 2.4;
    const armsOut = bump(span(time, WIND_UP_END, SPIN_END - 0.08));
    const crouch = bump(span(time, 0, WIND_UP_END * 1.5));
    const toeStand =
      easeOutBack(span(time, SPIN_END - 0.12, SPIN_END + 0.08)) *
      (1 - easeInOutCubic(span(time, POSE_END, SNAP_END)));
    const stare = easeOutBack(span(time, POSE_END, SNAP_END));
    const glide = span(time, GLIDE_START, GLIDE_START + 0.2);

    let pose = mixJoints(REST_JOINTS, SPIN_POSE, armsOut);
    pose = mixJoints(pose, TOE_STAND, toeStand);
    pose = mixJoints(pose, STARE, stare);
    pose.posY -= 0.9 * crouch;

    const glideTime = Math.max(time - GLIDE_START, 0);
    const phase = (glideTime / STEP_SECONDS) % 1;
    const left = slideLeg(phase);
    const right = slideLeg((phase + 0.5) % 1);
    const sway = Math.sin((glideTime / STEP_SECONDS) * Math.PI * 2);
    pose.leftLegX += left.angle * glide;
    pose.rightLegX += right.angle * glide;
    pose.leftArmX += sway * 0.28 * glide;
    pose.rightArmX -= sway * 0.28 * glide;
    pose.headX += Math.abs(sway) * 0.04 * glide;
    pose.posY -= (0.25 + Math.abs(sway) * 0.2) * glide;
    applyJoints(player, pose);
    skin.leftLeg.position.y = LEG_REST_Y + left.lift * glide;
    skin.rightLeg.position.y = LEG_REST_Y + right.lift * glide;

    player.rotation.y =
      time < WIND_UP_END
        ? WIND_UP_ANGLE * windUp
        : lerp(WIND_UP_ANGLE, SPIN_ANGLE, spin);

    if (time >= GLIDE_START && !this.gliding) {
      this.gliding = true;
      const rect = this.viewer.canvas.getBoundingClientRect();
      this.exitDistance =
        document.documentElement.clientWidth -
        (rect.left + rect.width / 2) +
        EXIT_MARGIN_PX;
    }

    if (this.gliding && !this.gone) {
      const travelled =
        glideTime < GLIDE_RAMP_SECONDS
          ? (GLIDE_SPEED * glideTime * glideTime) / (GLIDE_RAMP_SECONDS * 2)
          : GLIDE_SPEED * (glideTime - GLIDE_RAMP_SECONDS / 2);
      this.setOffset(travelled);
      if (travelled >= this.exitDistance) {
        this.gone = true;
        this.goneAt = time;
        this.viewer.canvas.style.visibility = "hidden";
      }
    }

    if (this.gone && time >= this.goneAt + WATCH_AFTER_EXIT_SECONDS) {
      stage.blur(this.username);
    }
  }

  private comeBack(player: PlayerObject): void {
    const duration = this.gliding ? RETURN_SECONDS : UNWIND_SECONDS;
    const t = span(this.progress - (this.stoppedAt ?? 0), 0, duration);
    if (this.stopPose) mixToRest(player, this.stopPose, easeInOutCubic(t));
    const skin = player.skin;
    skin.leftLeg.position.y = lerp(skin.leftLeg.position.y, LEG_REST_Y, t);
    skin.rightLeg.position.y = lerp(skin.rightLeg.position.y, LEG_REST_Y, t);
    this.setOffset(this.stopOffset * (1 - easeOutCubic(t)));
    if (t >= 1) this.finish();
  }
}
