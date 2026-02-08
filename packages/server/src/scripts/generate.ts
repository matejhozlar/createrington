process.env.VALIDATION_MODE = "generation";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface GeneratorConfig {
  name: string;
  scriptPath: string;
  enabled: boolean;
}

interface GeneratorResult {
  name: string;
  success: boolean;
  duration: number;
  filesGenerated?: string[];
  error?: Error;
}

const GENERATORS: GeneratorConfig[] = [
  {
    name: "Database Query System",
    scriptPath: "./db/generate-query-system.ts",
    enabled: true,
  },
  // TODO
];

async function executeGenerator(
  config: GeneratorConfig,
): Promise<GeneratorResult> {
  const startTime = Date.now();

  try {
    const absolutePath = path.resolve(__dirname, config.scriptPath);
    const fileUrl = pathToFileURL(absolutePath).href;

    const module = await import(fileUrl);

    let result;
    if (typeof module.default === "function") {
      result = await module.default();
    } else if (typeof module.generate === "function") {
      result = await module.generate();
    } else {
      throw new Error(
        "Generator module must export a default or generate function",
      );
    }

    return {
      name: config.name,
      success: true,
      duration: Date.now() - startTime,
      filesGenerated: result?.files || [],
    };
  } catch (error) {
    return {
      name: config.name,
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  const enabledGenerators = GENERATORS.filter((g) => g.enabled);

  if (enabledGenerators.length === 0) {
    console.log("[generate] No generators enabled");
    return;
  }

  console.log(`[generate] Running ${enabledGenerators.length} generator(s)...`);

  const results: GeneratorResult[] = [];

  for (const generator of enabledGenerators) {
    console.log(`[generate]   ${generator.name}...`);

    const result = await executeGenerator(generator);
    results.push(result);

    if (result.success) {
      console.log(
        `[generate]   ${generator.name} done (${formatDuration(result.duration)}, ${result.filesGenerated?.length ?? 0} files)`,
      );
    } else {
      console.error(
        `[generate]   ${generator.name} FAILED (${formatDuration(result.duration)})`,
      );
      if (result.error) {
        console.error(`[generate]     ${result.error.message}`);
      }
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(
    `[generate] Complete: ${successful} succeeded, ${failed} failed (${formatDuration(totalDuration)})`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("[generate] Fatal error:", error);
  process.exit(1);
});
