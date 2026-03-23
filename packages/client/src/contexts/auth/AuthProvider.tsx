import type React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import type { User, AuthContextType } from "./types";
import { AuthContext } from "./context";
import {
  setAccessToken,
  refreshAccessToken,
} from "@/services/auth/token-manager";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logoutRef = useRef<(() => Promise<void>) | null>(null);

  // ============================================================================
  // Authentication Functions
  // ============================================================================

  /**
   * Initiate Discord OAuth flow
   * Redirects user to Discord authorization page
   */
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

        // Redirect to Discord
        window.location.href = data.data.url;
      } else {
        setError("Failed to initiate login");
      }
    } catch (error) {
      setError("Failed to connect to authentication server");
      if (import.meta.env.DEV) console.error("Login error:", error);
    }
  }, []);

  /**
   * Handle OAuth callback
   * Exchange code for access token + refresh cookie
   */
  const handleCallback = useCallback(async (code: string, state?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Verify state parameter for CSRF protection
      const savedState = sessionStorage.getItem("oauth_state");
      if (state && savedState && state !== savedState) {
        throw new Error("Invalid state parameter - possible CSRF attack");
      }

      const response = await fetch("/api/auth/discord/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();

      if (data.success && data.data?.accessToken) {
        // Store access token in memory (not localStorage)
        setAccessToken(data.data.accessToken);

        // Set user data (map server response shape to User type)
        setUser(data.data.user);

        // Clear OAuth state
        sessionStorage.removeItem("oauth_state");

        // Clean up old localStorage token if present (migration)
        localStorage.removeItem("auth_token");

        // Redirect to home
        window.location.href = "/";
      } else {
        throw new Error(data.error?.message || "Authentication failed");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Authentication failed",
      );
      if (import.meta.env.DEV) console.error("Callback error:", error);

      // Redirect to home with error
      window.location.href = "/?error=auth_failed";
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout user
   * Revokes session via cookie and clears in-memory token
   */
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

  logoutRef.current = logout;

  /**
   * Logout from all sessions
   */
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
  const silentRefresh = useCallback(async () => {
    try {
      const result = await refreshAccessToken();

      if (result) {
        setUser({
          ...result.user,
          minecraftUsername: result.user.minecraftUsername,
        } as User);
      } else {
        // No valid refresh cookie — user is logged out
        setAccessToken(null);
        setUser(null);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Silent refresh error:", error);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Initialize authentication state on mount
   * Handle OAuth callback if present in URL, otherwise silent refresh
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const urlError = params.get("error");

    if (urlError) {
      setError("Authentication failed");
      setLoading(false);
      return;
    }

    if (code) {
      handleCallback(code, state || undefined);
    } else {
      // Silent refresh: use httpOnly cookie to get a new access token
      silentRefresh().finally(() => setLoading(false));
    }
  }, [handleCallback, silentRefresh]);

  /**
   * Set up access token refresh interval
   * Refresh every ~13 minutes (before 15-min access token expiry)
   */
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

  /**
   * Listen for session-expired events (from API client / tRPC)
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      logoutRef.current?.();
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

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
