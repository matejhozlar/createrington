import { useContext } from "react";
import {
  AdminChatContext,
  type AdminChatContextValue,
} from "./admin-chat-context";

// AdminChatProvider lazy-loads on first admin render. NavAdmin (the only
// consumer outside the chat itself) calls useAdminChat unconditionally, so
// returning safe defaults here keeps that render path working during the
// brief window before the provider mounts.
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
