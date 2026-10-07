import type { SkinObject } from "skinview3d";
import { Euler, Matrix4, Quaternion, Vector3, type Object3D } from "three";

type PieceSpec = {
  name: "head" | "body" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
  home: readonly [number, number, number];
  half: readonly [number, number, number];
  restRoll: number;
  land: number;
  depth: number;
  rise: number;
  turn: readonly [number, number, number];
  upright: boolean;
  joinAt: number;
};

type Body = {
  position: Vector3;
  velocity: Vector3;
  grounded: boolean;
};

export type Piece = Body & {
  spec: PieceSpec;
  part: Object3D;
  offset: Vector3;
  half: Vector3;
  spin: Euler;
  turn: Vector3;
  rest: Euler;
  quat: Quaternion;
  bounces: number;
  groundedAt: number;
  swell: number;
  home: Vector3;
  homeQuat: Quaternion;
  fromPosition: Vector3;
  fromQuat: Quaternion;
  joinAt: number;
};

const PIECES: readonly PieceSpec[] = [
  {
    name: "rightLeg",
    home: [-1.9, -12, -0.1],
    half: [2, 6, 2],
    restRoll: 0,
    land: -0.44,
    depth: -4,
    rise: 0.2,
    turn: [3, 0, 7.5],
    upright: false,
    joinAt: 0,
  },
  {
    name: "leftLeg",
    home: [1.9, -12, -0.1],
    half: [2, 6, 2],
    restRoll: 0,
    land: 0.54,
    depth: 4,
    rise: 0.26,
    turn: [-3.5, 0, -8.5],
    upright: false,
    joinAt: 0.05,
  },
  {
    name: "body",
    home: [0, -6, 0],
    half: [4, 6, 2],
    restRoll: 0,
    land: -0.1,
    depth: -6,
    rise: 0.42,
    turn: [6.5, 0, 2.5],
    upright: false,
    joinAt: 0.13,
  },
  {
    name: "rightArm",
    home: [-5, -2, 0],
    half: [2, 6, 2],
    restRoll: -0.06,
    land: -1,
    depth: 3,
    rise: 0.7,
    turn: [4, 0, 12],
    upright: false,
    joinAt: 0.23,
  },
  {
    name: "leftArm",
    home: [5, -2, 0],
    half: [2, 6, 2],
    restRoll: 0.06,
    land: 0.97,
    depth: -2,
    rise: 0.62,
    turn: [-5, 0, -11],
    upright: false,
    joinAt: 0.27,
  },
  {
    name: "head",
    home: [0, 0, 0],
    half: [4, 4, 4],
    restRoll: 0,
    land: 0.17,
    depth: 6,
    rise: 1,
    turn: [-6, 2.5, 3],
    upright: true,
    joinAt: 0.37,
  },
];

export const SKIN_Y = 8;
export const FLOOR_Y = -24;
export const GRAVITY = 420;
export const HALF_TURN = Math.PI;
export const FULL_TURN = Math.PI * 2;
export const LAST_JOIN_AT = Math.max(...PIECES.map((spec) => spec.joinAt));

const AIR_DRAG = 2.6;
const SLIDE_RATE = 9;
const RESTITUTION = 0.34;
const BOUNCE_GRIP = 0.5;
const SETTLE_SPEED = 16;
const PROBE_STEP = 1 / 120;
const PROBE_STEPS = 480;
const SLIM_ARM_HALF_WIDTH = 1.5;

const matrix = new Matrix4();
const scratch = new Vector3();

export function createPieces(skin: SkinObject): Piece[] {
  return PIECES.map((spec) => {
    const part = skin[spec.name];
    const offset = part.children[0].position.clone();
    const slimArm = skin.modelType === "slim" && spec.name.endsWith("Arm");
    const homeQuat = new Quaternion().setFromEuler(
      new Euler(0, 0, spec.restRoll),
    );
    return {
      spec,
      part,
      offset,
      half: new Vector3(
        slimArm ? SLIM_ARM_HALF_WIDTH : spec.half[0],
        spec.half[1],
        spec.half[2],
      ),
      position: new Vector3(),
      velocity: new Vector3(),
      grounded: false,
      spin: new Euler(),
      turn: new Vector3(),
      rest: new Euler(),
      quat: new Quaternion(),
      bounces: 0,
      groundedAt: 0,
      swell: 1,
      home: new Vector3(...spec.home).add(
        offset.clone().applyQuaternion(homeQuat),
      ),
      homeQuat,
      fromPosition: new Vector3(),
      fromQuat: new Quaternion(),
      joinAt: spec.joinAt,
    };
  });
}

export function advance(body: Body, floor: number, delta: number): number {
  const keep = Math.exp(-(body.grounded ? SLIDE_RATE : AIR_DRAG) * delta);
  body.velocity.x *= keep;
  body.velocity.z *= keep;
  body.position.x += body.velocity.x * delta;
  body.position.z += body.velocity.z * delta;
  if (body.grounded) {
    body.position.y = floor;
    return 0;
  }

  body.velocity.y -= GRAVITY * delta;
  body.position.y += body.velocity.y * delta;
  if (body.position.y > floor || body.velocity.y >= 0) return 0;

  const impact = -body.velocity.y;
  const rebound = impact * RESTITUTION;
  body.position.y = floor;
  body.velocity.x *= BOUNCE_GRIP;
  body.velocity.z *= BOUNCE_GRIP;
  body.grounded = rebound < SETTLE_SPEED;
  body.velocity.y = body.grounded ? 0 : rebound;
  return impact;
}

export function travelPerSpeed(
  startY: number,
  launch: number,
  floor: number,
): number {
  const probe: Body = {
    position: new Vector3(0, startY, 0),
    velocity: new Vector3(1, launch, 0),
    grounded: false,
  };
  for (let step = 0; step < PROBE_STEPS; step++) {
    advance(probe, floor, PROBE_STEP);
    if (probe.grounded && probe.velocity.x < 0.002) break;
  }
  return probe.position.x;
}

export function nearestTurn(angle: number, turn: number, phase = 0): number {
  return Math.round((angle - phase) / turn) * turn + phase;
}

export function floorExtent(piece: Piece): number {
  const elements = matrix.makeRotationFromEuler(piece.spin).elements;
  return (
    Math.abs(elements[1]) * piece.half.x +
    Math.abs(elements[5]) * piece.half.y +
    Math.abs(elements[9]) * piece.half.z
  );
}

export function placePiece(piece: Piece): void {
  piece.part.quaternion.copy(piece.quat);
  scratch.copy(piece.offset).applyQuaternion(piece.quat);
  piece.part.position.copy(piece.position).sub(scratch);
}
