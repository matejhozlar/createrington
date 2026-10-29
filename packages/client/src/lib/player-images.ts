import type { KnownPose } from "createrington-skin-api";

export function playerAvatarUrl(uuid: string, size?: number): string {
  const path = `/api/skin/${encodeURIComponent(uuid)}/avatar`;
  return size === undefined ? path : `${path}?size=${size}`;
}

export function playerPoseUrl(uuid: string, pose: KnownPose): string {
  return `/api/skin/${encodeURIComponent(uuid)}/pose/${pose}`;
}
