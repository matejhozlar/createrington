import { router } from "../../trpc";
import { logsRouter } from "./logs";
import { adminPlayersRouter } from "./players";
import { waitlistsRouter } from "./waitlists";

export const adminRouter = router({
  logs: logsRouter,
  players: adminPlayersRouter,
  waitlists: waitlistsRouter,
});
