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

const RESPONSE_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "unsupported_media_type",
  "rate_limited",
  "internal",
  "render_failed",
  "upstream_unavailable",
] as const satisfies readonly SkinApiErrorCode[];

const STATUS_CODES: Partial<Record<number, SkinApiErrorCode>> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  415: "unsupported_media_type",
  429: "rate_limited",
  500: "internal",
  502: "upstream_unavailable",
  503: "upstream_unavailable",
  504: "upstream_unavailable",
};

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; retryAfterMs?: unknown };
}

function transportError(error: unknown): SkinApiError {
  const timedOut = error instanceof Error && error.name === "TimeoutError";
  return new SkinApiError(
    timedOut
      ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
      : "Request to skin-api failed",
    { code: timedOut ? "timeout" : "network_error", status: 0 },
  );
}

function responseError(status: number, body: ErrorBody | null): SkinApiError {
  const info = body?.error;
  const serverCode =
    typeof info?.code === "string" ? info.code.toLowerCase() : undefined;
  const code =
    RESPONSE_CODES.find((known) => known === serverCode) ??
    STATUS_CODES[status] ??
    "unknown";
  return new SkinApiError(
    typeof info?.message === "string"
      ? info.message
      : `skin-api responded ${status}`,
    {
      code,
      status,
      retryAfterMs:
        typeof info?.retryAfterMs === "number" ? info.retryAfterMs : undefined,
    },
  );
}

/**
 * Renders a pose in a non-default style by calling skin-api directly. Render
 * styles are gated and not part of the SDK yet, so the SDK client cannot send
 * `style`. Every failure is a `SkinApiError` mapped the way the SDK client
 * maps it, so callers handle one error type whichever path rendered.
 */
export async function renderStyledSkin(
  params: StyledSkinRenderParams,
): Promise<Uint8Array> {
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
    throw transportError(error);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw responseError(response.status, body);
  }

  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    throw transportError(error);
  }
}
