/**
 * Pending Votes Import
 *
 * One-off cutover helper: reads the Votifier mod's `pending_votes.json` (or
 * its `config.json`, which carries the same map under `pendingVotes`) and
 * records every vote in `player_vote`, linked to the registered player when
 * the username matches one. Imported votes are left unrewarded, so the app
 * pays them out on the player's next join. Running it twice is safe: a vote
 * that is already stored is skipped.
 *
 * Usage:
 *   tsx src/scripts/votes/import-pending-votes.ts <path to pending_votes.json or config.json>
 */

import "@/logger.global";
import fs from "node:fs";
import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import { parseTimestamp } from "@/services/votifier/protocol";

interface ModVote {
  serviceName: string;
  username: string;
  timestamp?: string | number;
}

function readPendingVotes(file: string): ModVote[] {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
    string,
    unknown
  >;
  const map = (
    "pendingVotes" in parsed ? parsed.pendingVotes : parsed
  ) as Record<string, ModVote[]>;
  return Object.values(map).flat();
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: tsx src/scripts/votes/import-pending-votes.ts <pending_votes.json | config.json>",
    );
    process.exit(1);
  }

  const votes = readPendingVotes(file);
  console.log(`Found ${votes.length} pending vote(s) in ${file}`);

  let stored = 0;
  let linked = 0;
  let skipped = 0;
  let invalid = 0;
  for (const vote of votes) {
    const votedAt = parseTimestamp(vote.timestamp);
    if (!votedAt) {
      invalid++;
      console.warn(
        `  skipped ${vote.username} (${vote.serviceName}): no usable timestamp ${JSON.stringify(vote.timestamp)}`,
      );
      continue;
    }
    const [player] = await Q.player.findAll(
      { minecraftUsername: { $ilike: escapeLike(vote.username) } },
      { limit: 1 },
    );
    const row = await Q.player.vote.record({
      username: vote.username,
      serviceName: vote.serviceName,
      votedAt,
      playerMinecraftUuid: player?.minecraftUuid ?? null,
    });
    if (!row) {
      skipped++;
      continue;
    }
    stored++;
    if (player) linked++;
    console.log(
      `  #${row.id} ${vote.username} (${vote.serviceName}, ${row.votedAt.toISOString()})${player ? "" : " - no registered player"}`,
    );
  }

  console.log(
    `Stored ${stored} vote(s), ${linked} linked to a player, ${skipped} already present, ${invalid} without a timestamp`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
