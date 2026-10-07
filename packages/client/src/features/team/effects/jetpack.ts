import type { PlayerObject } from "skinview3d";
import astronautSkinUrl from "@/assets/skins/astronaut.png";
import { TeamEffect, type EffectContext } from "./core/effect";
import { fx } from "./core/fx-layer";
import {
  bump,
  easeInOutCubic,
  easeInQuad,
  easeOutBack,
  easeOutCubic,
  easeOutElastic,
  lerp,
  rand,
  span,
} from "./core/math";
import { dustBurst, FLAME, SMOKE } from "./core/particles";
import { capturePose, mixToRest, resetPlayer, type Pose } from "./core/pose";
import {
  footPoint,
  groundPoint,
  headPoint,
  pixelsPerUnit,
} from "./core/screen";
import { SkinDissolve } from "./core/skin-dissolve";
import { stage } from "./core/stage";

const SUIT_UP_END = 0.7;
const CROUCH_START = 0.42;
const CROUCH_END = 0.82;
const BURN_START = 0.9;
const LIFTOFF_START = 1.25;
const LIFTOFF_SECONDS = 1.2;
const EXIT_MARGIN_PX = 60;
const WATCH_AFTER_EXIT_SECONDS = 0.9;
const ABORT_SECONDS = 0.38;
const DROP_SECONDS = 0.42;
const LANDING_SECONDS = 0.5;
const SUIT_EDGE = [196, 240, 255] as const;

type Mode = "play" | "abort" | "return";

export class JetpackEffect extends TeamEffect {
  private readonly suit: SkinDissolve;
  private readonly unit: number;
  private mode: Mode = "play";
  private suitProgress = 0;
  private flameDebt = 0;
  private smokeDebt = 0;
  private launched = false;
  private exited = false;
  private landed = false;
  private flightDistance = 0;
  private homeFloor: number | null = null;
  private flightOffset = 0;
  private stopOffset = 0;
  private stopPose: Pose | null = null;

  constructor(context: EffectContext) {
    super(context);
    this.unit = pixelsPerUnit(this.viewer);
    this.suit = new SkinDissolve(this.viewer, astronautSkinUrl, {
      sweep: "up",
      edge: SUIT_EDGE,
      model: "default",
    });
    if (this.card) this.card.style.zIndex = "9999";
    stage.focus(this.username, () => headPoint(this.viewer));
  }

  protected animate(player: PlayerObject, delta: number): void {
    if (this.mode === "play") this.play(player, delta);
    else if (this.mode === "abort") this.standDown(player);
    else this.dropIn(player);
  }

  protected onStop(): void {
    this.stopPose = capturePose(this.viewer.playerObject);
    this.stopOffset = this.flightOffset;
    this.mode = this.launched ? "return" : "abort";
    stage.blur(this.username);
    if (this.mode === "return") {
      this.viewer.canvas.style.visibility = "";
    }
  }

  dispose(): void {
    stage.blur(this.username);
    this.suit.dispose();
    resetPlayer(this.viewer.playerObject);
    const canvas = this.viewer.canvas;
    canvas.style.transform = "";
    canvas.style.visibility = "";
    if (this.card) this.card.style.zIndex = "";
  }

  private setSuit(progress: number): void {
    this.suitProgress = progress;
    this.suit.set(progress);
  }

  private play(player: PlayerObject, delta: number): void {
    const time = this.progress;
    const skin = player.skin;

    this.setSuit(easeInOutCubic(span(time, 0.04, SUIT_UP_END)));

    const admire =
      easeOutCubic(span(time, 0, 0.3)) * (1 - span(time, 0.38, 0.6));
    const crouch = easeInOutCubic(span(time, CROUCH_START, CROUCH_END));
    const release = easeOutBack(
      span(time, LIFTOFF_START, LIFTOFF_START + 0.24),
    );
    const coil = crouch * (1 - release);
    const rumble =
      span(time, BURN_START - 0.1, LIFTOFF_START) *
      (1 - span(time, LIFTOFF_START, LIFTOFF_START + 0.7));

    skin.head.rotation.x = 0.24 * admire - 0.22 * coil - 0.5 * release;
    skin.body.rotation.x = 0.2 * coil - 0.04 * release;
    skin.leftLeg.rotation.x = 0.5 * coil;
    skin.rightLeg.rotation.x = 0.36 * coil;
    skin.leftLeg.rotation.z = 0.05 * release;
    skin.rightLeg.rotation.z = -0.05 * release;
    skin.leftArm.rotation.x = -0.12 * admire + 0.55 * coil + 0.18 * release;
    skin.rightArm.rotation.x = -0.12 * admire + 0.55 * coil + 0.18 * release;
    skin.leftArm.rotation.z = 0.06 + 0.3 * admire + 0.22 * coil + 0.3 * release;
    skin.rightArm.rotation.z =
      -0.06 - 0.3 * admire - 0.22 * coil - 0.3 * release;

    player.position.y = -2.4 * coil + 0.8 * release;
    player.position.x = Math.sin(time * 71) * 0.34 * rumble;
    player.position.z = Math.cos(time * 53) * 0.16 * rumble;
    player.rotation.z = Math.sin(time * 7) * 0.035 * release;

    const stretch =
      0.16 *
      span(time, LIFTOFF_START, LIFTOFF_START + 0.1) *
      (1 - span(time, LIFTOFF_START + 0.1, LIFTOFF_START + 0.7) * 0.6);
    const squash = 0.08 * coil;
    player.scale.set(
      1 - stretch * 0.45 + squash * 0.5,
      1 + stretch - squash,
      1 - stretch * 0.45 + squash * 0.5,
    );

    if (time >= LIFTOFF_START && !this.launched) this.launch();

    if (this.launched && !this.exited) {
      const flight = span(time, LIFTOFF_START, LIFTOFF_START + LIFTOFF_SECONDS);
      this.flightOffset = -this.flightDistance * flight ** 2.6;
      const sway = Math.sin(time * 9) * 3 * (1 - flight);
      this.viewer.canvas.style.transform = `translate(${sway.toFixed(1)}px, ${this.flightOffset.toFixed(1)}px)`;
      if (flight >= 1) this.exit();
    }

    if (time >= BURN_START && !this.exited) {
      const power = this.launched
        ? 1
        : span(time, BURN_START, LIFTOFF_START) * 0.8 + 0.2;
      this.burn(delta, power);
    }

    if (
      this.exited &&
      time >= LIFTOFF_START + LIFTOFF_SECONDS + WATCH_AFTER_EXIT_SECONDS
    ) {
      stage.blur(this.username);
    }
  }

  private launch(): void {
    this.launched = true;
    const ground = groundPoint(this.viewer);
    this.flightDistance = ground.y + EXIT_MARGIN_PX;
    this.homeFloor = ground.y;
    dustBurst(ground, this.unit, 18, 1.3);
  }

  private exit(): void {
    this.exited = true;
    this.viewer.canvas.style.visibility = "hidden";
  }

  private burn(delta: number, power: number): void {
    const unit = this.unit;
    const floor = this.homeFloor ?? groundPoint(this.viewer).y;

    this.flameDebt += delta * 170 * power;
    while (this.flameDebt >= 1) {
      this.flameDebt -= 1;
      const foot = footPoint(
        this.viewer,
        Math.random() < 0.5 ? "left" : "right",
      );
      fx.emit({
        x: foot.x + rand(-1, 1) * unit,
        y: foot.y + rand(0, 1.5) * unit,
        vx: rand(-12, 12) * unit,
        vy: rand(60, 115) * unit * lerp(0.5, 1, power),
        drag: 2.2,
        life: rand(0.16, 0.34),
        size: rand(1.6, 2.6) * unit * lerp(0.7, 1, power),
        sizeEnd: 0.6 * unit,
        colors: FLAME,
        additive: true,
        floor,
      });
    }

    this.smokeDebt += delta * 80 * power;
    while (this.smokeDebt >= 1) {
      this.smokeDebt -= 1;
      const foot = footPoint(
        this.viewer,
        Math.random() < 0.5 ? "left" : "right",
      );
      fx.emit({
        x: foot.x + rand(-2, 2) * unit,
        y: foot.y + rand(1, 4) * unit,
        vx: rand(-9, 9) * unit,
        vy: rand(20, 60) * unit,
        drag: 2.6,
        gravity: -11 * unit,
        life: rand(1, 1.9),
        size: rand(2.4, 3.4) * unit,
        sizeEnd: rand(5, 7) * unit,
        colors: SMOKE,
        alpha: 0.42,
        fadeFrom: 0.2,
        floor,
      });
    }
  }

  private standDown(player: PlayerObject): void {
    const t = span(this.progress - (this.stoppedAt ?? 0), 0, ABORT_SECONDS);
    if (this.stopPose) mixToRest(player, this.stopPose, easeInOutCubic(t));
    this.suit.set(this.suitProgress * (1 - easeInOutCubic(t)));
    if (t >= 1) this.finish();
  }

  private dropIn(player: PlayerObject): void {
    const elapsed = this.progress - (this.stoppedAt ?? 0);
    const skin = player.skin;
    const drop = span(elapsed, 0, DROP_SECONDS);
    const landing = span(elapsed, DROP_SECONDS, DROP_SECONDS + LANDING_SECONDS);
    const falling = 1 - easeOutCubic(span(landing, 0, 0.5));

    const startOffset = this.exited ? -this.flightDistance : this.stopOffset;
    this.flightOffset = startOffset * (1 - easeInQuad(drop));
    this.viewer.canvas.style.transform = `translateY(${this.flightOffset.toFixed(1)}px)`;

    skin.head.rotation.x = 0.25 * falling;
    skin.body.rotation.x = 0.1 * falling;
    skin.leftArm.rotation.x = -2.5 * falling;
    skin.rightArm.rotation.x = -2.5 * falling;
    skin.leftArm.rotation.z = 0.06 + 0.4 * falling;
    skin.rightArm.rotation.z = -0.06 - 0.4 * falling;
    skin.leftLeg.rotation.x = 0.28 * falling;
    skin.rightLeg.rotation.x = 0.12 * falling;
    skin.leftLeg.rotation.z = 0.1 * falling;
    skin.rightLeg.rotation.z = -0.1 * falling;
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);

    if (drop < 1) {
      const stretch = 0.1 * bump(drop);
      player.scale.set(1 - stretch * 0.4, 1 + stretch, 1 - stretch * 0.4);
      return;
    }

    if (!this.landed) {
      this.landed = true;
      dustBurst(groundPoint(this.viewer), this.unit, 12, 1);
    }

    const settle = easeOutElastic(span(landing, 0, 0.8));
    const squash = 0.24 * (1 - settle);
    player.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    player.position.y = -16 * squash;
    this.suit.set(1 - easeInOutCubic(span(landing, 0.15, 1)));
    if (landing >= 1) this.finish();
  }
}
