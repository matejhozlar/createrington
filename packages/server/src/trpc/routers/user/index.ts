import { router } from "@/trpc/trpc";
import { achievementsRouter } from "./achievements";
import { cryptoRouter } from "./crypto";

export const userRouter = router({
  achievements: achievementsRouter,
  crypto: cryptoRouter,
});
