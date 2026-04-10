import fs from "node:fs/promises";
import path from "node:path";
import { router, adminProcedure } from "@/trpc/trpc";

const CHANGELOG_PATH = path.resolve(process.cwd(), "CHANGELOG.md");

export const changelogRouter = router({
  get: adminProcedure
    .meta({ description: "Get the project changelog" })
    .query(async () => {
      try {
        const content = await fs.readFile(CHANGELOG_PATH, "utf-8");
        return { content };
      } catch (error) {
        logger.warn("Failed to read CHANGELOG.md:", error);
        return { content: "" };
      }
    }),
});
