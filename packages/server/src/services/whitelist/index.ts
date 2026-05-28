import { MinecraftRconManager, WhitelistAction } from "@/utils/rcon";
import {
  isFileOpsAllowed,
  writeFile,
  deleteFile,
} from "@/services/mc-server/file-ops";
import { maintenanceService } from "@/services/maintenance";
import { Q } from "@/db";

const WHITELIST_FILE = "whitelist.json";

/**
 * Whitelist Service
 *
 * Regenerates a server's whitelist.json from the currently registered players.
 * Like the maintenance service, it operates on the server data dir either via a
 * local filesystem path (dev) or SFTP (production), then reloads the whitelist
 * over RCON.
 *
 * Resync is refused while a server is in maintenance mode, because maintenance
 * replaces whitelist.json with an empty list and stashes the real one in
 * whitelist.json.bak; rewriting it then would clobber that state.
 */
export class WhitelistService {
  /**
   * Delete and regenerate whitelist.json from non-banned registered players,
   * then reload it via RCON.
   *
   * @param serverId - Server to resync
   * @returns The number of players written to the whitelist
   */
  async resync(serverId: number): Promise<{ count: number }> {
    if (!isFileOpsAllowed()) {
      throw new Error(
        "Whitelist resync is not available (no local path or SFTP access)",
      );
    }

    if (maintenanceService.isInMaintenance(serverId)) {
      throw new Error(
        "Cannot resync the whitelist while the server is in maintenance mode",
      );
    }

    const entries = await Q.player.getWhitelistEntries();

    await deleteFile(WHITELIST_FILE);
    await writeFile(WHITELIST_FILE, JSON.stringify(entries, null, 2));

    const rcon = MinecraftRconManager.getInstance();
    await rcon.whitelist(serverId, WhitelistAction.RELOAD);

    logger.info(
      `Whitelist resynced for server ${serverId} (${entries.length} players)`,
    );

    return { count: entries.length };
  }
}

export const whitelistService = new WhitelistService();
