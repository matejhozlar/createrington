import type { AuthSession } from "@createrington/shared/auth";

const REFRESH_PATH = "/api/auth/refresh";
const NO_RETRY_PATHS = [REFRESH_PATH, "/api/auth/discord"];
const REFRESH_LEAD_MS = 2 * 60 * 1000;
const MAX_TIMER_MS = 2 ** 31 - 1;

export const SESSION_EXPIRED_EVENT = "auth:session-expired";

export type RefreshResult =
  | { status: "ok"; session: AuthSession }
  | { status: "unauthorized" }
  | { status: "transient" };

let accessToken: string | null = null;

let refreshPromise: Promise<RefreshResult> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function refreshDelayMs(token: string | null): number | null {
  const claims = token ? readClaims(token) : null;
  if (!claims) return null;

  const lifetimeMs = (claims.exp - claims.iat) * 1000;
  return Math.min(
    Math.max(lifetimeMs - REFRESH_LEAD_MS, lifetimeMs / 2),
    MAX_TIMER_MS,
  );
}

function readClaims(token: string): { iat: number; exp: number } | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { iat, exp } = JSON.parse(atob(payload)) as {
      iat?: unknown;
      exp?: unknown;
    };
    return typeof iat === "number" && typeof exp === "number" && exp > iat
      ? { iat, exp }
      : null;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = doRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function retryAfterRefresh(
  response: Response,
  retry: (accessToken: string) => Promise<Response>,
): Promise<Response> {
  if (
    response.status !== 401 ||
    NO_RETRY_PATHS.some((path) => response.url.includes(path))
  ) {
    return response;
  }

  const result = await refreshAccessToken();
  if (result.status === "unauthorized") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  if (result.status !== "ok") return response;

  return retry(result.session.accessToken);
}

async function doRefresh(): Promise<RefreshResult> {
  try {
    const response = await fetch(REFRESH_PATH, {
      method: "POST",
      credentials: "include",
    });

    if (response.status === 401) {
      accessToken = null;
      return { status: "unauthorized" };
    }
    if (!response.ok) return { status: "transient" };

    const data = (await response.json()) as {
      success?: boolean;
      data?: AuthSession;
    };
    if (!data.success || !data.data?.accessToken) {
      return { status: "transient" };
    }

    accessToken = data.data.accessToken;
    return { status: "ok", session: data.data };
  } catch {
    return { status: "transient" };
  }
}
