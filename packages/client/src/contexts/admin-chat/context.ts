import { createContext } from "react";
import type { AdminChatContextType } from "./types";

export const AdminChatContext = createContext<AdminChatContextType | null>(
  null,
);
