import type { KnownPose } from "createrington-skin-api";

export function playerAvatarUrl(player: string, size?: number): string {
  const path = `/api/skin/${encodeURIComponent(player)}/avatar`;
  return size === undefined ? path : `${path}?size=${size}`;
}

export function playerPoseUrl(player: string, pose: KnownPose): string {
  return `/api/skin/${encodeURIComponent(player)}/pose/${pose}`;
}
