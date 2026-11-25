import SftpClient from "ssh2-sftp-client";
import { db, playtimeRepo, Q } from "@/db";
import type { StatsUpsertEntry } from "@/db/queries/player/minecraft/stats";
import type { StatsReconcileEntry } from "@/db/repositories/playtime";
import { FeatureFlags, featureFlagService } from "../feature-flag";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import type { McServer } from "../mc-server/servers";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";

const DEBOUNCE_MS = 30_000;
const IMPORT_CEILING_MS = 10 * 60 * 1000;
const KEEPALIVE_INTERVAL_MS = 10_000;
const KEEPALIVE_MAX_MISSED = 3;

type ServerConfig = Pick<McServer, "id" | "name" | "sftp">;

function extractPlayTimeTicks(stats: Record<string, unknown>): number | null {
  const custom = stats["minecraft:custom"];
  if (!custom || typeof custom !== "object") return null;
  const value = (custom as Record<string, unknown>)["minecraft:play_time"];
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/**
 * Imports per-player Minecraft stats JSON files from each configured game server over
 * SFTP and batch-upserts them into `player_minecraft_stats`. Triggers: one initial pass
 * on startup (fire-and-forget, never blocks bootstrap) plus debounced re-imports on
 * `sessionStart`/`sessionEnd` from each `PlaytimeService` (30s window). A per-server
 * lock prevents overlapping runs: an import asked for while one is running starts once
 * that one ends, so a stats file written after it was read is still picked up. The SFTP
 * connection sends keepalives and a run that has no result after ten minutes gives the
 * lock back, so a host that stops answering cannot block later imports. Rows for UUIDs
 * not present in the player table are skipped. After each import the vanilla play_time stat is compared against the stored
 * playtime totals; drift is logged, and overwritten with the stat when the
 * `playtime_stats_reconcile` feature flag is enabled.
 */
export class StatsImportService {
  private debounceTimers: Map<number, NodeJS.Timeout> = new Map();
  private importInProgress: Map<number, boolean> = new Map();
  private rerunRequested: Set<number> = new Set();

  constructor(
    private readonly playtimeManager: PlaytimeManagerService,
    private readonly configs: readonly ServerConfig[],
  ) {}

  /**
   * Subscribes to session events on each `PlaytimeService` and kicks off an initial
   * import in the background. Returns as soon as wiring is done; the first import
   * runs detached so a slow SFTP host cannot delay server boot.
   */
  initialize(): void {
    logger.info(
      `Initializing StatsImportService for ${this.configs.length} server(s)...`,
    );

    Promise.allSettled(
      this.configs.map((cfg) => this.importServerStats(cfg.id)),
    ).catch((error) => logger.error("Initial stats import failed:", error));

    for (const cfg of this.configs) {
      const playtimeService = this.playtimeManager.getService(cfg.id);
      if (!playtimeService) {
        logger.warn(
          `No PlaytimeService found for server ${cfg.id} (${cfg.name}), skipping event subscription`,
        );
        continue;
      }

      playtimeService.on("sessionStart", () => this.scheduleImport(cfg.id));
      playtimeService.on("sessionEnd", () => this.scheduleImport(cfg.id));

      logger.info(
        `Subscribed to session events for server ${cfg.id} (${cfg.name})`,
      );
    }

    logger.info("StatsImportService initialized");
  }

  /** Cancels any pending debounced imports and queued re-runs; in-flight imports are not interrupted. */
  shutdown(): void {
    for (const [serverId, timer] of this.debounceTimers) {
      clearTimeout(timer);
      logger.debug(`Cleared debounce timer for server ${serverId}`);
    }
    this.debounceTimers.clear();
    this.rerunRequested.clear();
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
      this.rerunRequested.add(serverId);
      logger.debug(
        `Stats import already in progress for server ${serverId}, running again when it ends`,
      );
      return;
    }

    const cfg = this.configs.find((c) => c.id === serverId);
    if (!cfg) {
      logger.warn(`No config found for server ${serverId}`);
      return;
    }

    this.importInProgress.set(serverId, true);
    const sftp = new SftpClient();
    let ceiling: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.readAndStore(sftp, cfg),
        new Promise<never>((_resolve, reject) => {
          ceiling = setTimeout(
            () =>
              reject(
                new Error(
                  `no result after ${IMPORT_CEILING_MS / 60_000} minutes`,
                ),
              ),
            IMPORT_CEILING_MS,
          );
        }),
      ]);
    } catch (error) {
      logger.error(
        `Stats import failed for server ${serverId} (${cfg.name}):`,
        error,
      );
    } finally {
      clearTimeout(ceiling);
      this.importInProgress.set(serverId, false);
      void sftp.end().catch(() => undefined);
      if (this.rerunRequested.delete(serverId)) {
        void this.importServerStats(serverId);
      }
    }
  }

  private async readAndStore(
    sftp: SftpClient,
    cfg: ServerConfig,
  ): Promise<void> {
    const serverId = cfg.id;
    const startTime = Date.now();

    logger.info(
      `Starting stats import for server ${serverId} (${cfg.name})...`,
    );

    await sftp.connect({
      host: cfg.sftp.host,
      port: cfg.sftp.port,
      username: cfg.sftp.username,
      password: cfg.sftp.password,
      keepaliveInterval: KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: KEEPALIVE_MAX_MISSED,
    });

    const fileList = await sftp.list(cfg.sftp.statsPath);
    const jsonFiles = fileList.filter(
      (f) => f.type === "-" && f.name.endsWith(".json"),
    );

    if (jsonFiles.length === 0) {
      logger.info(`No stats files found for server ${serverId} (${cfg.name})`);
      return;
    }

    const fileUuids = jsonFiles
      .map((file) => file.name.replace(".json", ""))
      .filter((uuid) => MC_UUID_REGEX.test(uuid));
    const players =
      fileUuids.length > 0
        ? await Q.player.findAll(
            { minecraftUuid: { $in: fileUuids } },
            { select: ["minecraftUuid"] },
          )
        : [];
    const knownUuids = new Set(players.map((p) => p.minecraftUuid));

    const statsToUpsert: StatsUpsertEntry[] = [];
    const playTimeEntries: StatsReconcileEntry[] = [];
    let skipped = 0;

    for (const file of jsonFiles) {
      const uuid = file.name.replace(".json", "");
      if (!knownUuids.has(uuid)) {
        skipped++;
        continue;
      }

      try {
        const content = await sftp.get(`${cfg.sftp.statsPath}/${file.name}`);
        if (typeof content !== "string" && !Buffer.isBuffer(content)) {
          throw new Error(`SFTP returned a stream for ${file.name}`);
        }
        const parsed = JSON.parse(content.toString()) as {
          stats?: Record<string, unknown>;
          DataVersion?: number;
        };
        const stats = parsed.stats ?? parsed;

        statsToUpsert.push({
          minecraftUuid: uuid,
          stats,
          dataVersion: parsed.DataVersion ?? null,
        });

        const playTimeTicks = extractPlayTimeTicks(stats);
        if (playTimeTicks !== null) {
          playTimeEntries.push({ minecraftUuid: uuid, playTimeTicks });
        }
      } catch (error) {
        logger.warn(
          `Failed to parse stats file ${file.name} for server ${serverId}:`,
          error,
        );
      }
    }

    if (statsToUpsert.length === 0) {
      logger.info(
        `No matching player stats to import for server ${serverId} (${cfg.name}). ` +
          `${jsonFiles.length} files found, ${skipped} skipped (unknown players)`,
      );
      return;
    }

    await db.inTransaction((tx) =>
      tx.player.minecraft.stats.batchUpsert(serverId, statsToUpsert),
    );

    const duration = Date.now() - startTime;
    logger.info(
      `Stats import complete for server ${serverId} (${cfg.name}): ` +
        `${statsToUpsert.length} imported, ${skipped} skipped, ${duration}ms`,
    );

    await this.reconcilePlaytime(serverId, playTimeEntries);
  }

  private async reconcilePlaytime(
    serverId: number,
    entries: StatsReconcileEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;

    try {
      const apply = await featureFlagService.isEnabled(
        FeatureFlags.playtimeStatsReconcile,
      );
      const result = await playtimeRepo.reconcileTotalsFromStats(
        serverId,
        entries,
        { apply },
      );

      logger.info(
        `Playtime reconcile for server ${serverId} (${apply ? "apply" : "report-only"}): ` +
          `${result.checked} checked, ${result.drifted} drifted, ${result.applied} applied, ` +
          `${result.skippedOpen} skipped (online), ${result.skippedSuspicious} skipped (suspicious drop)`,
      );
    } catch (error) {
      logger.error(`Playtime reconcile failed for server ${serverId}:`, error);
    }
  }
}
