import type React from "react";
import { useEffect, useState, useCallback } from "react";
import type { User, AuthContextType } from "./types";
import { AuthContext } from "./context";
import type { AuthSession, DiscordAuthUrl } from "@createrington/shared/auth";
import {
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
  refreshDelayMs,
  SESSION_EXPIRED_EVENT,
} from "@/services/auth/token-manager";
import { api, type ApiError } from "@/services/api/client";
import { writePlayerHint } from "@/lib/playerHint";
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
      const { data } = await api.get<{ data: DiscordAuthUrl }>(
        "api/auth/discord",
      );

      sessionStorage.setItem("oauth_state", data.state);
      sessionStorage.setItem(
        "oauth_redirect",
        window.location.pathname +
          window.location.search +
          window.location.hash,
      );

      window.location.href = data.url;
    } catch (error) {
      toast.error("Could not start login. Please try again.");
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

    api
      .post<{ data: AuthSession }>("api/auth/discord/callback", {
        code,
        state,
      })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);

        sessionStorage.removeItem("oauth_state");
        const redirectPath = sessionStorage.getItem("oauth_redirect") || "/";
        sessionStorage.removeItem("oauth_redirect");

        window.location.href = redirectPath;
      })
      .catch((error: ApiError) => {
        if (import.meta.env.DEV) console.error("Callback error:", error);
        const reason =
          error.code === "UNVERIFIED" ? "unverified" : "auth_failed";
        window.location.href = `/?error=${reason}`;
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

    const delay = refreshDelayMs(getAccessToken());
    if (delay === null) return;

    const refreshTimer = setTimeout(() => {
      void silentRefresh();
    }, delay);

    return () => clearTimeout(refreshTimer);
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
