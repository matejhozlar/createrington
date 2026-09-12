import fs from "node:fs/promises";
import path from "node:path";
import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import type {
  DiscordStickyMessageService,
  StickyMessageSpec,
} from "@/services/discord/sticky-message";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import type { GallerySubmission } from "@createrington/shared/db";
import { GALLERY_MAX_ORIGINAL_BYTES } from "@createrington/shared/gallery";
import { detectImageType } from "./image";
import {
  isImageAttachment,
  type IntakeAttachment,
  type IntakeMessage,
} from "./intake";

export interface GalleryServiceOptions {
  intakeChannelId: string | undefined;
  originalsDir: string;
  serverId: number;
  noticeRepostDelayMs?: number;
  download?: (url: string) => Promise<Buffer>;
}

export interface GalleryIngestResult {
  created: GallerySubmission[];
}

const DOWNLOAD_TIMEOUT_MS = 30_000;
const NOTICE_REPOST_DELAY_MS = 5 * 60_000;

/**
 * Harvests screenshot submissions from the Discord intake channel. Every
 * image attachment posted there by a registered player becomes a pending
 * gallery_submission, with the original bytes saved under the private
 * originals directory at intake time (Discord attachment links expire). The
 * consent notice of the channel is kept at the bottom through
 * DiscordStickyMessageService. Everything is gated by the `gallery` feature
 * flag, so the service is inert until the flag is switched on.
 */
export class GalleryService {
  private readonly notice: StickyMessageSpec | null;
  private readonly download: (url: string) => Promise<Buffer>;

  constructor(
    private readonly sticky: DiscordStickyMessageService,
    private readonly options: GalleryServiceOptions,
  ) {
    this.download = options.download ?? downloadAttachment;
    this.notice = options.intakeChannelId
      ? {
          channelId: options.intakeChannelId,
          build: () => EmbedPresets.gallery.intakeNotice(),
          repostDelayMs: options.noticeRepostDelayMs ?? NOTICE_REPOST_DELAY_MS,
        }
      : null;
  }

  /** Creates the originals directory and, when the feature is enabled, makes sure the consent notice is present in the intake channel. */
  async initialize(): Promise<void> {
    await fs.mkdir(this.options.originalsDir, { recursive: true });

    if (!this.notice) {
      logger.warn(
        "Gallery intake channel is not configured, screenshot submissions are disabled",
      );
      return;
    }

    if (await this.isEnabled()) {
      await this.sticky.ensure(this.notice);
    }

    logger.info("GalleryService initialized");
  }

  /** Channel the intake handlers listen to; undefined when the Discord entity is not configured. */
  get intakeChannelId(): string | undefined {
    return this.options.intakeChannelId;
  }

  /** Turns a message from the intake channel into pending submissions, one per image attachment. Bot messages, unregistered authors, and a disabled flag yield nothing. */
  async ingest(message: IntakeMessage): Promise<GalleryIngestResult> {
    const none: GalleryIngestResult = { created: [] };

    if (
      !this.notice ||
      message.channelId !== this.notice.channelId ||
      message.authorIsBot
    ) {
      return none;
    }

    if (!(await this.isEnabled())) return none;

    this.sticky.touch(this.notice);

    const images = message.attachments.filter(isImageAttachment);
    if (images.length === 0) return none;

    const player = await Q.player.find({ discordId: message.authorId });
    if (!player) {
      logger.info(
        `Gallery: ignoring ${images.length} image(s) from unregistered Discord user ${message.authorId}`,
      );
      return none;
    }

    const caption = message.content.trim() || null;
    const created: GallerySubmission[] = [];

    for (const attachment of images) {
      try {
        const submission = await this.ingestAttachment(
          message,
          attachment,
          player.minecraftUuid,
          caption,
        );
        if (submission) created.push(submission);
      } catch (error) {
        logger.error(
          `Gallery: failed to ingest attachment ${attachment.id} from message ${message.id}:`,
          error,
        );
      }
    }

    if (created.length > 0) {
      logger.info(
        `Gallery: ${created.length} submission(s) created from message ${message.id} by ${player.minecraftUsername}`,
      );
    }

    return { created };
  }

  /** Withdraws every pending submission harvested from the given Discord message and deletes its stored originals. */
  async withdrawByMessage(messageId: string): Promise<number> {
    const pending = await this.pendingFromMessage(messageId);

    for (const submission of pending) {
      await Q.gallery.submission.update(
        { id: submission.id },
        { status: "withdrawn" },
      );
      await this.removeOriginal(submission.originalPath);
    }

    if (pending.length > 0) {
      logger.info(
        `Gallery: withdrew ${pending.length} pending submission(s) after message ${messageId} was deleted`,
      );
    }

    return pending.length;
  }

  /** Copies an edited message text onto every pending submission harvested from that message. */
  async updateCaption(messageId: string, content: string): Promise<number> {
    const caption = content.trim() || null;
    const pending = await this.pendingFromMessage(messageId);

    for (const submission of pending) {
      await Q.gallery.submission.update({ id: submission.id }, { caption });
    }

    return pending.length;
  }

  /** Absolute path of the stored original of a submission. */
  originalFilePath(
    submission: Pick<GallerySubmission, "originalPath">,
  ): string {
    return path.join(this.options.originalsDir, submission.originalPath);
  }

  private isEnabled(): Promise<boolean> {
    return featureFlagService.isEnabled(FeatureFlags.gallery);
  }

  private pendingFromMessage(messageId: string): Promise<GallerySubmission[]> {
    return Q.gallery.submission
      .where({ sourceMessageId: messageId, status: "pending" })
      .all();
  }

  private async ingestAttachment(
    message: IntakeMessage,
    attachment: IntakeAttachment,
    playerMinecraftUuid: string,
    caption: string | null,
  ): Promise<GallerySubmission | null> {
    const existing = await Q.gallery.submission.find({
      sourceMessageId: message.id,
      sourceAttachmentId: attachment.id,
    });
    if (existing) return null;

    const bytes = await this.download(attachment.url);
    if (bytes.length > GALLERY_MAX_ORIGINAL_BYTES) {
      logger.warn(
        `Gallery: attachment ${attachment.id} is ${bytes.length} bytes, over the ${GALLERY_MAX_ORIGINAL_BYTES} byte cap`,
      );
      return null;
    }

    const detected = detectImageType(bytes);
    if (!detected) {
      logger.warn(
        `Gallery: attachment ${attachment.id} (${attachment.name}) is not a png, jpeg or webp image`,
      );
      return null;
    }

    const originalPath = `${message.id}-${attachment.id}.${detected.extension}`;
    await fs.writeFile(
      path.join(this.options.originalsDir, originalPath),
      bytes,
    );

    try {
      return await Q.gallery.submission.createAndReturn({
        playerMinecraftUuid,
        serverId: this.options.serverId,
        caption,
        sourceChannelId: message.channelId,
        sourceMessageId: message.id,
        sourceAttachmentId: attachment.id,
        originalPath,
        originalContentType: detected.contentType,
        originalBytes: bytes.length,
        width: attachment.width,
        height: attachment.height,
      });
    } catch (error) {
      await this.removeOriginal(originalPath);
      throw error;
    }
  }

  private async removeOriginal(originalPath: string): Promise<void> {
    try {
      await fs.rm(path.join(this.options.originalsDir, originalPath), {
        force: true,
      });
    } catch (error) {
      logger.warn(`Gallery: failed to delete original ${originalPath}:`, error);
    }
  }
}

async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Attachment download failed with status ${response.status}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
