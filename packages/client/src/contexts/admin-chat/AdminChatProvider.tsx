import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { localStore } from "@/lib/storage";
import { trpc } from "@/lib/trpc";
import { AdminChatContext } from "./context";
import type { AdminChatContextType, OpenDrawerOptions } from "./types";

const BUBBLE_KEY = "admin-chat:bubble-visible";

interface PanelState {
  open: boolean;
  expanded: boolean;
}

const PANEL_CLOSED: PanelState = { open: false, expanded: false };

export function AdminChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);

  const { data: enabledFromServer } = useQuery(
    trpc.admin.chat.enabled.queryOptions(undefined, { enabled: isAdmin }),
  );
  const [bubbleVisible, setBubbleVisibleState] = useState(
    () => localStore.get(BUBBLE_KEY) === "1",
  );
  const [panel, setPanel] = useState<PanelState>(PANEL_CLOSED);

  const enabled = isAdmin && enabledFromServer === true;

  useEffect(() => {
    localStore.set(BUBBLE_KEY, bubbleVisible ? "1" : "0");
  }, [bubbleVisible]);

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

  const value = useMemo<AdminChatContextType>(
    () => ({
      enabled,
      bubbleVisible,
      drawerOpen: panel.open,
      expanded: panel.expanded,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setExpanded,
      setBubbleVisible: setBubbleVisibleState,
    }),
    [
      enabled,
      bubbleVisible,
      panel,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setExpanded,
    ],
  );

  return (
    <AdminChatContext.Provider value={value}>
      {children}
    </AdminChatContext.Provider>
  );
}
