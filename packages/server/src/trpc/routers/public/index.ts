import { router } from "@/trpc/trpc";
import { serversRouter } from "./servers";
import { playersRouter } from "./players";
import { waitlistsRouter } from "./waitlists";
import { metricsRouter } from "./metrics";
import { cryptoRouter } from "./crypto";
import { discordRouter } from "./discord";

/** Public router — servers, players, waitlists, metrics, crypto market data, and Discord entities (no auth required). */
export const publicRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  crypto: cryptoRouter,
  discord: discordRouter,
});
