import { readAppChangelog } from "@/services/app-changelog";
import { router, adminProcedure } from "@/trpc/trpc";

export const changelogRouter = router({
  get: adminProcedure
    .meta({ description: "Get the project changelog" })
    .query(async () => {
      try {
        const content = await readAppChangelog();
        return { content };
      } catch (error) {
        logger.warn("Failed to read CHANGELOG.md:", error);
        return { content: "" };
      }
    }),
});
