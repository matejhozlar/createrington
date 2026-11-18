import type React from "react";
import { useEffect, useState, useCallback } from "react";
import type { User, AuthContextType } from "./types";
import { AuthContext } from "./context";
import {
  setAccessToken,
  refreshAccessToken,
  SESSION_EXPIRED_EVENT,
} from "@/services/auth/token-manager";
import { api } from "@/services/api/client";
import { writePlayerHint } from "@/lib/skin-runner/player-hint";
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

  const login = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/discord");
      const data = await response.json();

      if (data.success && data.data?.url) {
        if (data.data.state) {
          sessionStorage.setItem("oauth_state", data.data.state);
        }

        sessionStorage.setItem(
          "oauth_redirect",
          window.location.pathname +
            window.location.search +
            window.location.hash,
        );

        window.location.href = data.data.url;
      } else {
        toast.error("Could not start login. Please try again.");
      }
    } catch (error) {
      toast.error("Could not reach the authentication server.");
      if (import.meta.env.DEV) console.error("Login error:", error);
    }
  }, []);

  const handleCallback = useCallback((code: string, state?: string) => {
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
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);

          sessionStorage.removeItem("oauth_state");
          const redirectPath = sessionStorage.getItem("oauth_redirect") || "/";
          sessionStorage.removeItem("oauth_redirect");

          window.location.href = redirectPath;
          return;
        }

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

  const clearSession = useCallback(() => {
    setAccessToken(null);
    writePlayerHint(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("api/auth/logout");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Logout error:", error);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await api.post("api/auth/logout-all");
    } catch (error) {
      toast.error("Could not log out of all sessions. Please try again.");
      throw error;
    }
    clearSession();
  }, [clearSession]);

  const silentRefresh = useCallback(() => {
    return refreshAccessToken()
      .then((result) => {
        if (result) {
          setUser(result.user);
        } else {
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

      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url);
    }

    if (code) {
      handleCallback(code, state || undefined);
    } else {
      void silentRefresh().finally(() => setLoading(false));
    }
  }, [handleCallback, silentRefresh]);

  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(
      () => {
        void silentRefresh();
      },
      13 * 60 * 1000,
    );

    return () => clearInterval(refreshInterval);
  }, [user, silentRefresh]);

  useEffect(() => {
    if (!user?.minecraftUuid) return;
    writePlayerHint({
      uuid: user.minecraftUuid,
      username: user.minecraftUsername,
    });
  }, [user]);

  useEffect(() => {
    const handleSessionExpired = () => {
      void logout();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [logout]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    logoutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
