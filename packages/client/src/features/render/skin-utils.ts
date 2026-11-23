import { randomPose, type KnownPose } from "createrington-skin-api";
import { loadImage } from "@/lib/image";
import { playerPoseUrl } from "@/lib/playerImages";

export { randomPose };
export type { KnownPose };

export function loadSkin(uuid: string, pose: KnownPose): Promise<string> {
  const src = playerPoseUrl(uuid, pose);
  return loadImage(src).then(
    () => src,
    () => src,
  );
}
