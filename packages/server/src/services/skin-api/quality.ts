import type { RenderOptions, RenderStyle } from "createrington-skin-api";

export const MAX_QUALITY_RENDER = {
  width: 1366,
  height: 2048,
} as const satisfies RenderOptions;

export const POSE_RENDER_STYLE = "cel" satisfies RenderStyle;
