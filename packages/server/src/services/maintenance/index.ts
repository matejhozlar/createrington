import fs from "node:fs/promises";
import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import config from "@/config";
import { MinecraftRconManager, WhitelistAction } from "@/utils/rcon";
import type { MaintenanceScheduler } from "./scheduler";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";

const WHITELIST_FILE = "whitelist.json";
const WHITELIST_BACKUP = "whitelist.json.bak";

/**
 * Returns the local path for the Minecraft server data directory, or null
 * if not configured (meaning SFTP should be used instead).
 */
function getLocalPath(): string | null {
  return config.maintenance.localPath;
}

/**
 * SFTP credentials are shared across environments (dev + production both point
 * to the same game server). Only the production site should perform SFTP
 * operations to avoid the dev environment accidentally wiping the whitelist.
 */
function isSftpAllowed(): boolean {
  try {
    const url = new URL(config.meta.links.website);
    const host = url.hostname;
    if (host === "127.0.0.1" || host === "localhost") return false;
    if (host.startsWith("dev.")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Whether any whitelist operations are possible (local or SFTP) */
function isMaintenanceAllowed(): boolean {
  return getLocalPath() !== null || isSftpAllowed();
}

/** Resolves SFTP config for a given server ID */
function getSftpConfig(serverId: number) {
  // Currently only one server is configured
  if (serverId === config.servers.cogs.id) {
    return config.servers.cogs.sftp;
  }
  throw new Error(`No SFTP config for server ${serverId}`);
}

/** Resolves the SFTP base path (parent of the stats directory) for a server */
function getBasePath(serverId: number): string {
  const sftpConfig = getSftpConfig(serverId);
  // statsPath is something like "./world/stats" — base is two levels up, i.e. "."
  // We just use "." since whitelist.json is at the Minecraft server root
  const parts = sftpConfig.statsPath.split("/");
  // Remove "world/stats" (or similar) to get the root
  if (parts.length >= 3) {
    return parts.slice(0, -2).join("/") || ".";
  }
  return ".";
}

// =============================================================================
// Filesystem adapters — local or SFTP, selected by config
// =============================================================================

async function renameFile(from: string, to: string): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.rename(
      path.join(localPath, from),
      path.join(localPath, to),
    );
  } else {
    const sftpConfig = getSftpConfig(config.servers.cogs.id);
    const basePath = getBasePath(config.servers.cogs.id);
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });
      await sftp.rename(`${basePath}/${from}`, `${basePath}/${to}`);
    } finally {
      await sftp.end();
    }
  }
}

async function writeFile(name: string, content: string): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.writeFile(path.join(localPath, name), content, "utf-8");
  } else {
    const sftpConfig = getSftpConfig(config.servers.cogs.id);
    const basePath = getBasePath(config.servers.cogs.id);
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });
      await sftp.put(Buffer.from(content), `${basePath}/${name}`);
    } finally {
      await sftp.end();
    }
  }
}

async function deleteFile(name: string): Promise<void> {
  const localPath = getLocalPath();
  if (localPath) {
    await fs.unlink(path.join(localPath, name)).catch(() => {});
  } else {
    const sftpConfig = getSftpConfig(config.servers.cogs.id);
    const basePath = getBasePath(config.servers.cogs.id);
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });
      const exists = await sftp.exists(`${basePath}/${name}`);
      if (exists) await sftp.delete(`${basePath}/${name}`);
    } finally {
      await sftp.end();
    }
  }
}

async function fileExists(name: string): Promise<boolean> {
  const localPath = getLocalPath();
  if (localPath) {
    try {
      await fs.access(path.join(localPath, name));
      return true;
    } catch {
      return false;
    }
  } else {
    const sftpConfig = getSftpConfig(config.servers.cogs.id);
    const basePath = getBasePath(config.servers.cogs.id);
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });
      const exists = await sftp.exists(`${basePath}/${name}`);
      return exists !== false;
    } finally {
      await sftp.end();
    }
  }
}

// =============================================================================
// Service
// =============================================================================

/**
 * Maintenance Mode Service
 *
 * Manages server maintenance state by renaming the Minecraft whitelist file.
 * When enabled, ops can still join (they bypass whitelist), but regular players cannot.
 *
 * Supports two modes:
 * - **Local** (MAINTENANCE_LOCAL_PATH set): direct filesystem operations on the server data dir
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
  getScheduledMaintenance(
    serverId: number,
  ): ServerMaintenanceSchedule | null {
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

    if (!isMaintenanceAllowed()) {
      logger.info(
        "Maintenance check skipped — no local path configured and SFTP not allowed",
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
      } catch (err) {
        logger.warn(
          `Could not check maintenance state for server ${serverId}: ${err}`,
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
    if (!isMaintenanceAllowed()) {
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

    // Kick all online players
    for (const username of onlinePlayers) {
      try {
        await rcon.kick(serverId, username, "Server entering maintenance mode");
      } catch (err) {
        logger.warn(`Failed to kick ${username} on server ${serverId}: ${err}`);
      }
    }

    this.maintenanceServers.add(serverId);
    logger.info(
      `Maintenance mode enabled for server ${serverId} (kicked ${onlinePlayers.length} players)`,
    );
  }

  /** Disable maintenance mode for a server */
  async disable(serverId: number): Promise<void> {
    if (!isMaintenanceAllowed()) {
      throw new Error(
        "Maintenance mode is not available (no local path or SFTP access)",
      );
    }

    if (!this.maintenanceServers.has(serverId)) {
      throw new Error(`Server ${serverId} is not in maintenance mode`);
    }

    // Delete the empty whitelist.json
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
