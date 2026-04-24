import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, ownerProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import { getService, Services } from "@/services";
import { sessionService } from "@/services/auth/session/session.service";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Discord } from "@/discord/constants";
import { minecraftRcon } from "@/utils/rcon";
import { MINECRAFT_SERVERS } from "@/services/playtime/config";

const discordIdSchema = z
  .string()
  .regex(/^\d{17,20}$/, "Discord ID must be a snowflake");

const ACTION_PROMOTE = "admin_promote";
const ACTION_DEMOTE = "admin_demote";

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

      const likeQuery = `%${escapeLike(query)}%`;
      const results = /^\d{17,20}$/.test(query)
        ? await Q.player.findAll({ discordId: query })
        : await Q.player
            .where({ minecraftUsername: { $ilike: likeQuery } })
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
        "Preview the effects of demoting a user without applying them. Fetches Discord role state live — only runs when a demote is actually being considered.",
    })
    .input(z.object({ discordId: discordIdSchema }))
    .query(async ({ input }) => {
      const player = await Q.player.find({ discordId: input.discordId });
      const inDb = !!(await Q.admin.find({ discordId: input.discordId }));

      let hasDiscordRole = false;
      try {
        const mainBot = await getService(Services.DISCORD_MAIN_BOT);
        const guild = mainBot.guilds.cache.first();
        if (guild) {
          const member = await guild.members
            .fetch(input.discordId)
            .catch(() => null);
          hasDiscordRole = !!member?.roles.cache.has(Discord.Roles.ADMIN);
        }
      } catch {
        // Leave hasDiscordRole false on bot-unreachable.
      }

      const activeSessions = await Q.auth.session.getActiveSessions(
        input.discordId,
      );

      return {
        inDb,
        hasDiscordRole,
        activeSessions: activeSessions.length,
        serverCount: Object.keys(MINECRAFT_SERVERS).length,
        minecraftUsername: player?.minecraftUsername ?? null,
      };
    }),

  promote: ownerProcedure
    .meta({
      description:
        "Promote a user to admin: writes DB entry + adds Discord ADMIN role. Does NOT op on Minecraft servers — the owner does that manually per trust.",
    })
    .input(
      z.object({
        discordId: discordIdSchema,
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await Q.admin.find({ discordId: input.discordId });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already an admin",
        });
      }

      const player = await Q.player.find({ discordId: input.discordId });

      await Q.admin.create({ discordId: input.discordId });

      let discordRoleAdded = false;
      try {
        const mainBot = await getService(Services.DISCORD_MAIN_BOT);
        const guild = mainBot.guilds.cache.first();
        if (guild) {
          const member = await guild.members
            .fetch(input.discordId)
            .catch(() => null);
          if (member) {
            const result = await RoleManager.assign(
              member,
              Discord.Roles.ADMIN,
              input.reason ?? `Promoted by ${ctx.user.minecraftUsername}`,
            );
            discordRoleAdded = result === true;
          }
        }
      } catch (error) {
        logger.error(
          `[admin-promote] Failed to add Discord ADMIN role for ${input.discordId}:`,
          error,
        );
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: ACTION_PROMOTE,
        description: `Promoted ${player?.minecraftUsername ?? input.discordId} to admin`,
        targetPlayerUuid: player?.minecraftUuid,
        targetPlayerName: player?.minecraftUsername,
        reason: input.reason,
        metadata: { discordRoleAdded },
      });

      return {
        discordRoleAdded,
        minecraftUsername: player?.minecraftUsername ?? null,
      };
    }),

  demote: ownerProcedure
    .meta({
      description:
        "Demote a user: removes DB entry, removes Discord ADMIN role, deops across all Minecraft servers, revokes all active sessions.",
    })
    .input(
      z.object({
        discordId: discordIdSchema,
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.discordId === ctx.user.discordId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't demote yourself",
        });
      }

      const player = await Q.player.find({ discordId: input.discordId });
      const dbEntry = await Q.admin.find({ discordId: input.discordId });

      // Security-critical steps first: DB + session revoke. External
      // systems (Discord, RCON) follow and are best-effort — partial
      // failures are logged but don't abort.
      if (dbEntry) {
        await Q.admin.delete({ discordId: input.discordId });
      }

      await sessionService.revokeAllForUser(input.discordId);

      let discordRoleRemoved = false;
      try {
        const mainBot = await getService(Services.DISCORD_MAIN_BOT);
        const guild = mainBot.guilds.cache.first();
        if (guild) {
          const member = await guild.members
            .fetch(input.discordId)
            .catch(() => null);
          if (member && member.roles.cache.has(Discord.Roles.ADMIN)) {
            const result = await RoleManager.remove(
              member,
              Discord.Roles.ADMIN,
              input.reason ?? `Demoted by ${ctx.user.minecraftUsername}`,
            );
            discordRoleRemoved = result === true;
          }
        }
      } catch (error) {
        logger.error(
          `[admin-demote] Failed to remove Discord ADMIN role for ${input.discordId}:`,
          error,
        );
      }

      const rconResults: Array<{
        serverId: number;
        success: boolean;
        error?: string;
      }> = [];
      if (player?.minecraftUsername) {
        const results = await minecraftRcon.sendAll(
          `deop ${player.minecraftUsername}`,
        );
        for (const [serverId, result] of results.entries()) {
          rconResults.push({
            serverId,
            success: result.success,
            error: result.error?.message,
          });
          if (!result.success) {
            logger.warn(
              `[admin-demote] deop failed on server ${serverId} for ${player.minecraftUsername}:`,
              result.error,
            );
          }
        }
      }

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: ACTION_DEMOTE,
        description: `Demoted ${player?.minecraftUsername ?? input.discordId} from admin`,
        targetPlayerUuid: player?.minecraftUuid,
        targetPlayerName: player?.minecraftUsername,
        reason: input.reason,
        metadata: {
          removedFromDb: !!dbEntry,
          discordRoleRemoved,
          rconResults,
        },
      });

      return {
        removedFromDb: !!dbEntry,
        discordRoleRemoved,
        rconResults,
        minecraftUsername: player?.minecraftUsername ?? null,
      };
    }),

  auditLog: ownerProcedure
    .meta({
      description: "Recent promote/demote actions from the admin audit log",
    })
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const entries = await Q.admin.log.action
        .where({ actionType: { $in: [ACTION_PROMOTE, ACTION_DEMOTE] } })
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
