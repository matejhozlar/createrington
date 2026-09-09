import { LEVELS, type Level, type PortalKind } from "./levels";
import {
  loadPortalFrames,
  PORTAL_FRAME_DURATION,
  PORTAL_TILE,
  type PortalFrames,
} from "./portal";
import { drawNightTint, drawScene, type Drifter, type View } from "./scenery";
import { context2d, createCanvas, loadSkinParts, type SkinParts } from "./skin";
import {
  buildSprites,
  GROUND_ROWS,
  PORTAL_BLOCK,
  type ObstacleSprite,
  type PitKind,
  type Sprite,
  type Sprites,
} from "./sprites";
import { clamp, pick, rand, smoothstep } from "./util";

export type RunnerState = "loading" | "idle" | "running" | "dead";

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

type Obstacle = {
  kind: string;
  sprite: ObstacleSprite;
  x: number;
  bottom: number;
  speedMul: number;
  frame: number;
  frameT: number;
};

type Decor = { x: number; sprite: Sprite };

type Portal = { kind: PortalKind; x: number; color: string; entered: boolean };

type DeathCause = "hit" | PitKind;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
};

type Pose = {
  nearLeg: number;
  farLeg: number;
  nearKnee: number;
  farKnee: number;
  nearArm: number;
  farArm: number;
  nearElbow: number;
  farElbow: number;
  lean: number;
  headTilt: number;
  slide: number;
  bob: number;
  frontArm: number;
  breathe: number;
};

type Facing = "front" | "turning" | "side";

const DEFAULT_FONT = '"Minecraft", ui-monospace, monospace';
const BEST_SCORE_KEY = "skin-runner:best";
const TWO_PI = Math.PI * 2;

const VIEW_ROWS = 96;
const MIN_TEXT_SCALE = 4;
const MIN_SCALE = 2;
const MAX_SCALE = 10;
const PLAYER_X_RATIO = 0.18;
const PLAYER_X_MIN = 22;
const PLAYER_X_MAX = 56;
const PLAYER_ORIGIN_X = 20;
const PLAYER_ORIGIN_Y = 50;
const PLAYER_CANVAS_W = 48;
const PLAYER_CANVAS_H = 56;

const STAND_HIT = { x: -3, w: 6, h: 30 };
const SLIDE_HIT = { x: -10, w: 22, h: 11 };

const GRAVITY = 560;
const JUMP_VELOCITY = 190;
const HOLD_GRAVITY = 0.5;
const HOLD_MAX = 0.2;
const FAST_FALL = 2.2;

const BASE_SPEED = 110;
const SPEED_PER_POINT = 0.12;
const MAX_SPEED = 240;
const STRIDE_BASE = 44;
const STRIDE_PER_SPEED = 0.1;
const LEG_SWING = 0.8;
const KNEE_BEND = 1.1;
const ARM_SWING = 0.55;
const ELBOW_BEND = 1.3;
const ELBOW_PUMP = 0.2;
const RUN_BOB = 0.7;
const SLIDE_DROP = 8;
const LEAN_MIN = 0.08;
const LEAN_MAX = 0.34;
const LEAN_RAMP = 1.4;
const POINTS_PER_TP = 0.1;
const MILESTONE = 100;
const MILESTONE_BLINK = 0.7;
const SUNSET_START = 0.5;
const SUNSET_END = 0.82;
const FIRST_OBSTACLE_GAP = 150;
const RESTART_GAP = 120;
const LEVEL_ENTRY_GAP = 140;

const PORTAL_COLS = 4;
const PORTAL_ROWS = 5;
const PORTAL_SINK = PORTAL_BLOCK;
const PORTAL_W = PORTAL_COLS * PORTAL_BLOCK;
const PORTAL_H = PORTAL_ROWS * PORTAL_BLOCK;
const PORTAL_SPARK_INTERVAL = 0.05;
const TRANSITION = 1.6;
const BANNER = 2.6;
const BANNER_FADE_IN = 0.25;
const BANNER_FADE_OUT = 0.6;

const TURN_DURATION = 0.22;
const POSE_RATE = 14;
const DEATH_POSE_RATE = 9;
const SQUASH_DURATION = 0.14;
const DEATH_DELAY = 0.45;
const DEATH_FLASH = 0.4;
const DEATH_SLIDE = 0.12;
const SHAKE_DURATION = 0.35;
const SHAKE_AMPLITUDE = 1.5;
const RUN_DUST_INTERVAL = 0.11;
const SLIDE_DUST_INTERVAL = 0.05;
const LANDING_DUST = 6;
const CREEPER_HISS_RANGE = 34;
const LAVA_SINK = 9;
const LAVA_SINK_LIMIT = -12;
const VOID_FALL_LIMIT = -80;
const FIRE_INTERVAL = 0.06;
const MAX_DT = 0.05;
const MAX_SUBSTEP = 3;
const FASTEST_OBSTACLE = Math.max(
  ...LEVELS.flatMap((level) => level.roster.map((s) => s.speedMul ?? 1)),
);

const DUST_GRAVITY = 90;
const SPARK_GRAVITY = -12;
const FIRE_COLOR = "255, 150, 40";
const HIT_FLASH = "rgba(255, 70, 70, 0.55)";
const LAVA_FLASH = "rgba(255, 160, 40, 0.6)";
const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const SLIDE_KEYS = new Set(["ArrowDown", "KeyS", "ShiftLeft", "ShiftRight"]);

const RUN_POSE: Pose = {
  nearLeg: 0,
  farLeg: 0,
  nearKnee: 0,
  farKnee: 0,
  nearArm: 0,
  farArm: 0,
  nearElbow: 0,
  farElbow: 0,
  lean: 0,
  headTilt: 0,
  slide: 0,
  bob: 0,
  frontArm: 0,
  breathe: 0,
};

const LEAP_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: -0.7,
  nearKnee: -1.3,
  farLeg: 1.1,
  farKnee: -1,
  nearArm: 0.9,
  nearElbow: 0.6,
  farArm: 2.4,
  farElbow: 0.3,
  lean: 0.15,
  headTilt: -0.15,
};

const FALL_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 0.6,
  nearKnee: -0.5,
  farLeg: 0.25,
  farKnee: -0.5,
  nearArm: 0.6,
  nearElbow: 0.6,
  farArm: 1.5,
  farElbow: 0.5,
  lean: 0.1,
  headTilt: 0.1,
};

const SLIDE_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 1.35,
  nearKnee: -0.2,
  farLeg: 1.25,
  farKnee: -0.05,
  nearArm: -1.65,
  nearElbow: -0.3,
  farArm: 0.74,
  farElbow: 0.4,
  lean: -1.15,
  headTilt: 0.9,
  slide: 1,
};

const DEATH_POSE: Pose = {
  ...RUN_POSE,
  nearLeg: 0.5,
  nearKnee: -0.4,
  farLeg: -0.4,
  farKnee: -0.9,
  nearArm: -1.4,
  nearElbow: -0.3,
  farArm: -1.1,
  farElbow: -0.4,
  lean: -0.45,
  headTilt: 0.35,
};

const PLUNGE_POSE: Pose = {
  ...RUN_POSE,
  nearArm: 2.9,
  farArm: 2.9,
  nearElbow: 0.1,
  farElbow: 0.1,
  headTilt: 0.2,
};

function pad(value: number): string {
  return String(Math.floor(value)).padStart(5, "0");
}

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, button, a, [contenteditable]") !==
      null
  );
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(value)));
  } catch {
    return;
  }
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  for (const key of Object.keys(out) as (keyof Pose)[]) {
    out[key] = a[key] + (b[key] - a[key]) * t;
  }
  return out;
}

class Runner {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: SkinRunnerOptions;
  private readonly font: string;
  private readonly sprites: Sprites;
  private readonly playerCanvas: HTMLCanvasElement;
  private readonly playerCtx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver | null;
  private readonly viewObserver: IntersectionObserver | null;
  private readonly motionQuery: MediaQueryList;
  private readonly hoverQuery: MediaQueryList;

  private reducedMotion: boolean;
  private touchUi: boolean;
  private inView = true;
  private skinFailed = false;
  private skin: SkinParts | null = null;
  private portalFrames: PortalFrames | null = null;
  private state: RunnerState = "loading";
  private destroyed = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  private paused = false;

  private W = 0;
  private H = 0;
  private texel = 4;
  private groundPx = 0;
  private worldWidth = 0;
  private playerX = PLAYER_X_MIN;

  private scroll = 0;
  private distance = 0;
  private speed = BASE_SPEED;
  private score = 0;
  private best = 0;
  private newBest = false;
  private lastMilestone = 0;
  private milestoneT = 0;
  private nightMix = 0;
  private levelIndex = 0;
  private levelStart = 0;
  private fromLevel: Level | null = null;
  private transitionT = 0;
  private bannerT = 0;
  private portal: Portal | null = null;
  private portalSparkT = 0;
  private obstacles: Obstacle[] = [];
  private drifters: Drifter[] = [];
  private scatterDrifters = true;
  private nextDrifterAt = 0;
  private decor: Decor[] = [];
  private decorFrom: Decor[] = [];
  private particles: Particle[] = [];
  private nextObstacleAt = 0;
  private pending: Obstacle | null = null;
  private nextDecorAt = 0;

  private y = 0;
  private vy = 0;
  private grounded = true;
  private holdT = 0;
  private phase = 0;
  private pose: Pose = { ...RUN_POSE };
  private facing: Facing = "front";
  private turnT = 0;
  private squashT = 0;
  private glanceAngle = 0;
  private glanceAt = 2;
  private glanceT = -1;
  private dustT = 0;
  private deathT = 0;
  private deathCause: DeathCause = "hit";
  private deathAnchor: number | null = null;
  private deathSlideT = 0;
  private fireT = 0;
  private shakeT = 0;

  private jumpHeld = false;
  private downHeld = false;
  private jumpQueued = false;
  private pointerId: number | null = null;
  private pointerStartY = 0;

  constructor(canvas: HTMLCanvasElement, options: SkinRunnerOptions) {
    this.canvas = canvas;
    this.ctx = context2d(canvas);
    this.options = options;
    this.font = options.fontFamily ?? DEFAULT_FONT;
    this.sprites = buildSprites();
    this.playerCanvas = createCanvas(1, 1);
    this.playerCtx = context2d(this.playerCanvas);
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.hoverQuery = window.matchMedia("(hover: none)");
    this.reducedMotion = this.motionQuery.matches;
    this.touchUi = this.hoverQuery.matches;
    this.best = readBest();

    canvas.style.touchAction = "none";
    this.resize();

    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    } else {
      this.observer = null;
    }

    if (typeof IntersectionObserver !== "undefined") {
      this.viewObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) this.inView = entry.isIntersecting;
      });
      this.viewObserver.observe(canvas);
    } else {
      this.viewObserver = null;
    }

    this.motionQuery.addEventListener("change", this.onMediaChange);
    this.hoverQuery.addEventListener("change", this.onMediaChange);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
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

    void loadPortalFrames().then((frames) => {
      if (!this.destroyed) this.portalFrames = frames;
    });
  }

  getState(): RunnerState {
    return this.state;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.viewObserver?.disconnect();
    this.motionQuery.removeEventListener("change", this.onMediaChange);
    this.hoverQuery.removeEventListener("change", this.onMediaChange);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private get level(): Level {
    return LEVELS[this.levelIndex] ?? LEVELS[0];
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
    this.playerCanvas.width = PLAYER_CANVAS_W * this.texel;
    this.playerCanvas.height = PLAYER_CANVAS_H * this.texel;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.inView || isInteractive(event.target)) return;
    if (JUMP_KEYS.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.pressJump();
      this.jumpHeld = true;
    } else if (SLIDE_KEYS.has(event.code)) {
      event.preventDefault();
      this.downHeld = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (JUMP_KEYS.has(event.code)) this.jumpHeld = false;
    if (SLIDE_KEYS.has(event.code)) this.downHeld = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointerId !== null) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.pointerId = event.pointerId;
    this.pointerStartY = event.clientY;
    this.pressJump();
    this.jumpHeld = true;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    if (event.clientY - this.pointerStartY > 24) {
      this.downHeld = true;
      this.jumpHeld = false;
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.jumpHeld = false;
    this.downHeld = false;
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onMediaChange = (): void => {
    this.reducedMotion = this.motionQuery.matches;
    this.touchUi = this.hoverQuery.matches;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden && this.state === "running") this.paused = true;
  };

  private pressJump(): void {
    if (this.paused) {
      this.paused = false;
      return;
    }
    this.jumpQueued = true;
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
    if (this.paused) return;
    this.updateRun(dt);
  }

  private updateIdle(dt: number): void {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      this.begin();
      return;
    }
    if (this.reducedMotion) return;
    this.pose.breathe = Math.sin(this.time * 2.1) * 0.35;
    this.pose.frontArm = Math.sin(this.time * 2.1) * 0.04;
    if (this.glanceT < 0) {
      if (this.time >= this.glanceAt) {
        this.glanceT = 0;
        this.glanceAngle = (Math.random() < 0.5 ? -1 : 1) * rand(0.12, 0.22);
      }
      return;
    }
    this.glanceT += dt;
    const t = this.glanceT / 1.2;
    if (t >= 1) {
      this.glanceT = -1;
      this.glanceAt = this.time + rand(1.8, 4.5);
      this.pose.headTilt = 0;
    } else {
      this.pose.headTilt = this.glanceAngle * Math.sin(t * Math.PI);
    }
  }

  private begin(): void {
    this.facing = "turning";
    this.turnT = 0;
    this.resetRun(FIRST_OBSTACLE_GAP);
    this.setState("running");
  }

  private restart(): void {
    this.facing = "side";
    this.resetRun(RESTART_GAP);
    this.setState("running");
  }

  private resetRun(gap: number): void {
    if (this.levelIndex !== 0) {
      this.drifters = [];
      this.scatterDrifters = true;
    }
    this.pose = { ...RUN_POSE };
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.score = 0;
    this.newBest = false;
    this.lastMilestone = 0;
    this.milestoneT = 0;
    this.nightMix = 0;
    this.levelIndex = 0;
    this.levelStart = 0;
    this.fromLevel = null;
    this.transitionT = 0;
    this.bannerT = 0;
    this.portal = null;
    this.portalSparkT = 0;
    this.obstacles = [];
    this.decor = [];
    this.decorFrom = [];
    this.particles = [];
    this.nextObstacleAt = gap;
    this.pending = null;
    this.nextDecorAt = 20;
    this.nextDrifterAt = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.holdT = 0;
    this.phase = 0;
    this.squashT = 0;
    this.deathT = 0;
    this.deathCause = "hit";
    this.deathAnchor = null;
    this.deathSlideT = 0;
    this.fireT = 0;
    this.shakeT = 0;
    this.dustT = 0;
    this.paused = false;
  }

  private progress(): number {
    return this.score - this.levelStart;
  }

  private updateRun(dt: number): void {
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.score * SPEED_PER_POINT);
    const substeps = Math.max(
      1,
      Math.ceil((this.speed * dt * FASTEST_OBSTACLE) / MAX_SUBSTEP),
    );
    const subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      const step = this.speed * subDt;
      this.scroll += step;
      this.distance += step;
      this.score = this.distance * POINTS_PER_TP;
      this.updatePlayer(subDt);
      this.updateEntities(step, subDt);
      this.updatePortal(step, subDt);
      this.spawn();
      const hit = this.collides();
      if (hit) {
        this.die(hit);
        return;
      }
    }

    const milestone = Math.floor(this.score / MILESTONE);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.milestoneT = MILESTONE_BLINK;
    }
    this.milestoneT = Math.max(0, this.milestoneT - dt);
    this.updateTransition(dt);
    if (this.level.id === "overworld") {
      this.nightMix = smoothstep(
        SUNSET_START,
        SUNSET_END,
        this.progress() / this.level.span,
      );
    }
  }

  private updatePlayer(dt: number): void {
    if (this.facing === "turning") {
      this.turnT += dt;
      if (this.turnT >= TURN_DURATION) this.facing = "side";
    }

    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (this.grounded && this.facing === "side") {
        this.vy = -JUMP_VELOCITY;
        this.grounded = false;
        this.holdT = 0;
      }
    }

    if (!this.grounded) {
      let gravity = GRAVITY;
      if (this.vy < 0 && this.jumpHeld && this.holdT < HOLD_MAX) {
        gravity *= HOLD_GRAVITY;
        this.holdT += dt;
      }
      if (this.downHeld) gravity *= FAST_FALL;
      this.vy += gravity * dt;
      this.y -= this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.squashT = SQUASH_DURATION;
        this.burst(LANDING_DUST);
      }
    }
    this.squashT = Math.max(0, this.squashT - dt);

    if (this.grounded) {
      const stride = STRIDE_BASE + this.speed * STRIDE_PER_SPEED;
      this.phase = (this.phase + (this.speed / stride) * dt * TWO_PI) % TWO_PI;
    }

    if (!this.grounded) {
      const fall = clamp(
        (this.vy + JUMP_VELOCITY * 0.25) / (JUMP_VELOCITY * 0.75),
        0,
        1,
      );
      this.approach(mixPose(LEAP_POSE, FALL_POSE, fall), POSE_RATE * dt);
      return;
    }
    if (this.downHeld) {
      this.approach(SLIDE_POSE, POSE_RATE * dt);
      this.dustT += dt;
      if (this.dustT >= SLIDE_DUST_INTERVAL) {
        this.dustT = 0;
        this.burst(2);
      }
      return;
    }

    const near = this.phase;
    const far = this.phase + Math.PI;
    const speedNorm = (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    const p = this.pose;
    p.nearLeg = Math.sin(near) * LEG_SWING;
    p.farLeg = Math.sin(far) * LEG_SWING;
    p.nearKnee = -KNEE_BEND * Math.max(0, Math.cos(near));
    p.farKnee = -KNEE_BEND * Math.max(0, Math.cos(far));
    p.nearArm = -Math.sin(near) * ARM_SWING;
    p.farArm = -Math.sin(far) * ARM_SWING;
    p.nearElbow = ELBOW_BEND + ELBOW_PUMP * Math.sin(near);
    p.farElbow = ELBOW_BEND + ELBOW_PUMP * Math.sin(far);
    p.lean =
      LEAN_MIN + (LEAN_MAX - LEAN_MIN) * Math.min(1, speedNorm * LEAN_RAMP);
    p.headTilt = -p.lean * 0.6;
    p.bob = Math.abs(Math.cos(this.phase)) * RUN_BOB;
    p.slide = Math.max(0, p.slide - dt * 8);

    this.dustT += dt;
    if (this.dustT >= RUN_DUST_INTERVAL) {
      this.dustT = 0;
      this.burst(1);
    }
  }

  private approach(target: Pose, amount: number): void {
    const k = Math.min(1, amount);
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      this.pose[key] += (target[key] - this.pose[key]) * k;
    }
  }

  private updateEntities(step: number, dt: number): void {
    for (const o of this.obstacles) {
      o.x -= step * o.speedMul;
      if (o.sprite.frames.length > 1) {
        o.frameT += dt;
        if (o.frameT >= 1 / (o.sprite.fps ?? 6)) {
          o.frameT = 0;
          o.frame = (o.frame + 1) % o.sprite.frames.length;
        }
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.sprite.w > -10);

    for (const d of this.decor) d.x -= step;
    this.decor = this.decor.filter((d) => d.x + d.sprite.width > -10);
    for (const d of this.decorFrom) d.x -= step;
    this.decorFrom = this.decorFrom.filter((d) => d.x + d.sprite.width > -10);

    this.updateParticles(dt, step);
  }

  private updatePortal(step: number, dt: number): void {
    const portal = this.portal;
    if (!portal) return;
    portal.x -= step;
    if (portal.x + PORTAL_W < -10) {
      this.portal = null;
      return;
    }
    if (!portal.entered && portal.x + PORTAL_W / 2 <= this.playerX) {
      portal.entered = true;
      this.enterPortal();
      return;
    }
    this.portalSparkT += dt;
    if (this.portalSparkT >= PORTAL_SPARK_INTERVAL) {
      this.portalSparkT = 0;
      this.sparkle(
        portal.x + PORTAL_BLOCK + rand(0, 2 * PORTAL_BLOCK),
        rand(0, 3 * PORTAL_BLOCK),
        1,
        portal.color,
      );
    }
  }

  private enterPortal(): void {
    this.fromLevel = this.level;
    this.levelIndex = Math.min(this.levelIndex + 1, LEVELS.length - 1);
    this.levelStart = this.score;
    this.transitionT = 0;
    this.decorFrom = this.decor;
    this.decor = [];
    this.drifters = [];
    this.scatterDrifters = false;
    this.nextDrifterAt = this.time + 0.5;
    this.nextDecorAt = this.distance + 30;
    this.nextObstacleAt = Infinity;
    this.pending = null;
    this.sparkle(this.playerX, 16, 30, this.level.veil);
  }

  private updateTransition(dt: number): void {
    if (this.fromLevel) {
      this.transitionT += dt;
      this.sparkle(this.playerX + rand(-6, 6), rand(0, 32), 1, this.level.veil);
      if (this.transitionT >= TRANSITION) {
        this.fromLevel = null;
        this.decorFrom = [];
        this.bannerT = BANNER;
        this.nextObstacleAt =
          this.distance + LEVEL_ENTRY_GAP + this.speed * 0.3;
      }
    }
    this.bannerT = Math.max(0, this.bannerT - dt);
  }

  private updateParticles(dt: number, step: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt - step;
      p.y += p.vy * dt;
      p.vy -= p.gravity * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y >= 0);
  }

  private burst(count: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const life = rand(0.25, 0.45);
      this.particles.push({
        x: this.playerX - rand(1, 4),
        y: rand(0, 1.5),
        vx: -rand(8, 30),
        vy: rand(8, 34),
        life,
        maxLife: life,
        size: Math.random() < 0.6 ? 1 : 2,
        color: this.level.dust,
        gravity: DUST_GRAVITY,
      });
    }
  }

  private sparkle(x: number, y: number, count: number, color: string): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const life = rand(0.4, 0.8);
      this.particles.push({
        x: x + rand(-2, 2),
        y: Math.max(0, y + rand(-2, 2)),
        vx: rand(-14, 6),
        vy: rand(6, 26),
        life,
        maxLife: life,
        size: Math.random() < 0.5 ? 1 : 2,
        color,
        gravity: SPARK_GRAVITY,
      });
    }
  }

  private spawn(): void {
    if (this.distance >= this.nextObstacleAt) {
      const exit = this.level.portal;
      const destination = LEVELS[this.levelIndex + 1];
      if (exit && destination && this.progress() >= this.level.span) {
        this.portal = {
          kind: exit,
          x: this.worldWidth + 8,
          color: destination.veil,
          entered: false,
        };
        this.pending = null;
        this.nextObstacleAt = Infinity;
      } else {
        const obstacle = this.pending ?? this.makeObstacle();
        obstacle.x = this.worldWidth + 8;
        this.obstacles.push(obstacle);
        this.pending = this.makeObstacle();
        const travel = this.worldWidth + 8 - this.playerX;
        const catchUp = Math.max(
          0,
          1 / obstacle.speedMul - 1 / this.pending.speedMul,
        );
        const [gapMin, gapMax] = this.level.gap;
        this.nextObstacleAt =
          this.distance +
          obstacle.sprite.w +
          rand(gapMin, gapMax) +
          this.speed * 0.3 +
          travel * catchUp;
      }
    }
    if (this.distance >= this.nextDecorAt) {
      this.decor.push({
        x: this.worldWidth + 4,
        sprite: pick(this.sprites.levels[this.level.id].decor),
      });
      this.nextDecorAt = this.distance + rand(16, 60);
    }
  }

  private makeObstacle(): Obstacle {
    const progress = this.progress();
    const unlocked = this.level.roster.filter((s) => progress >= s.unlock);
    const total = unlocked.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * total;
    let spawn = unlocked[0] ?? this.level.roster[0];
    for (const candidate of unlocked) {
      roll -= candidate.weight;
      if (roll < 0) {
        spawn = candidate;
        break;
      }
    }
    if (!spawn) throw new Error("level without obstacles");
    const sprite = pick(spawn.pick(this.sprites));
    const bottom = spawn.altitudes ? pick(spawn.altitudes) : (sprite.rest ?? 0);
    return {
      kind: spawn.kind,
      sprite,
      x: this.worldWidth + 8,
      bottom,
      speedMul: spawn.speedMul ?? 1,
      frame: 0,
      frameT: 0,
    };
  }

  private collides(): Obstacle | null {
    const hit = this.grounded && this.downHeld ? SLIDE_HIT : STAND_HIT;
    const left = this.playerX + hit.x;
    const right = left + hit.w;
    const bottom = this.y;
    const top = this.y + hit.h;
    for (const o of this.obstacles) {
      const box = o.sprite.hit;
      const oLeft = o.x + box.x;
      const oRight = oLeft + box.w;
      const oTop = o.bottom + o.sprite.h - box.y;
      const oBottom = oTop - box.h;
      if (left < oRight && right > oLeft && bottom < oTop && top > oBottom) {
        return o;
      }
    }
    return null;
  }

  private die(obstacle: Obstacle): void {
    const cause = obstacle.sprite.pit ?? "hit";
    this.deathCause = cause;
    this.deathAnchor =
      cause === "hit" ? null : obstacle.x + obstacle.sprite.w / 2;
    this.deathSlideT = 0;
    this.deathT = 0;
    this.fireT = 0;
    this.shakeT = this.reducedMotion || cause === "void" ? 0 : SHAKE_DURATION;
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = Math.floor(this.score);
      writeBest(this.best);
    }
    if (cause === "lava") {
      this.sparkle(this.deathAnchor ?? this.playerX, 4, 14, FIRE_COLOR);
    }
    this.setState("dead");
  }

  private updateDead(dt: number): void {
    this.deathT += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.deathCause === "hit") {
      this.approach(DEATH_POSE, DEATH_POSE_RATE * dt);
    } else {
      this.deathSlideT = Math.min(1, this.deathSlideT + dt / DEATH_SLIDE);
      this.approach(PLUNGE_POSE, DEATH_POSE_RATE * dt);
      if (this.deathCause === "void") {
        this.vy += GRAVITY * 0.5 * dt;
        this.y = Math.max(VOID_FALL_LIMIT, this.y - this.vy * dt);
      } else {
        this.y = Math.max(LAVA_SINK_LIMIT, this.y - LAVA_SINK * dt);
        this.fireT += dt;
        if (this.fireT >= FIRE_INTERVAL) {
          this.fireT = 0;
          const x = this.playerX + this.deathOffset() + rand(-3, 3);
          this.sparkle(x, rand(0, 6), 1, FIRE_COLOR);
        }
      }
    }
    this.updateParticles(dt, 0);
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (this.deathT > DEATH_DELAY) this.restart();
    }
  }

  private updateDrifters(dt: number): void {
    const config = this.level.drifters;
    const frames = this.sprites.levels[this.level.id].drifter;
    const width = frames[0]?.width ?? 16;
    if (
      this.drifters.length < config.count &&
      this.time >= this.nextDrifterAt
    ) {
      this.drifters.push({
        x: this.scatterDrifters
          ? rand(0, this.worldWidth)
          : this.worldWidth + rand(4, 30),
        y: rand(config.y[0], config.y[1]),
        depth: rand(config.depth[0], config.depth[1]),
        scale: Math.random() < config.bigChance ? 2 : 1,
        frame: 0,
        frameT: 0,
      });
      this.nextDrifterAt = this.time + config.interval;
      if (this.drifters.length >= config.count) this.scatterDrifters = false;
    }
    const running = this.state === "running" && !this.paused;
    const drift = this.reducedMotion && !running ? 0 : config.drift;
    for (const d of this.drifters) {
      d.x -= (drift + (running ? this.speed * d.depth : 0)) * dt;
      if (config.fps > 0) {
        d.frameT += dt;
        if (d.frameT >= 1 / config.fps) {
          d.frameT = 0;
          d.frame = (d.frame + 1) % frames.length;
        }
      }
    }
    this.drifters = this.drifters.filter((d) => d.x + width * d.scale > -4);
  }

  private deathOffset(): number {
    if (this.deathAnchor === null) return 0;
    return (
      (this.deathAnchor - this.playerX) * smoothstep(0, 1, this.deathSlideT)
    );
  }

  private screenX(x: number): number {
    return Math.round(x * this.texel);
  }

  private screenY(height: number): number {
    return this.groundPx - Math.round(height * this.texel);
  }

  private blit(sprite: Sprite, x: number, y: number, scale = 1): void {
    this.ctx.drawImage(
      sprite,
      Math.round(x),
      Math.round(y),
      sprite.width * this.texel * scale,
      sprite.height * this.texel * scale,
    );
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
      nightMix: this.nightMix,
    };
  }

  private render(): void {
    const { ctx, W, H, texel } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (this.shakeT > 0) {
      const amplitude =
        (this.shakeT / SHAKE_DURATION) * SHAKE_AMPLITUDE * texel;
      ctx.translate(
        Math.round(rand(-amplitude, amplitude)),
        Math.round(rand(-amplitude, amplitude)),
      );
    }

    const view = this.view();
    const from = this.fromLevel;
    const fade = from ? smoothstep(0.2, 0.8, this.transitionT / TRANSITION) : 1;
    drawScene(
      view,
      from ?? this.level,
      this.sprites,
      from ? [] : this.drifters,
    );
    this.renderDecor(from ? this.decorFrom : this.decor);
    if (from) {
      ctx.globalAlpha = fade;
      drawScene(view, this.level, this.sprites, this.drifters);
      this.renderDecor(this.decor);
      ctx.globalAlpha = 1;
    }
    this.renderPortal();
    const sinking = this.state === "dead" && this.deathCause !== "hit";
    if (sinking) this.renderPlayer();
    this.renderObstacles();
    this.renderParticles();
    if (!sinking) this.renderPlayer();
    if ((from ?? this.level).id === "overworld") {
      drawNightTint(view, this.nightMix * (from ? 1 - fade : 1));
    }
    this.renderVeil();
    ctx.restore();

    this.renderHud();
    this.renderScore();
  }

  private renderDecor(list: Decor[]): void {
    for (const d of list) {
      this.blit(d.sprite, this.screenX(d.x), this.screenY(d.sprite.height));
    }
  }

  private renderPortal(): void {
    const portal = this.portal;
    if (!portal) return;
    const { ctx, texel } = this;
    const x = this.screenX(portal.x);
    const topY = this.screenY(PORTAL_H - PORTAL_SINK);
    const interiorX = x + PORTAL_BLOCK * texel;
    const interiorY = this.screenY(3 * PORTAL_BLOCK);
    const interiorW = 2 * PORTAL_BLOCK * texel;
    const interiorH = 3 * PORTAL_BLOCK * texel;
    const cx = interiorX + interiorW / 2;
    const cy = interiorY + interiorH / 2;
    const radius = PORTAL_H * 0.7 * texel;

    const glow = ctx.createRadialGradient(cx, cy, 4 * texel, cx, cy, radius);
    glow.addColorStop(0, `rgba(${portal.color}, 0.35)`);
    glow.addColorStop(1, `rgba(${portal.color}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const frames = this.portalFrames?.[portal.kind];
    if (frames && frames.length > 0) {
      const cycle = (this.time / PORTAL_FRAME_DURATION) % frames.length;
      const current = Math.floor(cycle);
      const next = (current + 1) % frames.length;
      const layers: [Sprite | undefined, number][] = [
        [frames[current], 1],
        [frames[next], cycle - current],
      ];
      ctx.save();
      ctx.beginPath();
      ctx.rect(interiorX, interiorY, interiorW, interiorH);
      ctx.clip();
      for (const [frame, alpha] of layers) {
        if (!frame) continue;
        ctx.globalAlpha = alpha;
        for (let ty = 0; ty < 3; ty++) {
          for (let tx = 0; tx < 2; tx++) {
            ctx.drawImage(
              frame,
              interiorX + tx * PORTAL_TILE * texel,
              interiorY + ty * PORTAL_TILE * texel,
              PORTAL_TILE * texel,
              PORTAL_TILE * texel,
            );
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(${portal.color}, 0.8)`;
      ctx.fillRect(interiorX, interiorY, interiorW, interiorH);
    }

    for (let r = 0; r < PORTAL_ROWS; r++) {
      for (let c = 0; c < PORTAL_COLS; c++) {
        if (r >= 1 && r <= 3 && c >= 1 && c <= 2) continue;
        const block =
          portal.kind === "nether"
            ? this.sprites.obsidian
            : r === 0
              ? this.sprites.endFrameEye
              : this.sprites.endFrame;
        this.blit(
          block,
          x + c * PORTAL_BLOCK * texel,
          topY + r * PORTAL_BLOCK * texel,
        );
      }
    }
  }

  private renderObstacles(): void {
    for (const o of this.obstacles) {
      const hissing =
        o.kind === "creeper" && o.x - this.playerX < CREEPER_HISS_RANGE;
      const frame = hissing ? Math.floor(this.time / 0.08) % 2 : o.frame;
      const sprite = o.sprite.frames[frame] ?? o.sprite.frames[0];
      if (!sprite) continue;
      this.blit(sprite, this.screenX(o.x), this.screenY(o.bottom + o.sprite.h));
    }
  }

  private renderParticles(): void {
    const { ctx, texel } = this;
    for (const p of this.particles) {
      ctx.fillStyle = `rgba(${p.color}, ${(p.life / p.maxLife) * 0.9})`;
      ctx.fillRect(
        this.screenX(p.x),
        this.screenY(p.y),
        p.size * texel,
        p.size * texel,
      );
    }
  }

  private renderVeil(): void {
    const from = this.fromLevel;
    if (!from) return;
    const { ctx, W, H } = this;
    const strength = Math.sin(Math.PI * (this.transitionT / TRANSITION));
    const color = this.level.veil;
    ctx.fillStyle = `rgba(${color}, ${strength * 0.5})`;
    ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.2,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.7,
    );
    vignette.addColorStop(0, `rgba(${color}, 0)`);
    vignette.addColorStop(1, `rgba(${color}, ${strength * 0.9})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  private renderPlayer(): void {
    const skin = this.skin;
    if (!skin) return;
    const { texel } = this;
    const pc = this.playerCtx;
    const width = this.playerCanvas.width;
    const height = this.playerCanvas.height;
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, width, height);
    pc.imageSmoothingEnabled = false;

    const squash = this.squashT / SQUASH_DURATION;
    const stretch =
      !this.grounded && this.vy < 0 ? (-this.vy / JUMP_VELOCITY) * 0.08 : 0;
    const sx = 1 + 0.18 * squash - stretch * 0.6;
    const sy = 1 - 0.18 * squash + stretch;
    pc.setTransform(
      texel * sx,
      0,
      0,
      texel * sy,
      PLAYER_ORIGIN_X * texel,
      PLAYER_ORIGIN_Y * texel,
    );

    if (this.facing === "front") {
      this.drawFront(pc, skin);
    } else if (this.facing === "turning") {
      const t = this.turnT / TURN_DURATION;
      const squeeze = Math.max(0.02, Math.abs(Math.cos(t * Math.PI)));
      pc.scale(squeeze, 1);
      if (t < 0.5) this.drawFront(pc, skin);
      else this.drawSide(pc, skin);
    } else {
      this.drawSide(pc, skin);
    }

    const flashing =
      this.state === "dead" &&
      this.deathCause !== "void" &&
      this.deathT < DEATH_FLASH &&
      Math.floor(this.deathT / 0.08) % 2 === 0;
    const portalTint = this.fromLevel
      ? Math.sin(Math.PI * (this.transitionT / TRANSITION)) * 0.6
      : 0;
    if (flashing || portalTint > 0.02) {
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalCompositeOperation = "source-atop";
      pc.fillStyle = flashing
        ? this.deathCause === "lava"
          ? LAVA_FLASH
          : HIT_FLASH
        : `rgba(${this.level.veil}, ${portalTint})`;
      pc.fillRect(0, 0, width, height);
      pc.globalCompositeOperation = "source-over";
    }

    this.ctx.drawImage(
      this.playerCanvas,
      this.screenX(this.playerX + this.deathOffset()) - PLAYER_ORIGIN_X * texel,
      this.screenY(this.y) - PLAYER_ORIGIN_Y * texel,
    );
  }

  private limb(
    pc: CanvasRenderingContext2D,
    part: Sprite,
    px: number,
    py: number,
    angle: number,
    length: number,
    width = 4,
  ): void {
    pc.save();
    pc.translate(px, py);
    pc.rotate(-angle);
    pc.drawImage(part, -width / 2, 0, width, length);
    pc.restore();
  }

  private jointedLimb(
    pc: CanvasRenderingContext2D,
    part: Sprite,
    px: number,
    py: number,
    upper: number,
    lower: number,
  ): void {
    const width = part.width;
    const half = part.height / 2;
    pc.save();
    pc.translate(px, py);
    pc.rotate(-upper);
    pc.drawImage(part, 0, 0, width, half, -width / 2, 0, width, half);
    pc.translate(0, half - 0.5);
    pc.rotate(-lower);
    pc.drawImage(part, 0, half, width, half, -width / 2, 0, width, half + 0.5);
    pc.restore();
  }

  private drawFront(pc: CanvasRenderingContext2D, skin: SkinParts): void {
    const { front, armWidth: aw } = skin;
    const p = this.pose;
    pc.drawImage(front.rightLeg, -4, -12, 4, 12);
    pc.drawImage(front.leftLeg, 0, -12, 4, 12);
    pc.save();
    pc.translate(0, -p.breathe);
    pc.drawImage(front.body, -4, -24, 8, 12);
    this.limb(pc, front.rightArm, -4 - aw / 2, -24, p.frontArm, 12, aw);
    this.limb(pc, front.leftArm, 4 + aw / 2, -24, -p.frontArm, 12, aw);
    pc.save();
    pc.translate(0, -24);
    pc.rotate(p.headTilt);
    pc.drawImage(front.head, -4, -8, 8, 8);
    pc.restore();
    pc.restore();
  }

  private drawSide(pc: CanvasRenderingContext2D, skin: SkinParts): void {
    const { side } = skin;
    const p = this.pose;
    const hipY = -12 + SLIDE_DROP * p.slide;

    pc.save();
    pc.translate(0, -p.bob);

    this.jointedLimb(pc, side.farLeg, 0, hipY, p.farLeg, p.farKnee);

    pc.save();
    pc.translate(0, hipY);
    pc.rotate(p.lean);
    this.jointedLimb(pc, side.farArm, 0, -12, p.farArm, p.farElbow);
    pc.drawImage(side.body, -2, -12, 4, 12);
    pc.restore();

    this.jointedLimb(pc, side.nearLeg, 0, hipY, p.nearLeg, p.nearKnee);

    pc.save();
    pc.translate(0, hipY);
    pc.rotate(p.lean);
    pc.save();
    pc.translate(0, -12);
    pc.rotate(p.headTilt);
    pc.drawImage(side.head, -4, -8, 8, 8);
    pc.restore();
    this.jointedLimb(pc, side.nearArm, 0, -12, p.nearArm, p.nearElbow);
    pc.restore();

    pc.restore();
  }

  private text(
    value: string,
    x: number,
    y: number,
    size: number,
    align: CanvasTextAlign,
    alpha = 1,
  ): void {
    const { ctx, texel } = this;
    const shadow = Math.max(1, Math.round(texel / 2));
    ctx.font = `${Math.round(size)}px ${this.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(value, x + shadow, y + shadow);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x, y);
    ctx.globalAlpha = 1;
  }

  private band(top: number, height: number, alpha = 1): void {
    this.ctx.fillStyle = `rgba(0, 0, 0, ${0.42 * alpha})`;
    this.ctx.fillRect(0, top, this.W, height);
  }

  private renderScore(): void {
    if (this.state === "loading") return;
    const { ctx, W, texel } = this;
    const T = Math.max(texel, MIN_TEXT_SCALE);
    const margin = 3 * texel;
    const size = 4 * T;
    const current = pad(this.score);
    const blinkOff =
      this.milestoneT > 0 && Math.floor(this.time / 0.12) % 2 === 1;
    if (!blinkOff) this.text(current, W - margin, margin, size, "right");
    if (this.best > 0) {
      ctx.font = `${Math.round(size)}px ${this.font}`;
      const width = ctx.measureText(current).width;
      this.text(
        `HI ${pad(this.best)}`,
        W - margin - width - 3 * T,
        margin,
        size,
        "right",
        0.7,
      );
    }
  }

  private renderHud(): void {
    const { W, texel } = this;
    const T = Math.max(texel, MIN_TEXT_SCALE);
    const top = 3 * texel + 6 * T;
    const pulse = 0.8 + 0.2 * Math.sin(this.time * 3);

    if (this.state === "loading") {
      const message = this.skinFailed
        ? "SKIN UNAVAILABLE, REFRESH TO RETRY"
        : "LOADING SKIN...";
      const alpha = this.skinFailed ? 1 : pulse;
      this.text(message, W / 2, top, 3.5 * T, "center", alpha);
      return;
    }

    if (this.state === "idle") {
      const prompt = this.touchUi ? "TAP TO RUN" : "PRESS SPACE OR TAP TO RUN";
      this.band(top - 2 * T, 8.5 * T);
      this.text(prompt, W / 2, top, 4.5 * T, "center", pulse);
      return;
    }

    if (this.state === "running" && this.paused) {
      this.band(top - 2 * T, 12 * T);
      this.text("PAUSED", W / 2, top, 5 * T, "center");
      const prompt = this.touchUi ? "TAP TO RESUME" : "PRESS SPACE TO RESUME";
      this.text(prompt, W / 2, top + 7 * T, 3 * T, "center", pulse);
      return;
    }

    if (this.state === "running" && this.bannerT > 0) {
      const alpha = Math.min(
        1,
        (BANNER - this.bannerT) / BANNER_FADE_IN,
        this.bannerT / BANNER_FADE_OUT,
      );
      this.band(top - 2 * T, 9 * T, alpha);
      this.text(this.level.name, W / 2, top, 5 * T, "center", alpha);
      return;
    }

    if (this.state === "dead" && this.deathT > DEATH_DELAY) {
      this.band(top - 2 * T, 19 * T);
      this.text("GAME OVER", W / 2, top, 6 * T, "center");
      if (this.newBest) {
        this.text(
          `NEW BEST ${pad(this.best)}`,
          W / 2,
          top + 8 * T,
          3.5 * T,
          "center",
          pulse,
        );
      } else {
        this.text(
          `SCORE ${pad(this.score)}   BEST ${pad(this.best)}`,
          W / 2,
          top + 8 * T,
          3.5 * T,
          "center",
        );
      }
      const prompt = this.touchUi ? "TAP TO RETRY" : "PRESS SPACE TO RETRY";
      this.text(prompt, W / 2, top + 13 * T, 3 * T, "center", pulse);
    }
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
