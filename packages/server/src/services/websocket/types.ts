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

export interface WebSocketServiceConfig {
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  path?: string;
  maxInitialMessages?: number;
}

export interface WebSocketStats {
  connectedClients: number;
  rooms: Record<string, number>;
  subscriptions: Record<SubscriptionType, number>;
  uptime: number;
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
