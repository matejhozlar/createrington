import type { Socket } from "socket.io-client";
import type {
  InitialDataPayload,
  ServerInitialDataPayload,
  SubscriptionType,
  PlayerData,
  ServerStatus,
} from "@createrington/shared/socket";

/**
 * Connection state
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * WebSocket statistics
 */
export interface WebSocketStats {
  /** When connection was established */
  connectedAt: Date | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Current latency in ms */
  latency: number | null;
}

/**
 * WebSocket configuration
 */
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
  /** Max reconnection attempts (defaults to 5) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (defaults to 1000) */
  reconnectDelay?: number;
  /** Health check interval in ms (optional) */
  healthCheckInterval?: number;
}

/**
 * WebSocket context type
 */
export interface WebSocketContextType {
  // Connection state
  socket: Socket | null;
  connectionState: ConnectionState;
  error: Error | null;
  stats: WebSocketStats;
  isConnected: boolean;

  // Connection methods
  connect: () => void;
  disconnect: () => void;
  ping: () => void;

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

/**
 * Server statistics
 */
export interface ServerStats {
  total: number;
  online: number;
  offline: number;
  totalPlayers: number;
  totalCapacity: number;
  averageLoad: number;
}

/**
 * Server data context type
 */
export interface ServerDataContextType {
  // State
  servers: ServerStatus[];
  serverMap: Map<number, ServerStatus>;
  loading: boolean;
  error: Error | null;
  stats: ServerStats;
  isSubscribed: boolean;

  // Methods
  getServer: (serverId: number) => ServerStatus | undefined;
  getAllServers: () => ServerStatus[];
  getOnlineServers: () => ServerStatus[];
  getOfflineServers: () => ServerStatus[];
  isServerOnline: (serverId: number) => boolean;
  refresh: () => Promise<void>;
  subscribeToUpdates: () => Promise<void>;
  unsubscribeFromUpdates: () => Promise<void>;
}

/**
 * Player statistics
 */
export interface PlayerStats {
  total: number;
  byServer: Record<number, number>;
  averageSessionDuration: number; // in seconds
  recentJoins: number;
  recentLeaves: number;
}

/**
 * Player data context type
 */
export interface PlayerDataContextType {
  // State
  players: PlayerData[];
  playerMap: Map<string, PlayerData>;
  loading: boolean;
  error: Error | null;
  stats: PlayerStats;
  isSubscribed: boolean;
  recentJoins: PlayerData[];
  recentLeaves: PlayerData[];

  // Methods
  getPlayer: (uuid: string) => PlayerData | undefined;
  getPlayerByUsername: (username: string) => PlayerData | undefined;
  getAllPlayers: () => PlayerData[];
  getServerPlayers: (serverId: number) => PlayerData[];
  isPlayerOnline: (uuid: string) => boolean;
  getServerPlayerCount: (serverId: number) => number;
  refresh: () => Promise<void>;
  clearRecentEvents: () => void;
  subscribeToUpdates: () => Promise<void>;
  unsubscribeFromUpdates: () => Promise<void>;
}
