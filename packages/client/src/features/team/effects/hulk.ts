import type { PlayerObject } from "skinview3d";
import hulkSkinUrl from "@/assets/skins/hulk.png";
import { TeamEffect, type EffectContext } from "./core/effect";
import {
  bump,
  clamp,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  lerp,
  span,
} from "./core/math";
import { dustBurst } from "./core/particles";
import {
  applyJoints,
  capturePose,
  mixJoints,
  mixToRest,
  resetPlayer,
  REST_JOINTS,
  symmetric,
  type Pose,
} from "./core/pose";
import { flinchOthers, hopOthers } from "./core/reactions";
import {
  groundPoint,
  headPoint,
  pixelsPerUnit,
  toViewport,
} from "./core/screen";
import { SkinDissolve } from "./core/skin-dissolve";
import { stage } from "./core/stage";

const STRAIN = symmetric({
  headX: 0.34,
  bodyX: 0.18,
  armX: -0.6,
  armY: 0.32,
  armZ: -0.14,
  legX: 0.14,
  legZ: 0.1,
  posY: -1.7,
});

const BURST = symmetric({
  headX: -0.44,
  bodyX: -0.26,
  armX: -0.1,
  armZ: 0.98,
  legX: 0.04,
  legZ: 0.17,
  posY: -0.3,
});

const ROAR = symmetric({
  headX: -0.52,
  bodyX: -0.22,
  armX: -0.2,
  armZ: 2.2,
  legX: 0.06,
  legZ: 0.16,
  posY: 0.2,
});

const CRUNCH = symmetric({
  headX: 0.3,
  bodyX: 0.3,
  armX: -0.75,
  armY: 0.3,
  armZ: 0.2,
  legX: 0.2,
  legZ: 0.16,
  posY: -2,
});

const POWER = symmetric({
  headX: -0.2,
  bodyX: -0.12,
  armX: -0.15,
  armY: 0.15,
  armZ: 0.52,
  legX: 0.08,
  legZ: 0.12,
  posY: 0,
});

const SURGES = [
  { at: 0.95, growth: 0.3, green: 0.42 },
  { at: 1.42, growth: 0.62, green: 0.74 },
  { at: 1.9, growth: 1, green: 1 },
] as const;

const SURGE_SECONDS = 0.34;
const ROAR_START = 2.3;
const SLAM_AT = 3;
const SLAM_IMPACT_DELAY = 0.1;
const POWER_START = 3.4;
const SHRINK_SECONDS = 0.5;
const MAX_SCALE = 2.5;
const MIN_SCALE = 1.5;
const TOP_MARGIN_PX = 16;
const FX_GROWTH_SHARE = 0.45;
const GAMMA_EDGE = [176, 255, 128] as const;

function surgePulse(since: number): number {
  if (since < 0) return 0;
  if (since < 0.08) return since / 0.08;
  return Math.max(0, 1 - (since - 0.08) / 0.42);
}

export class HulkEffect extends TeamEffect {
  private readonly skinSwap: SkinDissolve;
  private readonly unit: number;
  private readonly maxScale: number;
  private surgesFired = 0;
  private slammed = false;
  private scale = 1;
  private green = 0;
  private stopPose: Pose | null = null;
  private stopScale = 1;
  private stopGreen = 0;

  constructor(context: EffectContext) {
    super(context);
    const viewer = this.viewer;
    const canvas = viewer.canvas;
    const rect = canvas.getBoundingClientRect();
    const ground = groundPoint(viewer);
    const crown = toViewport(viewer, viewer.playerWrapper, 0, 16, 0);

    this.unit = pixelsPerUnit(viewer);
    this.maxScale = clamp(
      (ground.y - TOP_MARGIN_PX) / Math.max(ground.y - crown.y, 1),
      MIN_SCALE,
      MAX_SCALE,
    );
    this.skinSwap = new SkinDissolve(viewer, hulkSkinUrl, {
      sweep: "chest",
      edge: GAMMA_EDGE,
      model: "default",
    });

    const originY = ((ground.y - rect.top) / rect.height) * 100;
    canvas.style.transformOrigin = `50% ${originY.toFixed(2)}%`;
    if (this.card) this.card.style.zIndex = "9999";
    viewer.pixelRatio = (window.devicePixelRatio || 1) * this.maxScale;
    stage.focus(this.username, () => headPoint(viewer));
  }

  protected animate(player: PlayerObject): void {
    if (this.stoppedAt === null) this.play(player);
    else this.shrink(player);
  }

  protected onStop(): void {
    this.stopPose = capturePose(this.viewer.playerObject);
    this.stopScale = this.scale;
    this.stopGreen = this.green;
    stage.blur(this.username);
  }

  dispose(): void {
    stage.blur(this.username);
    this.skinSwap.dispose();
    resetPlayer(this.viewer.playerObject);
    const canvas = this.viewer.canvas;
    canvas.style.transform = "";
    canvas.style.transformOrigin = "";
    if (this.card) this.card.style.zIndex = "";
    this.viewer.pixelRatio = "match-device";
  }

  private setScale(scale: number): void {
    this.scale = scale;
    this.viewer.canvas.style.transform = `scale(${scale.toFixed(4)})`;
  }

  private setGreen(green: number): void {
    this.green = green;
    this.skinSwap.set(green);
  }

  private play(player: PlayerObject): void {
    const time = this.progress;

    let growth = 0;
    let green =
      0.16 * span(time, 0.3, 0.9) * (0.55 + 0.45 * Math.sin(time * 26));
    let burst = 0;
    let dip = 0;
    for (const surge of SURGES) {
      const k = span(time, surge.at, surge.at + SURGE_SECONDS);
      growth = lerp(growth, surge.growth, easeOutBack(k, 2.6));
      green = lerp(green, surge.green, easeOutCubic(span(k, 0, 0.8)));
      burst += surgePulse(time - surge.at);
      dip += bump(span(time, surge.at - 0.2, surge.at)) * 0.035;
    }
    burst = Math.min(burst, 1);

    while (
      this.surgesFired < SURGES.length &&
      time >= SURGES[this.surgesFired].at
    ) {
      this.surge(this.surgesFired++);
    }

    const hunch = easeInOutCubic(span(time, 0, 0.4));
    const roar =
      easeOutBack(span(time, ROAR_START, ROAR_START + 0.25)) *
      (1 - span(time, SLAM_AT, SLAM_AT + SLAM_IMPACT_DELAY));
    const crunch = bump(span(time, SLAM_AT, SLAM_AT + 0.45));
    const power = easeInOutCubic(
      span(time, SLAM_AT + SLAM_IMPACT_DELAY, POWER_START),
    );

    let pose = mixJoints(REST_JOINTS, STRAIN, hunch);
    pose = mixJoints(pose, BURST, burst);
    pose = mixJoints(pose, ROAR, roar);
    pose = mixJoints(pose, POWER, power);
    pose = mixJoints(pose, CRUNCH, crunch * 0.8);

    if (time >= SLAM_AT + SLAM_IMPACT_DELAY && !this.slammed) this.slam();

    const breathe = Math.sin(time * 2.4) * power;
    const tremor =
      0.13 * span(time, 0.3, 0.9) * (1 - power) +
      0.45 * burst +
      0.24 * Math.min(roar, 1);

    pose.headX -= breathe * 0.03;
    pose.headY = Math.sin((time - POWER_START) * 0.9) * 0.42 * power;
    pose.headZ = Math.sin(time * 90) * tremor * 0.16;
    pose.bodyX += breathe * 0.05;
    pose.leftArmZ += breathe * 0.04;
    pose.rightArmZ -= breathe * 0.04;
    applyJoints(player, pose);
    player.position.x = Math.sin(time * 83) * tremor;
    player.position.z = Math.cos(time * 61) * tremor * 0.5;
    player.scale.set(1 + breathe * 0.012, 1, 1 + breathe * 0.03);

    this.setGreen(green);
    this.setScale(1 + (this.maxScale - 1) * growth - dip);
  }

  private stomp(dust: number, shake: number, hop: number): void {
    const ground = groundPoint(this.viewer);
    const size = this.unit * (1 + (this.scale - 1) * FX_GROWTH_SHARE);
    dustBurst(ground, size, dust, 1.2);
    stage.shake(shake, 260);
    hopOthers(this.username, ground, hop);
  }

  private surge(index: number): void {
    if (index === 0) {
      flinchOthers(
        this.username,
        groundPoint(this.viewer),
        46 * this.unit,
        0.5,
      );
    }
    if (index === SURGES.length - 1) this.stomp(14, 4, 0.8);
  }

  private slam(): void {
    this.slammed = true;
    this.stomp(22, 6, 1.3);
  }

  private shrink(player: PlayerObject): void {
    const t = span(this.progress - (this.stoppedAt ?? 0), 0, SHRINK_SECONDS);
    const eased = easeInOutCubic(t);
    if (this.stopPose) mixToRest(player, this.stopPose, eased);
    this.setScale(lerp(this.stopScale, 1, eased));
    this.setGreen(this.stopGreen * (1 - eased));
    if (t >= 1) this.finish();
  }
}
