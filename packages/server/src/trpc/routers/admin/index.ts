import { router } from "@/trpc/trpc";
import { dashboardRouter } from "./dashboard";
import { embedsRouter } from "./embeds";
import { faqRouter } from "./faq";
import { logsRouter } from "./logs";
import { adminPlayersRouter } from "./players";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";

export const adminRouter = router({
  dashboard: dashboardRouter,
  embeds: embedsRouter,
  faq: faqRouter,
  logs: logsRouter,
  players: adminPlayersRouter,
  servers: adminServersRouter,
  waitlists: waitlistsRouter,
});
