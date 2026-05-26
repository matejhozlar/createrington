import {
  KNOWN_POSES,
  pickRandomPose,
  type KnownPose,
} from "@createrington/skin-api-client";
import { mcHeadsBody } from "@/lib/external-urls";

export { KNOWN_POSES, pickRandomPose };
export type { KnownPose };

export function skinApiUrl(uuid: string, pose: KnownPose): string {
  const url = new URL("/api/render/skin", window.location.origin);
  url.searchParams.set("uuid", uuid);
  url.searchParams.set("pose", pose);
  return url.toString();
}

/** Try to load a skin-api render, fall back to mc-heads on failure. */
export function loadSkin(uuid: string, pose: KnownPose): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(mcHeadsBody(uuid));
    img.src = skinApiUrl(uuid, pose);
  });
}
