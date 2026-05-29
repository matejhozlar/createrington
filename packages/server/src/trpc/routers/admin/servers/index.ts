import { router } from "@/trpc/trpc";
import { serverStatsProcedures } from "./stats";
import { serverMaintenanceProcedures } from "./maintenance";
import { serverWhitelistProcedures } from "./whitelist";

/** Admin servers router: server list with stats, detail view, activity, heatmap, sessions, maintenance, and whitelist resync. */
export const adminServersRouter = router({
  ...serverStatsProcedures,
  ...serverMaintenanceProcedures,
  ...serverWhitelistProcedures,
});
