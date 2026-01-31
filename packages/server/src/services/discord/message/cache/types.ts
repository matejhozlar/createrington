import type {
  CachedMessage,
  ParsedEmbed,
  ParsedAttachment,
  MinecraftMessageData,
  SystemMessageData,
  WebMessageData,
} from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";

/**
 * Configuration for a single server's message cache
 */
export interface ServerCacheConfig {
  /** Minecraft server ID */
  serverId: number;
  /** Discord channel ID to monitor */
  channelId: string;
  /** Maximum message to cache (default: 100) */
  maxMessages?: number;
}

/**
 * Service configuration
 */
export interface MessageCacheServiceConfig {
  /** Array of server configurations */
  servers: ServerCacheConfig[];
  /** Whether to load historical data on startup */
  loadHistoryOnStartup?: boolean;
  /** Bot data */
  botConfig: {
    createringtonBotId: string;
    createringtonWebhookId?: string;
  };
}

/**
 * Query options for retrieving messages
 */
export interface MessageQueryOptions {
  /** Limit number of results */
  limit?: number;
  /** Filter by author ID */
  authorId?: string;
  /** Filter by content (case-insensitive substring match) */
  contentContains?: string;
  /** Get messages after this timestamp */
  after?: Date;
  /** Get messages before this timestamp */
  before?: Date;
}

export type {
  CachedMessage,
  ParsedEmbed,
  ParsedAttachment,
  MinecraftMessageData,
  SystemMessageData,
  WebMessageData,
};

export { MessageSource };
