import { PlayerAnimation, type PlayerObject } from "skinview3d";
import { TeamEffect, type EffectContext } from "./core/effect";
import {
  bump,
  clamp,
  damp,
  easeInCubic,
  easeInOutCubic,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  lerp,
  rand,
  shortestAngle,
  span,
} from "./core/math";
import { dustBurst, FLAME, poof } from "./core/particles";
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
import { flinchOthers } from "./core/reactions";
import {
  groundPoint,
  headPoint,
  pixelsPerUnit,
  toViewport,
  visibleBox,
} from "./core/screen";
import {
  stage,
  type GuestAnimation,
  type GuestHandle,
  type StageMember,
} from "./core/stage";
import { BASE_BLEED } from "./core/view";
import {
  advance,
  createPieces,
  FLOOR_Y,
  floorExtent,
  FULL_TURN,
  GRAVITY,
  HALF_TURN,
  LAST_JOIN_AT,
  nearestTurn,
  placePiece,
  SKIN_Y,
  travelPerSpeed,
  type Piece,
} from "./explode-pieces";

type Mode = "fuse" | "calm" | "blast" | "rejoin";

type Picker = { member: StageMember; distance: number };

type Pickup = {
  member: StageMember;
  wave: ArmWaveAnimation;
  handle: GuestHandle;
  piece: Piece;
  held: { angle: number; since: number } | null;
};

const CLUTCH = symmetric({
  headX: 0.44,
  bodyX: 0.22,
  armX: -0.9,
  armY: 0.55,
  armZ: -0.22,
  legX: 0.16,
  legZ: 0.1,
  posY: -1.6,
});

const BRACE = symmetric({
  headX: -0.55,
  bodyX: -0.24,
  armX: -0.12,
  armZ: 1.05,
  legX: 0.04,
  legZ: 0.2,
  posY: 0.5,
});

const BLAST_BLEED = { x: 3.8, y: 2.8 };
const FUSE_SECONDS = 1.45;
const HIT_STOP_SECONDS = 0.08;
const BRACE_OTHERS_AT = FUSE_SECONDS - 0.3;
const CALM_SECONDS = 0.4;
const JOIN_SECONDS = 0.4;
const SETTLE_SECONDS = 0.24;
const PEAK_SWELL = 0.16;

const MAX_STEP = 1 / 30;

const DESIGN_REACH = 30;
const MIN_REACH = 8;
const DESIGN_RISE = 33;
const MIN_RISE = 6;
const PIECE_GUARD = 7.5;
const DEPTH_STRETCH = 1.17;
const TOP_MARGIN_PX = 16;

const TROPHY_PIECE = "rightArm";
const WAVING_ARM = "leftArm";
const PICK_ROW_TOLERANCE = 12;
const PICK_MAX_DISTANCE = 44;
const PICK_DROP_OFFSET = 10;
const PICK_DELAY_SECONDS = 0.35;
const PICK_GRAB_AT = 0.62;
const PICK_SNATCH_SECONDS = 0.16;
const WAVE_RATE = 9;
const WAVE_RAISE = 2.5;
const WAVE_SWING = 0.42;
const HAND_Y = -10.5;

class ArmWaveAnimation extends PlayerAnimation implements GuestAnimation {
  released = false;

  get grabbed(): boolean {
    return this.progress >= PICK_GRAB_AT;
  }

  protected animate(player: PlayerObject): void {
    const time = this.progress;
    const skin = player.skin;

    const look = easeInOutCubic(span(time, 0, 0.25));
    const down =
      easeInOutCubic(span(time, 0.16, PICK_GRAB_AT - 0.08)) *
      (1 - easeInOutCubic(span(time, PICK_GRAB_AT + 0.05, PICK_GRAB_AT + 0.4)));
    const up = easeOutBack(
      span(time, PICK_GRAB_AT + 0.1, PICK_GRAB_AT + 0.55),
      1.3,
    );
    const waving = span(time, PICK_GRAB_AT + 0.45, PICK_GRAB_AT + 0.75);
    const beat = (time - PICK_GRAB_AT - 0.45) * WAVE_RATE;
    const swing = Math.sin(beat) * waving;
    const glance = 0.5 + 0.5 * Math.cos((time - PICK_GRAB_AT) * 1.5);

    skin.head.rotation.set(
      0.55 * down - 0.14 * up,
      0.5 * look * (1 - up) + 0.55 * up * glance,
      0.06 * swing,
    );
    skin.body.rotation.set(0.24 * down, 0, 0.05 * swing);
    skin[WAVING_ARM].rotation.set(
      -0.3 * down * (1 - up) + 0.12 * Math.sin(beat * 0.5) * waving,
      0,
      0.06 + 0.3 * down * (1 - up) + WAVE_RAISE * up + WAVE_SWING * swing,
    );
    skin.rightArm.rotation.set(0.22 * up - 0.3 * down, 0, -0.06 - 0.36 * up);
    skin.leftLeg.rotation.set(-0.8 * down, 0, 0);
    skin.rightLeg.rotation.set(0.8 * down, 0, 0);

    player.position.set(2.2 * down, -3.6 * down + 0.45 * Math.abs(swing), 0);
    player.rotation.set(0.24 * down, 0.3 * look * (1 - up), -0.2 * down);
  }

  dispose(): void {
    this.released = true;
  }
}

export class ExplodeEffect extends TeamEffect {
  private readonly unit: number;
  private readonly pieces: Piece[];
  private mode: Mode = "fuse";
  private gap = 0;
  private braced: GuestHandle[] | null = null;
  private stopPose: Pose | null = null;
  private stopGap = 0;
  private picker: Picker | null = null;
  private pickup: Pickup | null = null;

  constructor(context: EffectContext) {
    super(context);
    this.setBleed(BLAST_BLEED);
    this.unit = pixelsPerUnit(this.viewer);

    this.pieces = createPieces(this.viewer.playerObject.skin);

    if (this.card) this.card.style.zIndex = "9999";
    stage.focus(this.username, () => headPoint(this.viewer));
  }

  protected animate(player: PlayerObject, delta: number): void {
    if (this.mode === "fuse") this.fuse(player);
    else if (this.mode === "calm") this.calm(player);
    else if (this.mode === "blast") this.blast(Math.min(delta, MAX_STEP));
    else this.rejoin(player);
  }

  protected onStop(): void {
    stage.blur(this.username);
    if (this.mode === "fuse") {
      this.releaseOthers();
      this.stopPose = capturePose(this.viewer.playerObject);
      this.stopGap = this.gap;
      this.mode = "calm";
      return;
    }
    for (const piece of this.pieces) {
      piece.fromPosition.copy(piece.position);
      piece.fromQuat.copy(piece.quat);
    }
    if (this.pickup?.held) this.pickup.piece.joinAt = 0;
    this.endPickup();
    this.mode = "rejoin";
  }

  dispose(): void {
    stage.blur(this.username);
    this.releaseOthers();
    this.endPickup();
    resetPlayer(this.viewer.playerObject);
    this.setBleed(BASE_BLEED);
    if (this.card) this.card.style.zIndex = "";
  }

  private releaseOthers(): void {
    this.braced?.forEach((handle) => handle.cancel());
    this.braced = null;
  }

  private endPickup(): void {
    this.picker = null;
    this.pickup?.handle.cancel();
    this.pickup = null;
  }

  private findPicker(): Picker | null {
    const viewer = this.viewer;
    const mine = toViewport(viewer, viewer.playerWrapper, 0, 0, 0);
    let best: Picker | null = null;
    for (const member of stage.others(this.username)) {
      const point = toViewport(
        member.viewer,
        member.viewer.playerWrapper,
        0,
        0,
        0,
      );
      const distance = (mine.x - point.x) / this.unit;
      const drop = Math.abs(point.y - mine.y) / this.unit;
      if (distance <= 0 || distance > PICK_MAX_DISTANCE) continue;
      if (drop > PICK_ROW_TOLERANCE) continue;
      if (!best || distance < best.distance) best = { member, distance };
    }
    return best;
  }

  private openSeams(gap: number): void {
    this.gap = gap;
    for (const piece of this.pieces) {
      const [x, y, z] = piece.spec.home;
      const side = Math.sign(x);
      const isArm = piece.spec.name.endsWith("Arm");
      piece.part.position.set(
        x + side * (isArm ? 0.9 : 0.35) * gap,
        y + (piece.spec.name === "head" ? 0.7 * gap : 0),
        z,
      );
    }
  }

  private fuse(player: PlayerObject): void {
    const frozen = this.progress >= FUSE_SECONDS;
    const time = Math.min(this.progress, FUSE_SECONDS);

    const startle = bump(span(time, 0, 0.22));
    const clutch = easeInOutCubic(span(time, 0.08, 0.42));
    const brace = easeOutBack(
      span(time, FUSE_SECONDS - 0.17, FUSE_SECONDS),
      1.2,
    );
    const build = easeInQuad(span(time, 0.1, FUSE_SECONDS));
    const tremor = frozen ? 0 : 0.14 * clutch + 1.25 * build;
    const pulse =
      Math.sin(time * (9 + 22 * time)) *
      0.02 *
      span(time, 0.3, 0.7) *
      (1 - brace);
    const swell =
      1 + PEAK_SWELL * easeInCubic(span(time, 0.3, FUSE_SECONDS)) + pulse;

    let pose = mixJoints(REST_JOINTS, CLUTCH, clutch);
    pose = mixJoints(pose, BRACE, brace);
    pose.posY += 0.7 * startle;
    pose.headY = Math.sin(time * 37) * 0.13 * tremor;
    pose.headZ = Math.sin(time * 89) * 0.17 * tremor;
    pose.bodyZ = Math.sin(time * 67) * 0.05 * tremor;
    pose.leftArmX += Math.sin(time * 61 + 1) * 0.2 * tremor;
    pose.rightArmX += Math.sin(time * 71 + 2.1) * 0.2 * tremor;
    pose.leftLegX += Math.sin(time * 53 + 0.4) * 0.09 * tremor;
    pose.rightLegX += Math.sin(time * 59 + 1.7) * 0.09 * tremor;
    applyJoints(player, pose);

    player.position.x =
      (Math.sin(time * 83) + 0.5 * Math.sin(time * 131)) * 0.62 * tremor;
    player.position.y += 16 * (swell - 1);
    player.position.z = Math.cos(time * 61) * 0.4 * tremor;
    player.rotation.set(
      0,
      Math.sin(time * 47) * 0.07 * tremor,
      Math.sin(time * 73) * 0.055 * tremor,
    );
    player.scale.setScalar(swell);
    this.openSeams(easeInCubic(span(time, 0.75, FUSE_SECONDS)));

    if (time >= BRACE_OTHERS_AT && !this.braced) {
      this.braced = flinchOthers(
        this.username,
        groundPoint(this.viewer),
        64 * this.unit,
        0.95,
      );
    }
    if (this.progress >= FUSE_SECONDS + HIT_STOP_SECONDS) this.detonate(player);
  }

  private calm(player: PlayerObject): void {
    const t = span(this.progress - (this.stoppedAt ?? 0), 0, CALM_SECONDS);
    const eased = easeInOutCubic(t);
    if (this.stopPose) mixToRest(player, this.stopPose, eased);
    this.openSeams(this.stopGap * (1 - eased));
    if (t >= 1) this.finish();
  }

  private measureRoom(): { left: number; right: number; rise: number } {
    const viewer = this.viewer;
    const rect = viewer.canvas.getBoundingClientRect();
    const center = toViewport(viewer, viewer.playerWrapper, 0, 0, 0);
    const crown = toViewport(viewer, viewer.playerWrapper, 0, SKIN_Y + 4, 0);
    const scale = this.unit * DEPTH_STRETCH;
    const visible = visibleBox(viewer.canvas);
    const leftEdge = Math.max(rect.left, visible.left);
    const rightEdge = Math.min(rect.right, visible.right);
    const topEdge = Math.max(rect.top, visible.top + TOP_MARGIN_PX);
    const room = (pixels: number, design: number, min: number) =>
      clamp(pixels / scale - PIECE_GUARD, min, design);
    return {
      left: room(center.x - leftEdge, DESIGN_REACH, MIN_REACH),
      right: room(rightEdge - center.x, DESIGN_REACH, MIN_REACH),
      rise: room(crown.y - topEdge, DESIGN_RISE, MIN_RISE),
    };
  }

  private detonate(player: PlayerObject): void {
    const viewer = this.viewer;
    const swell = player.scale.y;
    const lift = player.position.y;
    const room = this.measureRoom();
    this.picker = this.findPicker();

    for (const piece of this.pieces) {
      const { spec, part } = piece;
      piece.spin.copy(part.rotation);
      piece.quat.setFromEuler(piece.spin);
      piece.position
        .copy(piece.offset)
        .applyQuaternion(piece.quat)
        .add(part.position);
      piece.position.x *= swell;
      piece.position.y = (piece.position.y + SKIN_Y) * swell + lift - SKIN_Y;
      piece.position.z *= swell;
      piece.swell = swell;

      const restHalf = spec.upright ? piece.half.y : piece.half.x;
      const floor = FLOOR_Y + restHalf;
      const climb = Math.max(spec.rise * room.rise, 2.5);
      const launch = Math.sqrt(2 * GRAVITY * climb);
      const travel = travelPerSpeed(piece.position.y, launch, floor);
      const reach = spec.land < 0 ? room.left : room.right;
      const targetX =
        this.picker && spec.name === TROPHY_PIECE
          ? -Math.min(this.picker.distance - PICK_DROP_OFFSET, room.left)
          : spec.land * reach + rand(-1, 1);
      piece.velocity.set(
        (targetX - piece.position.x) / travel,
        launch,
        (spec.depth - piece.position.z) / travel,
      );
      piece.turn.set(
        spec.turn[0] * rand(0.85, 1.15),
        spec.turn[1] * rand(0.85, 1.15),
        spec.turn[2] * rand(0.85, 1.15),
      );
      if (!spec.upright) piece.spin.y = rand(-0.3, 0.3);
      piece.grounded = false;
      piece.bounces = 0;
    }

    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    player.scale.set(1, 1, 1);

    const chest = toViewport(viewer, viewer.playerWrapper, 0, 3, 0);
    const ground = groundPoint(viewer);
    poof(chest, this.unit * 1.7, 18);
    poof(chest, this.unit * 1.1, 9, FLAME);
    dustBurst(ground, this.unit, 12, 1.2);
    stage.shake(7, 340);

    this.mode = "blast";
    this.blast(0);
  }

  private touchDown(piece: Piece, impact: number): void {
    const { spin, turn, rest, spec } = piece;
    if (piece.bounces === 0) {
      const aheadX = spin.x + turn.x * 0.12;
      const aheadZ = spin.z + turn.z * 0.12;
      if (spec.upright) {
        rest.set(
          nearestTurn(aheadX, FULL_TURN),
          nearestTurn(spin.y + turn.y * 0.12, FULL_TURN),
          nearestTurn(aheadZ, FULL_TURN),
        );
      } else {
        rest.set(
          nearestTurn(aheadX, spec.name === "body" ? FULL_TURN : HALF_TURN),
          spin.y,
          nearestTurn(aheadZ, HALF_TURN, Math.PI / 2),
        );
      }
      dustBurst(
        toViewport(
          this.viewer,
          this.viewer.playerObject.skin,
          piece.position.x,
          FLOOR_Y,
          piece.position.z,
        ),
        this.unit,
        3,
        clamp(impact / 260, 0.3, 0.7),
      );
    }
    piece.bounces++;
    turn.multiplyScalar(0.4);
    if (piece.grounded) piece.groundedAt = this.progress;
  }

  private updatePickup(): void {
    const pickup = this.pickup;
    if (pickup) {
      if (!pickup.wave.released) return;
      const piece = pickup.piece;
      if (pickup.held) {
        piece.grounded = false;
        piece.velocity.set(0, 0, 0);
        piece.turn.set(0, 0, 0);
        piece.rest.set(
          nearestTurn(piece.spin.x, HALF_TURN),
          piece.rest.y,
          nearestTurn(piece.spin.z, HALF_TURN, Math.PI / 2),
        );
      }
      this.pickup = null;
      return;
    }

    const picker = this.picker;
    const piece = this.pieces.find((entry) => entry.spec.name === TROPHY_PIECE);
    if (!picker || !piece?.grounded) return;
    if (this.progress - piece.groundedAt < PICK_DELAY_SECONDS) return;
    if (picker.member.isBusy()) return;

    const wave = new ArmWaveAnimation();
    const handle = picker.member.playGuest(() => wave);
    this.picker = null;
    if (handle) {
      this.pickup = { member: picker.member, wave, handle, piece, held: null };
    }
  }

  private carry(pickup: Pickup, delta: number): void {
    const { member, piece } = pickup;
    const arm = member.viewer.playerObject.skin[WAVING_ARM];
    const pivotX = arm.children[0].position.x;
    const grip = toViewport(member.viewer, arm, pivotX, HAND_Y, 0);
    const shoulder = toViewport(member.viewer, arm, pivotX, 0, 0);
    const viewer = this.viewer;
    const center = toViewport(viewer, viewer.playerWrapper, 0, 0, 0);
    const unit = pixelsPerUnit(viewer);

    const target = Math.atan2(grip.x - shoulder.x, grip.y - shoulder.y);
    if (!pickup.held) {
      pickup.held = { angle: target, since: this.progress };
      piece.fromPosition.copy(piece.position);
      piece.fromQuat.copy(piece.quat);
    }
    const held = pickup.held;
    held.angle +=
      shortestAngle(held.angle, target) * (1 - Math.exp(-13 * delta));

    const angle = held.angle;
    const length = piece.half.y - 0.8;
    piece.spin.set(0, 0, angle);
    piece.quat.setFromEuler(piece.spin);
    piece.position.set(
      (grip.x - center.x) / unit + Math.sin(angle) * length,
      (center.y - grip.y) / unit - SKIN_Y - Math.cos(angle) * length,
      1,
    );

    const snatch = easeOutCubic(
      span(this.progress - held.since, 0, PICK_SNATCH_SECONDS),
    );
    if (snatch < 1) {
      piece.position.lerp(piece.fromPosition, 1 - snatch);
      piece.quat.slerp(piece.fromQuat, 1 - snatch);
    }
    placePiece(piece);
  }

  private headAct(piece: Piece): { pitch: number; yaw: number; roll: number } {
    if (this.pickup?.held) {
      return {
        pitch: -0.2,
        yaw: -0.6,
        roll: Math.sin(this.progress * 11) * 0.05,
      };
    }
    const since = this.progress - piece.groundedAt;
    const daze = Math.exp(-5 * since) * Math.cos(since * 14) * 0.22;
    const first = easeInOutCubic(span(since, 0.5, 0.85));
    const swap = easeInOutCubic(span(since, 1.55, 2.1));
    const back = easeInOutCubic(span(since, 2.85, 3.3));
    const sigh = bump(span(since, 3.4, 4.6));
    const side = piece.position.x >= 0 ? -1 : 1;
    return {
      pitch: 0.1 * (first - back) + 0.26 * sigh - 0.1 * back,
      yaw: side * 0.8 * (first - 2 * swap + back),
      roll: daze + 0.12 * back,
    };
  }

  private blast(delta: number): void {
    const since = this.progress - FUSE_SECONDS - HIT_STOP_SECONDS;

    this.updatePickup();
    const pickup = this.pickup;

    for (const piece of this.pieces) {
      if (pickup?.piece === piece && pickup.wave.grabbed) {
        this.carry(pickup, delta);
        continue;
      }
      const { spin, turn, rest } = piece;
      const impact = advance(piece, FLOOR_Y + floorExtent(piece), delta);
      if (impact > 0) this.touchDown(piece, impact);

      spin.x += turn.x * delta;
      spin.y += turn.y * delta;
      spin.z += turn.z * delta;

      if (piece.bounces > 0) {
        const rate = piece.grounded ? 14 : 6;
        const act =
          piece.grounded && piece.spec.upright
            ? this.headAct(piece)
            : { pitch: 0, yaw: 0, roll: 0 };
        spin.x = damp(spin.x, rest.x + act.pitch, rate, delta);
        spin.y = damp(spin.y, rest.y + act.yaw, rate, delta);
        spin.z = damp(spin.z, rest.z + act.roll, rate, delta);
        if (piece.grounded) {
          turn.multiplyScalar(Math.exp(-12 * delta));
          piece.position.y = FLOOR_Y + floorExtent(piece);
        }
      }

      piece.quat.setFromEuler(spin);
      piece.part.scale.setScalar(
        lerp(piece.swell, 1, easeOutCubic(span(since, 0, 0.18))),
      );
      placePiece(piece);
    }
  }

  private rejoin(player: PlayerObject): void {
    const elapsed = this.progress - (this.stoppedAt ?? 0);
    let joined = 0;

    for (const piece of this.pieces) {
      const t = span(elapsed, piece.joinAt, piece.joinAt + JOIN_SECONDS);
      const distance = piece.fromPosition.distanceTo(piece.home);
      const hop = bump(t) * clamp(distance * 0.28, 0, 9);
      piece.position.lerpVectors(
        piece.fromPosition,
        piece.home,
        easeInOutCubic(t),
      );
      piece.position.y += hop;
      piece.quat.slerpQuaternions(
        piece.fromQuat,
        piece.homeQuat,
        easeOutCubic(span(t, 0, 0.85)),
      );
      piece.part.scale.setScalar(1);
      placePiece(piece);
      if (t >= 1) joined++;
    }

    const last = LAST_JOIN_AT + JOIN_SECONDS;
    const settle = span(elapsed, last - 0.04, last + SETTLE_SECONDS);
    const squash = 0.07 * bump(settle);
    player.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    player.position.set(0, -16 * squash, 0);
    player.rotation.set(0, 0, 0);

    if (joined === this.pieces.length && settle >= 1) this.finish();
  }
}
