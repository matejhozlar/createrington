import { createContext } from "react";
import type { AdminChatContextValue } from "./types";

export const AdminChatContext = createContext<AdminChatContextValue | null>(
  null,
);
