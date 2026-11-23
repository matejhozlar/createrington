import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { findOrThrow, trpcError, id } from "@/trpc/utils";
import { createRateLimit } from "@/trpc/middleware/rate-limit";
import { Q } from "@/db";
import { BalanceUtils } from "@/db/utils/balance";
import {
  playerAccountService,
  toSessionView,
} from "@/services/player/account/account.service";
import config from "@/config";

const exportLimit = createRateLimit({
  name: "user.account.exportData",
  limit: 3,
  windowMs: 60 * 60 * 1000,
  key: (ctx) => ctx.user?.discordId ?? "anonymous",
});

export const accountRouter = router({
  me: userProcedure
    .meta({
      description:
        "Get the authenticated user's account info including linked Minecraft profile and creation date",
    })
    .query(async ({ ctx }) => {
      const player = await findOrThrow(
        Q.player.find({ discordId: ctx.user.discordId }),
        "Player not found",
      );

      return {
        discordId: player.discordId,
        discordUsername: ctx.user.username,
        discordAvatar: ctx.user.avatar ?? null,
        minecraftUuid: player.minecraftUuid,
        minecraftUsername: player.minecraftUsername,
        role: ctx.user.role,
        isOwner: ctx.user.discordId === config.app.auth.owner.discordId,
        createdAt: player.createdAt.toISOString(),
      };
    }),

  balance: userProcedure
    .meta({ description: "Get player's current in-game balance" })
    .query(async ({ ctx }) => {
      const balance = await Q.player.balance.find({
        minecraftUuid: ctx.user.minecraftUuid,
      });
      return {
        balance: String(BalanceUtils.fromStorage(balance?.balance ?? 0n)),
      };
    }),

  sessions: userProcedure
    .meta({
      description:
        "List all active (non-revoked, non-expired) sessions for the authenticated user",
    })
    .query(async ({ ctx }) => {
      const sessions = await Q.auth.session.getActiveSessions(
        ctx.user.discordId,
      );

      return sessions.map(toSessionView);
    }),

  revokeSession: userProcedure
    .meta({
      description:
        "Revoke a specific session by ID. Only sessions belonging to the authenticated user can be revoked",
    })
    .input(z.object({ id: id() }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await Q.auth.session.revokeOwnedById(
        input.id,
        ctx.user.discordId,
      );
      if (!revoked) {
        throw trpcError.notFound("Session not found");
      }
    }),

  exportData: userProcedure
    .use(exportLimit)
    .meta({
      description:
        "Export all personal data as a single JSON object, covering playtime, balance, moderation history, and more",
    })
    .query(({ ctx }) => playerAccountService.exportData(ctx.user)),

  deleteAccount: userProcedure
    .meta({
      description:
        "Permanently delete the account and all associated data, then kick the user from Discord. Requires typing a confirmation phrase",
    })
    .input(
      z.object({
        confirmation: z.string().refine((v) => v === "DELETE MY ACCOUNT", {
          message: 'You must type "DELETE MY ACCOUNT" to confirm',
        }),
      }),
    )
    .mutation(({ ctx }) =>
      playerAccountService.deleteAccount(ctx.user.discordId),
    ),
});
