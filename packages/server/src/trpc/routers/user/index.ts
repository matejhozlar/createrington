import { router } from "@/trpc/trpc";
import { accountRouter } from "./account";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";
import { userDonationsRouter } from "./donations";

/** Authenticated-user router — account, achievements, crypto trading, and donations. */
export const userRouter = router({
  account: accountRouter,
  achievements: achievementsRouter,
  crypto: cryptoRouter,
  donations: userDonationsRouter,
});
