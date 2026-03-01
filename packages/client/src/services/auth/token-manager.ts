/**
 * In-memory access token storage + silent refresh logic.
 *
 * The access token is kept in a module-scoped variable (NOT localStorage)
 * so it cannot be read by XSS scripts accessing the Storage API.
 * The refresh token lives in an httpOnly cookie managed by the server.
 */

let accessToken: string | null = null;

/** Shared promise to deduplicate concurrent refresh requests */
let refreshPromise: Promise<RefreshResult | null> | null = null;

interface RefreshResult {
  accessToken: string;
  user: {
    discordId: string;
    username: string;
    avatar?: string;
    role: string;
    isAdmin: boolean;
    minecraftUuid: string;
    minecraftUsername: string;
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Attempt to refresh the access token using the httpOnly refresh cookie.
 * Returns the new access token + user data, or null if refresh fails.
 * Uses a shared promise to deduplicate concurrent refresh calls.
 */
export async function refreshAccessToken(): Promise<RefreshResult | null> {
  // Deduplicate: if a refresh is already in-flight, wait for it
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

async function doRefresh(): Promise<RefreshResult | null> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      accessToken = null;
      return null;
    }

    const data = await response.json();

    if (data.success && data.data?.accessToken) {
      accessToken = data.data.accessToken;
      return {
        accessToken: data.data.accessToken,
        user: data.data.user,
      };
    }

    accessToken = null;
    return null;
  } catch {
    accessToken = null;
    return null;
  }
}
