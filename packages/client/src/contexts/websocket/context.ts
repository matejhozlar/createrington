import { createContext } from "react";
import type { WebSocketContextType } from "./types";

/**
 * WebSocket Context
 *
 * Separated into its own file to satisfy React Fast Refresh requirements
 */
export const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);
