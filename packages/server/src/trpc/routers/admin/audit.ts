import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { playerService } from "@/services/player";
import { parsePlayerId } from "../../utils";

export const auditRouter = router({
  list: adminProcedure
    .meta({ description: "Get the admin action audit log for a player." })
    .input(
      z.object({
        id: z.string().min(1),
        page: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [auditLog, total] = await Promise.all([
        playerService.audit.getLog(identifier, input.limit, input.page * input.limit),
        playerService.audit.count(identifier),
      ]);

      return {
        actions: auditLog.map((action) => ({
          id: action.id,
          adminDiscordId: action.adminDiscordId,
          adminDiscordUsername: action.adminDiscordUsername,
          actionType: action.actionType,
          targetPlayerUuid: action.targetPlayerUuid,
          targetPlayerName: action.targetPlayerName,
          tableName: action.tableName,
          fieldName: action.fieldName,
          oldValue: action.oldValue,
          newValue: action.newValue,
          reason: action.reason,
          serverId: action.serverId,
          performedAt: action.performedAt.toISOString(),
          metadata: action.metadata,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),
});
