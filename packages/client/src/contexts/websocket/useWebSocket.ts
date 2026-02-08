import { useContext } from "react";
import { WebSocketContext } from "./context";
import type { WebSocketContextType } from "./types";

/**
 * Hook to access WebSocket context
 *
 * @throws Error if used outside WebSocketProvider
 */
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }

  return context;
};
