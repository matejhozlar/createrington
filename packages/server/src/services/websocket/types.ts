import type {
  ServerStatus,
  PlayerData,
  InitialDataPayload,
  ServerInitialDataPayload,
  ServerStatusUpdatePayload,
  PlayersUpdatePayload,
  MessageUpdatePayload,
  SubscriptionRequest,
  SubscriptionConfirmation,
  InitialDataRequest,
} from "@createrington/shared/socket";
import {
  RoomType,
  SubscriptionType,
  SocketEvent,
} from "@createrington/shared/socket";

/**
 * WebSocket service configuration
 */
export interface WebSocketServiceConfig {
  /** CORS configuration */
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  /** Path for socket.io endpoint */
  path?: string;
  /** Maximum messages to include in initial data per server */
  maxInitialMessages?: number;
}

/**
 * Client socket with metadata
 */
export interface ClientSocket {
  id: string;
  subscriptions: Set<string>; // room names
  connectedAt: Date;
}

/**
 * Service statistics
 */
export interface WebSocketStats {
  connectedClients: number;
  rooms: Record<string, number>; // room name -> client count
  subscriptions: Record<SubscriptionType, number>; // subscription type -> total count
  uptime: number; // seconds
}

export type {
  ServerStatus,
  PlayerData,
  InitialDataPayload,
  ServerInitialDataPayload,
  ServerStatusUpdatePayload,
  PlayersUpdatePayload,
  MessageUpdatePayload,
  SubscriptionRequest,
  SubscriptionConfirmation,
  InitialDataRequest,
};

export { RoomType, SubscriptionType, SocketEvent };
