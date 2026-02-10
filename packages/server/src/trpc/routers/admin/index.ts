import { router } from "@/trpc/trpc";
import { logsRouter } from "./logs";
import { adminPlayersRouter } from "./players";
import { adminServersRouter } from "./servers";
import { waitlistsRouter } from "./waitlists";

export const adminRouter = router({
  logs: logsRouter,
  players: adminPlayersRouter,
  servers: adminServersRouter,
  waitlists: waitlistsRouter,
});
