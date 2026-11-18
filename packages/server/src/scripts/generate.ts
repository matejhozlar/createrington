process.env.VALIDATION_MODE = "generation";

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function main(): Promise<void> {
  const { generate } = await import("./db/generate-query-system");
  const result = await generate();
  console.log(`[generate] Generated ${result.files.length} files`);
  for (const file of result.scaffolds) {
    console.log(`[generate] Scaffolded ${file} (edit it in src/db/queries/)`);
  }

  console.log("[generate] Formatting generated files...");
  execSync("pnpm exec prettier --write src/db/queries", {
    cwd: serverRoot,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error("[generate] Failed:", error);
    process.exit(1);
  },
);
