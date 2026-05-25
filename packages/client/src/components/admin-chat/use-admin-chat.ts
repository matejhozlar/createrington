import { useContext } from "react";
import {
  AdminChatContext,
  type AdminChatContextValue,
} from "./admin-chat-context";

// Safe defaults for the window before the lazy-loaded provider mounts.
const NO_PROVIDER_DEFAULT: AdminChatContextValue = {
  enabled: false,
  bubbleVisible: false,
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  setBubbleVisible: () => {},
};

export function useAdminChat(): AdminChatContextValue {
  return useContext(AdminChatContext) ?? NO_PROVIDER_DEFAULT;
}
