import { router } from "@/trpc/trpc";
import { accountRouter } from "./account";
import { userDonationsRouter } from "./donations";
import { userStructurePacksRouter } from "./structure-packs";
import { userWorkshopsRouter } from "./workshops";

/** Authenticated-user router: account, donations, structure packs, and workshop. */
export const userRouter = router({
  account: accountRouter,
  donations: userDonationsRouter,
  structurePacks: userStructurePacksRouter,
  workshops: userWorkshopsRouter,
});
