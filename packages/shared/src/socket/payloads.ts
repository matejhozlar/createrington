import type { SubscriptionType } from "./events";
import type { CachedMessage } from "./messages";

/**
 * Server status data
 */
export interface ServerStatus {
  serverId: number;
  serverName: string;
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  lastUpdate: Date | string;
}

/**
 * Player data for WebSocket transmission
 */
export interface PlayerData {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date | string;
  sessionDuration: number; // seconds
}

/**
 * Initial data payload containing all current state
 */
export interface InitialDataPayload {
  servers: ServerStatus[];
  players: PlayerData[];
  messages: Record<number, CachedMessage[]>; // serverId -> messages
  timestamp: Date | string;
}

/**
 * Server-specific initial data
 */
export interface ServerInitialDataPayload {
  serverId: number;
  status: ServerStatus;
  players: PlayerData[];
  messages: CachedMessage[];
  timestamp: Date | string;
}

/**
 * Server status update payload
 */
export interface ServerStatusUpdatePayload {
  serverId: number;
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  timestamp: Date | string;
}

/**
 * Players update payload
 */
export interface PlayersUpdatePayload {
  serverId: number;
  type: "join" | "leave" | "sync";
  players?: PlayerData[]; // For sync
  player?: PlayerData; // For join/leave
  timestamp: Date | string;
}

/**
 * Message update payload
 */
export interface MessageUpdatePayload {
  serverId: number;
  type: "new" | "update" | "delete";
  message?: CachedMessage; // For new/update
  messageId?: string; // For delete
  timestamp: Date | string;
}

/**
 * Subscription request from client
 */
export interface SubscriptionRequest {
  type: SubscriptionType;
  serverId?: number; // Required for server-specific subscriptions
}

/**
 * Subscription confirmation
 */
export interface SubscriptionConfirmation {
  type: string; // SubscriptionType
  serverId?: number;
  room: string;
  success: boolean;
  error?: string;
}

/**
 * Initial data request from client
 */
export interface InitialDataRequest {
  serverId?: number; // If provided, only get data for this server
  includeMessages?: boolean;
  messageLimit?: number;
}

/**
 * Crypto price update payload (server -> client)
 */
export interface CryptoPriceUpdatePayload {
  tokenId: number;
  symbol: string;
  price: string;
  change24h: number;
  volume24h: string;
  availableSupply: string;
  isCrashed: boolean;
}
