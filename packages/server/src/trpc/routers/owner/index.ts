import { router } from "@/trpc/trpc";
import { ownerAdminsRouter } from "./admins";
import { ownerDonationsRouter } from "./donations";
import { ownerLauncherReleasesRouter } from "./launcher-releases";

/** Owner-only router namespace. Every procedure gates on `OWNER_DISCORD_ID`. */
export const ownerRouter = router({
  admins: ownerAdminsRouter,
  donations: ownerDonationsRouter,
  launcherReleases: ownerLauncherReleasesRouter,
});
