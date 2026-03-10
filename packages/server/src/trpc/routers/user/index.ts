import { router } from "@/trpc/trpc";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";

/** Authenticated-user router — achievements and crypto trading. */
export const userRouter = router({
  achievements: achievementsRouter,
  crypto: cryptoRouter,
});
