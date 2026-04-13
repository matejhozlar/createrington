import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { autoMessagesRouter } from "./auto-messages";
import { announcementsRouter } from "./announcements";
import { changelogRouter } from "./changelog";
import { adminCryptoRouter } from "./crypto";
import { dashboardRouter } from "./dashboard";
import { discordCommandsRouter } from "./discord-commands";
import { adminDonationsRouter } from "./donations";
import { embedsRouter } from "./embeds";
import { faqRouter } from "./faq";
import { inactivityRouter } from "./inactivity";
import { logsRouter } from "./logs";
import { adminMetricsRouter } from "./metrics";
import { adminPlayersRouter } from "./players";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";
import { adminStructurePacksRouter } from "./structure-packs";
import { adminForceloadsRouter } from "./forceloads";
import { refetchDiscordEntities } from "@/services/discord/entities/refetch";

/** Admin-only router — announcements, auto-messages, crypto, dashboard, discord commands, donations, embeds, FAQ, logs, metrics, players, servers, structure packs, waitlists. */
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
  autoMessages: autoMessagesRouter,
  announcements: announcementsRouter,
  changelog: changelogRouter,
  crypto: adminCryptoRouter,
  dashboard: dashboardRouter,
  discordCommands: discordCommandsRouter,
  donations: adminDonationsRouter,
  embeds: embedsRouter,
  faq: faqRouter,
  forceloads: adminForceloadsRouter,
  inactivity: inactivityRouter,
  logs: logsRouter,
  metrics: adminMetricsRouter,
  players: adminPlayersRouter,
  servers: adminServersRouter,
  structurePacks: adminStructurePacksRouter,
  waitlists: waitlistsRouter,
});
