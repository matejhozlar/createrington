import "@/logger.global";
import type { CommandModule } from "@/discord/bots/common/loaders/command-loader";
import { commandRegistry } from "@/discord/bots/main/command-registry";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Prevent process.exit() calls from killing the script during command imports.
// Some command files transitively import @/db which eagerly connects to PostgreSQL
// and calls process.exit(1) on failure. We only need the `data` export (a
// synchronous SlashCommandBuilder), so a broken DB pool is harmless here.
const realExit = process.exit.bind(process);
let exitIntercepted = false;
process.exit = ((code?: number) => {
  if (exitIntercepted) return undefined as never;
  return realExit(code);
}) as typeof process.exit;

// CLI flags: --json (JSON only), --md (markdown only), default = both
const args = process.argv.slice(2);
const flagJson = args.includes("--json");
const flagMd = args.includes("--md");
const emitJson = flagJson || (!flagJson && !flagMd);
const emitMd = flagMd || (!flagJson && !flagMd);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS_PATH = path.join(
  __dirname,
  "..",
  "..",
  "discord",
  "bots",
  "main",
  "interactions",
  "slash-commands",
);

const OUTPUT_PATH = path.join(__dirname, "..", "..", "..", "..", "..", "docs");
const OUTPUT_FILE = path.join(OUTPUT_PATH, "discord-commands.md");
const JSON_OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "discord-commands.json",
);

/** Discord ApplicationCommandOptionType values */
const OptionType: Record<number, string> = {
  1: "Subcommand",
  2: "Subcommand Group",
  3: "String",
  4: "Integer",
  5: "Boolean",
  6: "User",
  7: "Channel",
  8: "Role",
  9: "Mentionable",
  10: "Number",
  11: "Attachment",
};

interface CommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  min_value?: number;
  max_value?: number;
  options?: CommandOption[];
}

interface CommandData {
  name: string;
  description: string;
  category: string;
  options: CommandOption[];
  defaultMemberPermissions: string | null;
  permissions?: {
    requireAdmin?: boolean;
    requireOwner?: boolean;
  };
  cooldown?: {
    duration: number;
    type: string;
    message?: string;
  };
  env: string;
}

/** Recursively collect all .ts files from a directory */
function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Determine category from file path */
function getCategory(filePath: string): string {
  const relative = path.relative(COMMANDS_PATH, filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : "uncategorized";
}

/** Format the permission level for display */
function formatPermission(cmd: CommandData): string {
  if (cmd.permissions?.requireOwner) return "Owner";
  if (cmd.permissions?.requireAdmin) return "Admin";
  if (cmd.defaultMemberPermissions) return "Discord Administrator";
  return "None";
}

/** Format cooldown for display */
function formatCooldown(cmd: CommandData): string {
  if (!cmd.cooldown) return "None";
  return `${cmd.cooldown.duration}s (${cmd.cooldown.type})`;
}

/** Format option type with range constraints */
function formatOptionType(opt: CommandOption): string {
  const typeName = OptionType[opt.type] ?? `Unknown(${opt.type})`;
  if (
    (opt.type === 4 || opt.type === 10) &&
    (opt.min_value != null || opt.max_value != null)
  ) {
    const parts: string[] = [];
    if (opt.min_value != null) parts.push(`min: ${opt.min_value}`);
    if (opt.max_value != null) parts.push(`max: ${opt.max_value}`);
    return `${typeName} (${parts.join(", ")})`;
  }
  return typeName;
}

/** Format choices for display */
function formatChoices(
  choices?: { name: string; value: string | number }[],
): string {
  if (!choices?.length) return "";
  return choices.map((c) => `\`${c.value}\``).join(", ");
}

/** Render a single option row */
function renderOptionRow(opt: CommandOption): string {
  const required = opt.required ? "Yes" : "No";
  const type = formatOptionType(opt);
  const choices = formatChoices(opt.choices);
  const desc = choices
    ? `${opt.description} - Choices: ${choices}`
    : opt.description;
  return `| \`${opt.name}\` | ${type} | ${required} | ${desc} |`;
}

/** Render option table for non-subcommand options */
function renderOptionsTable(options: CommandOption[]): string {
  const lines = [
    "| Option | Type | Required | Description |",
    "|--------|------|----------|-------------|",
  ];
  for (const opt of options) {
    lines.push(renderOptionRow(opt));
  }
  return lines.join("\n");
}

/** Render a single subcommand block */
function renderSubcommand(sub: CommandOption, prefix = ""): string {
  const lines: string[] = [];
  const label = prefix ? `${prefix} ${sub.name}` : sub.name;

  lines.push(`#### \`${label}\``);
  lines.push("");
  lines.push(sub.description);
  lines.push("");

  const subOpts = (sub.options ?? []).filter(
    (o) => o.type !== 1 && o.type !== 2,
  );
  if (subOpts.length > 0) {
    lines.push(renderOptionsTable(subOpts));
    lines.push("");
  }

  return lines.join("\n");
}

/** Render subcommands and subcommand groups */
function renderSubcommands(options: CommandOption[]): string {
  const lines: string[] = [];

  for (const opt of options) {
    if (opt.type === 2) {
      // Subcommand group: render its nested subcommands with group prefix
      lines.push(`#### \`${opt.name}\` (group)`);
      lines.push("");
      lines.push(opt.description);
      lines.push("");

      for (const sub of opt.options ?? []) {
        if (sub.type === 1) {
          lines.push(renderSubcommand(sub, opt.name));
        }
      }
    } else if (opt.type === 1) {
      lines.push(renderSubcommand(opt));
    }
  }

  return lines.join("\n");
}

/** Render a full command section */
function renderCommand(cmd: CommandData): string {
  const lines: string[] = [];

  lines.push(`### /${cmd.name}`);
  lines.push("");
  lines.push(cmd.description);
  lines.push("");
  lines.push(
    `**Permission:** ${formatPermission(cmd)} · **Cooldown:** ${formatCooldown(cmd)} · **Env:** ${cmd.env}`,
  );
  lines.push("");

  const subcommands = cmd.options.filter((o) => o.type === 1 || o.type === 2);
  const topLevelOptions = cmd.options.filter(
    (o) => o.type !== 1 && o.type !== 2,
  );

  if (subcommands.length > 0) {
    lines.push(renderSubcommands(subcommands));
  }

  if (topLevelOptions.length > 0) {
    lines.push(renderOptionsTable(topLevelOptions));
    lines.push("");
  }

  if (subcommands.length === 0 && topLevelOptions.length === 0) {
    lines.push("*No options.*");
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log("Scanning command files...");

  const files = collectFiles(COMMANDS_PATH);
  const commands: CommandData[] = [];

  // Intercept process.exit during imports (DB module calls it when offline)
  exitIntercepted = true;
  for (const filePath of files) {
    const fileName = path.basename(filePath);
    try {
      const mod = (await import(pathToFileURL(filePath).href)) as CommandModule;

      if (!mod.data?.name) {
        console.warn(`Skipped ${fileName}: missing data export`);
        continue;
      }

      const json = mod.data.toJSON();
      const category = getCategory(filePath);
      const env = commandRegistry[mod.data.name] ?? "unregistered";

      commands.push({
        name: json.name,
        description: json.description,
        category,
        options: (json.options ?? []) as CommandOption[],
        defaultMemberPermissions: json.default_member_permissions ?? null,
        permissions: mod.permissions
          ? {
              requireAdmin: mod.permissions.requireAdmin,
              requireOwner: mod.permissions.requireOwner,
            }
          : undefined,
        cooldown: mod.cooldown
          ? {
              duration: mod.cooldown.duration,
              type: mod.cooldown.type,
              message: mod.cooldown.message,
            }
          : undefined,
        env: env === "both" ? "prod" : env,
      });

      console.log(`  Loaded /${json.name} (${category})`);
    } catch (error) {
      console.error(`  Failed to load ${fileName}:`, error);
    }
  }
  exitIntercepted = false;

  // Sort: by category then by name
  const categoryOrder = ["admin", "user", "public"];
  commands.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category);
    const catB = categoryOrder.indexOf(b.category);
    if (catA !== catB)
      return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
    return a.name.localeCompare(b.name);
  });

  const outputs: string[] = [];

  // Write markdown
  if (emitMd) {
    // Group by category
    const grouped = new Map<string, CommandData[]>();
    for (const cmd of commands) {
      const list = grouped.get(cmd.category) ?? [];
      list.push(cmd);
      grouped.set(cmd.category, list);
    }

    const lines: string[] = [];
    lines.push("# Discord Commands");
    lines.push("");
    lines.push(
      "> Auto-generated from slash command definitions. Do not edit manually.",
    );
    lines.push(`> Generated: ${new Date().toISOString().split("T")[0]}`);
    lines.push("");

    lines.push("## Table of Contents");
    lines.push("");
    for (const [category, cmds] of grouped) {
      const heading = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(
        `- **${heading}**: ${cmds.map((c) => `[/${c.name}](#${c.name})`).join(", ")}`,
      );
    }
    lines.push("");

    for (const [category, cmds] of grouped) {
      const heading = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`## ${heading} Commands`);
      lines.push("");

      for (const cmd of cmds) {
        lines.push(renderCommand(cmd));
      }
    }

    await fsp.mkdir(OUTPUT_PATH, { recursive: true });
    await fsp.writeFile(OUTPUT_FILE, lines.join("\n"), "utf-8");
    outputs.push(`Markdown: ${OUTPUT_FILE}`);
  }

  // Write JSON (consumed by tRPC admin endpoint)
  if (emitJson) {
    const jsonPayload = {
      generatedAt: new Date().toISOString(),
      commands,
    };
    await fsp.writeFile(
      JSON_OUTPUT_FILE,
      JSON.stringify(jsonPayload, null, "\t"),
      "utf-8",
    );
    outputs.push(`JSON:     ${JSON_OUTPUT_FILE}`);
  }

  console.log(`\nGenerated ${commands.length} commands:`);
  for (const o of outputs) console.log(`  ${o}`);
  realExit(0);
}

main().catch((err) => {
  console.error("Failed to generate command docs:", err);
  realExit(1);
});
