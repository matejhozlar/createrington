import { router } from "@/trpc/trpc";
import { sandboxPlayersRouter } from "./players";
import { sandboxWorkshopsRouter } from "./workshops";
import { sandboxModsRouter } from "./mods";
import { sandboxModpacksRouter } from "./modpacks";

export const sandboxRouter = router({
  players: sandboxPlayersRouter,
  workshops: sandboxWorkshopsRouter,
  mods: sandboxModsRouter,
  modpacks: sandboxModpacksRouter,
});

export type SandboxRouter = typeof sandboxRouter;
