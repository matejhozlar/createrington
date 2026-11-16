import type {
  InitialDataPayload,
  ServerInitialDataPayload,
  SubscriptionType,
} from "@createrington/shared/socket";

export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface SubscriptionResult {
  success: boolean;
  error?: string;
}

export interface WebSocketContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  on: (event: string, callback: (data: unknown) => void) => () => void;
  subscribe: (
    type: SubscriptionType,
    serverId?: number,
  ) => Promise<SubscriptionResult>;
  unsubscribe: (
    type: SubscriptionType,
    serverId?: number,
  ) => Promise<SubscriptionResult>;
  requestInitialData: (
    serverId?: number,
    options?: { includeMessages?: boolean; messageLimit?: number },
  ) => Promise<InitialDataPayload | ServerInitialDataPayload | null>;
  requestSnapshot: (fresh?: boolean) => Promise<InitialDataPayload | null>;
}
