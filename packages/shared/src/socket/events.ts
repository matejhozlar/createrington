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
  // Broadcast to all subscribers when token prices tick
  UPDATE_CRYPTO_PRICES = "update:crypto:prices",
  // Sent to the owning player when one of their pending orders is filled or cancelled
  UPDATE_CRYPTO_ORDER = "update:crypto:order",
  // Broadcast when a significant market event occurs (crash, listing, etc.)
  CRYPTO_MARKET_EVENT = "crypto:market:event",
  // Sent to the owning player when one of their price alerts triggers
  CRYPTO_NEWS = "crypto:news",

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
  // Subscribes to price ticks, order updates, market events, and news
  CRYPTO_MARKET = "crypto:market",
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
