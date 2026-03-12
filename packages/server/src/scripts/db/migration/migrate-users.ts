import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ quiet: true, path: "../../.env.migration" });

if (!process.env.SRC_PGHOST) {
  console.error("Env file not found. Exiting...");
  process.exit(0);
}

const execAsync = promisify(exec);

/**
 * CONFIG
 * - Source DB connection only (old DB)
 * - Target schema is a local SQL dump file (new schema)
 */
const SOURCE = {
  host: process.env.SRC_PGHOST ?? "localhost",
  user: process.env.SRC_PGUSER ?? "postgres",
  database: process.env.SRC_PGDATABASE ?? "postgres",
  password: process.env.SRC_PGPASSWORD ?? "",
  port: Number(process.env.SRC_PGPORT ?? "5432"),
};

const TARGET_SCHEMA_FILE =
  process.env.TARGET_SCHEMA_FILE ??
  path.resolve(process.cwd(), "target-schema.sql");

const OUTPUT_SQL_FILE =
  process.env.OUTPUT_SQL_FILE ??
  path.resolve(process.cwd(), "migration-inserts.sql");

/**
 * Uses COPY ... TO STDOUT WITH CSV so we can parse safely (handles tabs/newlines in text).
 */
import os from "node:os";
import crypto from "node:crypto";

async function copyCsvFromSource(sqlSelect: string): Promise<string> {
  const tmpName = `migrate-copy-${crypto.randomBytes(8).toString("hex")}.sql`;
  const tmpFile = path.join(os.tmpdir(), tmpName);

  // 1) trim
  // 2) remove ALL trailing semicolons
  // 3) collapse whitespace/newlines to a single space (so \copy sees a single statement cleanly)
  const select = sqlSelect
    .trim()
    .replace(/;+/g, "") // remove any ; anywhere (safe for SELECT-only strings)
    .replace(/\s+/g, " "); // collapse whitespace/newlines

  // CSV defaults: QUOTE is ", ESCAPE is " in Postgres CSV format
  const copySql = `\\copy (${select}) TO STDOUT WITH (FORMAT csv, HEADER true)\n`;

  await fs.writeFile(tmpFile, copySql, "utf8");

  // Debug: if it fails again, you can open this file and see exactly what's being run
  // console.log("Temp SQL:", tmpFile);
  // console.log(copySql);

  const cmd =
    `psql -h ${SOURCE.host} -p ${SOURCE.port} -U ${SOURCE.user} -d ${SOURCE.database} ` +
    `-v ON_ERROR_STOP=1 -f "${tmpFile}"`;

  try {
    const { stdout } = await execAsync(cmd, {
      env: { ...process.env, PGPASSWORD: SOURCE.password },
      maxBuffer: 1024 * 1024 * 512,
    });
    return stdout;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

/**
 * Minimal CSV parser for Postgres CSV output.
 * - Handles quoted fields, escaped quotes ("")
 * - Returns array of objects keyed by header columns
 */
function parseCsv(csvText: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // Avoid pushing empty trailing row
    rows.push(row);
    row = [];
  };

  while (i < csvText.length) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = csvText[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i += 1;
          continue;
        }
      } else {
        field += ch;
        i += 1;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        pushField();
        i += 1;
        continue;
      }
      if (ch === "\n") {
        pushField();
        pushRow();
        i += 1;
        continue;
      }
      if (ch === "\r") {
        // ignore CR (windows newlines)
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
  }

  // last field/row if file doesn't end with newline
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  const data = rows.slice(1);

  return data
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== "")) // drop empty last line
    .map((r) => {
      const obj: Record<string, string> = {};
      for (let c = 0; c < header.length; c++) {
        obj[header[c]] = r[c] ?? "";
      }
      return obj;
    });
}

/**
 * Extract column names from a target schema dump for a given table.
 * Assumes CREATE TABLE public.<table> ( ... );
 */
function extractTargetColumns(schemaSql: string, tableName: string): string[] {
  // Very tolerant regex: grabs everything inside the CREATE TABLE (...) block
  const re = new RegExp(
    String.raw`CREATE\s+TABLE\s+public\.${tableName}\s*\(\s*([\s\S]*?)\);\s`,
    "i",
  );

  const m = schemaSql.match(re);
  if (!m) return [];

  const inside = m[1];

  // Split by lines, grab first token for lines that look like column definitions:
  // e.g. "minecraft_uuid uuid NOT NULL,"
  // skip constraint lines (start with CONSTRAINT) and blank/comment lines
  const cols: string[] = [];
  for (const rawLine of inside.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("--")) continue;
    if (/^CONSTRAINT\b/i.test(line)) continue;

    // column name is the first identifier
    const colMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+/);
    if (!colMatch) continue;

    const col = colMatch[1];
    cols.push(col);
  }

  return cols;
}

/**
 * SQL literal escaper
 * - null/undefined => NULL
 * - strings => '...'
 */
function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  const s = String(v);
  // Treat empty string as empty string (not NULL)
  const escaped = s.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Convert timestamp string to timestamptz literal.
 * We just quote it; Postgres will cast.
 */
function tsLiteral(v: string | null | undefined): string {
  if (!v) return "NULL";
  return sqlLiteral(v);
}

/**
 * Convert numeric(20,8) (string) => bigint smallest unit with 3 decimal places.
 * Example: 1.23456789 => 1235 (rounded to 3dp)
 */
function balanceToBigint3dp(balanceText: string): bigint | null {
  if (!balanceText) return 0n;

  // Using string math to avoid float issues:
  // 1) normalize sign, split integer and fractional
  // 2) keep 4 digits to round to 3 dp
  let s = balanceText.trim();
  if (!s) return 0n;

  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);

  const [intPartRaw, fracRaw = ""] = s.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";

  // We need thousandths, so 3 digits, but for rounding look at 4th digit.
  const frac = (fracRaw + "0000").slice(0, 4); // at least 4 digits
  const frac3 = frac.slice(0, 3);
  const roundDigit = Number(frac[3] ?? "0");

  let value = BigInt(intPart) * 1000n + BigInt(frac3);

  if (roundDigit >= 5) value += 1n;

  if (negative) return -value;
  return value;
}

/**
 * Intersect desired columns with target columns, preserving desired order.
 */
function onlyColumnsThatExist(
  desired: string[],
  targetCols: Set<string>,
): string[] {
  return desired.filter((c) => targetCols.has(c));
}

/**
 * Build INSERT statements for player + player_balance
 */
async function main(): Promise<void> {
  const targetSchema = await fs.readFile(TARGET_SCHEMA_FILE, "utf-8");

  const playerColsTarget = new Set(
    extractTargetColumns(targetSchema, "player"),
  );
  const balanceColsTarget = new Set(
    extractTargetColumns(targetSchema, "player_balance"),
  );

  if (playerColsTarget.size === 0) {
    throw new Error(
      `Could not find CREATE TABLE public.player (...) in ${TARGET_SCHEMA_FILE}`,
    );
  }
  if (balanceColsTarget.size === 0) {
    throw new Error(
      `Could not find CREATE TABLE public.player_balance (...) in ${TARGET_SCHEMA_FILE}`,
    );
  }

  // --- Pull from source (users) ---
  // We fetch everything we might need, then intersect with target columns later.
  const usersCsv = await copyCsvFromSource(`
    SELECT
      uuid::text                     AS uuid,
      name                           AS name,
      COALESCE(discord_id, '')       AS discord_id,
      online::text                   AS online,
      last_seen::text                AS last_seen,
      first_joined::text             AS first_joined
    FROM public.users
    ORDER BY first_joined NULLS LAST, last_seen NULLS LAST;
  `);

  const users = parseCsv(usersCsv);

  // --- Pull from source (user_funds) ---
  const fundsCsv = await copyCsvFromSource(`
    SELECT
      uuid::text        AS uuid,
      balance::text     AS balance,
      last_updated::text AS last_updated
    FROM public.user_funds
    ORDER BY last_updated NULLS LAST;
  `);

  const funds = parseCsv(fundsCsv);

  // Map: uuid -> fund row
  const fundsByUuid = new Map<string, Record<string, string>>();
  for (const f of funds) {
    fundsByUuid.set(f.uuid, f);
  }

  // Desired columns for player in our inserts (we will intersect with actual target columns)
  const desiredPlayerCols = [
    "minecraft_uuid",
    "minecraft_username",
    "discord_id",
    "online",
    // "last_seen",
    "created_at",
    // "updated_at",
    "current_server_id",
  ];

  const actualPlayerCols = onlyColumnsThatExist(
    desiredPlayerCols,
    playerColsTarget,
  );

  // Desired columns for player_balance
  const desiredBalanceCols = ["minecraft_uuid", "balance", "updated_at"];
  const actualBalanceCols = onlyColumnsThatExist(
    desiredBalanceCols,
    balanceColsTarget,
  );

  const lines: string[] = [];
  lines.push("-- Auto-generated migration inserts");
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push(
    `-- Source: ${SOURCE.user}@${SOURCE.host}:${SOURCE.port}/${SOURCE.database}`,
  );
  lines.push(`-- Target schema parsed from: ${TARGET_SCHEMA_FILE}`);
  lines.push("");
  lines.push("BEGIN;");
  lines.push("");

  // -------------------------
  // player inserts
  // -------------------------
  let skippedNoDiscord = 0;
  let emittedPlayers = 0;
  const emittedPlayerUuids = new Set<string>();

  lines.push("-- =========================================");
  lines.push("-- public.player");
  lines.push("-- =========================================");
  lines.push("");

  for (const u of users) {
    const uuid = u.uuid;
    const username = u.name;
    const discordId = (u.discord_id ?? "").trim();

    // player.discord_id is NOT NULL in your target schema snippet,
    // so skip rows that don't have one.
    if (!discordId) {
      skippedNoDiscord++;
      continue;
    }

    emittedPlayerUuids.add(u.uuid);

    // last_seen in old is timestamp (no tz); target is timestamptz.
    // We'll just insert the string; PG will cast if it's parseable.
    const lastSeen = u.last_seen || null;
    const createdAt = u.first_joined || null;
    const updatedAt = u.last_seen || null;

    // Build values in the same order as actualPlayerCols
    const valueByCol: Record<string, string> = {
      minecraft_uuid: sqlLiteral(uuid) + "::uuid",
      minecraft_username: sqlLiteral(username),
      discord_id: sqlLiteral(discordId),
      online: u.online?.toLowerCase() === "true" ? "true" : "false",
      last_seen: tsLiteral(lastSeen) + "::timestamptz",
      created_at: tsLiteral(createdAt) + "::timestamptz",
      updated_at: tsLiteral(updatedAt) + "::timestamptz",
      current_server_id: "NULL",
    };

    const colsSql = actualPlayerCols.map((c) => `"${c}"`).join(", ");
    const valsSql = actualPlayerCols
      .map((c) => valueByCol[c] ?? "NULL")
      .join(", ");

    // Use an upsert keyed on minecraft_uuid (unique in target).
    // If the row exists, update the fields we provide (excluding uuid).
    const updateCols = actualPlayerCols
      .filter((c) => c !== "minecraft_uuid")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    lines.push(
      `INSERT INTO public.player (${colsSql}) VALUES (${valsSql}) ` +
        `ON CONFLICT (minecraft_uuid) DO UPDATE SET ${updateCols};`,
    );

    emittedPlayers++;
  }

  lines.push("");
  lines.push(
    `-- Emitted player rows: ${emittedPlayers}; skipped (no discord_id): ${skippedNoDiscord}`,
  );
  lines.push("");

  // -------------------------
  // player_balance inserts
  // -------------------------
  let emittedBalances = 0;
  let skippedNegative = 0;

  lines.push("-- =========================================");
  lines.push("-- public.player_balance");
  lines.push("-- =========================================");
  lines.push("");

  for (const u of users) {
    const uuid = u.uuid;

    if (!emittedPlayerUuids.has(uuid)) continue;

    const f = fundsByUuid.get(uuid);
    if (!f) continue;

    const bal = balanceToBigint3dp(f.balance);
    if (bal === null) continue;

    // Target has chk_balance_non_negative, so skip negatives.
    if (bal < 0n) {
      skippedNegative++;
      continue;
    }

    const updatedAt = f.last_updated || u.last_seen || null;

    const valueByCol: Record<string, string> = {
      minecraft_uuid: sqlLiteral(uuid) + "::uuid",
      balance: bal.toString(),
      updated_at: tsLiteral(updatedAt) + "::timestamptz",
    };

    const colsSql = actualBalanceCols.map((c) => `"${c}"`).join(", ");
    const valsSql = actualBalanceCols
      .map((c) => valueByCol[c] ?? "NULL")
      .join(", ");

    const updateCols = actualBalanceCols
      .filter((c) => c !== "minecraft_uuid")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    lines.push(
      `INSERT INTO public.player_balance (${colsSql}) VALUES (${valsSql}) ` +
        `ON CONFLICT (minecraft_uuid) DO UPDATE SET ${updateCols};`,
    );

    emittedBalances++;
  }

  lines.push("");
  lines.push(
    `-- Emitted balance rows: ${emittedBalances}; skipped (negative): ${skippedNegative}`,
  );
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");

  await fs.writeFile(OUTPUT_SQL_FILE, lines.join("\n"), "utf-8");

  console.log(`✓ Wrote ${OUTPUT_SQL_FILE}`);
  console.log(
    `  player: ${emittedPlayers} inserts, ${skippedNoDiscord} skipped (missing discord_id)`,
  );
  console.log(
    `  player_balance: ${emittedBalances} inserts, ${skippedNegative} skipped (negative balance)`,
  );
}

main().catch((err) => {
  console.error("Migration export failed:");
  console.error(err);
  process.exit(1);
});
