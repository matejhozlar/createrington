import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import process from "node:process";
import glob from "fast-glob";

/**
 * Represents a single occurence of an environment variable usage
 */
interface EnvUsageResult {
  file: string;
  line: number;
  content: string;
}

/**
 * Searches for usage of a specific environment variable in the project files
 *
 * @param envVar - The name of the environment variable to search for
 * @param searchDir - The directory to start searching from
 * @returns List of files and line numbers where the variable is used
 */
function findEnvUsage(envVar: string, searchDir: string): EnvUsageResult[] {
  const IGNORE_DIRS = ["node_modules", "dist", "build", "client", ".git"];
  const SUPPORTED_EXTENSIONS = ["js", "ts", "mjs", "cjs"];

  const pattern = `**/*.${SUPPORTED_EXTENSIONS.join(",")}`;

  const files = glob.sync(pattern, {
    cwd: searchDir,
    ignore: IGNORE_DIRS.map((d) => `${d}/**`),
    absolute: true,
  });

  const results: EnvUsageResult[] = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");

    lines.forEach((line, i) => {
      const cleanLine = line
        .replace(/\/\/.*$/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      const regex = new RegExp(`process\\.env\\.?${envVar}\\b`);
      if (regex.test(cleanLine)) {
        results.push({ file, line: i + 1, content: line.trim() });
      }
    });
  }

  return results;
}

const args: string[] = process.argv.slice(2);
const ENV_VAR: string | undefined = args[0];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!ENV_VAR) {
  console.error(
    "Please provide an environment variable name, e.g.: pnpm util:find-env DB_PASSWORD",
  );
  process.exit(1);
}

const SEARCH_DIR = path.join("..", "..");
const results = findEnvUsage(ENV_VAR, SEARCH_DIR);

if (results.length === 0) {
  console.log(`No usage found for ENV variable ${ENV_VAR}`);
} else {
  console.log(`Found ${results.length} usage(s) of "${ENV_VAR}":\n`);
  for (const { file, line, content } of results) {
    const relPath = path.relative(SEARCH_DIR, file).replace(/\\/g, "/");
    console.log(`${relPath}:${line} -> ${content}`);
  }
}
