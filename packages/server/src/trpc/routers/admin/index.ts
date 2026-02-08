import { router } from "../../trpc";
import { adminPlayersRouter } from "./players";
import { waitlistsRouter } from "./waitlists";

export const adminRouter = router({
  players: adminPlayersRouter,
  waitlists: waitlistsRouter,
});
