import type { RenderOptions } from "createrington-skin-api";

/**
 * Framing canvas that yields the highest-resolution render the API can
 * produce. The renderer draws into `width` x `height`, then crops to a tight
 * 2:3 box around the silhouette, so the requested size is not the output size.
 *
 * Only `height` drives resolution: the camera's vertical FOV is fixed, so the
 * figure's pixel height scales with `height` while `width` only decides how
 * much empty space is captured either side. 2048 is the API ceiling.
 *
 * 1366 is the smallest width that cannot cost quality. The crop is always 2:3,
 * so it can never be wider than 2048 * 2/3, and the widest pose in the
 * catalogue (`lounge`) is 928px at this height. A square 2048x2048 request
 * returns a byte-identical PNG for ~33% more render work.
 *
 * Silhouette edges come back aliased (the model uses alphaTest, and the API
 * exposes no supersampling), so consumers should downscale this with
 * smoothing on rather than draw it at 1:1.
 *
 * Kept free of `@/config` so the offline render scripts can import it.
 */
export const MAX_QUALITY_RENDER = {
  width: 1366,
  height: 2048,
} as const satisfies RenderOptions;
