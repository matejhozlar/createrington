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

  // Server->Client: Initial data responses
  INITIAL_DATA = "initial:data",

  // Server->Client: Real-time updates
  UPDATE_SERVER_STATUS = "update:server:status",
  UPDATE_PLAYERS = "update:players",
  UPDATE_MESSAGE = "update:message",
  UPDATE_CRYPTO_PRICES = "update:crypto:prices",
  UPDATE_CRYPTO_ORDER = "update:crypto:order",

  // Acknowledgments
  SUBSCRIBED = "subscribed",
  UNSUBSCRIBED = "unsubscribed",
}

/**
 * Subscription types for different data streams
 */
export enum SubscriptionType {
  SERVER_STATUS = "server:status",
  PLAYERS = "players",
  MESSAGES = "messages",
  CRYPTO_MARKET = "crypto:market",
  ALL = "all",
}

/**
 * Room naming convention
 */
export enum RoomType {
  GLOBAL = "global",
  SERVER = "server",
}
