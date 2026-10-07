import {
  PlayerAnimation,
  type PlayerObject,
  type SkinViewer,
} from "skinview3d";
import { Euler, Vector3 } from "three";
import { TeamEffect, type EffectContext } from "./core/effect";
import {
  bump,
  clamp,
  damp,
  easeInBack,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  lerp,
  rand,
  span,
} from "./core/math";
import { dustBurst, poof } from "./core/particles";
import {
  applyJoints,
  joints,
  mixJoints,
  resetPlayer,
  REST_JOINTS,
} from "./core/pose";
import {
  groundPoint,
  pixelsPerUnit,
  toViewport,
  type Point,
} from "./core/screen";
import {
  stage,
  type GuestAnimation,
  type GuestHandle,
  type StageMember,
} from "./core/stage";

const BODY_PARTS = [
  { name: "leftLeg", at: 0.06, centerY: -6 },
  { name: "rightLeg", at: 0.13, centerY: -6 },
  { name: "body", at: 0.21, centerY: 0 },
  { name: "leftArm", at: 0.27, centerY: -4 },
  { name: "rightArm", at: 0.33, centerY: -4 },
] as const;

const PART_SHRINK_SECONDS = 0.13;
const HOVER_END = 0.74;
const HEAD_HALF_UNITS = 4.5;
const HEAD_REST_Y = 4;
const HEAD_GROUND_Y = -20;
const HEAD_FLIGHT_Y = -8;
const FALL_GRAVITY = 540;
const FALL_RESTITUTION = 0.38;
const FALL_SETTLE_SPEED = 9;
const SELF_LAUNCH_SECONDS = 0.7;
const KICK_TIMEOUT_SECONDS = 4;
const HIT_STOP_SECONDS = 0.07;
const LAUNCH_SPEED = 1900;
const CRUISE_SPEED = 330;
const SPEED_DECAY = 2.2;
const LAUNCH_ANGLE = 0.6;
const REFORM_SECONDS = 0.45;
const ROW_TOLERANCE = 0.5;

const KICK_TURN_SECONDS = 0.25;
const KICK_WALK_SPEED = 300;
const KICK_WIND_SECONDS = 0.2;
const KICK_SWING_SECONDS = 0.1;
const KICK_HOLD_SECONDS = 0.32;
const KICK_REACH_UNITS = 11;

const WIND_UP = joints({
  headX: 0.3,
  bodyX: -0.18,
  rightLegX: 0.78,
  leftLegX: -0.1,
  leftArmX: -0.7,
  rightArmX: 0.5,
  posY: -0.4,
});

const FOLLOW_THROUGH = joints({
  headX: 0.2,
  bodyX: -0.32,
  rightLegX: -1.75,
  leftLegX: 0.08,
  leftArmX: 0.65,
  leftArmZ: 0.3,
  rightArmX: -0.95,
  rightArmZ: -0.3,
  posY: 0.9,
});

class KickAnimation extends PlayerAnimation implements GuestAnimation {
  private readonly viewer: SkinViewer;
  private readonly card: HTMLElement | null;
  private readonly side: -1 | 1;
  private readonly walkPx: number;
  private readonly onConnect: () => void;
  private readonly done: () => void;
  private readonly walkSeconds: number;
  private connected = false;

  constructor(
    viewer: SkinViewer,
    card: HTMLElement | null,
    side: -1 | 1,
    walkPx: number,
    onConnect: () => void,
    done: () => void,
  ) {
    super();
    this.viewer = viewer;
    this.card = card;
    this.side = side;
    this.walkPx = walkPx;
    this.onConnect = onConnect;
    this.done = done;
    this.walkSeconds = clamp(walkPx / KICK_WALK_SPEED, 0.3, 0.85);
    if (card) card.style.zIndex = "2";
  }

  protected animate(player: PlayerObject): void {
    const time = this.progress;
    const walkStart = KICK_TURN_SECONDS;
    const windStart = walkStart + this.walkSeconds;
    const swingStart = windStart + KICK_WIND_SECONDS;
    const holdStart = swingStart + KICK_SWING_SECONDS;
    const backStart = holdStart + KICK_HOLD_SECONDS;
    const backSeconds = Math.max(this.walkSeconds * 0.85, 0.45);

    const turn = easeInOutCubic(span(time, 0, KICK_TURN_SECONDS));
    const walk = span(time, walkStart, windStart);
    const wind = easeOutCubic(span(time, windStart, swingStart));
    const swing = span(time, swingStart, holdStart);
    const settle = easeInOutCubic(span(time, holdStart + 0.12, backStart));
    const back = span(time, backStart, backStart + backSeconds);
    const backEased = easeInOutCubic(back);

    const stride =
      Math.min(walk * 6, (1 - walk) * 6, 1) +
      Math.min(back * 6, (1 - back) * 6, 1) * 0.8;
    const step = Math.sin(time * 11);

    let pose = joints({
      headX: 0.22 * turn * (1 - backEased),
      bodyX: 0.08 * stride,
      leftLegX: step * 0.55 * stride,
      rightLegX: -step * 0.55 * stride,
      leftArmX: -step * 0.4 * stride,
      rightArmX: step * 0.4 * stride,
      posY: Math.abs(step) * 0.5 * stride,
    });
    pose = mixJoints(pose, WIND_UP, wind * (1 - settle));
    pose = mixJoints(pose, FOLLOW_THROUGH, easeOutBack(swing) * (1 - settle));
    applyJoints(player, pose);

    player.rotation.y = (this.side * Math.PI * turn * (1 - backEased)) / 2;
    const slide =
      this.side * this.walkPx * easeInOutSine(walk) * (1 - backEased);
    this.viewer.canvas.style.transform = `translateX(${slide.toFixed(1)}px)`;

    if (swing >= 0.5 && !this.connected) {
      this.connected = true;
      this.onConnect();
    }
    if (back >= 1) this.done();
  }

  dispose(): void {
    const canvas = this.viewer.canvas;
    canvas.style.transition = "transform 0.25s ease-out";
    canvas.style.transform = "";
    window.setTimeout(() => {
      canvas.style.transition = "";
    }, 260);
    if (this.card) this.card.style.zIndex = "";
  }
}

type Mode = "crumble" | "wait" | "fly" | "reform";

type Kicker = { member: StageMember; headSide: -1 | 1; distance: number };

export class HeadKickEffect extends TeamEffect {
  private readonly unit: number;
  private readonly center = new Vector3(0, HEAD_REST_Y, 0);
  private readonly spin = new Euler();
  private readonly scratch = new Vector3();
  private mode: Mode = "crumble";
  private modeStart = 0;
  private poofed = 0;
  private fallSpeed = 0;
  private landed = false;
  private landedAt = 0;
  private kick: GuestHandle | null = null;
  private watchSide: -1 | 1 = 1;
  private launchSide: -1 | 1 = -1;
  private launchAt: number | null = null;
  private homeParent: HTMLElement | null = null;
  private homeStyle: { position: string; left: string; top: string } | null =
    null;
  private anchor: Point = { x: 0, y: 0 };
  private position: Point = { x: 0, y: 0 };
  private direction: Point = { x: 0, y: 0 };
  private turn = { x: 0, y: 0, z: 0 };
  private squash: Point = { x: 0, y: 0 };
  private flightTime = 0;
  private reformFromFlight = false;
  private reformScales: number[] = [];

  constructor(context: EffectContext) {
    super(context);
    this.unit = pixelsPerUnit(this.viewer);
    if (this.card) this.card.style.zIndex = "9999";
    stage.focus(this.username, () => this.headPoint());
  }

  protected animate(player: PlayerObject, delta: number): void {
    if (this.mode === "crumble") this.crumble(player, delta);
    else if (this.mode === "wait") this.wait(player);
    else if (this.mode === "fly") this.fly(player, delta);
    else this.reform(player);
  }

  protected onStop(): void {
    stage.blur(this.username);
    this.cancelKick();
    this.reformFromFlight = this.mode === "fly";
    if (this.reformFromFlight) {
      poof(this.position, this.unit, 12);
      this.restoreCanvas();
    }
    const skin = this.viewer.playerObject.skin;
    this.reformScales = BODY_PARTS.map((entry) =>
      skin[entry.name].visible ? skin[entry.name].scale.x : 0,
    );
    this.enter("reform");
  }

  dispose(): void {
    stage.blur(this.username);
    this.cancelKick();
    this.restoreCanvas();
    resetPlayer(this.viewer.playerObject);
    this.viewer.canvas.style.transform = "";
    if (this.card) this.card.style.zIndex = "";
  }

  private enter(mode: Mode): void {
    this.mode = mode;
    this.modeStart = this.progress;
  }

  private cancelKick(): void {
    this.kick?.cancel();
    this.kick = null;
  }

  private headPoint(): Point {
    if (this.mode === "fly") return this.position;
    return toViewport(
      this.viewer,
      this.viewer.playerObject.skin,
      this.center.x,
      this.center.y,
      this.center.z,
    );
  }

  private placeHead(player: PlayerObject): void {
    const head = player.skin.head;
    head.rotation.copy(this.spin);
    this.scratch.set(0, HEAD_REST_Y, 0).applyEuler(this.spin);
    head.position.copy(this.center).sub(this.scratch);
  }

  private crumble(player: PlayerObject, delta: number): void {
    const time = this.progress;
    const skin = player.skin;

    BODY_PARTS.forEach((entry, index) => {
      const part = skin[entry.name];
      const shrink = easeInBack(
        span(time, entry.at, entry.at + PART_SHRINK_SECONDS),
      );
      part.scale.setScalar(Math.max(1 - shrink, 0.001));
      part.visible = shrink < 1;
      if (shrink >= 0.5 && this.poofed === index) {
        this.poofed++;
        poof(toViewport(this.viewer, part, 0, entry.centerY, 0), this.unit, 6);
      }
    });

    const startle = bump(span(time, 0, 0.22));
    const lookDown = easeInOutCubic(span(time, 0.38, 0.56));
    const gulp = easeInOutCubic(span(time, HOVER_END - 0.12, HOVER_END));
    const hover =
      span(time, 0.3, 0.55) * (1 - span(time, HOVER_END, HOVER_END + 0.05));

    if (time < HOVER_END) {
      this.center.y =
        HEAD_REST_Y + startle * 0.8 + Math.sin(time * 19) * 0.22 * hover;
      this.spin.set(
        -0.25 * startle + 0.55 * lookDown * (1 - gulp) - 0.12 * gulp,
        0,
        0,
      );
    } else if (!this.landed) {
      this.fallSpeed -= FALL_GRAVITY * delta;
      this.center.y += this.fallSpeed * delta;
      this.spin.x = damp(this.spin.x, 0.1, 10, delta);
      this.spin.z = 0.4 * span(time, HOVER_END, HOVER_END + 0.3);
      if (this.center.y <= HEAD_GROUND_Y) this.bounce();
    }

    if (this.landed) {
      const since = time - this.landedAt;
      this.center.y = HEAD_GROUND_Y;
      this.spin.z = 0.4 * Math.exp(-6 * since) * Math.cos(since * 15);
      if (since > 0.25) this.requestKick();
    }

    this.placeHead(player);
  }

  private bounce(): void {
    this.center.y = HEAD_GROUND_Y;
    const impact = Math.abs(this.fallSpeed);
    this.fallSpeed = impact * FALL_RESTITUTION;
    if (impact > 60) {
      const ground = groundPoint(this.viewer);
      dustBurst(ground, this.unit, 6, 0.5);
    }
    if (this.fallSpeed < FALL_SETTLE_SPEED) {
      this.landed = true;
      this.landedAt = this.progress;
    }
  }

  private findKicker(): Kicker | null {
    const mine = this.viewer.canvas.getBoundingClientRect();
    const mineX = mine.left + mine.width / 2;
    const mineY = mine.top + mine.height / 2;
    let best: Kicker | null = null;
    for (const member of stage.others(this.username)) {
      if (member.isBusy()) continue;
      const rect = member.viewer.canvas.getBoundingClientRect();
      const offsetX = rect.left + rect.width / 2 - mineX;
      const offsetY = rect.top + rect.height / 2 - mineY;
      if (Math.abs(offsetY) > mine.height * ROW_TOLERANCE) continue;
      const distance = Math.abs(offsetX);
      const closer = !best || distance < best.distance - 1;
      const tieOnRight =
        best !== null && distance < best.distance + 1 && offsetX > 0;
      if (closer || tieOnRight) {
        best = { member, headSide: offsetX > 0 ? -1 : 1, distance };
      }
    }
    return best;
  }

  private requestKick(): void {
    this.enter("wait");
    const kicker = this.findKicker();
    if (!kicker) return;

    this.watchSide = kicker.headSide > 0 ? -1 : 1;
    this.launchSide = kicker.headSide;
    const walkPx = Math.max(kicker.distance - KICK_REACH_UNITS * this.unit, 0);
    this.kick = kicker.member.playGuest(
      (viewer, done) =>
        new KickAnimation(
          viewer,
          kicker.member.card,
          kicker.headSide,
          walkPx,
          () => this.connect(),
          done,
        ),
    );
  }

  private wait(player: PlayerObject): void {
    const since = this.progress - this.modeStart;
    const dread = span(since, 0.1, 0.9);

    if (this.launchAt === null) {
      const timeout = this.kick ? KICK_TIMEOUT_SECONDS : SELF_LAUNCH_SECONDS;
      if (since >= timeout) this.connect();
      this.center.set(Math.sin(since * 47) * 0.18 * dread, HEAD_GROUND_Y, 0);
      this.spin.set(
        -0.12 * dread,
        this.watchSide * 0.75 * easeInOutCubic(span(since, 0, 0.35)),
        Math.sin(since * 31) * 0.04 * dread,
      );
      player.scale.set(1, 1, 1);
    } else {
      const crush = span(
        this.progress,
        this.launchAt - HIT_STOP_SECONDS,
        this.launchAt,
      );
      player.scale.set(1 - 0.3 * crush, 1, 1);
      if (this.progress >= this.launchAt) {
        this.launch(player);
        return;
      }
    }

    this.placeHead(player);
  }

  private connect(): void {
    if (this.mode !== "wait" || this.launchAt !== null) return;
    this.launchAt = this.progress + HIT_STOP_SECONDS;
    const point = this.headPoint();
    poof(
      {
        x: point.x - this.launchSide * HEAD_HALF_UNITS * this.unit,
        y: point.y,
      },
      this.unit,
      6,
    );
  }

  private launch(player: PlayerObject): void {
    const start = this.headPoint();
    const canvas = this.viewer.canvas;

    this.center.set(0, HEAD_FLIGHT_Y, 0);
    player.position.set(0, 0, 0);
    player.scale.set(1, 1, 1);
    this.placeHead(player);

    this.homeParent = canvas.parentElement;
    this.homeStyle = {
      position: canvas.style.position,
      left: canvas.style.left,
      top: canvas.style.top,
    };
    document.body.appendChild(canvas);
    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "9999";
    canvas.style.transform = "";

    const origin = toViewport(this.viewer, player, 0, 0, 0);
    this.anchor = origin;
    this.position = start;
    this.direction = {
      x: this.launchSide * Math.cos(LAUNCH_ANGLE),
      y: -Math.sin(LAUNCH_ANGLE),
    };
    this.turn = {
      x: rand(5, 8),
      y: rand(2, 4),
      z: -this.launchSide * rand(8, 11),
    };
    this.flightTime = 0;
    this.enter("fly");
    this.fly(player, 0);
  }

  private fly(player: PlayerObject, delta: number): void {
    this.flightTime += delta;
    const speed =
      CRUISE_SPEED +
      (LAUNCH_SPEED - CRUISE_SPEED) * Math.exp(-SPEED_DECAY * this.flightTime);
    const radius = HEAD_HALF_UNITS * this.unit;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;

    this.position.x += this.direction.x * speed * delta;
    this.position.y += this.direction.y * speed * delta;

    if (this.position.x < radius || this.position.x > width - radius) {
      this.position.x = clamp(this.position.x, radius, width - radius);
      this.direction.x *= -1;
      this.hitWall("x", speed);
    }
    if (this.position.y < radius || this.position.y > height - radius) {
      this.position.y = clamp(this.position.y, radius, height - radius);
      this.direction.y *= -1;
      this.hitWall("y", speed);
    }

    const cruise = 1 - Math.exp(-1.6 * this.flightTime);
    this.turn.x = damp(this.turn.x, Math.sign(this.turn.x) * 1.3, 1.6, delta);
    this.turn.y = damp(this.turn.y, Math.sign(this.turn.y) * 0.9, 1.6, delta);
    this.turn.z = damp(this.turn.z, Math.sign(this.turn.z) * 2.2, 1.6, delta);
    this.spin.x += this.turn.x * delta;
    this.spin.y += this.turn.y * delta;
    this.spin.z += this.turn.z * delta;

    this.squash.x = damp(this.squash.x, 0, 11, delta);
    this.squash.y = damp(this.squash.y, 0, 11, delta);
    const stretch = 0.12 * (1 - cruise);
    player.scale.set(
      1 - this.squash.x * 0.4 + this.squash.y * 0.18 + stretch,
      1 - this.squash.y * 0.4 + this.squash.x * 0.18,
      1,
    );

    this.placeHead(player);
    this.viewer.canvas.style.transform = `translate(${(this.position.x - this.anchor.x).toFixed(1)}px, ${(this.position.y - this.anchor.y).toFixed(1)}px)`;
  }

  private hitWall(axis: "x" | "y", speed: number): void {
    const force = clamp(speed / LAUNCH_SPEED, 0.25, 1);
    this.squash[axis] = lerp(0.45, 1, force);
    this.turn.z = (this.turn.z > 0 ? -1 : 1) * rand(3, 5 + 6 * force);
    this.turn.x = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 2 + 5 * force);
  }

  private restoreCanvas(): void {
    const canvas = this.viewer.canvas;
    if (this.homeParent && this.homeStyle) {
      this.homeParent.appendChild(canvas);
      canvas.style.position = this.homeStyle.position;
      canvas.style.left = this.homeStyle.left;
      canvas.style.top = this.homeStyle.top;
      canvas.style.zIndex = "";
      canvas.style.transform = "";
    }
    this.homeParent = null;
    this.homeStyle = null;
  }

  private reform(player: PlayerObject): void {
    const skin = player.skin;
    const t = span(this.progress - this.modeStart, 0, REFORM_SECONDS);

    applyJoints(player, REST_JOINTS);
    player.position.set(0, 0, 0);
    player.scale.set(1, 1, 1);

    if (this.reformFromFlight) {
      this.center.set(0, HEAD_REST_Y, 0);
      this.spin.set(0, 0, 0);
      skin.head.scale.setScalar(Math.max(easeOutBack(span(t, 0, 0.45)), 0.001));
    } else {
      const settle = easeInOutCubic(span(t, 0, 0.6));
      this.center.set(
        lerp(this.center.x, 0, settle),
        lerp(this.center.y, HEAD_REST_Y, settle),
        0,
      );
      this.spin.set(
        lerp(this.spin.x, 0, settle),
        lerp(this.spin.y, 0, settle),
        lerp(this.spin.z, 0, settle),
      );
    }
    this.placeHead(player);

    BODY_PARTS.forEach((entry, index) => {
      const part = skin[entry.name];
      const start = 0.12 + (BODY_PARTS.length - 1 - index) * 0.09;
      const grow = easeOutBack(span(t, start, start + 0.4));
      const scale = lerp(this.reformScales[index] ?? 0, 1, grow);
      part.visible = scale > 0.001;
      part.scale.setScalar(Math.max(scale, 0.001));
    });

    if (t >= 1) this.finish();
  }
}
