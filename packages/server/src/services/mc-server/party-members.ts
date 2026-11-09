import {
  defaultRconSend,
  isUnknownCommand,
  stripFormatting,
  type RconSend,
} from "@/utils/rcon";

export type PartyCommandFailure =
  "unknown_command" | "not_reporting" | "unexpected_reply";

/** Raised when a `/createrington party` command answers with something other than one of its known replies; `reason` says which case. */
export class PartyCommandError extends Error {
  constructor(
    message: string,
    public readonly reason: PartyCommandFailure,
    public readonly command: string,
    public readonly response: string,
  ) {
    super(message);
    this.name = "PartyCommandError";
  }
}

export type PartyRemoval =
  | { outcome: "removed"; playerName: string; partyName: string }
  | { outcome: "owner"; playerName: string; partyName: string }
  | { outcome: "not_in_party"; playerName: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_REPORTING = /party_sync is off/i;
const SYNC_STARTED = /^Sending the parties to the app/;

function requireUuid(uuid: string): string {
  const value = uuid.trim().toLowerCase();
  if (!UUID.test(value)) {
    throw new Error(`Invalid Minecraft UUID: ${JSON.stringify(uuid)}`);
  }
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRemoval(response: string, uuid: string): PartyRemoval | null {
  const id = escapeRegExp(uuid);
  const removed = new RegExp(`^Removed (.+) \\(${id}\\) from (.+)\\.$`, "i");
  const owner = new RegExp(
    `^(.+) \\(${id}\\) owns (.+) and is never removed from it\\.$`,
    "i",
  );
  const notInParty = new RegExp(`^(.+) \\(${id}\\) is not in a party\\.$`, "i");

  let match = removed.exec(response);
  if (match) {
    return { outcome: "removed", playerName: match[1], partyName: match[2] };
  }
  match = owner.exec(response);
  if (match) {
    return { outcome: "owner", playerName: match[1], partyName: match[2] };
  }
  match = notInParty.exec(response);
  if (match) return { outcome: "not_in_party", playerName: match[1] };
  return null;
}

/**
 * Typed client for core's `/createrington party` commands (feature
 * `party_sync`), spoken over RCON. `sync` makes core send its party snapshot
 * at the next tick even when nothing changed; it only starts the send, the
 * snapshot arrives through the mod API. `remove` takes a player out of their
 * FTB Teams party by UUID, so renamed and offline players are found, and
 * never removes a party owner: core refuses and the result says so. A missing
 * command, a feature that is off, and an unknown reply surface as
 * PartyCommandError with a matching `reason`; transport failures surface as
 * the RCON manager's own errors.
 */
export class PartyMembersClient {
  constructor(private readonly send: RconSend = defaultRconSend) {}

  private async run(serverId: number, subcommand: string): Promise<string> {
    const command = `createrington party ${subcommand}`;
    const response = stripFormatting(await this.send(serverId, command));
    if (isUnknownCommand(response)) {
      throw new PartyCommandError(
        "Core did not recognise the command (is a core release with /createrington party on the server?)",
        "unknown_command",
        command,
        response,
      );
    }
    if (NOT_REPORTING.test(response)) {
      throw new PartyCommandError(
        `Core's party sync is not running: ${response}`,
        "not_reporting",
        command,
        response,
      );
    }
    return response;
  }

  /** Asks core to send its party snapshot at the next tick, changed or not. */
  async sync(serverId: number): Promise<void> {
    const response = await this.run(serverId, "sync");
    if (!SYNC_STARTED.test(response)) {
      throw new PartyCommandError(
        `Unexpected reply to createrington party sync: ${response}`,
        "unexpected_reply",
        "createrington party sync",
        response,
      );
    }
  }

  /** Removes a player from their party unless they own it. */
  async remove(serverId: number, minecraftUuid: string): Promise<PartyRemoval> {
    const uuid = requireUuid(minecraftUuid);
    const response = await this.run(serverId, `remove ${uuid}`);
    const removal = parseRemoval(response, uuid);
    if (!removal) {
      throw new PartyCommandError(
        `Unexpected reply to createrington party remove ${uuid}: ${response}`,
        "unexpected_reply",
        `createrington party remove ${uuid}`,
        response,
      );
    }
    return removal;
  }
}
