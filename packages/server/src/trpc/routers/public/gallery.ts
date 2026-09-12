import { z } from "zod";
import { router, publicProcedure, middleware } from "@/trpc/trpc";
import { Q } from "@/db";
import { buildPagination, paginationInput, trpcError } from "@/trpc/utils";
import { featureFlagService, FeatureFlags } from "@/services/feature-flag";
import { galleryImageUrls } from "@/services/gallery/urls";
import type { GallerySubmission } from "@createrington/shared/db";

const requireGalleryEnabled = middleware(async ({ next }) => {
  if (!(await featureFlagService.isEnabled(FeatureFlags.gallery))) {
    throw trpcError.forbidden("The gallery is currently disabled");
  }
  return next();
});

const galleryProcedure = publicProcedure.use(requireGalleryEnabled);

const publishedFilters = {
  status: "approved",
  fullKey: { $exists: true },
  thumbKey: { $exists: true },
} as const;

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
  const nameByUuid = new Map(
    players.map((player) => [player.minecraftUuid, player.minecraftUsername]),
  );

  function credit(minecraftUuid: string) {
    return {
      minecraftUuid,
      minecraftUsername: nameByUuid.get(minecraftUuid) ?? null,
    };
  }

  return rows.flatMap((row) => {
    const images = galleryImageUrls(row);
    if (!images) return [];

    return [
      {
        id: row.id,
        caption: row.caption,
        width: row.width,
        height: row.height,
        images,
        publishedAt: row.reviewedAt,
        author: credit(row.playerMinecraftUuid),
        credits: credits
          .filter((entry) => entry.submissionId === row.id)
          .map((entry) => credit(entry.playerMinecraftUuid)),
      },
    ];
  });
}

/** Public gallery router: approved screenshots with their credits, newest published first. */
export const publicGalleryRouter = router({
  isEnabled: publicProcedure
    .meta({ description: "Whether the public gallery is enabled" })
    .query(async () => ({
      enabled: await featureFlagService.isEnabled(FeatureFlags.gallery),
    })),

  list: galleryProcedure
    .meta({
      description: "List published gallery screenshots, newest approval first",
    })
    .input(z.object(paginationInput({ defaultLimit: 24, maxLimit: 48 })))
    .query(async ({ input }) => {
      const [rows, total] = await Promise.all([
        Q.gallery.submission
          .where(publishedFilters)
          .orderBy("reviewedAt", "desc")
          .paginate(input.page, input.limit)
          .all(),
        Q.gallery.submission.count(publishedFilters),
      ]);

      return {
        items: await serialize(rows),
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),
});
