import { router } from "@/trpc/trpc";
import { accountRouter } from "./account";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";
import { userDonationsRouter } from "./donations";
import { userStructurePacksRouter } from "./structure-packs";

/** Authenticated-user router: account, achievements, crypto trading, donations, and structure packs. */
export const userRouter = router({
  account: accountRouter,
  achievements: achievementsRouter,
  crypto: cryptoRouter,
  donations: userDonationsRouter,
  structurePacks: userStructurePacksRouter,
});
