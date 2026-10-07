import { PlayerAnimation, type PlayerObject } from "skinview3d";
import { bump, clamp, easeInOutCubic, easeOutBack, span } from "./core/math";
import {
  applyJoints,
  joints,
  mixJoints,
  REST_JOINTS,
  symmetric,
  type Joints,
} from "./core/pose";
import { stage, type GuestAnimation } from "./core/stage";

const BEAT_SECONDS = 0.5;
const PHRASE_BEATS = 8;
const DANCE_BEATS = PHRASE_BEATS * 4;
const DANCE_SECONDS = DANCE_BEATS * BEAT_SECONDS;
const BOW_SECONDS = 2;
const SHOW_SECONDS = DANCE_SECONDS + BOW_SECONDS;
const HIT_SHARE = 0.4;
const SPIN_CANON_BEATS = 0.75;
const SPIN_BEATS = 1.1;
const TRAVEL_UNITS = 3.2;
const WAVE_CANON_BEATS = 2.25;
const WAVE_BEATS = 1.5;
const FINAL_SPIN_START = 4;
const FINAL_SPIN_END = 5.6;
const FINAL_HIT = 6;

type Dancer = { place: number; mirror: 1 | -1 };

type Frame = { pose: Joints; travel: number; turn: number; squash: number };

const ARMS_OUT = symmetric({ armX: -1, armZ: 0.8 });
const ARMS_UP = symmetric({ headX: -0.28, armX: -2.9, armZ: 0.4, legZ: 0.14 });
const CLAP = symmetric({ headX: -0.2, armX: -2.95, armZ: -0.22, legZ: 0.2 });

const BOW = joints({
  headX: 0.3,
  bodyX: 0.46,
  leftArmX: 0.3,
  leftArmZ: -0.14,
  rightArmX: 0.3,
  rightArmZ: 0.14,
  posY: -0.35,
});

function hit(fraction: number): number {
  return easeOutBack(span(fraction, 0, HIT_SHARE), 1.4);
}

function dip(beat: number): number {
  return 0.5 + 0.5 * Math.cos(beat * Math.PI * 2);
}

function groove(beat: number, amount: number): Joints {
  const down = dip(beat) * amount;
  const sway = Math.sin(beat * Math.PI) * amount;
  return joints({
    headX: 0.06 * down,
    headZ: -0.05 * sway,
    bodyX: 0.03 * down,
    bodyZ: 0.06 * sway,
    leftArmX: 0.14 * sway,
    leftArmZ: 0.1,
    rightArmX: -0.14 * sway,
    rightArmZ: -0.1,
    posY: -0.55 * down,
  });
}

function addGroove(pose: Joints, beat: number, amount: number): Joints {
  const layer = groove(beat, amount);
  return {
    ...pose,
    headX: pose.headX + layer.headX,
    headZ: pose.headZ + layer.headZ,
    bodyX: pose.bodyX + layer.bodyX,
    bodyZ: pose.bodyZ + layer.bodyZ,
    posY: pose.posY + layer.posY,
  };
}

function pointUp(mirror: number): Joints {
  const lead = { x: -2.65, z: -0.45 * mirror };
  const hip = { x: 0.15, z: 0.4 * mirror };
  return joints({
    headX: -0.22,
    headY: -0.3 * mirror,
    bodyY: -0.12 * mirror,
    bodyZ: 0.09 * mirror,
    rightArmX: mirror > 0 ? lead.x : hip.x,
    rightArmZ: mirror > 0 ? lead.z : hip.z,
    leftArmX: mirror > 0 ? hip.x : lead.x,
    leftArmZ: mirror > 0 ? hip.z : lead.z,
    leftLegZ: mirror > 0 ? 0.18 : 0,
    rightLegZ: mirror > 0 ? 0 : -0.18,
  });
}

function pointDown(mirror: number): Joints {
  const lead = { x: -0.7, z: 0.75 * mirror };
  const hip = { x: 0.15, z: 0.4 * mirror };
  return joints({
    headX: 0.2,
    headY: 0.25 * mirror,
    bodyY: 0.12 * mirror,
    bodyZ: -0.09 * mirror,
    rightArmX: mirror > 0 ? lead.x : hip.x,
    rightArmZ: mirror > 0 ? lead.z : hip.z,
    leftArmX: mirror > 0 ? hip.x : lead.x,
    leftArmZ: mirror > 0 ? hip.z : lead.z,
    leftLegX: mirror > 0 ? 0 : -0.15,
    rightLegX: mirror > 0 ? -0.15 : 0,
    posY: -0.3,
  });
}

function pointPhrase(local: number, dancer: Dancer): Frame {
  const step = Math.floor(local);
  const up = pointUp(dancer.mirror);
  const down = pointDown(dancer.mirror);
  const target = step % 2 === 0 ? up : down;
  const previous = step === 0 ? groove(local, 1) : step % 2 === 0 ? down : up;
  let pose = mixJoints(previous, target, hit(local - step));
  pose = addGroove(pose, local, 0.6);

  const spinStart = 6 + dancer.place * SPIN_CANON_BEATS;
  const spinEnd = spinStart + SPIN_BEATS;
  const spin = span(local, spinStart, spinEnd);
  const spinWeight =
    span(local, spinStart - 0.25, spinStart + 0.15) *
    (1 - span(local, spinEnd - 0.1, spinEnd + 0.3));
  pose = mixJoints(pose, ARMS_OUT, spinWeight);
  pose.posY += bump(spin) * 1.1;

  return {
    pose,
    travel: 0,
    turn: easeInOutCubic(spin) * Math.PI * 2 * dancer.mirror,
    squash: bump(span(local, spinEnd, spinEnd + 0.5)),
  };
}

function stepPhrase(local: number): Frame {
  const side = Math.sin(local * Math.PI);
  const punch = Math.sign(side) * Math.abs(side) ** 0.6;
  const drift = Math.sin((local * Math.PI) / 2);
  const heading = Math.cos((local * Math.PI) / 2);
  const stepping = 1 - span(local, 5.6, 6);

  let pose = joints({
    headX: 0.04,
    headY: 0.26 * heading,
    bodyY: 0.16 * punch,
    bodyZ: -0.08 * heading,
    leftArmX: -1.15 - 0.65 * punch,
    leftArmZ: -0.1,
    rightArmX: -1.15 + 0.65 * punch,
    rightArmZ: 0.1,
    leftLegZ: 0.28 * Math.max(side, 0),
    rightLegZ: -0.28 * Math.max(-side, 0),
  });
  pose = mixJoints(groove(local, 1), pose, span(local, 0, 0.4) * stepping);
  pose = addGroove(pose, local, 0.8 * stepping);

  const clapBeat = local - Math.floor(local);
  const clapping = span(local, 5.8, 6.1);
  const landed = clapping * (1 - bump(clapBeat));
  pose = mixJoints(pose, CLAP, clapping * hit(clapBeat));
  pose.posY += 1.8 * bump(clapBeat) * clapping - 0.6 * landed;

  return {
    pose,
    travel: TRAVEL_UNITS * drift * stepping,
    turn: 0,
    squash: landed * 0.6,
  };
}

function wavePhrase(local: number, dancer: Dancer): Frame {
  const delay = dancer.place * WAVE_CANON_BEATS;
  const lift =
    bump(span(local, delay, delay + WAVE_BEATS)) +
    bump(span(local, 4 + delay, 4 + delay + WAVE_BEATS));
  const coil =
    bump(span(local, delay - 0.45, delay + 0.1)) +
    bump(span(local, 4 + delay - 0.45, 4 + delay + 0.1));
  const front = (local % 4) / WAVE_CANON_BEATS;
  const watch = clamp((front - dancer.place) * 1.1, -0.5, 0.5) * (1 - lift);

  let pose = addGroove(groove(local, 1), local, 0.3);
  pose.headY = watch;
  pose = mixJoints(pose, ARMS_UP, easeOutBack(clamp(lift * 1.4, 0, 1), 1.2));
  pose.posY += 2.4 * lift - 0.9 * coil;

  return { pose, travel: 0, turn: 0, squash: coil * 0.7 };
}

function finalePhrase(local: number, dancer: Dancer): Frame {
  const jumping = 1 - span(local, FINAL_SPIN_START - 0.3, FINAL_SPIN_START);
  const air = Math.abs(Math.sin(local * Math.PI)) * jumping;
  const spin = span(local, FINAL_SPIN_START, FINAL_SPIN_END);
  const spinWeight =
    span(local, FINAL_SPIN_START - 0.3, FINAL_SPIN_START + 0.1) *
    (1 - span(local, FINAL_SPIN_END - 0.1, FINAL_HIT));
  const finish = easeOutBack(span(local, FINAL_HIT - 0.2, FINAL_HIT + 0.25), 2);
  const nod = bump(span(local, 7, 7.5));

  const roof = { ...ARMS_UP };
  roof.leftArmX += 0.5 * (1 - air);
  roof.rightArmX += 0.5 * (1 - air);
  roof.posY = 1.7 * air;

  let pose = mixJoints(groove(local, 1), roof, span(local, 0, 0.35) * jumping);
  pose = mixJoints(pose, ARMS_OUT, spinWeight);
  pose.posY += bump(spin) * 1.2;
  pose = mixJoints(pose, pointUp(dancer.mirror), finish);
  pose.headX += 0.14 * nod;
  pose.posY -= 0.4 * nod * finish;

  return {
    pose,
    travel: 0,
    turn: easeInOutCubic(spin) * Math.PI * 2 * dancer.mirror,
    squash:
      (1 - Math.abs(Math.sin(local * Math.PI))) * 0.45 * jumping +
      bump(span(local, FINAL_SPIN_END, FINAL_HIT + 0.3)),
  };
}

function danceFrame(beat: number, dancer: Dancer): Frame {
  const phrase = Math.floor(beat / PHRASE_BEATS);
  const local = beat - phrase * PHRASE_BEATS;
  if (phrase === 0) return pointPhrase(local, dancer);
  if (phrase === 1) return stepPhrase(local);
  if (phrase === 2) return wavePhrase(local, dancer);
  return finalePhrase(local, dancer);
}

class DiscoAnimation extends PlayerAnimation implements GuestAnimation {
  private readonly startedAt: number;
  private readonly dancer: Dancer;
  private readonly done: () => void;

  constructor(startedAt: number, dancer: Dancer, done: () => void) {
    super();
    this.startedAt = startedAt;
    this.dancer = dancer;
    this.done = done;
  }

  protected animate(player: PlayerObject): void {
    const time = (performance.now() - this.startedAt) / 1000;
    if (time >= SHOW_SECONDS) {
      this.done();
      return;
    }

    if (time >= DANCE_SECONDS) {
      const bow = (time - DANCE_SECONDS) / BOW_SECONDS;
      const release = easeInOutCubic(span(bow, 0, 0.3));
      const depth =
        easeInOutCubic(span(bow, 0.1, 0.4)) *
        (1 - easeInOutCubic(span(bow, 0.68, 1)));
      const held = pointUp(this.dancer.mirror);
      applyJoints(
        player,
        mixJoints(mixJoints(held, REST_JOINTS, release), BOW, depth),
      );
      player.position.x = 0;
      player.rotation.y = 0;
      player.scale.set(1, 1, 1);
      return;
    }

    const enter = easeInOutCubic(span(time, 0, 0.3));
    const frame = danceFrame(time / BEAT_SECONDS, this.dancer);
    const squash = frame.squash * 0.09;
    applyJoints(player, mixJoints(REST_JOINTS, frame.pose, enter));
    player.position.x = frame.travel * enter;
    player.position.y -= 16 * squash;
    player.rotation.y = frame.turn;
    player.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
  }
}

export function startDisco(): void {
  const startedAt = performance.now();
  const members = stage.all().sort((first, second) => {
    const a = first.viewer.canvas.getBoundingClientRect();
    const b = second.viewer.canvas.getBoundingClientRect();
    return a.top - b.top || a.left - b.left;
  });

  const last = Math.max(members.length - 1, 1);

  members.forEach((member, index) => {
    const mirror = index < members.length / 2 ? 1 : -1;
    member.playGuest(
      (_viewer, done) =>
        new DiscoAnimation(startedAt, { place: index / last, mirror }, done),
    );
  });
}
