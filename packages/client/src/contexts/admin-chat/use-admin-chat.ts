import { useContext } from "react";
import { AdminChatContext } from "./context";
import type { AdminChatContextType } from "./types";

// Safe defaults for the window before the lazy-loaded provider mounts.
const NO_PROVIDER_DEFAULT: AdminChatContextType = {
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

export function useAdminChat(): AdminChatContextType {
  return useContext(AdminChatContext) ?? NO_PROVIDER_DEFAULT;
}
