import { router } from "@/trpc/trpc";
import { adminCryptoSettingsRouter } from "./settings";
import { cryptoTokenProcedures } from "./tokens";
import { cryptoEventProcedures } from "./events";
import { cryptoMarketProcedures } from "./market";

export const adminCryptoRouter = router({
  settings: adminCryptoSettingsRouter,
  ...cryptoTokenProcedures,
  ...cryptoEventProcedures,
  ...cryptoMarketProcedures,
});
