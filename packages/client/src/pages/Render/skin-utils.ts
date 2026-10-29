import {
  KNOWN_POSES,
  randomPose,
  type KnownPose,
} from "createrington-skin-api";

export { KNOWN_POSES, randomPose };
export type { KnownPose };

function skinApiUrl(uuid: string, pose: KnownPose): string {
  const url = new URL("/api/render/skin", window.location.origin);
  url.searchParams.set("uuid", uuid);
  url.searchParams.set("pose", pose);
  return url.toString();
}

export function loadSkin(uuid: string, pose: KnownPose): Promise<string> {
  const src = skinApiUrl(uuid, pose);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
