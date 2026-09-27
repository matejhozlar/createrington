import type { Socket } from "socket.io-client";
import type {
  InitialDataPayload,
  ServerInitialDataPayload,
  SubscriptionType,
} from "@createrington/shared/socket";

export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface WebSocketConfig {
  /** WebSocket server URL (defaults to window.location.origin) */
  url?: string;
  /** Socket.IO path (defaults to /socket.io) */
  path?: string;
  /** Transport methods (defaults to ["websocket", "polling"]) */
  transports?: ("websocket" | "polling")[];
  /** Connection timeout in ms (defaults to 10000) */
  timeout?: number;
  /** Auto-connect on mount (defaults to true) */
  autoConnect?: boolean;
  /** Initial reconnect delay in ms (defaults to 1000) */
  reconnectionDelay?: number;
  /** Upper bound on the reconnect delay in ms (defaults to 30000) */
  reconnectionDelayMax?: number;
}

export interface WebSocketContextType {
  // Connection state
  socket: Socket;
  connectionState: ConnectionState;
  error: Error | null;
  isConnected: boolean;

  // Connection methods
  connect: () => void;
  disconnect: () => void;

  // Event methods (using unknown for type safety)
  on: (event: string, callback: (data: unknown) => void) => () => void;
  off: (event: string, callback: (data: unknown) => void) => void;
  emit: (
    event: string,
    data?: unknown,
    callback?: (response: unknown) => void,
  ) => boolean;

  // Subscription methods
  subscribe: (
    type: SubscriptionType,
    serverId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  unsubscribe: (
    type: SubscriptionType,
    serverId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  requestInitialData: (
    serverId?: number,
    options?: { includeMessages?: boolean; messageLimit?: number },
  ) => Promise<InitialDataPayload | ServerInitialDataPayload | null>;
}
