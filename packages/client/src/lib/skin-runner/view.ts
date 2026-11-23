import type { Sprite } from "./sprites";

export type View = {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  texel: number;
  groundPx: number;
  worldWidth: number;
  scroll: number;
  time: number;
  nightMix: number;
};

export function screenX(view: View, x: number): number {
  return Math.round(x * view.texel);
}

export function screenY(view: View, height: number): number {
  return view.groundPx - Math.round(height * view.texel);
}

export function blit(
  view: View,
  sprite: Sprite,
  x: number,
  y: number,
  scale = 1,
): void {
  view.ctx.drawImage(
    sprite,
    Math.round(x),
    Math.round(y),
    sprite.width * view.texel * scale,
    sprite.height * view.texel * scale,
  );
}
