import config from "@/config";
import {
  SkinApiError,
  type KnownPose,
  type SkinApiErrorCode,
} from "createrington-skin-api";
import { SKIN_API_USER_AGENT } from "./constants";
import { MAX_QUALITY_STYLED_RENDER } from "./quality";

export const SKIN_RENDER_STYLES = ["default", "cel"] as const;
export type SkinRenderStyle = (typeof SKIN_RENDER_STYLES)[number];
export type StyledSkinRenderStyle = Exclude<SkinRenderStyle, "default">;

export interface StyledSkinRenderParams {
  uuid: string;
  pose: KnownPose;
  style: StyledSkinRenderStyle;
}

const REQUEST_TIMEOUT_MS = 30_000;

const ERROR_CODES: Partial<Record<number, SkinApiErrorCode>> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  429: "rate_limited",
};

/**
 * Renders a pose in a non-default style by calling skin-api directly. Render
 * styles are gated and not part of the SDK yet, so the SDK client cannot send
 * `style`. Throws `SkinApiError`, like the SDK client does.
 */
export async function renderStyledSkin(
  params: StyledSkinRenderParams,
): Promise<Buffer> {
  const query = new URLSearchParams({
    uuid: params.uuid,
    pose: params.pose,
    width: String(MAX_QUALITY_STYLED_RENDER.width),
    height: String(MAX_QUALITY_STYLED_RENDER.height),
    style: params.style,
  });
  const baseUrl = config.skinApi.baseUrl.replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/render?${query.toString()}`, {
      headers: {
        authorization: `Bearer ${config.skinApi.apiKey}`,
        "user-agent": SKIN_API_USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new SkinApiError(
      timedOut
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : "Could not reach skin-api",
      { code: timedOut ? "timeout" : "network_error", status: 0 },
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new SkinApiError(
      body?.error?.message ?? `skin-api responded ${response.status}`,
      {
        code: ERROR_CODES[response.status] ?? "unknown",
        status: response.status,
      },
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
