import { router } from "@/trpc/trpc";
import { ownerAdminsRouter } from "./admins";
import { ownerContentGatewayRouter } from "./content-gateway";
import { ownerCurseforgeCdnRouter } from "./curseforge";
import { ownerDonationsRouter } from "./donations";
import { ownerLauncherPacksRouter } from "./launcher-packs";
import { ownerLauncherReleasesRouter } from "./launcher-releases";
import { ownerVoteRewardsRouter } from "./vote-rewards";

/** Owner-only router namespace. Every procedure gates on `OWNER_DISCORD_ID`. */
export const ownerRouter = router({
  admins: ownerAdminsRouter,
  contentGateway: ownerContentGatewayRouter,
  curseforgeCdn: ownerCurseforgeCdnRouter,
  donations: ownerDonationsRouter,
  launcherPacks: ownerLauncherPacksRouter,
  launcherReleases: ownerLauncherReleasesRouter,
  voteRewards: ownerVoteRewardsRouter,
});
