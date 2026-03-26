import { router } from "@/trpc/trpc";
import { autoMessagesRouter } from "./auto-messages";
import { announcementsRouter } from "./announcements";
import { adminCryptoRouter } from "./crypto";
import { dashboardRouter } from "./dashboard";
import { discordCommandsRouter } from "./discord-commands";
import { adminDonationsRouter } from "./donations";
import { embedsRouter } from "./embeds";
import { faqRouter } from "./faq";
import { logsRouter } from "./logs";
import { adminMetricsRouter } from "./metrics";
import { adminPlayersRouter } from "./players";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";
import { adminStructurePacksRouter } from "./structure-packs";

/** Admin-only router — announcements, auto-messages, crypto, dashboard, discord commands, donations, embeds, FAQ, logs, metrics, players, servers, structure packs, waitlists. */
export const adminRouter = router({
  autoMessages: autoMessagesRouter,
  announcements: announcementsRouter,
  crypto: adminCryptoRouter,
  dashboard: dashboardRouter,
  discordCommands: discordCommandsRouter,
  donations: adminDonationsRouter,
  embeds: embedsRouter,
  faq: faqRouter,
  logs: logsRouter,
  metrics: adminMetricsRouter,
  players: adminPlayersRouter,
  servers: adminServersRouter,
  structurePacks: adminStructurePacksRouter,
  waitlists: waitlistsRouter,
});
