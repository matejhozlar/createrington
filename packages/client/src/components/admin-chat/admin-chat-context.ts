import { createContext } from "react";

export interface AdminChatContextValue {
  enabled: boolean;
  bubbleVisible: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setBubbleVisible: (visible: boolean) => void;
}

export const AdminChatContext = createContext<AdminChatContextValue | null>(
  null,
);
