import { randomPose, type KnownPose } from "createrington-skin-api";
import { playerPoseUrl } from "@/lib/playerImages";

export { randomPose };
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
