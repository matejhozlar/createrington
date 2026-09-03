import {
  defaultRconSend,
  isUnknownCommand,
  requireUsername,
  stripFormatting,
  type RconSend,
} from "@/utils/rcon";

export type FtbRanksFailure =
  "unknown_command" | "unknown_rank" | "unknown_player" | "unexpected_reply";

/** Raised when `/ftbranks` answers with something other than the expected confirmation; `reason` says which case. */
export class FtbRanksCommandError extends Error {
  constructor(
    message: string,
    public readonly reason: FtbRanksFailure,
    public readonly command: string,
    public readonly response: string,
  ) {
    super(message);
    this.name = "FtbRanksCommandError";
  }
}

const RANK_ID = /^[A-Za-z0-9_.+-]+$/;
const UNKNOWN_RANK = /unknown rank/i;
const UNKNOWN_PLAYER = /player does not exist|no player was found/i;
const ADDED = /added to rank/i;
const REMOVED = /removed from rank/i;

function requireRankId(rankId: string): string {
  const id = rankId.trim();
  if (!RANK_ID.test(id)) {
    throw new Error(`Invalid FTB Ranks rank id: ${JSON.stringify(rankId)}`);
  }
  return id;
}

/**
 * Typed client for the FTB Ranks mod's `/ftbranks` command tree, spoken over
 * RCON. Membership changes (`add` / `remove`) resolve the player through the
 * server's profile cache, so the target does not need to be online. The mod
 * only confirms an actual change ("Player X added to rank 'Y'!") and stays
 * silent when the player already had, or did not have, the rank, which is why
 * an empty reply resolves to `false` instead of failing. A rank missing from
 * ranks.snbt, a player the server cannot resolve, and a missing mod all
 * surface as FtbRanksCommandError with a matching `reason`; transport
 * failures surface as the RCON manager's own errors.
 */
export class FtbRanksClient {
  constructor(private readonly send: RconSend = defaultRconSend) {}

  private async run(serverId: number, subcommand: string): Promise<string> {
    const command = `ftbranks ${subcommand}`;
    const response = stripFormatting(await this.send(serverId, command));
    if (isUnknownCommand(response)) {
      throw new FtbRanksCommandError(
        "The FTB Ranks mod did not recognise the command (is it installed on the server?)",
        "unknown_command",
        command,
        response,
      );
    }
    if (UNKNOWN_RANK.test(response)) {
      throw new FtbRanksCommandError(
        `Rank is not declared on the server: ${response}`,
        "unknown_rank",
        command,
        response,
      );
    }
    if (UNKNOWN_PLAYER.test(response)) {
      throw new FtbRanksCommandError(
        `Player is unknown to the server: ${response}`,
        "unknown_player",
        command,
        response,
      );
    }
    return response;
  }

  private async change(
    serverId: number,
    action: "add" | "remove",
    username: string,
    rankId: string,
    confirmation: RegExp,
  ): Promise<boolean> {
    const subcommand = `${action} ${requireUsername(username)} ${requireRankId(rankId)}`;
    const response = await this.run(serverId, subcommand);
    if (response === "") return false;
    if (confirmation.test(response)) return true;
    throw new FtbRanksCommandError(
      `Unexpected reply to ftbranks ${subcommand}: ${response}`,
      "unexpected_reply",
      `ftbranks ${subcommand}`,
      response,
    );
  }

  /** Grants a rank to a player. Resolves true when granted, false when the player already had it. */
  async add(
    serverId: number,
    username: string,
    rankId: string,
  ): Promise<boolean> {
    return this.change(serverId, "add", username, rankId, ADDED);
  }

  /** Revokes a rank from a player. Resolves true when revoked, false when the player did not have it. */
  async remove(
    serverId: number,
    username: string,
    rankId: string,
  ): Promise<boolean> {
    return this.change(serverId, "remove", username, rankId, REMOVED);
  }
}
