/**
 * WebSocket event types
 * Shared between server and client
 */
export enum SocketEvent {
  // Connection lifecycle
  CONNECTION = "connection",
  DISCONNECT = "disconnect",
  ERROR = "error",

  // Client actions
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  REQUEST_INITIAL_DATA = "request:initial",

  // Server->Client: Real-time updates
  UPDATE_SERVER_STATUS = "update:server:status",
  UPDATE_PLAYERS = "update:players",
  UPDATE_MESSAGE = "update:message",
}

/**
 * Subscription types for different data streams
 */
export enum SubscriptionType {
  SERVER_STATUS = "server:status",
  PLAYERS = "players",
  MESSAGES = "messages",
  ALL = "all",
}

/**
 * Room naming convention
 */
export enum RoomType {
  GLOBAL = "global",
  SERVER = "server",
  USER = "user",
}
