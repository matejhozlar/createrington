import {
  KNOWN_POSES,
  randomPose,
  type KnownPose,
} from "createrington-skin-api";
import { playerPoseUrl } from "@/lib/player-images";

export { KNOWN_POSES, randomPose };
export type { KnownPose };

export function loadSkin(uuid: string, pose: KnownPose): Promise<string> {
  const src = playerPoseUrl(uuid, pose);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
