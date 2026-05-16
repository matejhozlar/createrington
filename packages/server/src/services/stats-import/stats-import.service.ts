import SftpClient from "ssh2-sftp-client";
import { Q } from "@/db";
import type { StatsUpsertEntry } from "@/db/queries/player/minecraft/stats";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import type { StatsImportServerConfig } from "./config";

/** Debounce delay before triggering an import after a player count change */
const DEBOUNCE_MS = 30_000;

/**
 * Minecraft Server Stats Import Service
 *
 * Imports per-player Minecraft stats files from game servers via SFTP
 * and stores them as JSONB in the database.
 *
 * Handles:
 * - Connecting to configured game servers over SFTP
 * - Downloading and parsing per-player stats JSON files (<uuid>.json)
 * - Filtering to only known players (exist in the player table)
 * - Batch upserting stats into player_minecraft_stats table
 * - Triggering re-imports when player count changes (debounced)
 *
 * Import triggers:
 * 1. Once on startup (initial import for all configured servers)
 * 2. On sessionStart/sessionEnd events from PlaytimeService (debounced 30s)
 *
 * Optimizations:
 * - Debounce: Multiple quick join/leave events collapse into a single import
 * - Import lock: Prevents concurrent imports for the same server
 * - Player filter: Only imports stats for UUIDs that exist in the player table
 * - Batch upsert: Single SQL statement for all players instead of N queries
 */
export class StatsImportService {
  private debounceTimers: Map<number, NodeJS.Timeout> = new Map();
  private importInProgress: Map<number, boolean> = new Map();
  private importCompleteCallbacks: Array<
    (serverId: number, uuids: string[]) => void
  > = [];

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly configs: StatsImportServerConfig[],
  ) {}

  /**
   * Register a callback to be invoked after a successful stats import.
   * The callback receives the server ID and the list of player UUIDs that were imported.
   */
  onImportComplete(
    callback: (serverId: number, uuids: string[]) => void,
  ): void {
    this.importCompleteCallbacks.push(callback);
  }

  /**
   * Initializes the service and performs initial imports
   * Called by the service container during startup
   *
   * This method:
   * - Runs an initial stats import for all configured servers in parallel
   * - Subscribes to sessionStart/sessionEnd events on each PlaytimeService
   *   to trigger debounced re-imports when players join or leave
   *
   * @returns Promise resolving when initialization is complete
   */
  async initialize(): Promise<void> {
    logger.info(
      `Initializing StatsImportService for ${this.configs.length} server(s)...`,
    );

    // Run initial import in the background, don't block server startup
    Promise.allSettled(
      this.configs.map((cfg) => this.importServerStats(cfg.serverId)),
    ).catch((error) => logger.error("Initial stats import failed:", error));

    // Subscribe to session events to detect player count changes
    for (const cfg of this.configs) {
      const playtimeService = this.playtimeManager.getService(cfg.serverId);
      if (!playtimeService) {
        logger.warn(
          `No PlaytimeService found for server ${cfg.serverId} (${cfg.serverName}), skipping event subscription`,
        );
        continue;
      }

      playtimeService.on("sessionStart", () =>
        this.scheduleImport(cfg.serverId),
      );
      playtimeService.on("sessionEnd", () => this.scheduleImport(cfg.serverId));

      logger.info(
        `Subscribed to session events for server ${cfg.serverId} (${cfg.serverName})`,
      );
    }

    logger.info("StatsImportService initialized");
  }

  /**
   * Shuts down the service and clears all pending debounce timers
   * Called by the service container during graceful shutdown
   *
   * @returns Promise resolving when shutdown is complete
   */
  async shutdown(): Promise<void> {
    for (const [serverId, timer] of this.debounceTimers) {
      clearTimeout(timer);
      logger.debug(`Cleared debounce timer for server ${serverId}`);
    }
    this.debounceTimers.clear();
    logger.info("StatsImportService shut down");
  }

  /**
   * Schedules a debounced stats import for a specific server
   *
   * If a timer already exists for this server, it is cleared and reset.
   * This ensures that rapid join/leave events only trigger a single import
   * after the debounce period (30s) elapses with no further events.
   *
   * @param serverId - The server to schedule an import for
   *
   * @private
   */
  private scheduleImport(serverId: number): void {
    const existing = this.debounceTimers.get(serverId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(serverId);
      this.importServerStats(serverId).catch((error) => {
        logger.error(
          `Scheduled stats import failed for server ${serverId}:`,
          error,
        );
      });
    }, DEBOUNCE_MS);

    this.debounceTimers.set(serverId, timer);
  }

  /**
   * Imports player stats from a single Minecraft server via SFTP
   *
   * Import workflow:
   * 1. Guard against concurrent imports for the same server
   * 2. Connect to the server's SFTP
   * 3. List all *.json files in the configured stats directory
   * 4. Load known player UUIDs from the database
   * 5. For each file matching a known player, download and parse the JSON
   * 6. Batch upsert all parsed stats into player_minecraft_stats
   * 7. Log import summary (imported count, skipped count, duration)
   *
   * @param serverId - The server to import stats from
   *
   * @private
   */
  private async importServerStats(serverId: number): Promise<void> {
    if (this.importInProgress.get(serverId)) {
      logger.debug(
        `Stats import already in progress for server ${serverId}, skipping`,
      );
      return;
    }

    const cfg = this.configs.find((c) => c.serverId === serverId);
    if (!cfg) {
      logger.warn(`No config found for server ${serverId}`);
      return;
    }

    this.importInProgress.set(serverId, true);
    const startTime = Date.now();
    const sftp = new SftpClient();

    try {
      logger.info(
        `Starting stats import for server ${serverId} (${cfg.serverName})...`,
      );

      await sftp.connect({
        host: cfg.sftp.host,
        port: cfg.sftp.port,
        username: cfg.sftp.username,
        password: cfg.sftp.password,
      });

      const fileList = await sftp.list(cfg.sftp.statsPath);
      const jsonFiles = fileList.filter(
        (f) => f.type === "-" && f.name.endsWith(".json"),
      );

      if (jsonFiles.length === 0) {
        logger.info(
          `No stats files found for server ${serverId} (${cfg.serverName})`,
        );
        return;
      }

      const players = await Q.player.findAll(undefined, {
        select: ["minecraftUuid"],
      });
      const knownUuids = new Set(players.map((p) => p.minecraftUuid));

      const statsToUpsert: StatsUpsertEntry[] = [];
      let skipped = 0;

      for (const file of jsonFiles) {
        // Filename is <uuid>.json: extract UUID
        const uuid = file.name.replace(".json", "");
        if (!knownUuids.has(uuid)) {
          skipped++;
          continue;
        }

        try {
          const content = await sftp.get(`${cfg.sftp.statsPath}/${file.name}`);
          const parsed = JSON.parse(content.toString());

          statsToUpsert.push({
            minecraftUuid: uuid,
            stats: parsed.stats ?? parsed,
            dataVersion: parsed.DataVersion ?? null,
          });
        } catch (error) {
          logger.warn(
            `Failed to parse stats file ${file.name} for server ${serverId}:`,
            error,
          );
        }
      }

      if (statsToUpsert.length === 0) {
        logger.info(
          `No matching player stats to import for server ${serverId} (${cfg.serverName}). ` +
            `${jsonFiles.length} files found, ${skipped} skipped (unknown players)`,
        );
        return;
      }

      await Q.player.minecraft.stats.batchUpsert(serverId, statsToUpsert);

      const duration = Date.now() - startTime;
      logger.info(
        `Stats import complete for server ${serverId} (${cfg.serverName}): ` +
          `${statsToUpsert.length} imported, ${skipped} skipped, ${duration}ms`,
      );

      // Notify listeners (e.g. AchievementService)
      const importedUuids = statsToUpsert.map((e) => e.minecraftUuid);
      for (const callback of this.importCompleteCallbacks) {
        try {
          callback(serverId, importedUuids);
        } catch (error) {
          logger.error("Import complete callback failed:", error);
        }
      }
    } catch (error) {
      logger.error(
        `Stats import failed for server ${serverId} (${cfg.serverName}):`,
        error,
      );
    } finally {
      this.importInProgress.set(serverId, false);
      try {
        await sftp.end();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}
