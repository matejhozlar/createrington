import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/auth";
import { api } from "@/services/api/client";
import { AdminChatContext } from "./context";
import type { AdminChatContextValue, OpenDrawerOptions } from "./types";

const BUBBLE_KEY = "admin-chat:bubble-visible";
// Inlined here (rather than imported from features/admin-chat/api) so this
// provider stays outside the lazy admin-chat chunk: the rest of admin-chat
// is still split.
const ENABLED_ENDPOINT = "api/claude-chat/enabled";

interface PanelState {
  open: boolean;
  expanded: boolean;
}

const PANEL_CLOSED: PanelState = { open: false, expanded: false };

async function fetchEnabled(): Promise<boolean> {
  try {
    const data = await api.get<{ enabled?: boolean }>(ENABLED_ENDPOINT);
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
  // TEMP: local design preview, strip before PR
  const [bubbleVisible, setBubbleVisibleState] = useState<boolean>(
    () => import.meta.env.DEV || readInitialBubbleVisible(),
  );
  const [panel, setPanel] = useState<PanelState>(PANEL_CLOSED);

  // Server kill-switch: only fetched for admins. Non-admins keep the
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

  // TEMP: local design preview, strip before PR
  const enabled = isAdmin && (enabledFromServer || import.meta.env.DEV);

  useEffect(() => {
    try {
      localStorage.setItem(BUBBLE_KEY, bubbleVisible ? "1" : "0");
    } catch {
      // Non-fatal: state still works within this tab.
    }
  }, [bubbleVisible]);

  const setBubbleVisible = useCallback((visible: boolean) => {
    setBubbleVisibleState(visible);
    if (!visible) setPanel(PANEL_CLOSED);
  }, []);

  const openDrawer = useCallback((options?: OpenDrawerOptions) => {
    setPanel({ open: true, expanded: options?.expanded ?? false });
  }, []);

  const closeDrawer = useCallback(() => {
    setPanel(PANEL_CLOSED);
  }, []);

  const toggleDrawer = useCallback(() => {
    setPanel((prev) =>
      prev.open ? PANEL_CLOSED : { open: true, expanded: false },
    );
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setPanel((prev) => (prev.open ? { ...prev, expanded } : prev));
  }, []);

  // Ctrl/Cmd+I summons the assistant as the expanded modal, or dismisses
  // it when it is already open. The launcher bubble is left untouched.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          setPanel((prev) =>
            prev.open ? PANEL_CLOSED : { open: true, expanded: true },
          );
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
      drawerOpen: panel.open,
      expanded: panel.expanded,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setExpanded,
      setBubbleVisible,
    }),
    [
      enabled,
      bubbleVisible,
      panel,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setExpanded,
      setBubbleVisible,
    ],
  );

  return (
    <AdminChatContext.Provider value={value}>
      {children}
    </AdminChatContext.Provider>
  );
}
