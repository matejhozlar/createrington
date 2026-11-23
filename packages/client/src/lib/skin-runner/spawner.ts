import type { DrifterConfig, ExitPortal, Level, ObstacleKind } from "./levels";
import type { Particles } from "./particles";
import type { Bounds } from "./player";
import { interiorPoint, PORTAL_W, type Portal } from "./portal";
import type { Drifter } from "./scenery";
import type { ObstacleSprite, Sprite, Sprites } from "./sprites";
import { pick, rand } from "./util";
import { blit, screenX, screenY, type View } from "./view";

type Range = readonly [number, number];

export type Obstacle = {
  kind: ObstacleKind;
  sprite: ObstacleSprite;
  x: number;
  bottom: number;
  speedMul: number;
  frame: number;
  frameT: number;
};

type Decor = { x: number; sprite: Sprite };

export type Course = {
  level: Level;
  exit: ExitPortal | null;
  progress: number;
  distance: number;
  speed: number;
  worldWidth: number;
  playerX: number;
};

export type DrifterField = {
  config: DrifterConfig;
  frames: readonly Sprite[];
  time: number;
  worldWidth: number;
  drift: number;
  scroll: number;
};

const SPAWN_MARGIN = 8;
const DECOR_MARGIN = 4;
const DESPAWN_MARGIN = 10;
const FIRST_DECOR_AT = 20;
const DECOR_GAP: Range = [16, 60];
const REACTION_TIME = 0.3;
const LEVEL_ENTRY_GAP = 140;
const LEVEL_DECOR_DELAY = 30;
const DEFAULT_FPS = 6;
const PORTAL_SPARK_INTERVAL = 0.05;
const HISS_RANGE = 34;
const HISS_BLINK = 0.08;

const DRIFTER_ENTRY: Range = [4, 30];
const DRIFTER_DESPAWN_MARGIN = 4;
const DRIFTER_FALLBACK_WIDTH = 16;
const LEVEL_DRIFTER_DELAY = 0.5;

function scrollDecor(list: Decor[], step: number): Decor[] {
  for (const d of list) d.x -= step;
  return list.filter((d) => d.x + d.sprite.width > -DESPAWN_MARGIN);
}

export class Spawner {
  portal: Portal | null = null;

  private readonly sprites: Sprites;
  private obstacles: Obstacle[] = [];
  private decor: Decor[] = [];
  private leavingDecor: Decor[] = [];
  private pending: Obstacle | null = null;
  private nextObstacleAt: number;
  private nextDecorAt = FIRST_DECOR_AT;
  private portalSparkT = 0;

  constructor(sprites: Sprites, firstGap: number) {
    this.sprites = sprites;
    this.nextObstacleAt = firstGap;
  }

  advance(step: number, dt: number): void {
    for (const o of this.obstacles) {
      o.x -= step * o.speedMul;
      if (o.sprite.frames.length > 1) {
        o.frameT += dt;
        if (o.frameT >= 1 / (o.sprite.fps ?? DEFAULT_FPS)) {
          o.frameT = 0;
          o.frame = (o.frame + 1) % o.sprite.frames.length;
        }
      }
    }
    this.obstacles = this.obstacles.filter(
      (o) => o.x + o.sprite.w > -DESPAWN_MARGIN,
    );
    this.decor = scrollDecor(this.decor, step);
    this.leavingDecor = scrollDecor(this.leavingDecor, step);
  }

  advancePortal(
    step: number,
    dt: number,
    playerX: number,
    particles: Particles,
  ): Portal | null {
    const portal = this.portal;
    if (!portal) return null;
    portal.x -= step;
    if (portal.x + PORTAL_W < -DESPAWN_MARGIN) {
      this.portal = null;
      return null;
    }
    if (!portal.entered && portal.x + PORTAL_W / 2 <= playerX) {
      portal.entered = true;
      return portal;
    }
    this.portalSparkT += dt;
    if (this.portalSparkT >= PORTAL_SPARK_INTERVAL) {
      this.portalSparkT = 0;
      const spark = interiorPoint(portal);
      particles.sparkle(spark.x, spark.y, 1, portal.color);
    }
    return null;
  }

  spawn(course: Course): void {
    if (course.distance >= this.nextObstacleAt) {
      if (course.exit) this.openPortal(course.exit, course.worldWidth);
      else this.spawnObstacle(course);
    }
    if (course.distance >= this.nextDecorAt) {
      this.decor.push({
        x: course.worldWidth + DECOR_MARGIN,
        sprite: pick(this.sprites.levels[course.level.id].decor),
      });
      this.nextDecorAt = course.distance + rand(...DECOR_GAP);
    }
  }

  collide(box: Bounds): Obstacle | null {
    for (const o of this.obstacles) {
      const hit = o.sprite.hit;
      const left = o.x + hit.x;
      const right = left + hit.w;
      const top = o.bottom + o.sprite.h - hit.y;
      const bottom = top - hit.h;
      if (
        box.left < right &&
        box.right > left &&
        box.bottom < top &&
        box.top > bottom
      ) {
        return o;
      }
    }
    return null;
  }

  leaveLevel(distance: number): void {
    this.leavingDecor = this.decor;
    this.decor = [];
    this.obstacles = [];
    this.pending = null;
    this.nextDecorAt = distance + LEVEL_DECOR_DELAY;
    this.nextObstacleAt = Infinity;
  }

  enterLevel(distance: number, speed: number): void {
    this.leavingDecor = [];
    this.nextObstacleAt = distance + LEVEL_ENTRY_GAP + speed * REACTION_TIME;
  }

  drawDecor(view: View, set: "current" | "leaving"): void {
    for (const d of set === "current" ? this.decor : this.leavingDecor) {
      blit(view, d.sprite, screenX(view, d.x), screenY(view, d.sprite.height));
    }
  }

  drawObstacles(view: View, playerX: number): void {
    for (const o of this.obstacles) {
      const hissing = o.kind === "creeper" && o.x - playerX < HISS_RANGE;
      const frame = hissing ? Math.floor(view.time / HISS_BLINK) % 2 : o.frame;
      const sprite = o.sprite.frames[frame] ?? o.sprite.frames[0];
      if (!sprite) continue;
      blit(
        view,
        sprite,
        screenX(view, o.x),
        screenY(view, o.bottom + o.sprite.h),
      );
    }
  }

  private openPortal(exit: ExitPortal, worldWidth: number): void {
    this.portal = {
      kind: exit.kind,
      x: worldWidth + SPAWN_MARGIN,
      color: exit.color,
      entered: false,
    };
    this.pending = null;
    this.nextObstacleAt = Infinity;
  }

  private spawnObstacle(course: Course): void {
    const obstacle = this.pending ?? this.makeObstacle(course);
    obstacle.x = course.worldWidth + SPAWN_MARGIN;
    this.obstacles.push(obstacle);
    this.pending = this.makeObstacle(course);
    const travel = course.worldWidth + SPAWN_MARGIN - course.playerX;
    const catchUp = Math.max(
      0,
      1 / obstacle.speedMul - 1 / this.pending.speedMul,
    );
    const [gapMin, gapMax] = course.level.gap;
    this.nextObstacleAt =
      course.distance +
      obstacle.sprite.w +
      rand(gapMin, gapMax) +
      course.speed * REACTION_TIME +
      travel * catchUp;
  }

  private makeObstacle({ level, progress, worldWidth }: Course): Obstacle {
    const unlocked = level.roster.filter((s) => progress >= s.unlock);
    const total = unlocked.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * total;
    let spawn = unlocked[0] ?? level.roster[0];
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
      x: worldWidth + SPAWN_MARGIN,
      bottom,
      speedMul: spawn.speedMul ?? 1,
      frame: 0,
      frameT: 0,
    };
  }
}

export class Drifters {
  list: Drifter[] = [];

  private scatter = true;
  private nextAt = 0;

  reset(clear: boolean): void {
    if (clear) {
      this.list = [];
      this.scatter = true;
    }
    this.nextAt = 0;
  }

  leaveLevel(time: number): void {
    this.list = [];
    this.scatter = false;
    this.nextAt = time + LEVEL_DRIFTER_DELAY;
  }

  update(dt: number, field: DrifterField): void {
    const { config, frames, time, worldWidth, drift, scroll } = field;
    const width = frames[0]?.width ?? DRIFTER_FALLBACK_WIDTH;
    if (this.list.length < config.count && time >= this.nextAt) {
      this.list.push({
        x: this.scatter
          ? rand(0, worldWidth)
          : worldWidth + rand(...DRIFTER_ENTRY),
        y: rand(...config.y),
        depth: rand(...config.depth),
        scale: Math.random() < config.bigChance ? 2 : 1,
        frame: 0,
        frameT: 0,
      });
      this.nextAt = time + config.interval;
      if (this.list.length >= config.count) this.scatter = false;
    }
    for (const d of this.list) {
      d.x -= (drift + scroll * d.depth) * dt;
      if (config.fps > 0) {
        d.frameT += dt;
        if (d.frameT >= 1 / config.fps) {
          d.frameT = 0;
          d.frame = (d.frame + 1) % frames.length;
        }
      }
    }
    this.list = this.list.filter(
      (d) => d.x + width * d.scale > -DRIFTER_DESPAWN_MARGIN,
    );
  }
}
