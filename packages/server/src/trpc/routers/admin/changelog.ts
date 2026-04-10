import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router, adminProcedure } from "@/trpc/trpc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "CHANGELOG.md",
);

export const changelogRouter = router({
  get: adminProcedure
    .meta({ description: "Get the project changelog" })
    .query(async () => {
      try {
        const content = await fs.readFile(CHANGELOG_PATH, "utf-8");
        return { content };
      } catch {
        return { content: "" };
      }
    }),
});
