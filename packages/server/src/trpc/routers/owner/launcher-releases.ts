import { z } from "zod";
import { router, ownerProcedure, launcherAvailable } from "@/trpc/trpc";
import { id, paginateQuery, paginationInput, rethrowTrpc } from "@/trpc/utils";
import config from "@/config";
import { Q } from "@/db";
import { ilikeContains } from "@/db/utils";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import {
  LAUNCHER_PLATFORMS,
  LAUNCHER_RELEASE_STATUSES,
} from "@createrington/shared/launcher";
import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";

const launcherOwnerProcedure = ownerProcedure.use(launcherAvailable);

const listInput = z.object({
  platform: z.enum(LAUNCHER_PLATFORMS),
  status: z.enum(LAUNCHER_RELEASE_STATUSES).optional(),
  search: z.string().trim().max(64).optional(),
  ...paginationInput(),
});

const idInput = z.object({ id: id() });
const releaseInput = idInput.extend({ required: z.boolean().default(false) });

function toDto(release: LauncherRelease) {
  return {
    id: release.id,
    version: release.version,
    platform: release.platform,
    url: release.url,
    notes: release.notes,
    status: release.status,
    required: release.required,
    pubDate: release.pubDate.toISOString(),
    createdAt: release.createdAt.toISOString(),
    releasedAt: release.releasedAt?.toISOString() ?? null,
    withdrawnAt: release.withdrawnAt?.toISOString() ?? null,
    prunedAt: release.prunedAt?.toISOString() ?? null,
  };
}

export const ownerLauncherReleasesRouter = router({
  list: launcherOwnerProcedure
    .meta({
      description:
        "List one page of a platform's launcher releases stored for this environment's channel, newest first, with optional status and version filters",
    })
    .input(listInput)
    .query(async ({ input }) => {
      const { rows, pagination } = await paginateQuery(
        Q.launcher.release,
        {
          platform: input.platform,
          status: input.status,
          version: input.search ? ilikeContains(input.search) : undefined,
        },
        input,
        { orderBy: "createdAt", orderDirection: "desc" },
      );
      return {
        channel: config.launcher.channel,
        enabled: launcherReleaseService.isEnabled(),
        releases: rows.map(toDto),
        pagination,
      };
    }),

  release: launcherOwnerProcedure
    .meta({
      description:
        "Release a pending launcher version so the update check offers it, optionally as an update older launchers must take",
    })
    .input(releaseInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return toDto(
          await launcherReleaseService.release(
            input.id,
            ctx.user.discordId,
            input.required,
          ),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  withdraw: launcherOwnerProcedure
    .meta({
      description:
        "Withdraw a pending or released launcher version so it is never offered",
    })
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return toDto(
          await launcherReleaseService.withdraw(input.id, ctx.user.discordId),
        );
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
