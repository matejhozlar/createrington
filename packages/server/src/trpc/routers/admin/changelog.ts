import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@/config";
import { router, adminProcedure } from "@/trpc/trpc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levels = config.envMode.isProd ? 5 : 6;
const ROOT = path.resolve(__dirname, ...Array(levels).fill(".."));
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

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
