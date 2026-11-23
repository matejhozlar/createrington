import { context2d } from "@/lib/canvas";
import { clamp } from "@/lib/math";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";
import { localStore } from "@/lib/storage";
import { BANNER, drawHud, type HudFrame } from "./hud";
import { Input } from "./input";
import { LEVELS, type Level } from "./levels";
import { Particles } from "./particles";
import { Player, PlayerRig, type Facing } from "./player";
import {
  drawPortal,
  drawVeil,
  loadPortalFrames,
  type Portal,
  type PortalFrames,
} from "./portal";
import { BASE_SPEED, DEATH_DELAY, MAX_SPEED, type RunnerState } from "./run";
import { drawNightTint, drawScene } from "./scenery";
import { loadSkinParts, type SkinParts } from "./skin";
import { Drifters, Spawner, type Course, type Obstacle } from "./spawner";
import { GROUND_ROWS, buildSprites, type Sprites } from "./sprites";
import { rand, rgba, smoothstep, type Rgb } from "./util";
import type { View } from "./view";

export type SkinRunnerOptions = {
  uuid: string;
  username: string;
  fontFamily?: string;
  onStateChange?: (state: RunnerState) => void;
};

export type SkinRunnerHandle = {
  destroy: () => void;
  getState: () => RunnerState;
};

type RunState = {
  player: Player;
  spawner: Spawner;
  particles: Particles;
  distance: number;
  speed: number;
  score: number;
  newBest: boolean;
  milestone: number;
  milestoneT: number;
  nightMix: number;
  levelIndex: number;
  levelStart: number;
  fromLevel: Level | null;
  transitionT: number;
  bannerT: number;
  shakeT: number;
  paused: boolean;
};

const DEFAULT_FONT = '"Minecraft", ui-monospace, monospace';
const BEST_SCORE_KEY = "skin-runner:best";

const VIEW_ROWS = 96;
const MIN_SCALE = 2;
const MAX_SCALE = 10;
const PLAYER_X_RATIO = 0.18;
const PLAYER_X_MIN = 22;
const PLAYER_X_MAX = 56;

const SPEED_PER_POINT = 0.12;
const POINTS_PER_TP = 0.1;
const MILESTONE = 100;
const MILESTONE_BLINK = 0.7;
const SUNSET_START = 0.5;
const SUNSET_END = 0.82;
const FIRST_OBSTACLE_GAP = 150;
const RESTART_GAP = 120;

const TRANSITION = 1.6;
const CROSSFADE_START = 0.2;
const CROSSFADE_END = 0.8;
const PORTAL_BURST = 30;
const PORTAL_BURST_HEIGHT = 16;
const VEIL_SPARK_SPREAD = 6;
const VEIL_SPARK_HEIGHT = 32;
const PORTAL_TINT = 0.6;
const PORTAL_TINT_MIN = 0.02;
const WHITE: Rgb = [255, 255, 255];

const SHAKE_DURATION = 0.35;
const SHAKE_AMPLITUDE = 1.5;
const MAX_DT = 0.05;
const MAX_SUBSTEP = 3;
const FASTEST_OBSTACLE = Math.max(
  ...LEVELS.flatMap((level) => level.roster.map((s) => s.speedMul ?? 1)),
);

function readBest(): number {
  return Number(localStore.get(BEST_SCORE_KEY)) || 0;
}

function writeBest(value: number): void {
  localStore.set(BEST_SCORE_KEY, String(Math.floor(value)));
}

class Runner {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: SkinRunnerOptions;
  private readonly font: string;
  private readonly sprites: Sprites;
  private readonly rig: PlayerRig;
  private readonly input: Input;
  private readonly drifters = new Drifters();
  private readonly observer: ResizeObserver | null;
  private readonly motionQuery: MediaQueryList;
  private readonly hoverQuery: MediaQueryList;

  private reducedMotion: boolean;
  private touchUi: boolean;
  private skinFailed = false;
  private skin: SkinParts | null = null;
  private portalFrames: PortalFrames | null = null;
  private state: RunnerState = "loading";
  private destroyed = false;
  private raf = 0;
  private last = 0;
  private time = 0;

  private W = 0;
  private H = 0;
  private texel = 4;
  private groundPx = 0;
  private worldWidth = 0;
  private playerX = PLAYER_X_MIN;

  private scroll = 0;
  private best: number;
  private veilColor: Rgb = WHITE;
  private run: RunState;

  constructor(canvas: HTMLCanvasElement, options: SkinRunnerOptions) {
    this.canvas = canvas;
    this.ctx = context2d(canvas);
    this.options = options;
    this.font = options.fontFamily ?? DEFAULT_FONT;
    this.sprites = buildSprites();
    this.rig = new PlayerRig();
    this.motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    this.hoverQuery = window.matchMedia("(hover: none)");
    this.reducedMotion = this.motionQuery.matches;
    this.touchUi = this.hoverQuery.matches;
    this.best = readBest();
    this.run = this.createRun("front", FIRST_OBSTACLE_GAP);

    this.resize();

    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    } else {
      this.observer = null;
    }

    this.input = new Input(canvas, () => this.pressJump());
    this.motionQuery.addEventListener("change", this.onMediaChange);
    this.hoverQuery.addEventListener("change", this.onMediaChange);
    document.addEventListener("visibilitychange", this.onVisibility);

    document.fonts?.load(`16px ${this.font}`).catch(() => undefined);
    this.raf = requestAnimationFrame(this.frame);

    void loadSkinParts(options.uuid)
      .then((parts) => {
        if (this.destroyed) return;
        this.skin = parts;
        this.setState("idle");
      })
      .catch(() => {
        this.skinFailed = true;
      });

    void loadPortalFrames()
      .then((frames) => {
        if (!this.destroyed) this.portalFrames = frames;
      })
      .catch(() => undefined);
  }

  getState(): RunnerState {
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.input.destroy();
    this.motionQuery.removeEventListener("change", this.onMediaChange);
    this.hoverQuery.removeEventListener("change", this.onMediaChange);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private get level(): Level {
    return LEVELS[this.run.levelIndex] ?? LEVELS[0];
  }

  private createRun(facing: Facing, firstGap: number): RunState {
    return {
      player: new Player(facing),
      spawner: new Spawner(this.sprites, firstGap),
      particles: new Particles(() => this.reducedMotion),
      distance: 0,
      speed: BASE_SPEED,
      score: 0,
      newBest: false,
      milestone: 0,
      milestoneT: 0,
      nightMix: 0,
      levelIndex: 0,
      levelStart: 0,
      fromLevel: null,
      transitionT: 0,
      bannerT: 0,
      shakeT: 0,
      paused: false,
    };
  }

  private setState(state: RunnerState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.texel = clamp(Math.floor(H / VIEW_ROWS), MIN_SCALE, MAX_SCALE);
    this.groundPx = H - GROUND_ROWS * this.texel;
    this.worldWidth = W / this.texel;
    this.playerX = clamp(
      this.worldWidth * PLAYER_X_RATIO,
      PLAYER_X_MIN,
      PLAYER_X_MAX,
    );
    this.rig.resize(this.texel);
  }

  private readonly onMediaChange = (): void => {
    this.reducedMotion = this.motionQuery.matches;
    this.touchUi = this.hoverQuery.matches;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden && this.state === "running") this.run.paused = true;
  };

  private pressJump(): void {
    if (this.run.paused) {
      this.run.paused = false;
      return;
    }
    this.input.queueJump();
  }

  private readonly frame = (now: number): void => {
    const dt = this.last ? Math.min((now - this.last) / 1000, MAX_DT) : 0;
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.time += dt;
    this.updateDrifters(dt);
    if (this.state === "loading") return;
    if (this.state === "idle") {
      this.updateIdle(dt);
      return;
    }
    if (this.state === "dead") {
      this.updateDead(dt);
      return;
    }
    if (this.run.paused) return;
    this.updateRun(dt);
  }

  private updateIdle(dt: number): void {
    if (this.input.takeJump()) {
      this.startRun("turning", FIRST_OBSTACLE_GAP);
      return;
    }
    if (this.reducedMotion) return;
    this.run.player.idle(this.time, dt);
  }

  private startRun(facing: Facing, firstGap: number): void {
    this.drifters.reset(this.run.levelIndex !== 0);
    this.run = this.createRun(facing, firstGap);
    this.setState("running");
  }

  private course(): Course {
    const run = this.run;
    const level = this.level;
    const progress = run.score - run.levelStart;
    const exitOpen =
      LEVELS[run.levelIndex + 1] !== undefined && progress >= level.span;
    return {
      level,
      exit: exitOpen ? level.portal : null,
      progress,
      distance: run.distance,
      speed: run.speed,
      worldWidth: this.worldWidth,
      playerX: this.playerX,
    };
  }

  private updateRun(dt: number): void {
    const run = this.run;
    const { player, spawner, particles } = run;
    run.speed = Math.min(MAX_SPEED, BASE_SPEED + run.score * SPEED_PER_POINT);
    const substeps = Math.max(
      1,
      Math.ceil((run.speed * dt * FASTEST_OBSTACLE) / MAX_SUBSTEP),
    );
    const subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      const step = run.speed * subDt;
      this.scroll += step;
      run.distance += step;
      run.score = run.distance * POINTS_PER_TP;
      player.run(subDt, {
        speed: run.speed,
        x: this.playerX,
        dust: this.level.dust,
        input: this.input,
        particles,
      });
      spawner.advance(step, subDt);
      particles.update(subDt, step);
      const entered = spawner.advancePortal(
        step,
        subDt,
        this.playerX,
        particles,
      );
      if (entered) this.enterPortal(entered);
      spawner.spawn(this.course());
      const hit = spawner.collide(
        player.bounds(this.playerX, this.input.downHeld),
      );
      if (hit) {
        this.die(hit);
        return;
      }
    }

    const milestone = Math.floor(run.score / MILESTONE);
    if (milestone > run.milestone) {
      run.milestone = milestone;
      run.milestoneT = MILESTONE_BLINK;
    }
    run.milestoneT = Math.max(0, run.milestoneT - dt);
    this.updateTransition(dt);
    if (this.level.id === "overworld") {
      run.nightMix = smoothstep(
        SUNSET_START,
        SUNSET_END,
        (run.score - run.levelStart) / this.level.span,
      );
    }
  }

  private enterPortal(portal: Portal): void {
    const run = this.run;
    this.veilColor = portal.color;
    run.fromLevel = this.level;
    run.levelIndex = Math.min(run.levelIndex + 1, LEVELS.length - 1);
    run.levelStart = run.score;
    run.transitionT = 0;
    run.spawner.leaveLevel(run.distance);
    this.drifters.leaveLevel(this.time);
    run.particles.sparkle(
      this.playerX,
      PORTAL_BURST_HEIGHT,
      PORTAL_BURST,
      this.veilColor,
    );
  }

  private updateTransition(dt: number): void {
    const run = this.run;
    if (run.fromLevel) {
      run.transitionT += dt;
      run.particles.sparkle(
        this.playerX + rand(-VEIL_SPARK_SPREAD, VEIL_SPARK_SPREAD),
        rand(0, VEIL_SPARK_HEIGHT),
        1,
        this.veilColor,
      );
      if (run.transitionT >= TRANSITION) {
        run.fromLevel = null;
        run.bannerT = BANNER;
        run.spawner.enterLevel(run.distance, run.speed);
      }
    }
    run.bannerT = Math.max(0, run.bannerT - dt);
  }

  private die(obstacle: Obstacle): void {
    const run = this.run;
    const cause = run.player.die(obstacle, this.playerX, run.particles);
    run.shakeT = this.reducedMotion || cause === "void" ? 0 : SHAKE_DURATION;
    run.newBest = run.score > this.best;
    if (run.newBest) {
      this.best = Math.floor(run.score);
      writeBest(this.best);
    }
    this.setState("dead");
  }

  private updateDead(dt: number): void {
    const run = this.run;
    run.player.updateDead(dt, this.playerX, run.particles);
    run.shakeT = Math.max(0, run.shakeT - dt);
    run.particles.update(dt, 0);
    if (this.input.takeJump() && run.player.deathT > DEATH_DELAY) {
      this.startRun("side", RESTART_GAP);
    }
  }

  private updateDrifters(dt: number): void {
    const config = this.level.drifters;
    const running = this.state === "running" && !this.run.paused;
    this.drifters.update(dt, {
      config,
      frames: this.sprites.levels[this.level.id].drifter,
      time: this.time,
      worldWidth: this.worldWidth,
      drift: this.reducedMotion && !running ? 0 : config.drift,
      scroll: running ? this.run.speed : 0,
    });
  }

  private transitionStrength(): number {
    return Math.sin(Math.PI * (this.run.transitionT / TRANSITION));
  }

  private playerTint(): string | null {
    const flash = this.run.player.flash();
    if (flash) return flash;
    if (!this.run.fromLevel || this.reducedMotion) return null;
    const tint = this.transitionStrength() * PORTAL_TINT;
    return tint > PORTAL_TINT_MIN ? rgba(this.veilColor, tint) : null;
  }

  private view(): View {
    return {
      ctx: this.ctx,
      W: this.W,
      H: this.H,
      texel: this.texel,
      groundPx: this.groundPx,
      worldWidth: this.worldWidth,
      scroll: this.scroll,
      time: this.time,
      nightMix: this.run.nightMix,
    };
  }

  private hudFrame(): HudFrame {
    const run = this.run;
    return {
      state: this.state,
      paused: run.paused,
      touchUi: this.touchUi,
      skinFailed: this.skinFailed,
      score: run.score,
      best: this.best,
      newBest: run.newBest,
      milestoneT: run.milestoneT,
      levelName: this.level.name,
      bannerT: run.bannerT,
      deathT: run.player.deathT,
    };
  }

  private render(): void {
    const { ctx, W, H, texel, run } = this;
    const { player, spawner, particles } = run;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (run.shakeT > 0) {
      const amplitude = (run.shakeT / SHAKE_DURATION) * SHAKE_AMPLITUDE * texel;
      ctx.translate(
        Math.round(rand(-amplitude, amplitude)),
        Math.round(rand(-amplitude, amplitude)),
      );
    }

    const view = this.view();
    const from = run.fromLevel;
    const fade = from
      ? smoothstep(CROSSFADE_START, CROSSFADE_END, run.transitionT / TRANSITION)
      : 1;
    drawScene(
      view,
      from ?? this.level,
      this.sprites,
      from ? [] : this.drifters.list,
    );
    spawner.drawDecor(view, from ? "leaving" : "current");
    if (from) {
      ctx.globalAlpha = fade;
      drawScene(view, this.level, this.sprites, this.drifters.list);
      spawner.drawDecor(view, "current");
      ctx.globalAlpha = 1;
    }
    if (spawner.portal) {
      drawPortal(view, spawner.portal, this.portalFrames, this.sprites);
    }
    if (player.sinking) this.drawPlayer(view);
    spawner.drawObstacles(view, this.playerX);
    particles.draw(view);
    if (!player.sinking) this.drawPlayer(view);
    if ((from ?? this.level).id === "overworld") {
      drawNightTint(view, run.nightMix * (from ? 1 - fade : 1));
    }
    if (from && !this.reducedMotion) {
      drawVeil(view, this.veilColor, this.transitionStrength());
    }
    ctx.restore();

    drawHud(view, this.font, this.hudFrame());
  }

  private drawPlayer(view: View): void {
    if (!this.skin) return;
    this.rig.draw(
      view,
      this.run.player,
      this.skin,
      this.playerX,
      this.playerTint(),
    );
  }
}

export function mountSkinRunner(
  canvas: HTMLCanvasElement,
  options: SkinRunnerOptions,
): SkinRunnerHandle {
  const runner = new Runner(canvas, options);
  return {
    destroy: () => runner.destroy(),
    getState: () => runner.getState(),
  };
}
