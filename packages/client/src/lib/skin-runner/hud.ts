import { DEATH_DELAY, type RunnerState } from "./run";
import type { View } from "./view";

export type HudFrame = {
  state: RunnerState;
  paused: boolean;
  touchUi: boolean;
  skinFailed: boolean;
  score: number;
  best: number;
  newBest: boolean;
  milestoneT: number;
  levelName: string;
  bannerT: number;
  deathT: number;
};

export const BANNER = 2.6;
const BANNER_FADE_IN = 0.25;
const BANNER_FADE_OUT = 0.6;
const MIN_TEXT_SCALE = 4;
const SCORE_DIGITS = 5;
const SCORE_BLINK = 0.12;
const PULSE_RATE = 3;
const PULSE_DEPTH = 0.2;
const BAND_ALPHA = 0.42;
const BEST_ALPHA = 0.7;
const SHADOW = "rgba(0, 0, 0, 0.5)";

function pad(value: number): string {
  return String(Math.floor(value)).padStart(SCORE_DIGITS, "0");
}

function text(
  view: View,
  font: string,
  value: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
  alpha = 1,
): void {
  const { ctx, texel } = view;
  const shadow = Math.max(1, Math.round(texel / 2));
  ctx.font = `${Math.round(size)}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = SHADOW;
  ctx.fillText(value, x + shadow, y + shadow);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(value, x, y);
  ctx.globalAlpha = 1;
}

function band(view: View, top: number, height: number, alpha = 1): void {
  view.ctx.fillStyle = `rgba(0, 0, 0, ${BAND_ALPHA * alpha})`;
  view.ctx.fillRect(0, top, view.W, height);
}

function drawScore(view: View, font: string, frame: HudFrame): void {
  if (frame.state === "loading") return;
  const { ctx, W, texel, time } = view;
  const T = Math.max(texel, MIN_TEXT_SCALE);
  const margin = 3 * texel;
  const size = 4 * T;
  const current = pad(frame.score);
  const blinkOff =
    frame.milestoneT > 0 && Math.floor(time / SCORE_BLINK) % 2 === 1;
  if (!blinkOff) text(view, font, current, W - margin, margin, size, "right");
  if (frame.best > 0) {
    ctx.font = `${Math.round(size)}px ${font}`;
    const width = ctx.measureText(current).width;
    text(
      view,
      font,
      `HI ${pad(frame.best)}`,
      W - margin - width - 3 * T,
      margin,
      size,
      "right",
      BEST_ALPHA,
    );
  }
}

function drawMessage(view: View, font: string, frame: HudFrame): void {
  const { W, texel, time } = view;
  const T = Math.max(texel, MIN_TEXT_SCALE);
  const top = 3 * texel + 6 * T;
  const pulse = 1 - PULSE_DEPTH + PULSE_DEPTH * Math.sin(time * PULSE_RATE);
  const say = (value: string, y: number, size: number, alpha?: number): void =>
    text(view, font, value, W / 2, y, size, "center", alpha);

  if (frame.state === "loading") {
    const message = frame.skinFailed
      ? "SKIN UNAVAILABLE, REFRESH TO RETRY"
      : "LOADING SKIN...";
    say(message, top, 3.5 * T, frame.skinFailed ? 1 : pulse);
    return;
  }

  if (frame.state === "idle") {
    band(view, top - 2 * T, 8.5 * T);
    say(
      frame.touchUi ? "TAP TO RUN" : "PRESS SPACE OR TAP TO RUN",
      top,
      4.5 * T,
      pulse,
    );
    return;
  }

  if (frame.state === "running" && frame.paused) {
    band(view, top - 2 * T, 12 * T);
    say("PAUSED", top, 5 * T);
    say(
      frame.touchUi ? "TAP TO RESUME" : "PRESS SPACE TO RESUME",
      top + 7 * T,
      3 * T,
      pulse,
    );
    return;
  }

  if (frame.state === "running" && frame.bannerT > 0) {
    const alpha = Math.min(
      1,
      (BANNER - frame.bannerT) / BANNER_FADE_IN,
      frame.bannerT / BANNER_FADE_OUT,
    );
    band(view, top - 2 * T, 9 * T, alpha);
    say(frame.levelName, top, 5 * T, alpha);
    return;
  }

  if (frame.state === "dead" && frame.deathT > DEATH_DELAY) {
    band(view, top - 2 * T, 19 * T);
    say("GAME OVER", top, 6 * T);
    if (frame.newBest) {
      say(`NEW BEST ${pad(frame.best)}`, top + 8 * T, 3.5 * T, pulse);
    } else {
      say(
        `SCORE ${pad(frame.score)}   BEST ${pad(frame.best)}`,
        top + 8 * T,
        3.5 * T,
      );
    }
    say(
      frame.touchUi ? "TAP TO RETRY" : "PRESS SPACE TO RETRY",
      top + 13 * T,
      3 * T,
      pulse,
    );
  }
}

export function drawHud(view: View, font: string, frame: HudFrame): void {
  drawMessage(view, font, frame);
  drawScore(view, font, frame);
}
