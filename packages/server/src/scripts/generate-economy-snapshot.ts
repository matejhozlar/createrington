/**
 * Generates a hardcoded snapshot of the player population for the
 * Admin -> Tools -> Economy Simulator. Pure read-only; does not mutate state.
 *
 * Usage:
 *   pnpm tsx packages/server/src/scripts/generate-economy-snapshot.ts \
 *     [--cutoff 2026-03-17] \
 *     [--output packages/client/src/features/admin/tools/economy-simulator/snapshot.json]
 */

import "@/logger.global";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";

interface SnapshotPlayer {
  uuid: string;
  username: string;
  joined: string;
  cash: number;
  crypto: number;
  worth: number;
  totalSeconds: number;
  postCutoffSeconds: number;
}

interface Snapshot {
  generatedAt: string;
  cutoffDate: string;
  players: SnapshotPlayer[];
}

interface Args {
  cutoff: string;
  output: string;
}

const DEFAULT_OUTPUT =
  "packages/client/src/features/admin/tools/economy-simulator/snapshot.json";

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let cutoff = "2026-03-17";
  let output = DEFAULT_OUTPUT;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cutoff") cutoff = args[++i];
    else if (a === "--output") output = args[++i];
  }
  return { cutoff, output };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { cutoff, output } = parseArgs();
  console.log(`=== Economy Snapshot Generator ===`);
  console.log(`cutoff: ${cutoff}`);
  console.log(`output: ${output}\n`);

  const players = await Q.player.findAll({});
  console.log(`Loaded ${players.length} players`);

  const balances = await Q.player.balance.where({}).all();
  const balanceByUuid = new Map<string, number>();
  for (const b of balances) {
    balanceByUuid.set(b.minecraftUuid, BalanceUtils.fromStorage(b.balance));
  }
  console.log(`Loaded ${balances.length} balance rows`);

  const tokens = await Q.crypto.token.where({}).all();
  const tokenPriceMap = new Map(tokens.map((t) => [t.id, Number(t.price)]));
  const holdings = await Q.crypto.holding.where({}).all();
  const cryptoByUuid = new Map<string, number>();
  for (const h of holdings) {
    const price = tokenPriceMap.get(h.tokenId) ?? 0;
    const value = price * Number(h.amount);
    cryptoByUuid.set(
      h.playerMinecraftUuid,
      (cryptoByUuid.get(h.playerMinecraftUuid) ?? 0) + value,
    );
  }
  console.log(
    `Loaded ${tokens.length} tokens and ${holdings.length} crypto holdings`,
  );

  const summaries = await Q.player.playtime.summary.where({}).all();
  const totalSecondsByUuid = new Map<string, number>();
  for (const s of summaries) {
    totalSecondsByUuid.set(
      s.playerMinecraftUuid,
      (totalSecondsByUuid.get(s.playerMinecraftUuid) ?? 0) +
        Number(s.totalSeconds),
    );
  }
  console.log(`Loaded ${summaries.length} playtime summary rows`);

  const dailyRows = await Q.player.playtime.daily
    .where({ playDate: { $gte: new Date(cutoff) } })
    .all();
  const postCutoffByUuid = new Map<string, number>();
  for (const d of dailyRows) {
    postCutoffByUuid.set(
      d.playerMinecraftUuid,
      (postCutoffByUuid.get(d.playerMinecraftUuid) ?? 0) +
        Number(d.secondsPlayed),
    );
  }
  console.log(`Loaded ${dailyRows.length} post-cutoff daily playtime rows`);

  const out: SnapshotPlayer[] = [];
  for (const p of players) {
    if (!p.minecraftUuid || !p.minecraftUsername) continue;
    const cash = balanceByUuid.get(p.minecraftUuid) ?? 0;
    const crypto = cryptoByUuid.get(p.minecraftUuid) ?? 0;
    const worth = cash + crypto;
    if (worth <= 0) continue;
    out.push({
      uuid: p.minecraftUuid,
      username: p.minecraftUsername,
      joined: toIsoDate(new Date(p.createdAt)),
      cash,
      crypto,
      worth,
      totalSeconds: totalSecondsByUuid.get(p.minecraftUuid) ?? 0,
      postCutoffSeconds: postCutoffByUuid.get(p.minecraftUuid) ?? 0,
    });
  }

  out.sort((a, b) => b.worth - a.worth);

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    cutoffDate: cutoff,
    players: out,
  };

  const outputPath = resolve(process.cwd(), output);
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + "\n");

  const totalCash = out.reduce((acc, p) => acc + p.cash, 0);
  const totalCrypto = out.reduce((acc, p) => acc + p.crypto, 0);
  console.log(
    `\nWrote ${out.length} players to ${outputPath}\n` +
      `  total cash: ${totalCash.toFixed(2)}\n` +
      `  total crypto: ${totalCrypto.toFixed(2)}`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
