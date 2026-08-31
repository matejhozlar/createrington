import { useContext } from "react";
import { AdminChatContext } from "./context";
import type { AdminChatContextValue } from "./types";

// Safe defaults for the window before the lazy-loaded provider mounts.
const NO_PROVIDER_DEFAULT: AdminChatContextValue = {
  enabled: false,
  bubbleVisible: false,
  drawerOpen: false,
  expanded: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  setExpanded: () => {},
  setBubbleVisible: () => {},
};

export function useAdminChat(): AdminChatContextValue {
  return useContext(AdminChatContext) ?? NO_PROVIDER_DEFAULT;
}
