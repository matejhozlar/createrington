import { router } from "@/trpc/trpc";
import { serversRouter } from "./servers";
import { playersRouter } from "./players";
import { waitlistsRouter } from "./waitlists";
import { metricsRouter } from "./metrics";
import { discordCommandsRouter } from "./discord-commands";
import { publicStructurePacksRouter } from "./structure-packs";

/** Public router: servers, players, waitlists, metrics, and structure pack reads (no auth required). */
export const publicRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  discordCommands: discordCommandsRouter,
  structurePacks: publicStructurePacksRouter,
});
