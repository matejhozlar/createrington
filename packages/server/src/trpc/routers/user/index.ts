import { router } from "@/trpc/trpc";
import { accountRouter } from "./account";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";

/** Authenticated-user router — account, achievements, and crypto trading. */
export const userRouter = router({
  account: accountRouter,
  achievements: achievementsRouter,
  crypto: cryptoRouter,
});
