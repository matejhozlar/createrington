import type { RefreshResponse } from "@createrington/shared/auth";

const REFRESH_PATH = "/api/auth/refresh";

export const SESSION_EXPIRED_EVENT = "auth:session-expired";

let accessToken: string | null = null;

let refreshPromise: Promise<RefreshResponse | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function refreshAccessToken(): Promise<RefreshResponse | null> {
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
  if (response.status !== 401 || response.url.includes(REFRESH_PATH)) {
    return response;
  }

  const result = await refreshAccessToken();
  if (!result) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    return response;
  }

  return retry(result.accessToken);
}

async function doRefresh(): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(REFRESH_PATH, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      accessToken = null;
      return null;
    }

    const data = (await response.json()) as {
      success?: boolean;
      data?: RefreshResponse;
    };

    if (data.success && data.data?.accessToken) {
      accessToken = data.data.accessToken;
      return data.data;
    }

    accessToken = null;
    return null;
  } catch {
    accessToken = null;
    return null;
  }
}
