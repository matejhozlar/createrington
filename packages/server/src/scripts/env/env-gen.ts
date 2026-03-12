import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs";

/**
 * Generates a .env.example file from existing .env file by copying
 * all variable names but removing their values
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_SOURCE_PATH = path.join(__dirname, "..", "..", "..", ".env");
const ENV_EXAMPLE_PATH = path.join(__dirname, "..", "..", "..", ".env.example");

try {
  if (!fs.existsSync(ENV_SOURCE_PATH)) {
    console.error(`.env file not found at ${ENV_SOURCE_PATH}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_SOURCE_PATH, "utf-8");
  const lines = envContent.split("\n");

  const exampleLines = lines.map((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      return line;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex > 0) {
      const varName = trimmedLine.substring(0, equalsIndex);
      return `${varName}=`;
    }

    return line;
  });

  const exampleContent = exampleLines.join("\n");
  fs.writeFileSync(ENV_EXAMPLE_PATH, exampleContent, "utf-8");

  console.log(`Successfully generated .env.example at: ${ENV_EXAMPLE_PATH}`);
  console.log(`Processed ${lines.length} lines`);

  const envVarCount = exampleLines.filter(
    (line) => line.trim() && !line.trim().startsWith("#") && line.includes("="),
  ).length;
  console.log(`Found ${envVarCount} environment variables`);
} catch (error) {
  console.error(`Error generaing .env.example:`, error);
  process.exit(1);
}
