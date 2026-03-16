import { router } from "@/trpc/trpc";
import { autoMessagesRouter } from "./auto-messages";
import { adminCryptoRouter } from "./crypto";
import { dashboardRouter } from "./dashboard";
import { embedsRouter } from "./embeds";
import { faqRouter } from "./faq";
import { logsRouter } from "./logs";
import { adminMetricsRouter } from "./metrics";
import { adminPlayersRouter } from "./players";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";

/** Admin-only router — auto-messages, crypto, dashboard, embeds, FAQ, logs, metrics, players, servers, waitlists. */
export const adminRouter = router({
  autoMessages: autoMessagesRouter,
  crypto: adminCryptoRouter,
  dashboard: dashboardRouter,
  embeds: embedsRouter,
  faq: faqRouter,
  logs: logsRouter,
  metrics: adminMetricsRouter,
  players: adminPlayersRouter,
  servers: adminServersRouter,
  waitlists: waitlistsRouter,
});
