import { router } from "@/trpc/trpc";
import { serverStatsProcedures } from "./stats";
import { serverMaintenanceProcedures } from "./maintenance";
import { serverWhitelistProcedures } from "./whitelist";

export const adminServersRouter = router({
  ...serverStatsProcedures,
  ...serverMaintenanceProcedures,
  ...serverWhitelistProcedures,
});
