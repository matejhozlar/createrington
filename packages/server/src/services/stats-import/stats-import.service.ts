import SftpClient from "ssh2-sftp-client";
import { Q } from "@/db";
import type { StatsUpsertEntry } from "@/db/queries/player/minecraft/stats";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import type { StatsImportServerConfig } from "./config";

/** Debounce delay before triggering an import after a player count change */
const DEBOUNCE_MS = 30_000;

/**
 * Imports per-player Minecraft stats JSON files from each configured game server over
 * SFTP and batch-upserts them into `player_minecraft_stats`. Triggers: one initial pass
 * on startup (fire-and-forget, never blocks bootstrap) plus debounced re-imports on
 * `sessionStart`/`sessionEnd` from each `PlaytimeService` (30s window). A per-server
 * lock prevents overlapping runs; rows for UUIDs not present in the player table are
 * skipped.
 */
export class StatsImportService {
  private debounceTimers: Map<number, NodeJS.Timeout> = new Map();
  private importInProgress: Map<number, boolean> = new Map();

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly configs: StatsImportServerConfig[],
  ) {}

  /**
   * Subscribes to session events on each `PlaytimeService` and kicks off an initial
   * import in the background. Returns as soon as wiring is done; the first import
   * runs detached so a slow SFTP host cannot delay server boot.
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

  /** Cancels any pending debounced imports; in-flight imports are not interrupted. */
  async shutdown(): Promise<void> {
    for (const [serverId, timer] of this.debounceTimers) {
      clearTimeout(timer);
      logger.debug(`Cleared debounce timer for server ${serverId}`);
    }
    this.debounceTimers.clear();
    logger.info("StatsImportService shut down");
  }

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
