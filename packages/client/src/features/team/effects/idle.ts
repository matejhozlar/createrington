import {
  PlayerAnimation,
  type PlayerObject,
  type SkinViewer,
} from "skinview3d";
import {
  bump,
  clamp,
  clamp01,
  damp,
  easeInOutCubic,
  easeInOutSine,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  lerp,
  prefersReducedMotion,
  rand,
  span,
} from "./core/math";
import {
  applyJoints,
  joints,
  layerJoints,
  mixJoints,
  REST_JOINTS,
  type Joints,
} from "./core/pose";
import { headPoint, type Point } from "./core/screen";
import { stage, type StageMember } from "./core/stage";

type Look = { yaw: number; pitch: number };

type Neighbor = { look: Look; notice: () => void };

type IdleHost = {
  focus(): Look | null;
  aim(point: Point): Look;
  neighbors(): Neighbor[];
};

type Cue = { at: number; run: () => void };

type Gesture = {
  length: number;
  pose(time: number): Joints;
  hipX?(time: number): number;
  cue?: Cue | undefined;
};

type Ease = (t: number) => number;

type Key = readonly [at: number, value: number, ease?: Ease];

type Segment = { start: number; end: number; from: Look; to: Look };

type GestureEntry = {
  weight: number;
  calm: boolean;
  create: (host: IdleHost) => Gesture;
};

const FOCUS_DEPTH_PX = 260;
const FOCUS_MAX_YAW = 1.1;
const FOCUS_MAX_PITCH_UP = 0.7;
const FOCUS_MAX_PITCH_DOWN = 0.5;
const ARM_SWAY = 0.03;
const ARM_SWAY_RATE = 1.5;
const BODY_YAW_SHARE = 0.2;
const BODY_YAW_RATE = 5;
const GLANCE_ARC = 0.06;
const NEIGHBOR_GLANCE_CHANCE = 0.4;
const SECOND_LOOK_CHANCE = 0.25;
const GLANCE_BACK_CHANCE = 0.4;
const ALERT_CHANCE = 0.7;
const CENTER: Look = { yaw: 0, pitch: 0 };

const SNEEZE_AT = 1.5;
const SNEEZE_LENGTH = 3.9;
const SNEEZE_HITCHES = [
  { at: 0.1, size: 0.4 },
  { at: 0.6, size: 0.3 },
  { at: 1, size: 0.3 },
] as const;
const SNEEZE_INHALE = joints({
  headX: -0.3,
  bodyX: -0.07,
  rightArmX: -0.55,
  rightArmZ: 0.1,
  posY: 0.4,
});
const SNEEZE_ACHOO = joints({
  headX: 0.55,
  bodyX: 0.22,
  leftArmX: -0.4,
  leftArmZ: -0.02,
  rightArmX: -1.65,
  rightArmZ: 0.38,
  leftLegX: 0.1,
  rightLegX: 0.1,
  posY: -0.6,
});

const WAKE_AT = 2.7;
const NOD_LENGTH = 3.9;
const DOZE_KEYS: readonly Key[] = [
  [0, 0],
  [1.4, 0.45],
  [1.75, 0.3, easeOutCubic],
  [WAKE_AT, 1, easeInQuad],
];
const DOZE = joints({
  headX: 0.5,
  bodyX: 0.07,
  leftArmZ: 0.03,
  rightArmZ: -0.03,
  posY: -0.2,
});
const JOLT = joints({
  headX: -0.2,
  bodyX: -0.04,
  leftArmZ: 0.22,
  rightArmZ: -0.22,
  posY: 0.35,
});

const STRETCH_GATHER = joints({
  headX: 0.06,
  bodyX: 0.03,
  leftArmX: 0.2,
  rightArmX: 0.2,
  posY: -0.15,
});
const STRETCH_BODY = joints({ headX: -0.24, bodyX: -0.09, posY: 0.35 });
const STRETCH_ARMS = joints({
  leftArmX: -2.85,
  leftArmZ: 0.21,
  rightArmX: -2.85,
  rightArmZ: -0.21,
});

const SCRATCH_RATE = 11;
const SCRATCH_ARM = joints({ rightArmX: -2.05, rightArmZ: 0.5 });
const SCRATCH_HEAD = joints({ headX: 0.06, headY: -0.14, headZ: 0.1 });

const JACK_READY = 0.4;
const JACK_HOPS = 10;
const JACK_PUSH = 0.07;
const JACK_AIR = 0.28;
const JACK_ABSORB = 0.07;
const JACK_HOP = JACK_PUSH + JACK_AIR + JACK_ABSORB;
const JACK_SETTLE = 0.35;
const JACK_DIP = 0.35;
const JACK_HEIGHT = 1.6;
const JACK_ARMS = joints({
  headX: -0.1,
  leftArmX: -2.9,
  leftArmZ: 0.62,
  rightArmX: -2.9,
  rightArmZ: -0.62,
});
const JACK_LEGS = joints({ leftLegZ: 0.3, rightLegZ: -0.3 });

const PEEK_LEAN_SECONDS = 1.2;
const PEEK_SCAN_KEYS: readonly Key[] = [
  [0, 0],
  [0.2, -0.22],
  [0.42, -0.22],
  [0.64, 0.2],
  [0.84, 0.2],
  [0.96, 0],
];
const PEEK = joints({
  headX: 0.15,
  headZ: 0.12,
  bodyX: 0.25,
  leftArmX: 0.3,
  rightArmX: 0.3,
  posY: -0.2,
});
const STARTLE_BODY = joints({ headX: -0.22, bodyX: -0.16, posY: 0.45 });
const STARTLE_ARMS = joints({
  leftArmX: -1.6,
  leftArmZ: 0.4,
  rightArmX: -1.6,
  rightArmZ: -0.4,
});

const TRIP_CATCH_AT = 0.18;
const TRIP_LOOK_AT = 0.55;
const TRIP_LOOK_KEYS: readonly Key[] = [
  [0, 0],
  [0.16, 0.28],
  [0.4, 0.28],
  [0.6, -0.26],
  [0.82, -0.26],
  [1, 0],
];
const TRIP_LURCH = joints({
  headX: 0.3,
  bodyX: 0.35,
  leftArmX: -0.8,
  leftArmZ: 0.26,
  rightArmX: -0.6,
  rightArmZ: -0.21,
  leftLegX: 0.45,
  rightLegX: -0.2,
  posY: -0.3,
});
const TRIP_CATCH = joints({
  headX: -0.15,
  bodyX: -0.1,
  leftArmX: -1,
  leftArmZ: 0.66,
  rightArmX: -1,
  rightArmZ: -0.66,
  leftLegX: 0.15,
  posY: 0.1,
});
const TRIP_STEADY = {
  ...TRIP_CATCH,
  leftArmX: -0.5,
  leftArmZ: 0.36,
  rightArmX: -0.5,
  rightArmZ: -0.36,
};

const GESTURES: readonly GestureEntry[] = [
  { weight: 0.38, calm: true, create: lookAround },
  { weight: 0.17, calm: true, create: shiftWeight },
  { weight: 0.08, calm: true, create: scratchHead },
  { weight: 0.08, calm: false, create: stretch },
  { weight: 0.07, calm: false, create: nodOff },
  { weight: 0.07, calm: false, create: jumpingJacks },
  { weight: 0.06, calm: false, create: peek },
  { weight: 0.05, calm: false, create: sneeze },
  { weight: 0.04, calm: false, create: trip },
];

function keyed(keys: readonly Key[], time: number): number {
  let [fromAt, from] = keys[0];
  if (time <= fromAt) return from;
  for (let i = 1; i < keys.length; i++) {
    const [at, value, ease = easeInOutSine] = keys[i];
    if (time < at) return lerp(from, value, ease(span(time, fromAt, at)));
    fromAt = at;
    from = value;
  }
  return from;
}

function side(): -1 | 1 {
  return Math.random() < 0.5 ? -1 : 1;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomLook(): Look {
  return { yaw: rand(-0.35, 0.35), pitch: rand(-0.125, 0.125) };
}

function alertNeighbors(host: IdleHost): void {
  for (const neighbor of host.neighbors()) {
    if (Math.random() < ALERT_CHANCE) neighbor.notice();
  }
}

function glance(
  looks: readonly Look[],
  turn: number,
  holds: readonly number[],
  delay = 0,
  cue?: Cue,
): Gesture {
  const segments: Segment[] = [];
  let time = delay;
  let from = CENTER;
  looks.forEach((look, index) => {
    segments.push({ start: time, end: time + turn, from, to: look });
    time += turn + holds[index];
    from = look;
  });
  segments.push({ start: time, end: time + turn, from, to: CENTER });

  return {
    length: time + turn,
    cue,
    pose(now) {
      let look = CENTER;
      let arc = 0;
      for (const segment of segments) {
        if (now < segment.start) break;
        const k = span(now, segment.start, segment.end);
        const eased = easeInOutCubic(k);
        const swing = Math.abs(segment.to.yaw - segment.from.yaw);
        look = {
          yaw: lerp(segment.from.yaw, segment.to.yaw, eased),
          pitch: lerp(segment.from.pitch, segment.to.pitch, eased),
        };
        arc = GLANCE_ARC * bump(k) * Math.min(swing / 0.5, 1);
      }
      return joints({ headX: look.pitch + arc, headY: look.yaw });
    },
  };
}

function lookAround(host: IdleHost): Gesture {
  const neighbors = host.neighbors();
  const neighbor =
    neighbors.length > 0 && Math.random() < NEIGHBOR_GLANCE_CHANCE
      ? pick(neighbors)
      : null;
  const looks = [neighbor ? neighbor.look : randomLook()];
  if (Math.random() < SECOND_LOOK_CHANCE) looks.push(randomLook());
  const turn = rand(0.7, 1.1);
  const holds = looks.map(() => rand(1, 2.5));
  const cue =
    neighbor && Math.random() < GLANCE_BACK_CHANCE
      ? { at: turn + 0.2, run: neighbor.notice }
      : undefined;
  return glance(looks, turn, holds, 0, cue);
}

function sneeze(host: IdleHost): Gesture {
  return {
    length: SNEEZE_LENGTH,
    cue: { at: SNEEZE_AT + 0.05, run: () => alertNeighbors(host) },
    pose(time) {
      let inhale = 0;
      for (const hitch of SNEEZE_HITCHES) {
        inhale +=
          hitch.size * easeOutBack(span(time, hitch.at, hitch.at + 0.3), 1.2);
      }
      inhale *= 1 - easeOutCubic(span(time, SNEEZE_AT, SNEEZE_AT + 0.12));
      const achoo =
        easeOutBack(span(time, SNEEZE_AT, SNEEZE_AT + 0.16), 1.4) *
        (1 - easeInOutCubic(span(time, 2.35, SNEEZE_LENGTH)));

      const pose = mixJoints(
        mixJoints(REST_JOINTS, SNEEZE_INHALE, inhale),
        SNEEZE_ACHOO,
        achoo,
      );
      pose.headX -= 0.1 * bump(span(time, 1.68, 2.1));
      return pose;
    },
  };
}

function nodOff(): Gesture {
  return {
    length: NOD_LENGTH,
    pose(time) {
      const doze =
        keyed(DOZE_KEYS, time) *
        (1 - easeOutCubic(span(time, WAKE_AT, WAKE_AT + 0.1)));
      const jolt =
        easeOutBack(span(time, WAKE_AT, WAKE_AT + 0.16), 1.6) *
        (1 - easeInOutCubic(span(time, WAKE_AT + 0.3, NOD_LENGTH)));
      const shake = span(time, WAKE_AT + 0.25, NOD_LENGTH);

      const pose = mixJoints(mixJoints(REST_JOINTS, DOZE, doze), JOLT, jolt);
      pose.headY += Math.sin(shake * Math.PI * 4) * 0.1 * (1 - shake);
      return pose;
    },
  };
}

function stretch(): Gesture {
  const hold = rand(1, 1.5);
  const release = 1.4 + hold;
  const length = release + 1.5;
  const lean = side();
  return {
    length,
    pose(time) {
      const gather = bump(span(time, 0, 0.5));
      const reach = easeInOutSine(span(time, 0.2, 1.4));
      const body =
        reach * (1 - easeInOutCubic(span(time, release, release + 1)));
      const arms =
        reach * (1 - easeInOutCubic(span(time, release + 0.15, length - 0.1)));
      const tilt = Math.sin(span(time, 1.4, release) * Math.PI) * lean;

      let pose = layerJoints(REST_JOINTS, STRETCH_GATHER, gather);
      pose = layerJoints(pose, STRETCH_BODY, body);
      pose = layerJoints(pose, STRETCH_ARMS, arms);
      pose.bodyZ += 0.07 * tilt;
      pose.headZ += 0.05 * tilt;
      pose.leftArmZ += 0.12 * tilt;
      pose.rightArmZ += 0.12 * tilt;
      pose.posY -= 0.15 * bump(span(time, length - 0.45, length));
      return pose;
    },
  };
}

function shiftWeight(): Gesture {
  const direction = side();
  const hold = rand(2, 4);
  const back = 0.9 + hold;
  const length = back + 0.9;
  const knee = joints({
    leftLegX: direction < 0 ? 0.15 : 0,
    rightLegX: direction > 0 ? 0.15 : 0,
    posY: -0.15,
  });
  const hips = joints({ bodyZ: 0.06 * direction, headZ: -0.04 * direction });
  const kneeWeight = (time: number) =>
    easeInOutSine(span(time, 0, 0.75)) *
    (1 - easeInOutSine(span(time, back, back + 0.75)));
  const hipWeight = (time: number) =>
    easeInOutSine(span(time, 0.12, 0.9)) *
    (1 - easeInOutSine(span(time, back + 0.12, length)));

  return {
    length,
    pose(time) {
      return layerJoints(
        layerJoints(REST_JOINTS, knee, kneeWeight(time)),
        hips,
        hipWeight(time),
      );
    },
    hipX: (time) => 0.3 * direction * hipWeight(time),
  };
}

function scratchHead(): Gesture {
  const lower = 0.6 + rand(1.2, 1.8);
  const length = lower + 0.85;
  return {
    length,
    pose(time) {
      const arm =
        easeInOutCubic(span(time, 0, 0.6)) *
        (1 - easeInOutCubic(span(time, lower, lower + 0.75)));
      const head =
        easeInOutSine(span(time, 0.1, 0.7)) *
        (1 - easeInOutSine(span(time, lower + 0.2, length)));
      const rub =
        easeInOutSine(span(time, 0.5, 0.7)) *
        (1 - easeInOutSine(span(time, lower - 0.15, lower + 0.05)));
      const phase = Math.max(time - 0.5, 0) * SCRATCH_RATE;

      const pose = layerJoints(
        layerJoints(REST_JOINTS, SCRATCH_ARM, arm),
        SCRATCH_HEAD,
        head,
      );
      pose.rightArmX += Math.sin(phase) * 0.11 * rub;
      pose.rightArmZ += (1 - Math.cos(phase)) * 0.03 * rub;
      pose.headZ += Math.sin(phase) * 0.015 * rub;
      return pose;
    },
  };
}

function jackFrame(
  time: number,
  hopsEnd: number,
): { height: number; legs: number; arms: number } {
  if (time < JACK_READY) {
    const crouch = easeInOutSine(span(time, 0, JACK_READY));
    return { height: -JACK_DIP * crouch, legs: 0, arms: 0 };
  }
  if (time >= hopsEnd) {
    const rise = easeInOutSine(span(time, hopsEnd, hopsEnd + JACK_SETTLE));
    return { height: -JACK_DIP * (1 - rise), legs: 0, arms: 0 };
  }

  const hopTime = time - JACK_READY;
  const hop = Math.floor(hopTime / JACK_HOP);
  const local = hopTime - hop * JACK_HOP;
  const from = hop % 2;
  const to = 1 - from;

  if (local < JACK_PUSH) {
    const push = easeInQuad(local / JACK_PUSH);
    return { height: -JACK_DIP * (1 - push), legs: from, arms: from };
  }
  const air = (local - JACK_PUSH) / JACK_AIR;
  if (air < 1) {
    return {
      height: JACK_HEIGHT * 4 * air * (1 - air),
      legs: lerp(from, to, easeInOutSine(air)),
      arms: lerp(from, to, easeInOutSine(Math.min(air * 1.15, 1))),
    };
  }
  const absorb = clamp01((local - JACK_PUSH - JACK_AIR) / JACK_ABSORB);
  return { height: -JACK_DIP * easeOutCubic(absorb), legs: to, arms: to };
}

function jumpingJacks(): Gesture {
  const hopsEnd = JACK_READY + JACK_HOPS * JACK_HOP;
  return {
    length: hopsEnd + JACK_SETTLE,
    pose(time) {
      const jump = jackFrame(time, hopsEnd);
      const pose = layerJoints(
        layerJoints(REST_JOINTS, JACK_LEGS, jump.legs),
        JACK_ARMS,
        jump.arms,
      );
      pose.posY += jump.height;
      pose.bodyX += 0.06 * clamp01(-jump.height / JACK_DIP);
      return pose;
    },
  };
}

function peek(): Gesture {
  const caught = PEEK_LEAN_SECONDS + rand(1.5, 2.5);
  const length = caught + 1.5;
  return {
    length,
    pose(time) {
      const lean =
        easeInOutSine(span(time, 0, PEEK_LEAN_SECONDS)) *
        (1 - easeOutCubic(span(time, caught, caught + 0.16)));
      const startle = easeOutBack(span(time, caught, caught + 0.24), 1.2);
      const body =
        startle * (1 - easeInOutCubic(span(time, caught + 0.3, caught + 1.2)));
      const arms =
        startle * (1 - easeInOutCubic(span(time, caught + 0.45, length)));

      let pose = mixJoints(REST_JOINTS, PEEK, lean);
      pose = layerJoints(pose, STARTLE_BODY, body);
      pose = layerJoints(pose, STARTLE_ARMS, arms);
      pose.headY += keyed(
        PEEK_SCAN_KEYS,
        span(time, PEEK_LEAN_SECONDS, caught),
      );
      pose.headX += 0.12 * bump(span(time, caught + 0.55, length));
      return pose;
    },
  };
}

function trip(host: IdleHost): Gesture {
  const recover = TRIP_LOOK_AT + rand(1.8, 2.5);
  const length = recover + 0.9;
  return {
    length,
    cue: { at: 0.12, run: () => alertNeighbors(host) },
    pose(time) {
      let pose = mixJoints(
        REST_JOINTS,
        TRIP_LURCH,
        easeOutCubic(span(time, 0, TRIP_CATCH_AT)),
      );
      pose = mixJoints(
        pose,
        TRIP_CATCH,
        easeOutBack(span(time, TRIP_CATCH_AT, 0.5), 1.3),
      );
      pose = mixJoints(
        pose,
        TRIP_STEADY,
        easeInOutSine(
          span(time, 0.6, TRIP_LOOK_AT + (recover - TRIP_LOOK_AT) * 0.6),
        ),
      );
      pose = mixJoints(
        pose,
        REST_JOINTS,
        easeInOutCubic(span(time, recover, length)),
      );

      const leftWheel = easeInOutSine(span(time, 0.2, 0.8));
      const rightWheel = easeInOutSine(span(time, 0.26, 0.86));
      if (leftWheel < 1) pose.leftArmX -= Math.PI * 2 * leftWheel;
      if (rightWheel < 1) pose.rightArmX -= Math.PI * 2 * rightWheel;
      pose.headY += keyed(
        TRIP_LOOK_KEYS,
        span(time, TRIP_LOOK_AT, recover + 0.4),
      );
      return pose;
    },
  };
}

function pickGesture(host: IdleHost): Gesture {
  const pool = prefersReducedMotion()
    ? GESTURES.filter((entry) => entry.calm)
    : GESTURES;
  let roll = Math.random() * pool.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.create(host);
  }
  return pool[0].create(host);
}

export class LookAroundIdleAnimation extends PlayerAnimation {
  private readonly host: IdleHost;
  private gesture: Gesture | null = null;
  private gestureStart = 0;
  private cued = false;
  private restUntil = rand(2, 8);
  private bodyYaw = 0;
  private focusWeight = 0;
  private focusYaw = 0;
  private focusPitch = 0;

  constructor(host: IdleHost) {
    super();
    this.host = host;
  }

  notice(point: Point): void {
    if (this.gesture || this.host.focus()) return;
    const look = this.host.aim(point);
    this.begin(
      glance([look], rand(0.45, 0.6), [rand(0.9, 1.6)], rand(0.15, 0.4)),
    );
  }

  protected animate(player: PlayerObject, delta: number): void {
    const focus = this.host.focus();
    this.focusWeight = damp(this.focusWeight, focus ? 1 : 0, 7, delta);
    if (focus) {
      this.focusYaw = damp(this.focusYaw, focus.yaw, 12, delta);
      this.focusPitch = damp(this.focusPitch, focus.pitch, 12, delta);
    }

    if (!this.gesture && !focus && this.progress >= this.restUntil) {
      this.begin(pickGesture(this.host));
    }

    const { pose, hipX } = this.frame();
    const sway = Math.cos(this.progress * ARM_SWAY_RATE) * ARM_SWAY;
    const yaw = lerp(pose.headY, this.focusYaw, this.focusWeight);
    this.bodyYaw = damp(
      this.bodyYaw,
      yaw * BODY_YAW_SHARE,
      BODY_YAW_RATE,
      delta,
    );

    applyJoints(player, {
      ...pose,
      headX: lerp(pose.headX, this.focusPitch, this.focusWeight),
      headY: yaw,
      bodyY: pose.bodyY + this.bodyYaw,
      leftArmZ: pose.leftArmZ + sway,
      rightArmZ: pose.rightArmZ - sway,
    });
    player.position.x = hipX;
  }

  private begin(gesture: Gesture): void {
    this.gesture = gesture;
    this.gestureStart = this.progress;
    this.cued = false;
  }

  private frame(): { pose: Joints; hipX: number } {
    const gesture = this.gesture;
    if (!gesture) return { pose: REST_JOINTS, hipX: 0 };

    const time = this.progress - this.gestureStart;
    if (gesture.cue && !this.cued && time >= gesture.cue.at) {
      this.cued = true;
      gesture.cue.run();
    }
    if (time >= gesture.length) {
      this.gesture = null;
      this.restUntil = this.progress + rand(4, 10);
      return { pose: REST_JOINTS, hipX: 0 };
    }
    return { pose: gesture.pose(time), hipX: gesture.hipX?.(time) ?? 0 };
  }
}

function aim(viewer: SkinViewer, point: Point): Look {
  const head = headPoint(viewer);
  return {
    yaw: clamp(
      Math.atan2(point.x - head.x, FOCUS_DEPTH_PX),
      -FOCUS_MAX_YAW,
      FOCUS_MAX_YAW,
    ),
    pitch: clamp(
      Math.atan2(point.y - head.y, FOCUS_DEPTH_PX * 1.4),
      -FOCUS_MAX_PITCH_UP,
      FOCUS_MAX_PITCH_DOWN,
    ),
  };
}

function nearestNeighbors(
  viewer: SkinViewer,
  username: string,
): { member: StageMember; point: Point }[] {
  const head = headPoint(viewer);
  const nearest = new Map<
    number,
    { member: StageMember; point: Point; distance: number }
  >();
  for (const member of stage.others(username)) {
    const point = headPoint(member.viewer);
    const direction = Math.sign(point.x - head.x);
    const distance = Math.hypot(point.x - head.x, point.y - head.y);
    const best = nearest.get(direction);
    if (direction !== 0 && (!best || distance < best.distance)) {
      nearest.set(direction, { member, point, distance });
    }
  }
  return [...nearest.values()];
}

export function createIdleAnimation(
  viewer: SkinViewer,
  username: string,
): LookAroundIdleAnimation {
  return new LookAroundIdleAnimation({
    focus: () => {
      const point = stage.attentionFor(username);
      return point ? aim(viewer, point) : null;
    },
    aim: (point) => aim(viewer, point),
    neighbors: () =>
      nearestNeighbors(viewer, username).map(({ member, point }) => ({
        look: aim(viewer, point),
        notice: () => member.notice(headPoint(viewer)),
      })),
  });
}
