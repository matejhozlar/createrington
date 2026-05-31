import { MinecraftRconManager, WhitelistAction } from "@/utils/rcon";
import {
  isFileOpsAllowed,
  renameFile,
  writeFile,
  deleteFile,
  fileExists,
  getLocalPath,
} from "@/services/mc-server/file-ops";
import type { MaintenanceScheduler } from "./scheduler";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";

const WHITELIST_FILE = "whitelist.json";
const WHITELIST_BACKUP = "whitelist.json.bak";

/**
 * Maintenance Mode Service
 *
 * Manages server maintenance state by renaming the Minecraft whitelist file.
 * When enabled, ops can still join (they bypass whitelist), but regular players cannot.
 *
 * Supports two modes:
 * - **Local** (MC_SERVER_LOCAL_PATH set): direct filesystem operations on the server data dir
 * - **SFTP** (production): remote file operations via SSH
 *
 * Persistence: the existence of `whitelist.json.bak` IS the source of truth.
 * An in-memory Set caches this to avoid filesystem calls on every status check.
 */
export class MaintenanceService {
  private maintenanceServers = new Set<number>();
  private initialized = false;
  private scheduler: MaintenanceScheduler | null = null;

  /** Wire the scheduler after both are constructed (avoids circular dep) */
  setScheduler(scheduler: MaintenanceScheduler): void {
    this.scheduler = scheduler;
  }

  /** Return the current scheduled/active maintenance for a server, or null */
  getScheduledMaintenance(serverId: number): ServerMaintenanceSchedule | null {
    return this.scheduler?.getSchedule(serverId) ?? null;
  }

  /** Cancel a pending scheduled maintenance for a server */
  async cancelScheduledMaintenance(serverId: number): Promise<void> {
    await this.scheduler?.cancel(serverId);
  }

  /** Schedule maintenance for a server */
  async scheduleMaintenance(opts: {
    serverId: number;
    scheduledAt: Date;
    estimatedMinutes: number;
    scheduledByDiscordId: string;
  }): Promise<ServerMaintenanceSchedule> {
    if (!this.scheduler) {
      throw new Error("Maintenance scheduler not initialized");
    }
    return this.scheduler.schedule(opts);
  }

  /** Check in-memory cache for maintenance state */
  isInMaintenance(serverId: number): boolean {
    return this.maintenanceServers.has(serverId);
  }

  /**
   * Initialize by checking for existing backup files.
   * Call once on startup. Silently skips on failure.
   */
  async initialize(serverIds: number[]): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (!isFileOpsAllowed()) {
      logger.info(
        "Maintenance check skipped, no local path configured and SFTP not allowed",
      );
      return;
    }

    const mode = getLocalPath() ? "local" : "sftp";
    logger.info(`Maintenance service using ${mode} mode`);

    for (const serverId of serverIds) {
      try {
        const inMaintenance = await fileExists(WHITELIST_BACKUP);
        if (inMaintenance) {
          this.maintenanceServers.add(serverId);
          logger.info(
            `Server ${serverId} is in maintenance mode (whitelist.json.bak found)`,
          );
        }
      } catch (error) {
        logger.warn(
          `Could not check maintenance state for server ${serverId}: ${error}`,
        );
      }
    }
  }

  /**
   * Enable maintenance mode for a server.
   * Optionally kicks all online players after clearing the whitelist.
   *
   * @param serverId - Server ID
   * @param onlinePlayers - Usernames of currently online players to kick
   */
  async enable(serverId: number, onlinePlayers: string[] = []): Promise<void> {
    if (!isFileOpsAllowed()) {
      throw new Error(
        "Maintenance mode is not available (no local path or SFTP access)",
      );
    }

    if (this.maintenanceServers.has(serverId)) {
      throw new Error(`Server ${serverId} is already in maintenance mode`);
    }

    // Rename whitelist.json → whitelist.json.bak
    await renameFile(WHITELIST_FILE, WHITELIST_BACKUP);

    // Write an empty whitelist so Minecraft has a valid file to reload
    await writeFile(WHITELIST_FILE, "[]");

    // RCON: reload whitelist from the now-empty file
    const rcon = MinecraftRconManager.getInstance();
    await rcon.whitelist(serverId, WhitelistAction.RELOAD);

    for (const username of onlinePlayers) {
      try {
        await rcon.kick(serverId, username, "Server entering maintenance mode");
      } catch (error) {
        logger.warn(
          `Failed to kick ${username} on server ${serverId}: ${error}`,
        );
      }
    }

    this.maintenanceServers.add(serverId);
    logger.info(
      `Maintenance mode enabled for server ${serverId} (kicked ${onlinePlayers.length} players)`,
    );
  }

  /** Disable maintenance mode for a server */
  async disable(serverId: number): Promise<void> {
    if (!isFileOpsAllowed()) {
      throw new Error(
        "Maintenance mode is not available (no local path or SFTP access)",
      );
    }

    if (!this.maintenanceServers.has(serverId)) {
      throw new Error(`Server ${serverId} is not in maintenance mode`);
    }

    await deleteFile(WHITELIST_FILE);

    // Rename whitelist.json.bak → whitelist.json
    await renameFile(WHITELIST_BACKUP, WHITELIST_FILE);

    // RCON: reload whitelist (Minecraft now reads the restored file)
    const rcon = MinecraftRconManager.getInstance();
    await rcon.whitelist(serverId, WhitelistAction.RELOAD);

    this.maintenanceServers.delete(serverId);

    // Mark any active schedule row as completed
    if (this.scheduler) {
      await this.scheduler.markCompleted(serverId);
    }

    logger.info(`Maintenance mode disabled for server ${serverId}`);
  }
}

export const maintenanceService = new MaintenanceService();
