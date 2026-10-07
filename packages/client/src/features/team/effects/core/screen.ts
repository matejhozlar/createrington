import type { SkinViewer } from "skinview3d";
import { Vector3, type Object3D } from "three";

export type Point = { x: number; y: number };

const scratch = new Vector3();

export function toViewport(
  viewer: SkinViewer,
  object: Object3D,
  x = 0,
  y = 0,
  z = 0,
): Point {
  scratch.set(x, y, z);
  object.localToWorld(scratch);
  scratch.project(viewer.camera);
  const rect = viewer.canvas.getBoundingClientRect();
  return {
    x: rect.left + ((scratch.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - scratch.y) / 2) * rect.height,
  };
}

export function pixelsPerUnit(viewer: SkinViewer): number {
  const wrapper = viewer.playerWrapper;
  const origin = toViewport(viewer, wrapper, 0, 0, 0);
  const above = toViewport(viewer, wrapper, 0, 1, 0);
  return Math.max(origin.y - above.y, 1);
}

export function groundPoint(viewer: SkinViewer): Point {
  return toViewport(viewer, viewer.playerWrapper, 0, -16, 0);
}

export function headPoint(viewer: SkinViewer): Point {
  return toViewport(viewer, viewer.playerObject.skin.head, 0, 4, 0);
}

export function footPoint(viewer: SkinViewer, side: "left" | "right"): Point {
  const leg =
    side === "left"
      ? viewer.playerObject.skin.leftLeg
      : viewer.playerObject.skin.rightLeg;
  return toViewport(viewer, leg, 0, -12, 0);
}
