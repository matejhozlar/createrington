import {
  MINECRAFT_USERNAME,
  defaultRconSend,
  isUnknownCommand,
  requireUsername,
  stripFormatting,
  type RconSend,
} from "@/utils/rcon";

export interface MaintenanceAllowList {
  players: string[];
  groups: string[];
  ignored: string[];
}

/** Raised when `/maintenance` answers with something other than the expected confirmation. */
export class MaintenanceModeCommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly response: string,
  ) {
    super(message);
    this.name = "MaintenanceModeCommandError";
  }
}

const LEGACY_AMPERSAND_CODE = /&([0-9a-fk-or])/gi;
const PLAYER_LIST = /allowed player\(s\):\s*(.*?)(?=\s*(?:\n|There are|$))/is;
const GROUP_LIST =
  /allowed luckperms groups\(s\):\s*(.*?)(?=\s*(?:\n|There are|$))/is;

export function parseStatus(response: string): boolean | null {
  if (/\bEnabled/.test(response)) return true;
  if (/\bDisabled/.test(response)) return false;
  return null;
}

function matchList(text: string, pattern: RegExp): string[] {
  const match = text.match(pattern);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseAllowList(response: string): MaintenanceAllowList {
  const tokens = matchList(response, PLAYER_LIST);
  return {
    players: tokens.filter((name) => MINECRAFT_USERNAME.test(name)),
    groups: matchList(response, GROUP_LIST),
    ignored: tokens.filter((name) => !MINECRAFT_USERNAME.test(name)),
  };
}

export function toPhrase(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(LEGACY_AMPERSAND_CODE, "§$1")
    .trim();
}

/**
 * Typed client for the Maintenance Mode mod's `/maintenance` command tree,
 * spoken over RCON. Every method sends exactly one command and validates the
 * mod's reply, so callers get a boolean or a thrown
 * MaintenanceModeCommandError instead of free text (transport failures
 * surface as the RCON manager's own errors). Replies arrive as the plain
 * concatenated text of every message the command emitted (RCON has no
 * separators), which is why matching is substring based and list parsing
 * stops at the next message start. Usernames sent to the mod must match
 * MINECRAFT_USERNAME; names read back from the mod that do not are reported
 * as `ignored` rather than echoed into further commands. MOTD and kick
 * message are sent as legacy `§` formatted text with real newlines: the mod's
 * MiniMessage path drops unstyled runs and downgrades hex colours, whereas
 * `§` codes pass through untouched and the vanilla client renders them in
 * both the server list and the disconnect screen. Authors write `&` codes,
 * which are translated here.
 */
export class MaintenanceModeClient {
  constructor(private readonly send: RconSend = defaultRconSend) {}

  private async run(serverId: number, subcommand: string): Promise<string> {
    const command = `maintenance ${subcommand}`;
    const response = stripFormatting(await this.send(serverId, command));
    if (isUnknownCommand(response)) {
      throw new MaintenanceModeCommandError(
        "The Maintenance Mode mod did not recognise the command (is it installed on the server?)",
        command,
        response,
      );
    }
    return response;
  }

  private async expect(
    serverId: number,
    subcommand: string,
    ok: RegExp,
    failure: string,
  ): Promise<string> {
    const response = await this.run(serverId, subcommand);
    if (!ok.test(response)) {
      throw new MaintenanceModeCommandError(
        `${failure}: ${response || "empty response"}`,
        `maintenance ${subcommand}`,
        response,
      );
    }
    return response;
  }

  /** Whether the mod currently has maintenance enabled. */
  async status(serverId: number): Promise<boolean> {
    const response = await this.run(serverId, "status");
    const enabled = parseStatus(response);
    if (enabled === null) {
      throw new MaintenanceModeCommandError(
        `Could not read maintenance status: ${response || "empty response"}`,
        "maintenance status",
        response,
      );
    }
    return enabled;
  }

  /** Turn maintenance on; with `untilRestart` the mod turns itself off at the next server stop. */
  async enable(
    serverId: number,
    options: { untilRestart?: boolean } = {},
  ): Promise<void> {
    await this.expect(
      serverId,
      options.untilRestart ? "schedule untilRestart" : "on",
      /\bEnabled/,
      "Failed to enable maintenance mode",
    );
  }

  /** Turn maintenance off. The mod confirms with "Disabled" even when it was already off. */
  async disable(serverId: number): Promise<void> {
    await this.expect(
      serverId,
      "off",
      /\bDisabled/,
      "Failed to disable maintenance mode",
    );
  }

  /** Set the MOTD the mod serves while maintenance is on. */
  async setMotd(serverId: number, motd: string): Promise<void> {
    await this.expect(
      serverId,
      `setMotd ${toPhrase(motd)}`,
      /Updated config/i,
      "Failed to set the maintenance MOTD",
    );
  }

  /** Set the kick / join-denied message shown to players who are not allowed in. */
  async setMessage(serverId: number, message: string): Promise<void> {
    await this.expect(
      serverId,
      `setMessage ${toPhrase(message)}`,
      /Updated config/i,
      "Failed to set the maintenance message",
    );
  }

  /** Allow a player (by Minecraft username) to join during maintenance. Idempotent. */
  async addAllowed(serverId: number, username: string): Promise<void> {
    const name = requireUsername(username);
    await this.expect(
      serverId,
      `addAllowed ${name}`,
      /added to allowed list|already in allowed list/i,
      `Failed to allow ${name}`,
    );
  }

  /** Remove a player from the allow list; the mod kicks them if they are online. Idempotent. */
  async removeAllowed(serverId: number, username: string): Promise<void> {
    const name = requireUsername(username);
    await this.expect(
      serverId,
      `removeAllowed ${name}`,
      /removed from allowed list|not found in allowed list/i,
      `Failed to remove ${name} from the allow list`,
    );
  }

  /** Players and LuckPerms groups currently allowed by the mod. */
  async list(serverId: number): Promise<MaintenanceAllowList> {
    const response = await this.run(serverId, "list");
    if (!/allowed/i.test(response)) {
      throw new MaintenanceModeCommandError(
        `Could not read the allow list: ${response || "empty response"}`,
        "maintenance list",
        response,
      );
    }
    const list = parseAllowList(response);
    if (list.ignored.length > 0) {
      logger.warn(
        `Ignoring unparseable entries in the maintenance allow list on server ${serverId}: ${list.ignored.join(" | ")}`,
      );
    }
    return list;
  }

  /** Toggle the mod's built-in full-server backup on enable. Always pushed as `false` by this app. */
  async setBackups(serverId: number, enabled: boolean): Promise<void> {
    await this.expect(
      serverId,
      `doBackups ${enabled}`,
      /Backups:/i,
      "Failed to update the backup setting",
    );
  }
}
