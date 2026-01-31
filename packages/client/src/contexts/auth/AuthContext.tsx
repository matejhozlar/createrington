// packages/client/src/contexts/auth/AuthContext.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import type { User, AuthContextType } from "./types";
import { AuthContext } from "./context";

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
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
      console.error("Login error:", error);
    }
  }, []);

  /**
   * Handle OAuth callback
   * Exchange code for JWT token
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
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        // Store JWT token
        localStorage.setItem("auth_token", data.data.token);

        // Set user data
        setUser(data.data.user);

        // Clear OAuth state
        sessionStorage.removeItem("oauth_state");

        // Redirect to home
        window.location.href = "/";
      } else {
        throw new Error(data.error?.message || "Authentication failed");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Authentication failed",
      );
      console.error("Callback error:", error);

      // Redirect to home with error
      window.location.href = "/?error=auth_failed";
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout user
   * Clears token and user state
   */
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem("auth_token");

      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("auth_token");
      setUser(null);
      setError(null);
    }
  }, []);

  logoutRef.current = logout;

  /**
   * Refresh JWT token
   * Extends session without re-authentication
   */
  const refreshToken = useCallback(async () => {
    try {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        throw new Error("No token to refresh");
      }

      const response = await fetch("/api/auth/token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        localStorage.setItem("auth_token", data.data.token);
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      logoutRef.current?.();
    }
  }, []);

  /**
   * Get current user from token
   * Validates existing session on mount
   */
  const getCurrentUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data?.user) {
        setUser(data.data.user);
      } else {
        localStorage.removeItem("auth_token");
      }
    } catch (error) {
      console.error("Get user error:", error);
      localStorage.removeItem("auth_token");
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Initialize authentication state on mount
   * Handle OAuth callback if present in URL
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
      getCurrentUser();
    }
  }, [handleCallback, getCurrentUser]);

  /**
   * Set up token refresh interval
   * Refresh token every 6 days (before 7 day expiration)
   */
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(
      () => {
        refreshToken();
      },
      6 * 24 * 60 * 60 * 1000, // 6 days
    );

    return () => clearInterval(refreshInterval);
  }, [user, refreshToken]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
