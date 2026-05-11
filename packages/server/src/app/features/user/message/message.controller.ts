import { BadRequestError, NotFoundError } from "@/app/middleware";
import { getService, Services } from "@/services";
import { MESSAGE_CACHE_CONFIG } from "@/services/discord/message/cache";
import { AttachmentBuilder } from "discord.js";
import type { Request, Response } from "express";
import {
  SendMessageBodySchema,
  type SendMessageResponse,
} from "@createrington/shared/api";

/** 10 MB hard cap for uploaded images (must match multer config in routes) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** MIME types we accept for image uploads */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * Resolves the monitored Discord channel ID for a given Minecraft Server
 * Only servers present in MESSAGE_CACHE_CONFIG are valid targets - sending to
 * any other channel would bypass the cache entirely
 */
function resolveChannelForServer(serverId: number): string | null {
  const entry = MESSAGE_CACHE_CONFIG.servers.find(
    (s) => s.serverId === serverId,
  );
  return entry?.channelId ?? null;
}

/**
 * Message Controller
 *
 * Handles sending messages from the web client to a monitored Discord channel:
 * - Validates image attachments (MIME type and size)
 * - Resolves the target Discord channel for the requested Minecraft server
 * - Prefixes text content with the sender's Minecraft username
 * - Delegates delivery to WEB_MESSAGE_SERVICE
 *
 * NOTE: The web bot's own messageCreate listener picks up the sent message and
 * inserts it into MessageCacheService, there is no need to update the cache
 * manually here. The WebSocket broadcast is a side-effect of that pipeline.
 */
export class MessageController {
  /**
   * Sends a message to the Discord channel linked to a Minecraft server.
   *
   * Validates the uploaded image if present, resolves the channel for the
   * given `serverId`, prepends the sender's display name to the text content,
   * and forwards the payload to WEB_MESSAGE_SERVICE.
   *
   * @param req - Express request with multipart body (serverId, content, image)
   * @param res - Express response; returns 201 with messageId, serverId, channelId
   * @returns Promise that resolves when the message has been delivered
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    const { serverId, content } = SendMessageBodySchema.parse(req.body);

    const channelId = resolveChannelForServer(serverId);
    if (!channelId) {
      throw new NotFoundError(
        `No monitored channel configured for server ${serverId}`,
      );
    }

    const file = req.file;

    if (!content && !file) {
      throw new BadRequestError(
        "At least one of 'content' or 'image' is required",
      );
    }

    let attachment: AttachmentBuilder | undefined;

    if (file) {
      if (!file.mimetype || !ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
        throw new BadRequestError(
          "Invalid image type. Allowed: png, jpeg, gif, webp",
        );
      }

      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestError("Image must be maximum of 10MB");
      }

      const SAFE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
      const rawExt = file.originalname.split(".").pop()?.toLowerCase() ?? "png";
      const ext = SAFE_EXTS.has(rawExt) ? rawExt : "png";
      const safeName = `image.${ext}`;

      attachment = new AttachmentBuilder(file.buffer, { name: safeName });
    }

    let messageContent = content?.trim();

    if (req.user) {
      const displayName = req.user.minecraftUsername ?? "Web User";

      if (messageContent) {
        messageContent = `**<${displayName}>**: ${messageContent}`;
      }
    }

    const messageService = await getService(Services.WEB_MESSAGE_SERVICE);

    const result = await messageService.send({
      channelId,
      content: messageContent || undefined,
      files: attachment ? [attachment] : undefined,
    });

    if (!result.success) {
      logger.error(
        `Failed to send web message to channel ${channelId}:`,
        result.error,
      );

      throw new BadRequestError(result.error ?? "Failed to send message");
    }

    const response: SendMessageResponse = {
      success: true,
      data: {
        messageId: result.messageId!,
        serverId,
        channelId,
      },
      message: "Message sent successfully",
    };

    res.status(201).json(response);
  }
}
