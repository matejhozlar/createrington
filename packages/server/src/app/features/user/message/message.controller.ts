import { BadRequestError, NotFoundError } from "@/app/middleware";
import { getService, Services } from "@/services";
import type { DiscordMessageService } from "@/services/discord/message";
import { MESSAGE_CACHE_CONFIG } from "@/services/discord/message/cache";
import { AttachmentBuilder } from "discord.js";
import { Request, Response } from "express";
import type {
  SendMessageBody,
  SendMessageResponse,
} from "@createrington/shared/api";

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
 * Message controller
 *
 * Handles sending messages from the web client to a monitored Discord channel.
 *
 * The message is sent by the web bot, which means the bot's own messageCreate
 * listener will pick it up and add it to the MessageCacheService automatically.
 * There is no need to manually insert into the cache — the WebSocket broadcast
 * happens as a side-effect of the existing event pipeline.
 */
export class MessageController {
  /**
   * POST /api/messages
   *
   * Send a message to a Minecraft server's linked Discord channel.
   *
   * Body (multipart/form-data):
   * - serverId: number          (required) — target Minecraft server ID
   * - content:  string          (optional) — text content
   * - image:    file            (optional) — image attachment (≤ 10 MB, image/* only)
   *
   * At least one of `content` or `image` must be provided.
   *
   * The message is sent as a webhook-style post under the authenticated user's
   * display name and avatar when possible, falling back to the bot identity.
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    const { serverId: rawServerId, content: rawContent } =
      req.body as SendMessageBody;

    const serverId = parseInt(rawServerId, 10);

    const channelId = resolveChannelForServer(serverId);
    if (!channelId) {
      throw new NotFoundError(
        `No monitored channel configured for server ${serverId}`,
      );
    }

    const content =
      typeof req.body.content === "string" ? req.body.content.trim() : "";
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

      const ext = file.originalname.split(".").pop() ?? "png";
      const safeName = `image.${ext}`;

      attachment = new AttachmentBuilder(file.buffer, { name: safeName });
    }

    let messageContent = content;

    if (req.user) {
      const displayName = req.user.minecraftUsername ?? "Web User";

      if (messageContent) {
        messageContent = `**<${displayName}>**: ${messageContent}`;
      }
    }

    const messageService = await getService<DiscordMessageService>(
      Services.WEB_MESSAGE_SERVICE,
    );

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
