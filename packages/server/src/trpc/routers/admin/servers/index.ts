import { router } from "@/trpc/trpc";
import { serverStatsProcedures } from "./stats";
import { serverMaintenanceRouter } from "./maintenance";
import { serverWhitelistRouter } from "./whitelist";

export const adminServersRouter = router({
  ...serverStatsProcedures,
  maintenance: serverMaintenanceRouter,
  whitelist: serverWhitelistRouter,
});
