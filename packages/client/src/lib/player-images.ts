import type { KnownPose } from "createrington-skin-api";

export function playerAvatarUrl(uuid: string): string {
  return `/api/skin/${encodeURIComponent(uuid)}/avatar`;
}

export function playerPoseUrl(uuid: string, pose: KnownPose): string {
  return `/api/skin/${encodeURIComponent(uuid)}/pose/${pose}`;
}
