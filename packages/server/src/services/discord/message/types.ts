import type {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  EmbedBuilder,
  Message,
  MessageCreateOptions,
} from "discord.js";

/**
 * Options for sending a new message
 */
export interface SendMessageOptions {
  /** Discord channel ID to send the message to */
  channelId: string;
  /** Optional text content of the message */
  content?: string;
  /** Optional embed to include in the message */
  embeds?: EmbedBuilder;
  /** Optional components (buttons, select menus) to attach */
  components?: ActionRowBuilder<ButtonBuilder>[];
  /** Optional file attachments to include */
  files?: AttachmentBuilder[];
  /** Optional message flags (e.g. MessageFlags.SuppressNotifications) */
  flags?: MessageCreateOptions["flags"];
}

/**
 * Options for editing an existing message
 */
export interface EditMessageOptions {
  /** Discord channel ID containing the message */
  channelId: string;
  /** Discord message ID to edit */
  messageId: string;
  /** Optional new text content */
  content?: string;
  /** Optional new embed */
  embeds?: EmbedBuilder;
  /** Optional new components */
  components?: ActionRowBuilder<ButtonBuilder>[];
  /** Optional new file attachments */
  files?: AttachmentBuilder[];
}

/**
 * Options for deleting a message
 */
export interface DeleteMessageOptions {
  /** Discord channel ID containing the message */
  channelId: string;
  /** Discord message ID to delete */
  messageId: string;
}

/**
 * Options for replying to a message
 */
export interface ReplyMessageOptions {
  /** Discord channel ID containing the message */
  channelId: string;
  /** Discord message ID to reply to */
  messageId: string;
  /** Optional content */
  content?: string;
  /** Optional embed to include in the reply */
  embeds?: EmbedBuilder;
  /** Optional components (buttons, select menus) to attach */
  components?: ActionRowBuilder<ButtonBuilder>[];
  /** Optional file attachments to include */
  files?: AttachmentBuilder[];
}

/**
 * Options for fetching a message
 */
export interface FetchMessageOptions {
  /** Discord channel ID containing the message */
  channelId: string;
  /** Discord message ID to fetch */
  messageId: string;
}

/**
 * Options for fetching a channel
 */
export interface FetchChannelOptions {
  /** Discord channel ID to fetch */
  channelId: string;
}

/**
 * Result of a message operation (send, edit, reply)
 */
export interface SendMessageResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Discord message ID if successful */
  messageId?: string;
  /** Full Message object if successful */
  message?: Message;
  /** Error message if failed */
  error?: string;
}
