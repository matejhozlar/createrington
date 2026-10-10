import type { SkinViewer } from "skinview3d";

export type Bleed = { x: number; y: number };

export type Slot = { width: number; height: number };

export const BASE_BLEED: Bleed = { x: 2.6, y: 1.6 };

const BASE_FOV_TAN = Math.tan((50 * Math.PI) / 360);
const BASE_ZOOM = 0.9;

export function frameViewer(
  viewer: SkinViewer,
  slot: Slot,
  bleed: Bleed,
): void {
  const marginX = Math.round((slot.width * (bleed.x - 1)) / 2);
  const marginY = Math.round((slot.height * (bleed.y - 1)) / 2);
  const height = slot.height + marginY * 2;
  const ratio = height / slot.height;

  viewer.setSize(slot.width + marginX * 2, height);
  viewer.fov = (Math.atan(ratio * BASE_FOV_TAN) * 360) / Math.PI;
  viewer.zoom = BASE_ZOOM / ratio;
  viewer.canvas.style.left = `${-marginX}px`;
  viewer.canvas.style.top = `${-marginY}px`;
}
