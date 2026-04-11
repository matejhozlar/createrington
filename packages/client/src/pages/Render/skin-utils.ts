import { mcHeadsBody } from "@/lib/external-urls";

export const SKIN_POSES = [
  "default",
  "marching",
  "walking",
  "crouching",
  "crossed",
  "cheering",
  "trudging",
  "pointing",
  "dungeons",
  "facepalm",
  "kicking",
  "ultimate",
] as const;

export function randomPose(): string {
  return SKIN_POSES[Math.floor(Math.random() * SKIN_POSES.length)];
}

export function starlightSkinUrl(uuid: string, pose: string): string {
  return `https://starlightskins.lunareclipse.studio/render/${pose}/${uuid}/full`;
}

export function starlightBustUrl(uuid: string): string {
  return `https://starlightskins.lunareclipse.studio/render/default/${uuid}/bust`;
}

/** Try to load a starlightskins render, fall back to mc-heads on failure. */
export function loadSkin(uuid: string, pose: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(mcHeadsBody(uuid));
    img.src = starlightSkinUrl(uuid, pose);
  });
}
