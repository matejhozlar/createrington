import { router } from "@/trpc/trpc";
import { achievementsRouter } from "./achievements";

export const userRouter = router({
  achievements: achievementsRouter,
});
