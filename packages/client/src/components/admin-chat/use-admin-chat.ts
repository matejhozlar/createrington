import { useContext } from "react";
import {
  AdminChatContext,
  type AdminChatContextValue,
} from "./admin-chat-context";

export function useAdminChat(): AdminChatContextValue {
  const ctx = useContext(AdminChatContext);
  if (!ctx) {
    throw new Error("useAdminChat must be used within AdminChatProvider");
  }
  return ctx;
}
