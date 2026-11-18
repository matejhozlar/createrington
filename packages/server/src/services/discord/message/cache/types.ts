import type {
  CachedMessage,
  ParsedEmbed,
  ParsedAttachment,
  MinecraftMessageData,
  SystemMessageData,
} from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";

export interface ServerCacheConfig {
  serverId: number;
  channelId: string;
  maxMessages?: number;
}

export interface MessageCacheServiceConfig {
  servers: ServerCacheConfig[];
  loadHistoryOnStartup?: boolean;
}

export interface MessageQueryOptions {
  limit?: number;
  authorId?: string;
  contentContains?: string;
  after?: Date;
  before?: Date;
}

export type {
  CachedMessage,
  ParsedEmbed,
  ParsedAttachment,
  MinecraftMessageData,
  SystemMessageData,
};

export { MessageSource };
