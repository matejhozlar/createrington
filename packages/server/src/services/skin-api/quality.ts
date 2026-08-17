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
 * 1366 is the smallest width that cannot cost quality, and raising it cannot
 * buy any. The crop is always 2:3, so at this height it can never be wider
 * than 2048 * 2/3; a pose whose silhouette exceeded that would be cut by the
 * crop at any canvas width, so a wider canvas protects nothing. A square
 * 2048x2048 request returns a byte-identical PNG for ~33% more render work.
 *
 * The widest pose in the catalogue (`mojavatar`) measures 1234px here, so
 * there is 132px of headroom. That is a measured fact about a catalogue the
 * SDK can grow, not an invariant anything enforces: re-measure the widest
 * pose when bumping createrington-skin-api.
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
