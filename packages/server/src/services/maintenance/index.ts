import SftpClient from "ssh2-sftp-client";
import config from "@/config";
import { MinecraftRconManager, WhitelistAction } from "@/utils/rcon";

const WHITELIST_FILE = "whitelist.json";
const WHITELIST_BACKUP = "whitelist.json.bak";

/**
 * SFTP credentials are shared across environments (dev + production both point
 * to the same game server). Only the production site should perform SFTP
 * operations to avoid the dev environment accidentally wiping the whitelist.
 */
function isSftpAllowed(): boolean {
  try {
    const host = new URL(config.meta.links.website).hostname;
    return !host.startsWith("dev.");
  } catch {
    return false;
  }
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

/**
 * Maintenance Mode Service
 *
 * Manages server maintenance state by renaming the Minecraft whitelist file.
 * When enabled, ops can still join (they bypass whitelist), but regular players cannot.
 *
 * Persistence: the existence of `whitelist.json.bak` on the game server IS the source
 * of truth. An in-memory Set caches this to avoid SFTP calls on every status check.
 */
class MaintenanceService {
  private maintenanceServers = new Set<number>();
  private initialized = false;

  /** Check in-memory cache for maintenance state */
  isInMaintenance(serverId: number): boolean {
    return this.maintenanceServers.has(serverId);
  }

  /**
   * Initialize by checking SFTP for existing backup files.
   * Call once on startup. Silently skips on failure (dev mode, no SFTP).
   */
  async initialize(serverIds: number[]): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (!isSftpAllowed()) {
      logger.info("Maintenance SFTP check skipped — not the production site");
      return;
    }

    for (const serverId of serverIds) {
      try {
        const inMaintenance = await this.checkSftpState(serverId);
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

  /** Enable maintenance mode for a server */
  async enable(serverId: number): Promise<void> {
    if (!isSftpAllowed()) {
      throw new Error(
        "Maintenance mode is only available on the production site",
      );
    }

    if (this.maintenanceServers.has(serverId)) {
      throw new Error(`Server ${serverId} is already in maintenance mode`);
    }

    const sftpConfig = getSftpConfig(serverId);
    const basePath = getBasePath(serverId);
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });

      const whitelistPath = `${basePath}/${WHITELIST_FILE}`;
      const backupPath = `${basePath}/${WHITELIST_BACKUP}`;

      // Rename whitelist.json → whitelist.json.bak
      await sftp.rename(whitelistPath, backupPath);
    } finally {
      await sftp.end();
    }

    // RCON: reload whitelist (Minecraft will create an empty whitelist.json)
    const rcon = MinecraftRconManager.getInstance();
    await rcon.whitelist(serverId, WhitelistAction.RELOAD);

    this.maintenanceServers.add(serverId);
    logger.info(`Maintenance mode enabled for server ${serverId}`);
  }

  /** Disable maintenance mode for a server */
  async disable(serverId: number): Promise<void> {
    if (!isSftpAllowed()) {
      throw new Error(
        "Maintenance mode is only available on the production site",
      );
    }

    if (!this.maintenanceServers.has(serverId)) {
      throw new Error(`Server ${serverId} is not in maintenance mode`);
    }

    const sftpConfig = getSftpConfig(serverId);
    const basePath = getBasePath(serverId);
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });

      const whitelistPath = `${basePath}/${WHITELIST_FILE}`;
      const backupPath = `${basePath}/${WHITELIST_BACKUP}`;

      // Delete the empty whitelist.json that Minecraft created
      const exists = await sftp.exists(whitelistPath);
      if (exists) {
        await sftp.delete(whitelistPath);
      }

      // Rename whitelist.json.bak → whitelist.json
      await sftp.rename(backupPath, whitelistPath);
    } finally {
      await sftp.end();
    }

    // RCON: reload whitelist (Minecraft now reads the restored file)
    const rcon = MinecraftRconManager.getInstance();
    await rcon.whitelist(serverId, WhitelistAction.RELOAD);

    this.maintenanceServers.delete(serverId);
    logger.info(`Maintenance mode disabled for server ${serverId}`);
  }

  /** Check SFTP for whitelist.json.bak existence */
  private async checkSftpState(serverId: number): Promise<boolean> {
    const sftpConfig = getSftpConfig(serverId);
    const basePath = getBasePath(serverId);
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      });

      const backupPath = `${basePath}/${WHITELIST_BACKUP}`;
      const exists = await sftp.exists(backupPath);
      return exists !== false;
    } finally {
      await sftp.end();
    }
  }
}

export const maintenanceService = new MaintenanceService();
