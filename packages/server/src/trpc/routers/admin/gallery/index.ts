import { z } from "zod";
import config from "@/config";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import {
  auditActor,
  buildPagination,
  paginationInput,
  rethrowTrpc,
  trpcError,
} from "@/trpc/utils";
import { container, Services } from "@/services/container";
import {
  galleryRewardAmountSchema,
  galleryWeeklyRewardCapSchema,
  settings,
} from "@/services/settings";
import type { GallerySubmission, Player } from "@createrington/shared/db";
import {
  GALLERY_MAX_CAPTION_LENGTH,
  GALLERY_SUBMISSION_STATUSES,
} from "@createrington/shared/gallery";

const statusSchema = z.enum(GALLERY_SUBMISSION_STATUSES);
const idInput = z.object({ id: z.number().int().positive() });

const MAX_NOTE_LENGTH = 500;
const MAX_CREDITS = 10;

function gallery() {
  return container.getSync(Services.GALLERY_SERVICE);
}

function playerSummary(player: Player | undefined, minecraftUuid: string) {
  return {
    minecraftUuid,
    minecraftUsername: player?.minecraftUsername ?? "Unknown player",
    discordId: player?.discordId ?? null,
  };
}

function announcementUrl(row: GallerySubmission): string | null {
  if (!row.announcementChannelId || !row.announcementMessageId) return null;
  return `https://discord.com/channels/${config.discord.guild.id}/${row.announcementChannelId}/${row.announcementMessageId}`;
}

async function serialize(rows: GallerySubmission[]) {
  const credits =
    rows.length > 0
      ? await Q.gallery.submission.credit
          .where({ submissionId: { $in: rows.map((row) => row.id) } })
          .all()
      : [];

  const uuids = [
    ...new Set([
      ...rows.map((row) => row.playerMinecraftUuid),
      ...credits.map((credit) => credit.playerMinecraftUuid),
    ]),
  ];
  const players =
    uuids.length > 0
      ? await Q.player.where({ minecraftUuid: { $in: uuids } }).all()
      : [];
  const byUuid = new Map(
    players.map((player) => [player.minecraftUuid, player]),
  );

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    caption: row.caption,
    width: row.width,
    height: row.height,
    originalBytes: row.originalBytes,
    originalContentType: row.originalContentType,
    sourceChannelId: row.sourceChannelId,
    sourceMessageId: row.sourceMessageId,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    rejectNote: row.rejectNote,
    rewardAmount: row.rewardAmount,
    announcementUrl: announcementUrl(row),
    author: playerSummary(
      byUuid.get(row.playerMinecraftUuid),
      row.playerMinecraftUuid,
    ),
    credits: credits
      .filter((credit) => credit.submissionId === row.id)
      .map((credit) =>
        playerSummary(
          byUuid.get(credit.playerMinecraftUuid),
          credit.playerMinecraftUuid,
        ),
      ),
    images: gallery().imageUrls(row),
    originalUrl:
      row.status === "pending" || row.status === "approved"
        ? `/api/gallery/submissions/${row.id}/original`
        : null,
  }));
}

async function serializeOne(row: GallerySubmission) {
  const [item] = await serialize([row]);
  return item;
}

async function findOrThrow(id: number): Promise<GallerySubmission> {
  const row = await Q.gallery.submission.find({ id });
  if (!row) {
    throw trpcError.notFound("Gallery submission not found");
  }
  return row;
}

const settingsRouter = router({
  get: adminProcedure
    .meta({ description: "Current gallery reward amount and weekly cap" })
    .query(async () => {
      const [rewardAmount, weeklyRewardCap] = await Promise.all([
        settings.getGalleryRewardAmount(),
        settings.getGalleryWeeklyRewardCap(),
      ]);
      return { rewardAmount, weeklyRewardCap };
    }),

  update: adminProcedure
    .meta({
      description:
        "Update the gallery reward amount and weekly cap, then repost the rules notice",
    })
    .input(
      z.object({
        rewardAmount: galleryRewardAmountSchema,
        weeklyRewardCap: galleryWeeklyRewardCapSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await settings.setGalleryRewardAmount(
        input.rewardAmount,
        ctx.user.discordId,
      );
      await settings.setGalleryWeeklyRewardCap(
        input.weeklyRewardCap,
        ctx.user.discordId,
      );

      await Q.admin.log.action.logAction({
        ...auditActor(ctx),
        actionType: "gallery_settings_update",
        description: `Gallery reward set to ${input.rewardAmount} coins, weekly cap ${input.weeklyRewardCap}`,
      });

      gallery()
        .refreshNotice()
        .catch((error) =>
          logger.error("Failed to repost the gallery rules notice:", error),
        );

      return input;
    }),
});

/** Admin gallery router: review queue, approval with reward and credits, rejection, removal, and reward settings. */
export const adminGalleryRouter = router({
  list: adminProcedure
    .meta({
      description:
        "List gallery submissions by status; pending ones oldest first, the rest newest first",
    })
    .input(
      z.object({
        status: statusSchema.optional(),
        ...paginationInput({ defaultLimit: 20, maxLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const filters = input.status ? { status: input.status } : {};
      const direction = input.status === "pending" ? "asc" : "desc";

      const [rows, total, ...countValues] = await Promise.all([
        Q.gallery.submission
          .where(filters)
          .orderBy("createdAt", direction)
          .paginate(input.page, input.limit)
          .all(),
        Q.gallery.submission.count(filters),
        ...GALLERY_SUBMISSION_STATUSES.map((status) =>
          Q.gallery.submission.count({ status }),
        ),
      ]);

      const counts = Object.fromEntries(
        GALLERY_SUBMISSION_STATUSES.map((status, index) => [
          status,
          countValues[index],
        ]),
      ) as Record<(typeof GALLERY_SUBMISSION_STATUSES)[number], number>;

      return {
        items: await serialize(rows),
        pagination: buildPagination(input.page, input.limit, total),
        counts,
      };
    }),

  get: adminProcedure
    .meta({
      description:
        "One submission with its author, credits, and the reward status of the author",
    })
    .input(idInput)
    .query(async ({ input }) => {
      const row = await findOrThrow(input.id);
      const [item, defaultAmount, weeklyCap, weeklyUsed] = await Promise.all([
        serializeOne(row),
        settings.getGalleryRewardAmount(),
        settings.getGalleryWeeklyRewardCap(),
        gallery().weeklyRewardsUsed(row.playerMinecraftUuid),
      ]);

      return {
        ...item,
        reward: {
          defaultAmount,
          weeklyCap,
          weeklyUsed,
          capReached: weeklyUsed >= weeklyCap,
        },
      };
    }),

  approve: adminProcedure
    .meta({
      description:
        "Approve a pending submission: publish variants, pay the reward, credit extra players, announce it",
    })
    .input(
      idInput.extend({
        caption: z
          .string()
          .max(GALLERY_MAX_CAPTION_LENGTH)
          .nullable()
          .optional(),
        rewardAmount: galleryRewardAmountSchema.optional(),
        creditPlayerUuids: z
          .array(z.string().uuid())
          .max(MAX_CREDITS)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await gallery().approve(
          input.id,
          { discordId: ctx.user.discordId },
          {
            caption: input.caption,
            rewardAmount: input.rewardAmount,
            creditPlayerUuids: input.creditPlayerUuids,
          },
        );
        const item = await serializeOne(result.submission);

        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "gallery_submission_approve",
          description: `Approved gallery screenshot #${input.id} (reward ${result.rewardPaid}${result.capReached ? ", weekly cap reached" : ""})`,
          targetPlayerUuid: item.author.minecraftUuid,
          targetPlayerName: item.author.minecraftUsername,
        });

        return {
          item,
          rewardPaid: result.rewardPaid,
          capReached: result.capReached,
          announced: result.announced,
        };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  reject: adminProcedure
    .meta({
      description:
        "Reject a pending submission with an optional note and delete its original",
    })
    .input(idInput.extend({ note: z.string().max(MAX_NOTE_LENGTH).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await gallery().reject(
          input.id,
          { discordId: ctx.user.discordId },
          input.note,
        );
        const item = await serializeOne(row);

        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "gallery_submission_reject",
          description: `Rejected gallery screenshot #${input.id}`,
          reason: input.note?.trim() || undefined,
          targetPlayerUuid: item.author.minecraftUuid,
          targetPlayerName: item.author.minecraftUsername,
        });

        return item;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  remove: adminProcedure
    .meta({
      description:
        "Pull an approved screenshot from the gallery, deleting its published files and announcement",
    })
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await gallery().remove(input.id, {
          discordId: ctx.user.discordId,
          isAdmin: true,
        });
        const item = await serializeOne(row);

        await Q.admin.log.action.logAction({
          ...auditActor(ctx),
          actionType: "gallery_submission_remove",
          description: `Removed gallery screenshot #${input.id}`,
          targetPlayerUuid: item.author.minecraftUuid,
          targetPlayerName: item.author.minecraftUsername,
        });

        return item;
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  settings: settingsRouter,
});
