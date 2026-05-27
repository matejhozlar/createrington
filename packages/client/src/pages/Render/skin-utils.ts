import { KNOWN_POSES, type KnownPose } from "createrington-skin-api";
import { mcHeadsBody } from "@/lib/external-urls";

export function pickRandomPose(): KnownPose {
  const idx = Math.floor(Math.random() * KNOWN_POSES.length);
  return KNOWN_POSES[idx] as KnownPose;
}

export { KNOWN_POSES };
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
