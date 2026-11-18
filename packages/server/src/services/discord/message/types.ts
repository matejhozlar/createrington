import type {
  AttachmentBuilder,
  EmbedBuilder,
  MessageCreateOptions,
  MessageEditOptions,
} from "discord.js";

export interface SendMessageOptions {
  channelId: string;
  content?: string;
  embeds?: EmbedBuilder;
  components?: MessageCreateOptions["components"];
  files?: AttachmentBuilder[];
  flags?: MessageCreateOptions["flags"];
  allowedMentions?: MessageCreateOptions["allowedMentions"];
}

export interface EditMessageOptions {
  channelId: string;
  messageId: string;
  content?: string | null;
  embeds?: EmbedBuilder | null;
  components?: MessageEditOptions["components"] | null;
  files?: AttachmentBuilder[];
  flags?: MessageEditOptions["flags"];
}

export interface DeleteMessageOptions {
  channelId: string;
  messageId: string;
}

export interface FetchMessageOptions {
  channelId: string;
  messageId: string;
}
