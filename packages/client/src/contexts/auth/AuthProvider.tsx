import type React from "react";
import { useEffect, useState, useCallback } from "react";
import type { User, AuthContextType } from "./types";
import { AuthContext } from "./context";
import {
  setAccessToken,
  refreshAccessToken,
} from "@/services/auth/token-manager";
import { toast } from "sonner";

interface AuthProviderProps {
  children: React.ReactNode;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Login failed. Please try again.",
  unverified: "You need to apply to join before logging in.",
  state_mismatch: "Login session expired. Please try again.",
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(() => {
    const urlError = new URLSearchParams(window.location.search).get("error");
    if (!urlError) return null;
    return AUTH_ERROR_MESSAGES[urlError] ?? AUTH_ERROR_MESSAGES.auth_failed;
  });

  const login = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/auth/discord");
      const data = await response.json();

      if (data.success && data.data?.url) {
        // Save state for CSRF verification
        if (data.data.state) {
          sessionStorage.setItem("oauth_state", data.data.state);
        }

        // Save current path (including query) so we can redirect back after
        // login. The query matters for deep links like /authorize?state=...
        sessionStorage.setItem(
          "oauth_redirect",
          window.location.pathname + window.location.search,
        );

        window.location.href = data.data.url;
      } else {
        setError("Failed to initiate login");
        toast.error("Could not start login. Please try again.");
      }
    } catch (error) {
      setError("Failed to connect to authentication server");
      toast.error("Could not reach the authentication server.");
      if (import.meta.env.DEV) console.error("Login error:", error);
    }
  }, []);

  const handleCallback = useCallback((code: string, state?: string) => {
    // Verify state parameter for CSRF protection
    const savedState = sessionStorage.getItem("oauth_state");
    if (state && savedState && state !== savedState) {
      sessionStorage.removeItem("oauth_state");
      window.location.href = "/?error=state_mismatch";
      return;
    }

    fetch("/api/auth/discord/callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ code, state }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data?.accessToken) {
          // Access token lives in memory only: refresh token stays in an httpOnly cookie.
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);

          sessionStorage.removeItem("oauth_state");
          const redirectPath = sessionStorage.getItem("oauth_redirect") || "/";
          sessionStorage.removeItem("oauth_redirect");

          // Clean up pre-refresh-cookie migration: old auth_token in localStorage.
          localStorage.removeItem("auth_token");

          window.location.href = redirectPath;
          return;
        }

        // The error toast is shown on the next page load by the URL-error
        // effect below, since this redirect unloads the current document.
        const reason =
          data.error?.code === "UNVERIFIED" ? "unverified" : "auth_failed";
        window.location.href = `/?error=${reason}`;
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.error("Callback error:", error);
        window.location.href = "/?error=auth_failed";
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Logout error:", error);
    } finally {
      setAccessToken(null);
      localStorage.removeItem("auth_token"); // clean up legacy
      setUser(null);
      setError(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      const { getAccessToken } = await import("@/services/auth/token-manager");
      const token = getAccessToken();

      await fetch("/api/auth/logout-all", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Logout-all error:", error);
    } finally {
      setAccessToken(null);
      setUser(null);
      setError(null);
    }
  }, []);

  /**
   * Silently refresh the access token using the httpOnly refresh cookie.
   * On mount, this replaces the old getCurrentUser() + localStorage approach.
   */
  const silentRefresh = useCallback(() => {
    return refreshAccessToken()
      .then((result) => {
        if (result) {
          setUser({
            ...result.user,
            minecraftUsername: result.user.minecraftUsername,
          } as User);
        } else {
          // No valid refresh cookie: user is logged out
          setAccessToken(null);
          setUser(null);
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.error("Silent refresh error:", error);
        setAccessToken(null);
        setUser(null);
      });
  }, []);

  // On mount: handle OAuth callback if present in the URL, otherwise silent refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const urlError = params.get("error");

    if (urlError) {
      const message =
        AUTH_ERROR_MESSAGES[urlError] ?? AUTH_ERROR_MESSAGES.auth_failed;

      if (urlError === "unverified") {
        toast.error("You're not registered yet", {
          description: message,
          duration: 10000,
          action: {
            label: "Apply to join",
            onClick: () => {
              window.location.href = "/apply-to-join";
            },
          },
        });
      } else {
        toast.error(message);
      }

      // Strip the error param so a refresh doesn't re-trigger the toast.
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url);
    }

    if (code) {
      handleCallback(code, state || undefined);
    } else {
      silentRefresh().finally(() => setLoading(false));
    }
  }, [handleCallback, silentRefresh]);

  // Refresh ~2 minutes before the 15-minute access token expires.
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(
      () => {
        silentRefresh();
      },
      13 * 60 * 1000, // 13 minutes
    );

    return () => clearInterval(refreshInterval);
  }, [user, silentRefresh]);

  // Listen for session-expired events dispatched by the API client / tRPC.
  useEffect(() => {
    const handleSessionExpired = () => {
      void logout();
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [logout]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    logoutAll,
    refreshToken: silentRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
