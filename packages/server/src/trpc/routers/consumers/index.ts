import { router } from "@/trpc/trpc";
import { panelRouter } from "./panel";
import { sandboxRouter } from "./sandbox";

export const consumersRouter = router({
  panel: panelRouter,
  sandbox: sandboxRouter,
});
