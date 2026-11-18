import { router } from "@/trpc/trpc";
import { serversRouter } from "./servers";
import { playersRouter } from "./players";
import { waitlistsRouter } from "./waitlists";
import { metricsRouter } from "./metrics";
import { discordCommandsRouter } from "./discord-commands";
import { publicStructurePacksRouter } from "./structure-packs";
import { publicGalleryRouter } from "./gallery";
import { leaderboardsRouter } from "./leaderboards";

export const publicRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  discordCommands: discordCommandsRouter,
  structurePacks: publicStructurePacksRouter,
  gallery: publicGalleryRouter,
  leaderboards: leaderboardsRouter,
});
