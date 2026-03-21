/**
 * Message source types
 */
export enum MessageSource {
  SYSTEM = "system",
  DISCORD = "discord",
  MINECRAFT = "minecraft",
  WEB = "web",
}

/**
 * Cached message data with relevant metadata
 * Shared between server cache and frontend
 */
export interface CachedMessage {
  /** Discord message ID */
  messageId: string;
  /** Channel ID where message was sent */
  channelId: string;
  /** Server ID this channel belongs to */
  serverId: number;
  /** Author's Discord user ID */
  authorId: string;
  /** Author's username */
  authorUsername: string;
  /** Author's server displayname */
  authorDisplayname: string;
  /** Author's avatar url */
  authorAvatarUrl: string;
  /** Author's tag */
  authorTag: string;
  /** Message Content */
  content: string;
  /** When the message was created */
  createdAt: Date | string;
  /** When the message was edited */
  editedAt?: Date | string;
  /** Attachment data */
  attachments: ParsedAttachment[];
  /** Embed data */
  embeds: ParsedEmbed[];
  /** Whether message was sent by a bot */
  isBot: boolean;
  /** Referenced message ID (for replies) */
  referenceMessageId?: string;

  source: MessageSource;
  minecraftData?: MinecraftMessageData;
  systemData?: SystemMessageData;
  webData?: WebMessageData;
}

/**
 * Parsed embed for web <-> Discord
 */
export interface ParsedEmbed {
  type?: string;
  title?: string;
  description?: string;
  url?: string;
  color?: number | string;
  timestamp?: string;
  footer?: {
    text: string;
    iconUrl?: string;
  };
  author?: {
    name: string;
    iconUrl?: string;
    url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
  video?: {
    url: string;
    width?: number;
    height?: number;
  };
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
}

/**
 * Parsed attachment
 */
export interface ParsedAttachment {
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface MinecraftMessageData {
  playerName: string;
}

export interface SystemMessageData {
  title?: string;
  description?: string;
}

export interface WebMessageData {
  originalAuthor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}
