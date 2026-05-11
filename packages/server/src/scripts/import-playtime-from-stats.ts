/**
 * One-shot importer: walks a folder of Minecraft 1.21+ stats JSON files
 * (world/stats/<uuid>.json) and emits SQL upserts for player_playtime_summary.
 *
 * Use case: backfilling all-time playtime for players who left the server
 * before the bot existed, or whose summary rows were lost to cascade deletes
 * before the FK was dropped.
 *
 * Usage:
 *   pnpm tsx packages/server/src/scripts/import-playtime-from-stats.ts \
 *     --stats-dir ./stats-snapshot \
 *     --server-id 1 \
 *     --output ./playtime-backfill.sql
 *
 * The emitted SQL uses ON CONFLICT DO NOTHING: existing summary rows are
 * never touched. Only UUIDs missing from player_playtime_summary get inserted.
 * This is safe to re-run.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const TICKS_PER_SECOND = 20;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Args {
  statsDir: string;
  serverId: number;
  output: string | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let statsDir: string | null = null;
  let serverId: number | null = null;
  let output: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--stats-dir") statsDir = args[++i];
    else if (a === "--server-id") serverId = parseInt(args[++i], 10);
    else if (a === "--output") output = args[++i];
  }

  if (!statsDir || serverId == null || Number.isNaN(serverId)) {
    console.error(
      "Usage: --stats-dir <path> --server-id <int> [--output <sql file>]",
    );
    process.exit(1);
  }
  return { statsDir, serverId, output };
}

interface StatsFile {
  stats?: { "minecraft:custom"?: Record<string, number> };
}

function readPlayTimeTicks(filePath: string): number | null {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as StatsFile;
  const custom = parsed.stats?.["minecraft:custom"] ?? {};
  // 1.17+: play_time. Pre-1.17: play_one_minute (also ticks despite the name).
  const ticks =
    custom["minecraft:play_time"] ?? custom["minecraft:play_one_minute"];
  return typeof ticks === "number" && ticks > 0 ? ticks : null;
}

function main(): void {
  const { statsDir, serverId, output } = parseArgs();

  const files = readdirSync(statsDir).filter((f) => f.endsWith(".json"));

  const rows: { uuid: string; seconds: number }[] = [];
  let skippedNoPlaytime = 0;
  let skippedBadName = 0;

  for (const file of files) {
    const uuid = file.replace(/\.json$/, "");
    if (!UUID_REGEX.test(uuid)) {
      skippedBadName++;
      continue;
    }
    const ticks = readPlayTimeTicks(join(statsDir, file));
    if (ticks == null) {
      skippedNoPlaytime++;
      continue;
    }
    rows.push({ uuid, seconds: Math.floor(ticks / TICKS_PER_SECOND) });
  }

  rows.sort((a, b) => b.seconds - a.seconds);

  const lines: string[] = [];
  lines.push(
    `-- Backfill of player_playtime_summary from Minecraft stats files`,
  );
  lines.push(`-- Source dir: ${statsDir}`);
  lines.push(`-- Target server_id: ${serverId}`);
  lines.push(
    `-- Players: ${rows.length} (skipped ${skippedNoPlaytime} no-playtime, ${skippedBadName} bad-name)`,
  );
  lines.push(
    `-- Total hours: ${(rows.reduce((s, r) => s + r.seconds, 0) / 3600).toFixed(1)}`,
  );
  lines.push(``);
  lines.push(`BEGIN;`);
  lines.push(``);

  const valuesPerStatement = 500;
  for (let i = 0; i < rows.length; i += valuesPerStatement) {
    const chunk = rows.slice(i, i + valuesPerStatement);
    lines.push(
      `INSERT INTO player_playtime_summary (player_minecraft_uuid, server_id, total_seconds) VALUES`,
    );
    chunk.forEach((r, idx) => {
      const sep = idx === chunk.length - 1 ? "" : ",";
      lines.push(`  ('${r.uuid}', ${serverId}, ${r.seconds})${sep}`);
    });
    lines.push(`ON CONFLICT (player_minecraft_uuid, server_id) DO NOTHING;`);
    lines.push(``);
  }

  lines.push(`COMMIT;`);
  lines.push(``);

  const sql = lines.join("\n");

  if (output) {
    writeFileSync(output, sql);
    console.log(`Wrote ${rows.length} upsert rows to ${output}`);
    console.log(
      `Total: ${(rows.reduce((s, r) => s + r.seconds, 0) / 3600).toFixed(1)}h`,
    );
  } else {
    process.stdout.write(sql);
  }
}

main();
