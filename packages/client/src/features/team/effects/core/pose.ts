import { PlayerAnimation, type PlayerObject } from "skinview3d";
import { clamp01, easeOutCubic, lerp, shortestAngle } from "./math";

const PART_NAMES = [
  "head",
  "body",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
] as const;

const POSE_SIZE = PART_NAMES.length * 3 + 9;

export type Pose = Float32Array;

export function capturePose(player: PlayerObject): Pose {
  const pose = new Float32Array(POSE_SIZE);
  let cursor = 0;
  for (const name of PART_NAMES) {
    const rotation = player.skin[name].rotation;
    pose[cursor++] = rotation.x;
    pose[cursor++] = rotation.y;
    pose[cursor++] = rotation.z;
  }
  pose[cursor++] = player.position.x;
  pose[cursor++] = player.position.y;
  pose[cursor++] = player.position.z;
  pose[cursor++] = player.rotation.x;
  pose[cursor++] = player.rotation.y;
  pose[cursor++] = player.rotation.z;
  pose[cursor++] = player.scale.x;
  pose[cursor++] = player.scale.y;
  pose[cursor++] = player.scale.z;
  return pose;
}

export function mixFromPose(
  player: PlayerObject,
  from: Pose,
  weight: number,
): void {
  let cursor = 0;
  for (const name of PART_NAMES) {
    const rotation = player.skin[name].rotation;
    rotation.x = lerp(from[cursor++], rotation.x, weight);
    rotation.y = lerp(from[cursor++], rotation.y, weight);
    rotation.z = lerp(from[cursor++], rotation.z, weight);
  }
  player.position.x = lerp(from[cursor++], player.position.x, weight);
  player.position.y = lerp(from[cursor++], player.position.y, weight);
  player.position.z = lerp(from[cursor++], player.position.z, weight);
  for (const axis of ["x", "y", "z"] as const) {
    const start = from[cursor++];
    const arc = shortestAngle(start, player.rotation[axis]);
    player.rotation[axis] = start + arc * weight;
  }
  player.scale.x = lerp(from[cursor++], player.scale.x, weight);
  player.scale.y = lerp(from[cursor++], player.scale.y, weight);
  player.scale.z = lerp(from[cursor++], player.scale.z, weight);
}

function restPose(player: PlayerObject): void {
  for (const name of PART_NAMES) {
    player.skin[name].rotation.set(0, 0, 0);
  }
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.scale.set(1, 1, 1);
}

export function mixToRest(
  player: PlayerObject,
  from: Pose,
  weight: number,
): void {
  restPose(player);
  mixFromPose(player, from, weight);
}

export class BlendedAnimation extends PlayerAnimation {
  private readonly inner: PlayerAnimation;
  private readonly from: Pose;
  private readonly duration: number;
  private settled = false;

  constructor(inner: PlayerAnimation, from: Pose, duration: number) {
    super();
    this.inner = inner;
    this.from = from;
    this.duration = duration;
  }

  protected animate(player: PlayerObject, delta: number): void {
    if (this.settled) {
      this.inner.update(player, delta);
      return;
    }
    const t = clamp01(this.progress / this.duration);
    restPose(player);
    this.inner.update(player, delta);
    if (t < 1) mixFromPose(player, this.from, easeOutCubic(t));
    else this.settled = true;
  }
}

export function resetPlayer(player: PlayerObject): void {
  player.resetJoints();
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.scale.set(1, 1, 1);
  player.skin.head.position.set(0, 0, 0);
  player.skin.body.position.x = 0;
  for (const name of PART_NAMES) {
    const part = player.skin[name];
    part.visible = true;
    part.scale.set(1, 1, 1);
  }
}

const JOINT_KEYS = [
  "headX",
  "headY",
  "headZ",
  "bodyX",
  "bodyY",
  "bodyZ",
  "leftArmX",
  "leftArmY",
  "leftArmZ",
  "rightArmX",
  "rightArmY",
  "rightArmZ",
  "leftLegX",
  "leftLegZ",
  "rightLegX",
  "rightLegZ",
  "posY",
] as const;

export type Joints = Record<(typeof JOINT_KEYS)[number], number>;

type SymmetricJoints = {
  headX?: number;
  bodyX?: number;
  armX?: number;
  armY?: number;
  armZ?: number;
  legX?: number;
  legZ?: number;
  posY?: number;
};

const ARM_REST_Z = 0.06;

export const REST_JOINTS: Joints = {
  headX: 0,
  headY: 0,
  headZ: 0,
  bodyX: 0,
  bodyY: 0,
  bodyZ: 0,
  leftArmX: 0,
  leftArmY: 0,
  leftArmZ: ARM_REST_Z,
  rightArmX: 0,
  rightArmY: 0,
  rightArmZ: -ARM_REST_Z,
  leftLegX: 0,
  leftLegZ: 0,
  rightLegX: 0,
  rightLegZ: 0,
  posY: 0,
};

export function joints(overrides: Partial<Joints>): Joints {
  return { ...REST_JOINTS, ...overrides };
}

export function symmetric(pose: SymmetricJoints): Joints {
  const armZ = pose.armZ ?? ARM_REST_Z;
  return joints({
    headX: pose.headX ?? 0,
    bodyX: pose.bodyX ?? 0,
    leftArmX: pose.armX ?? 0,
    rightArmX: pose.armX ?? 0,
    leftArmY: pose.armY ?? 0,
    rightArmY: -(pose.armY ?? 0),
    leftArmZ: armZ,
    rightArmZ: -armZ,
    leftLegX: pose.legX ?? 0,
    rightLegX: pose.legX ?? 0,
    leftLegZ: pose.legZ ?? 0,
    rightLegZ: -(pose.legZ ?? 0),
    posY: pose.posY ?? 0,
  });
}

export function mixJoints(from: Joints, to: Joints, weight: number): Joints {
  const mixed = { ...from };
  for (const key of JOINT_KEYS) {
    mixed[key] = lerp(from[key], to[key], weight);
  }
  return mixed;
}

export function applyJoints(player: PlayerObject, pose: Joints): void {
  const skin = player.skin;
  skin.head.rotation.set(pose.headX, pose.headY, pose.headZ);
  skin.body.rotation.set(pose.bodyX, pose.bodyY, pose.bodyZ);
  skin.leftArm.rotation.set(pose.leftArmX, pose.leftArmY, pose.leftArmZ);
  skin.rightArm.rotation.set(pose.rightArmX, pose.rightArmY, pose.rightArmZ);
  skin.leftLeg.rotation.set(pose.leftLegX, 0, pose.leftLegZ);
  skin.rightLeg.rotation.set(pose.rightLegX, 0, pose.rightLegZ);
  player.position.y = pose.posY;
}
