import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth";
import { getAccessToken } from "@/services/auth/token-manager";
import {
  AdminChatContext,
  type AdminChatContextValue,
} from "./admin-chat-context";

const BUBBLE_KEY = "admin-chat:bubble-visible";
// Inlined here (rather than imported from ./api) so this provider stays
// outside the lazy admin-chat chunk — the rest of admin-chat is still split.
const ENABLED_ENDPOINT = "/api/claude-chat/enabled";

async function fetchEnabled(): Promise<boolean> {
  const token = getAccessToken();
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  try {
    const response = await fetch(ENABLED_ENDPOINT, { headers });
    if (!response.ok) return false;
    const data = (await response.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

function readInitialBubbleVisible(): boolean {
  try {
    return localStorage.getItem(BUBBLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const [enabledFromServer, setEnabledFromServer] = useState<boolean>(false);
  const [bubbleVisible, setBubbleVisibleState] = useState<boolean>(
    readInitialBubbleVisible,
  );
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Server kill-switch — only fetched for admins. Non-admins keep the
  // initial `false`, so no setState is needed in the early-return branch.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetchEnabled().then((value) => {
      if (!cancelled) setEnabledFromServer(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const enabled = isAdmin && enabledFromServer;

  useEffect(() => {
    try {
      localStorage.setItem(BUBBLE_KEY, bubbleVisible ? "1" : "0");
    } catch {
      // Non-fatal — state still works within this tab.
    }
  }, [bubbleVisible]);

  const setBubbleVisible = useCallback((visible: boolean) => {
    setBubbleVisibleState(visible);
    if (!visible) setDrawerOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    setBubbleVisibleState(true);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => {
      const next = !prev;
      if (next) setBubbleVisibleState(true);
      return next;
    });
  }, []);

  // Ctrl/Cmd+I toggles the bubble's visibility (closes the drawer when hiding).
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          setBubbleVisibleState((v) => {
            if (v) setDrawerOpen(false);
            return !v;
          });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);

  const value = useMemo<AdminChatContextValue>(
    () => ({
      enabled,
      bubbleVisible,
      drawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setBubbleVisible,
    }),
    [
      enabled,
      bubbleVisible,
      drawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setBubbleVisible,
    ],
  );

  return (
    <AdminChatContext.Provider value={value}>
      {children}
    </AdminChatContext.Provider>
  );
}
