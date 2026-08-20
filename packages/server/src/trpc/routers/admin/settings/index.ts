import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { auditActor, rethrowTrpc } from "@/trpc/utils";
import {
  settings,
  intakeModeSchema,
  playerLimitSchema,
} from "@/services/settings";
import { waitlistService } from "@/services/waitlist/waitlist.service";

export const adminSettingsRouter = router({
  get: adminProcedure
    .meta({
      description: "Current runtime settings with the live player count",
    })
    .query(async () => {
      const [playerLimit, intakeMode, playerCount, reservedSlots] =
        await Promise.all([
          settings.getPlayerLimit(),
          settings.getIntakeMode(),
          Q.player.count(),
          Q.waitlist.entry.count({ status: "promoted" }),
        ]);
      return { playerLimit, intakeMode, playerCount, reservedSlots };
    }),

  update: adminProcedure
    .meta({
      description: "Update runtime settings (player limit, intake mode)",
    })
    .input(
      z.object({
        playerLimit: playerLimitSchema.optional(),
        intakeMode: intakeModeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const actor = auditActor(ctx);

        if (input.playerLimit !== undefined) {
          await settings.setPlayerLimit(
            input.playerLimit,
            actor.adminDiscordId,
          );
          await Q.admin.log.action.logAction({
            ...actor,
            actionType: "setting_update",
            description: `Set player limit to ${input.playerLimit}`,
            metadata: { key: "player_limit", value: input.playerLimit },
          });
        }

        if (input.intakeMode !== undefined) {
          await settings.setIntakeMode(input.intakeMode, actor.adminDiscordId);
          await Q.admin.log.action.logAction({
            ...actor,
            actionType: "setting_update",
            description: `Set intake mode to ${input.intakeMode}`,
            metadata: { key: "intake_mode", value: input.intakeMode },
          });
        }

        if (input.playerLimit !== undefined || input.intakeMode !== undefined) {
          void waitlistService.promoteEligible().catch((error) => {
            logger.error("Promotion pass after settings update failed:", error);
          });
        }
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
