import {
  GALLERY_IMAGE_CONTENT_TYPES,
  GALLERY_MAX_ORIGINAL_BYTES,
} from "@createrington/shared/gallery";
import type { Message } from "discord.js";

export const GALLERY_INTAKE_REACTION = "📸";

export interface IntakeAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}

export interface IntakeMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  attachments: IntakeAttachment[];
}

export function toIntakeMessage(message: Message): IntakeMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.author.id,
    authorIsBot: message.author.bot,
    content: message.content,
    attachments: Array.from(message.attachments.values()).map((att) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      size: att.size,
      contentType: att.contentType,
      width: att.width,
      height: att.height,
    })),
  };
}

export function isImageAttachment(attachment: IntakeAttachment): boolean {
  const type = attachment.contentType?.split(";")[0].trim().toLowerCase();
  if (!type) return false;

  return (
    (GALLERY_IMAGE_CONTENT_TYPES as readonly string[]).includes(type) &&
    attachment.size <= GALLERY_MAX_ORIGINAL_BYTES
  );
}
