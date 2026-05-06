import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { adminAiRouter } from "./ai";
import { autoMessagesRouter } from "./auto-messages";
import { announcementsRouter } from "./announcements";
import { changelogRouter } from "./changelog";
import { adminCryptoRouter } from "./crypto";
import { dashboardRouter } from "./dashboard";
import { discordCommandsRouter } from "./discord-commands";
import { embedsRouter } from "./embeds";
import { faqRouter } from "./faq";
import { inactivityRouter } from "./inactivity";
import { logsRouter } from "./logs";
import { adminMetricsRouter } from "./metrics";
import { adminPlayersRouter } from "./players";
import { adminPromptsRouter } from "./prompts";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";
import { adminStructurePacksRouter } from "./structure-packs";
import { adminPartiesRouter } from "./parties";
import { refetchDiscordEntities } from "@/services/discord/entities/refetch";

export const adminRouter = router({
  refetchDiscordEntities: adminProcedure
    .meta({
      description:
        "Re-scrape Discord roles, channels, and categories from the live guild",
    })
    .mutation(async ({ ctx }) => {
      const result = await refetchDiscordEntities();

      await Q.admin.log.action.logAction({
        adminDiscordId: ctx.user.discordId,
        adminUsername: ctx.user.minecraftUsername,
        actionType: "discord_entities_refetch",
        description: "Re-scraped Discord roles, channels, and categories",
      });

      return result;
    }),
  ai: adminAiRouter,
  autoMessages: autoMessagesRouter,
  announcements: announcementsRouter,
  changelog: changelogRouter,
  crypto: adminCryptoRouter,
  dashboard: dashboardRouter,
  discordCommands: discordCommandsRouter,
  embeds: embedsRouter,
  faq: faqRouter,
  parties: adminPartiesRouter,
  inactivity: inactivityRouter,
  logs: logsRouter,
  metrics: adminMetricsRouter,
  players: adminPlayersRouter,
  prompts: adminPromptsRouter,
  servers: adminServersRouter,
  structurePacks: adminStructurePacksRouter,
  waitlists: waitlistsRouter,
});
