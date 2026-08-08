import { router } from "@/trpc/trpc";
import { accountRouter } from "./account";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";
import { userDonationsRouter } from "./donations";
import { userStructurePacksRouter } from "./structure-packs";
import { userWorkshopsRouter } from "./workshops";

/** Authenticated-user router: account, achievements, crypto trading, donations, structure packs, and workshop. */
export const userRouter = router({
  account: accountRouter,
  achievements: achievementsRouter,
  crypto: cryptoRouter,
  donations: userDonationsRouter,
  structurePacks: userStructurePacksRouter,
  workshops: userWorkshopsRouter,
});
