import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/app/middleware/error-handler";
import { balanceRepo, db, Q } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { ConstraintViolationError, translateDbError } from "@/db/utils/errors";
import { EmbedPresets } from "@/discord/embeds";
import type {
  DiscordStickyMessageService,
  StickyMessageSpec,
} from "@/services/discord/sticky-message";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import { settings } from "@/services/settings";
import { objectStorage } from "@/services/storage";
import type { GallerySubmission } from "@createrington/shared/db";
import {
  galleryCaption,
  GALLERY_MAX_ORIGINAL_BYTES,
} from "@createrington/shared/gallery";
import {
  announceApproval,
  deleteAnnouncement,
  markSourceMessage,
} from "./discord";
import { detectImageType } from "./image";
import {
  isImageAttachment,
  type IntakeAttachment,
  type IntakeMessage,
} from "./intake";
import { createGalleryVariants } from "./variants";

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

export interface GalleryReviewer {
  discordId: string;
}

export interface GalleryApproveInput {
  caption?: string | null;
  rewardAmount?: number;
  creditPlayerUuids?: string[];
}

export interface GalleryApproveResult {
  submission: GallerySubmission;
  rewardPaid: number;
  capReached: boolean;
  announced: boolean;
}

export interface GalleryRemover {
  discordId: string;
  isAdmin: boolean;
}

const DOWNLOAD_TIMEOUT_MS = 30_000;
const NOTICE_REPOST_DELAY_MS = 5 * 60_000;
const REWARD_WINDOW_MS = 7 * 24 * 60 * 60_000;
const STORAGE_PREFIX = "gallery";

/**
 * Owns the screenshot gallery lifecycle. Intake harvests image attachments
 * posted in the Discord submissions channel by registered players into
 * pending gallery_submission rows, saving the original bytes under the
 * private originals directory (Discord attachment links expire). Review
 * moves a row to approved (webp variants uploaded to object storage,
 * reward paid once under a rolling weekly cap, announcement posted) or
 * rejected (original deleted); the author or an admin can later withdraw an
 * approved one. The submissions channel carries a sticky rules notice via
 * DiscordStickyMessageService. Intake is gated by the `gallery` feature
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
          build: async () =>
            EmbedPresets.gallery.intakeNotice(
              await settings.getGalleryRewardAmount(),
            ),
          repostDelayMs: options.noticeRepostDelayMs ?? NOTICE_REPOST_DELAY_MS,
        }
      : null;
  }

  /** Creates the originals directory and, when the feature is enabled, makes sure the rules notice is present in the submissions channel. */
  async initialize(): Promise<void> {
    await fs.mkdir(this.options.originalsDir, { recursive: true });

    if (!this.notice) {
      logger.warn(
        "Gallery submissions channel is not configured, screenshot submissions are disabled",
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

  /** Reposts the rules notice so it reflects the current reward setting; no-op while the feature is off. */
  async refreshNotice(): Promise<void> {
    if (this.notice && (await this.isEnabled())) {
      await this.sticky.repost(this.notice);
    }
  }

  /** Turns a message from the submissions channel into pending submissions, one per image attachment. Bot messages, unregistered authors, and a disabled flag yield nothing. */
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

    const caption = galleryCaption(message.content);
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
    const caption = galleryCaption(content);
    const pending = await this.pendingFromMessage(messageId);

    for (const submission of pending) {
      await Q.gallery.submission.update({ id: submission.id }, { caption });
    }

    return pending.length;
  }

  /** Publishes a pending submission: uploads webp variants, pays the reward (skipped past the weekly cap), records credits, and announces it in the gallery channel. */
  async approve(
    id: number,
    reviewer: GalleryReviewer,
    input: GalleryApproveInput = {},
  ): Promise<GalleryApproveResult> {
    const submission = await this.requirePending(id);

    if (!objectStorage.enabled) {
      throw new BadRequestError(
        "Object storage is not configured, set the R2_* environment variables",
      );
    }

    const author = await Q.player.find({
      minecraftUuid: submission.playerMinecraftUuid,
    });
    if (!author) {
      throw new NotFoundError("Submitting player no longer exists");
    }

    const original = await this.readOriginal(submission);
    const variants = await createGalleryVariants(original);
    const token = randomBytes(6).toString("hex");
    const fullKey = `${STORAGE_PREFIX}/${id}-${token}.webp`;
    const thumbKey = `${STORAGE_PREFIX}/${id}-${token}-thumb.webp`;

    await objectStorage.put({
      key: fullKey,
      body: variants.full.body,
      contentType: variants.full.contentType,
    });
    await objectStorage.put({
      key: thumbKey,
      body: variants.thumb.body,
      contentType: variants.thumb.contentType,
    });

    const [defaultAmount, cap, used] = await Promise.all([
      settings.getGalleryRewardAmount(),
      settings.getGalleryWeeklyRewardCap(),
      this.weeklyRewardsUsed(author.minecraftUuid),
    ]);
    const requested = input.rewardAmount ?? defaultAmount;
    const capReached = used >= cap;
    const rewardAmount = capReached ? 0 : requested;

    const creditUuids = [...new Set(input.creditPlayerUuids ?? [])].filter(
      (uuid) => uuid !== author.minecraftUuid,
    );
    const caption =
      input.caption === undefined
        ? submission.caption
        : galleryCaption(input.caption ?? "");

    if (rewardAmount > 0) {
      const balance = await Q.player.balance.find({
        minecraftUuid: author.minecraftUuid,
      });
      if (!balance) {
        await balanceRepo.create(author.minecraftUuid, 0);
      }
    }

    const approved = await this.withUploadCleanup(
      [fullKey, thumbKey],
      async () =>
        db.inTransaction(async (tx) => {
          const locked = await tx.gallery.submission.getForUpdate(id);
          if (!locked || locked.status !== "pending") {
            throw new ConflictError(
              `Gallery submission is already ${locked?.status ?? "gone"}`,
            );
          }

          let rewardTransactionId: number | null = null;

          if (rewardAmount > 0) {
            const idempotencyKey = `gallery-reward:${id}`;
            await balanceRepo.add(
              { minecraftUuid: author.minecraftUuid },
              rewardAmount,
              `Gallery screenshot #${id} approved`,
              BalanceTransactionType.GALLERY_REWARD,
              { tx, idempotencyKey, metadata: { gallerySubmissionId: id } },
            );
            const ledger = await tx.player.balance.transaction
              .where({ idempotencyKey })
              .orderBy("id", "desc")
              .limit(1)
              .all();
            rewardTransactionId = ledger[0]?.id ?? null;
          }

          const row = await tx.gallery.submission.updateAndReturn(
            { id },
            {
              status: "approved",
              caption,
              fullKey,
              thumbKey,
              width: variants.full.width,
              height: variants.full.height,
              reviewedBy: reviewer.discordId,
              reviewedAt: new Date(),
              rewardAmount,
              rewardTransactionId,
            },
          );

          for (const playerMinecraftUuid of creditUuids) {
            await tx.gallery.submission.credit.create({
              submissionId: id,
              playerMinecraftUuid,
            });
          }

          return row;
        }),
    );

    const creditNames =
      creditUuids.length > 0
        ? (
            await Q.player.where({ minecraftUuid: { $in: creditUuids } }).all()
          ).map((player) => player.minecraftUsername)
        : [];

    const announcement = await announceApproval({
      submissionId: id,
      authorDiscordId: author.discordId,
      caption,
      creditNames,
      rewardAmount,
      imageUrl: objectStorage.publicUrl(fullKey),
    });

    let final = approved;
    if (announcement) {
      final = await Q.gallery.submission.updateAndReturn(
        { id },
        {
          announcementChannelId: announcement.channelId,
          announcementMessageId: announcement.messageId,
        },
      );
    }

    await markSourceMessage(
      submission.sourceChannelId,
      submission.sourceMessageId,
      "approved",
    );

    logger.info(
      `Gallery: submission #${id} by ${author.minecraftUsername} approved by ${reviewer.discordId} (reward ${rewardAmount}${capReached ? ", weekly cap reached" : ""})`,
    );

    return {
      submission: final,
      rewardPaid: rewardAmount,
      capReached,
      announced: announcement !== null,
    };
  }

  /** Rejects a pending submission with an optional note for the audit trail and deletes its stored original. */
  async reject(
    id: number,
    reviewer: GalleryReviewer,
    note?: string,
  ): Promise<GallerySubmission> {
    const submission = await this.requirePending(id);

    const rejected = await Q.gallery.submission.updateAndReturn(
      { id },
      {
        status: "rejected",
        reviewedBy: reviewer.discordId,
        reviewedAt: new Date(),
        rejectNote: note?.trim() || null,
      },
    );

    await this.removeOriginal(submission.originalPath);
    await markSourceMessage(
      submission.sourceChannelId,
      submission.sourceMessageId,
      "rejected",
    );

    logger.info(`Gallery: submission #${id} rejected by ${reviewer.discordId}`);

    return rejected;
  }

  /** Pulls an approved submission from the gallery: only the author or an admin may do it. Published variants, the announcement, and the original are deleted; the reward is kept. */
  async remove(id: number, actor: GalleryRemover): Promise<GallerySubmission> {
    const submission = await Q.gallery.submission.find({ id });
    if (!submission) {
      throw new NotFoundError("Gallery submission not found");
    }
    if (submission.status !== "approved") {
      throw new ConflictError("Only approved screenshots can be removed");
    }

    if (!actor.isAdmin) {
      const author = await Q.player.find({
        minecraftUuid: submission.playerMinecraftUuid,
      });
      if (author?.discordId !== actor.discordId) {
        throw new ForbiddenError(
          "Only the author or an admin can remove this screenshot",
        );
      }
    }

    const removed = await Q.gallery.submission.updateAndReturn(
      { id },
      {
        status: "withdrawn",
        announcementChannelId: null,
        announcementMessageId: null,
      },
    );

    const keys = [submission.fullKey, submission.thumbKey].filter(
      (key): key is string => key !== null,
    );
    if (keys.length > 0 && objectStorage.enabled) {
      try {
        await objectStorage.delete(keys);
      } catch (error) {
        logger.error(
          `Gallery: failed to delete published files of #${id}:`,
          error,
        );
      }
    }

    if (submission.announcementChannelId && submission.announcementMessageId) {
      await deleteAnnouncement({
        channelId: submission.announcementChannelId,
        messageId: submission.announcementMessageId,
      });
    }

    await this.removeOriginal(submission.originalPath);

    logger.info(`Gallery: submission #${id} removed by ${actor.discordId}`);

    return removed;
  }

  /** Number of rewarded approvals a player received in the rolling weekly window. */
  async weeklyRewardsUsed(playerMinecraftUuid: string): Promise<number> {
    return Q.gallery.submission.count({
      playerMinecraftUuid,
      rewardTransactionId: { $exists: true },
      reviewedAt: { $gte: new Date(Date.now() - REWARD_WINDOW_MS) },
    });
  }

  /** Absolute path of the stored original of a submission. */
  originalFilePath(
    submission: Pick<GallerySubmission, "originalPath">,
  ): string {
    return path.join(this.options.originalsDir, submission.originalPath);
  }

  /** Directory holding the stored originals, for serving them with a root constraint. */
  get originalsDir(): string {
    return this.options.originalsDir;
  }

  private isEnabled(): Promise<boolean> {
    return featureFlagService.isEnabled(FeatureFlags.gallery);
  }

  private async requirePending(id: number): Promise<GallerySubmission> {
    const submission = await Q.gallery.submission.find({ id });
    if (!submission) {
      throw new NotFoundError("Gallery submission not found");
    }
    if (submission.status !== "pending") {
      throw new ConflictError(
        `Gallery submission is already ${submission.status}`,
      );
    }
    return submission;
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
      const translated = translateDbError(error);
      // A unique violation means a concurrent delivery of the same message
      // already owns this file, so deleting it would strand that row.
      if (!(translated instanceof ConstraintViolationError)) {
        await this.removeOriginal(originalPath);
      }
      throw translated;
    }
  }

  private async withUploadCleanup<T>(
    keys: string[],
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      try {
        await objectStorage.delete(keys);
      } catch (cleanupError) {
        logger.error(
          `Gallery: failed to delete the uploads of an abandoned approval (${keys.join(", ")}):`,
          cleanupError,
        );
      }
      throw error;
    }
  }

  private async readOriginal(
    submission: Pick<GallerySubmission, "id" | "originalPath">,
  ): Promise<Buffer> {
    try {
      return await fs.readFile(this.originalFilePath(submission));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ConflictError(
          "The stored image is gone, so this screenshot can no longer be published. Reject it and ask the player to post it again.",
        );
      }
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
