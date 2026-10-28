import { router } from "@/trpc/trpc";
import { ownerAdminsRouter } from "./admins";
import {
  ownerCurseforgeBudgetRouter,
  ownerCurseforgeCallsRouter,
  ownerCurseforgeCdnRouter,
} from "./curseforge";
import { ownerDonationsRouter } from "./donations";
import { ownerLauncherPacksRouter } from "./launcher-packs";
import { ownerLauncherReleasesRouter } from "./launcher-releases";

/** Owner-only router namespace. Every procedure gates on `OWNER_DISCORD_ID`. */
export const ownerRouter = router({
  admins: ownerAdminsRouter,
  curseforgeBudget: ownerCurseforgeBudgetRouter,
  curseforgeCalls: ownerCurseforgeCallsRouter,
  curseforgeCdn: ownerCurseforgeCdnRouter,
  donations: ownerDonationsRouter,
  launcherPacks: ownerLauncherPacksRouter,
  launcherReleases: ownerLauncherReleasesRouter,
});
