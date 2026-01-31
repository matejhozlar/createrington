process.env.VALIDATION_MODE = "generation";

import { SingleBar, Presets } from "cli-progress";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generator configuration
 */
interface GeneratorConfig {
  name: string;
  description: string;
  scriptPath: string;
  enabled: boolean;
}

/**
 * Result of a generator execution
 */
interface GeneratorResult {
  name: string;
  success: boolean;
  duration: number;
  filesGenerated?: string[];
  error?: Error;
}

/**
 * Available generators
 */
const GENERATORS: GeneratorConfig[] = [
  {
    name: "Database Query System",
    description: "Generate full base queries directly from the database",
    scriptPath: "./db/generate-query-system.ts",
    enabled: true,
  },
  // TODO
];

/**
 * Executes a single generator
 */
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

/**
 * Formats duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Creates a centered box with title
 */
function createTitleBox(title: string, width: number = 50): string[] {
  const topBorder = "╔" + "═".repeat(width - 2) + "╗";
  const bottomBorder = "╚" + "═".repeat(width - 2) + "╝";

  const titleLength = title.length;
  const totalPadding = width - 2 - titleLength;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;

  const titleLine =
    "║" + " ".repeat(leftPadding) + title + " ".repeat(rightPadding) + "║";

  return [topBorder, titleLine, bottomBorder];
}

/**
 * Main generation orchestrator
 */
async function main() {
  console.clear();

  // Header
  const [top, title, bottom] = createTitleBox("Code Generation Pipeline", 44);
  console.log(chalk.bold.cyan(`\n${top}`));
  console.log(
    chalk.bold.cyan("║") +
      chalk.bold.white(title.slice(1, -1)) +
      chalk.bold.cyan("║"),
  );
  console.log(chalk.bold.cyan(`${bottom}\n`));

  const enabledGenerators = GENERATORS.filter((g) => g.enabled);

  if (enabledGenerators.length === 0) {
    console.log(chalk.yellow("No generators enabled"));
    return;
  }

  console.log(chalk.bold("Generators to run:\n"));
  enabledGenerators.forEach((gen, index) => {
    console.log(`  ${chalk.cyan(`${index + 1}.`)} ${chalk.white(gen.name)}`);
    console.log(`     ${chalk.gray(gen.description)}`);
  });
  console.log();

  const totalGenerators = enabledGenerators.length;
  const results: GeneratorResult[] = [];
  let currentGenerator = 0;

  const overallBar = new SingleBar(
    {
      format:
        chalk.cyan("{bar}") +
        " | {percentage}% | {value}/{total} Generators | {status}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    Presets.shades_classic,
  );

  overallBar.start(totalGenerators, 0, { status: "Starting..." });

  for (const generator of enabledGenerators) {
    currentGenerator++;

    overallBar.update(currentGenerator - 1, {
      status: `Running: ${generator.name}`,
    });

    const spinner = ora({
      text: chalk.white(`Generating ${generator.name}...`),
      color: "cyan",
    }).start();

    const result = await executeGenerator(generator);
    results.push(result);

    if (result.success) {
      spinner.succeed(
        chalk.green(
          `${generator.name} ${chalk.gray(
            `(${formatDuration(result.duration)})`,
          )}`,
        ),
      );

      if (result.filesGenerated && result.filesGenerated.length > 0) {
        result.filesGenerated.forEach((file) => {
          console.log(chalk.gray(`     └─ ${file}`));
        });
      }
    } else {
      spinner.fail(
        chalk.red(
          `${generator.name} ${chalk.gray(
            `(${formatDuration(result.duration)})`,
          )}`,
        ),
      );
      if (result.error) {
        console.log(chalk.red(`     └─ Error: ${result.error.message}`));
      }
    }

    overallBar.update(currentGenerator, {
      status:
        currentGenerator === totalGenerators
          ? "Complete!"
          : `Next: ${enabledGenerators[currentGenerator]?.name || ""}`,
    });
  }

  overallBar.stop();

  console.log(chalk.bold("\nGeneration Summary\n"));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(
    `  ${chalk.green("✓")} Successful: ${chalk.bold(successful.toString())}`,
  );
  console.log(
    `  ${chalk.red("✗")} Failed:     ${chalk.bold(failed.toString())}`,
  );
  console.log(
    `  ${chalk.cyan("⏱")}  Total Time: ${chalk.bold(
      formatDuration(totalDuration),
    )}\n`,
  );

  // Exit with appropriate code
  if (failed > 0) {
    console.log(chalk.red("Generation completed with errors\n"));
    process.exit(1);
  } else {
    console.log(chalk.green("All generators completed successfully!\n"));
    process.exit(0);
  }
}

// Execute
main().catch((error) => {
  console.error(chalk.red("\nFatal error:"), error);
  process.exit(1);
});
