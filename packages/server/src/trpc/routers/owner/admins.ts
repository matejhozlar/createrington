import { z } from "zod";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { router, ownerProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { ilikeContains } from "@/db/utils";
import { adminRoleService } from "@/services/auth/admin-role/admin-role.service";
import { Discord } from "@/discord/constants";
import { SERVERS } from "@/services/mc-server/servers";
import { isDiscordId } from "@createrington/shared/discord-id";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { discordId } from "@/utils/zod-schemas";

export const ownerAdminsRouter = router({
  list: ownerProcedure
    .meta({
      description: "List all admins from the DB admin table",
    })
    .query(async () => {
      const dbAdmins = await Q.admin.findAll({});
      if (dbAdmins.length === 0) return { admins: [] };

      const players = await Q.player.findAll({
        discordId: { $in: dbAdmins.map((a) => a.discordId) },
      });
      const playerByDiscordId = new Map(players.map((p) => [p.discordId, p]));

      const admins = dbAdmins
        .map((a) => {
          const player = playerByDiscordId.get(a.discordId);
          return {
            discordId: a.discordId,
            minecraftUuid: player?.minecraftUuid ?? null,
            minecraftUsername: player?.minecraftUsername ?? null,
            createdAt: a.createdAt?.toISOString() ?? null,
          };
        })
        .sort((a, b) => {
          const aName = a.minecraftUsername ?? a.discordId;
          const bName = b.minecraftUsername ?? b.discordId;
          return aName.localeCompare(bName);
        });

      return { admins };
    }),

  searchPlayers: ownerProcedure
    .meta({
      description:
        "Search non-admin players by partial Minecraft username or Discord ID. Used to pick a candidate for promote.",
    })
    .input(z.object({ query: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const query = input.query.trim();
      if (!query) return { players: [] };

      const results = isDiscordId(query)
        ? await Q.player.findAll({ discordId: query })
        : await Q.player
            .where({ minecraftUsername: ilikeContains(query) })
            .orderBy("minecraftUsername", "asc")
            .limit(20)
            .all();

      const existingAdmins = new Set(
        (await Q.admin.findAll({})).map((a) => a.discordId),
      );

      return {
        players: results
          .filter((p) => !existingAdmins.has(p.discordId))
          .map((p) => ({
            discordId: p.discordId,
            minecraftUuid: p.minecraftUuid,
            minecraftUsername: p.minecraftUsername,
          })),
      };
    }),

  previewDemote: ownerProcedure
    .meta({
      description:
        "Preview the effects of demoting a user without applying them. Fetches Discord role state live, only runs when a demote is actually being considered.",
    })
    .input(z.object({ discordId }))
    .query(async ({ input }) => {
      const player = await Q.player.find({ discordId: input.discordId });
      const inDb = !!(await Q.admin.find({ discordId: input.discordId }));

      let hasDiscordRole = false;
      try {
        const member = await fetchGuildMember(input.discordId);
        hasDiscordRole = !!member?.roles.cache.has(Discord.Roles.ADMIN);
      } catch {}

      const activeSessions = await Q.auth.session.getActiveSessions(
        input.discordId,
      );

      return {
        inDb,
        hasDiscordRole,
        activeSessions: activeSessions.length,
        serverCount: SERVERS.length,
        minecraftUsername: player?.minecraftUsername ?? null,
      };
    }),

  promote: ownerProcedure
    .meta({
      description:
        "Promote a user to admin: writes DB entry + adds Discord ADMIN role. Does NOT op on Minecraft servers, the owner does that manually per trust.",
    })
    .input(
      z.object({
        discordId,
        reason: z.string().max(ADMIN_REASON_MAX_LENGTH).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      adminRoleService.promote(input.discordId, input.reason, ctx.user),
    ),

  demote: ownerProcedure
    .meta({
      description:
        "Demote a user: removes DB entry, removes Discord ADMIN role, deops across all Minecraft servers, revokes all active sessions.",
    })
    .input(
      z.object({
        discordId,
        reason: z.string().max(ADMIN_REASON_MAX_LENGTH).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      adminRoleService.demote(input.discordId, input.reason, ctx.user),
    ),

  auditLog: ownerProcedure
    .meta({
      description: "Recent promote/demote actions from the admin audit log",
    })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const entries = await Q.admin.log.action
        .where({ actionType: { $in: ["admin_promote", "admin_demote"] } })
        .orderBy("performedAt", "desc")
        .limit(input.limit)
        .all();

      return {
        entries: entries.map((e) => ({
          id: e.id,
          actorDiscordId: e.adminDiscordId,
          actorUsername: e.adminUsername,
          actionType: e.actionType,
          description: e.description,
          targetPlayerName: e.targetPlayerName,
          targetPlayerUuid: e.targetPlayerUuid,
          reason: e.reason,
          metadata: e.metadata,
          performedAt: e.performedAt?.toISOString() ?? null,
        })),
      };
    }),
});
