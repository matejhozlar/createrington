import path from "node:path";
import fs from "node:fs/promises";
import { Q, db, balanceRepo } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { BadRequestError } from "@/app/middleware/error-handler";
import {
  isFileOpsAllowed,
  getLocalPath,
  copyFileToServer,
  deleteFile,
  fileExists,
} from "@/services/mc-server/file-ops";
import {
  downloadModFile as cfDownload,
  getModFileDownloadUrl,
} from "@/services/curseforge";
import type { StructurePackService } from "./index";
import type {
  StructurePack,
  StructurePackMod,
  StructurePackRotationConfig,
  StructurePackRotation,
  StructurePackBoost,
} from "@createrington/shared/db";
import type { DiscordMessageService } from "@/services/discord/message/message.service";

const MODS_DIR = "mods";
const CACHE_DIR = ".structure-pack-cache";
const T_REF = 7 * 24 * 60 * 60; // one week in seconds
const DEFAULT_ELAPSED_WEEKS = 4;

type RotationPeriod = "daily" | "weekly" | "monthly";

/** How many milliseconds one period lasts (approximate, for missed-rotation detection). */
function periodIntervalMs(period: RotationPeriod): number {
  switch (period) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

interface WeightEntry {
  packId: number;
  packName: string;
  weight: number;
  timeFactor: number;
  boostFactor: number;
}

/**
 * Converts a wall-clock time in a given IANA timezone to a UTC Date.
 *
 * Example: dateInTimezone(2026, 0, 5, 12, 0, "Europe/Prague")
 * returns the UTC instant that corresponds to 2026-01-05 12:00 in Prague.
 */
function dateInTimezone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone: string,
): Date {
  // Build an approximate UTC date, then nudge it so the wall-clock in the
  // target timezone matches the requested values.
  const guess = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

  // Format the guess in the target timezone to see what wall-clock it produces
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(guess);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const wallDate = new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
    ),
  );

  // The difference between our guess and what the timezone produced tells us
  // the UTC offset — apply it to get the correct UTC instant.
  const offsetMs = guess.getTime() - wallDate.getTime();
  return new Date(guess.getTime() + offsetMs);
}

/**
 * Structure Pack Rotation Service
 *
 * Manages the automated weekly (or configurable period) rotation of active structure packs:
 * - Schedules rotations at configurable times using IANA timezone-aware scheduling
 * - Detects and recovers from missed rotations on startup
 * - Selects the next pack via a weighted-random algorithm (time-since-last + boost units)
 * - Downloads and caches mod files from CurseForge before installing them on the server
 * - Records every rotation attempt (success or failure) with a weights snapshot for auditing
 * - Handles player-purchased boost units that increase a pack's selection weight for a cycle
 *
 * NOTE: File operations (mod installs/removals) are skipped when `isFileOpsAllowed()` returns
 * false; the rotation is still recorded in the database in that case.
 */
export class StructurePackRotationService {
  private nextRotationTimer: ReturnType<typeof setTimeout> | null = null;
  private rotationInProgress = false;

  constructor(
    private packService: StructurePackService,
    private messageService: DiscordMessageService | null,
  ) {}

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Initializes the rotation scheduler
   *
   * Loads the rotation config, logs the active schedule, and either triggers an
   * immediate rotation (if one was missed while the server was down) or schedules
   * the next rotation at the configured time.
   */
  async initialize(): Promise<void> {
    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    const period = rotationConfig.period as RotationPeriod;
    const scheduleDesc =
      period === "daily"
        ? `daily at ${rotationConfig.time}`
        : period === "monthly"
          ? `monthly on day ${rotationConfig.dayOfMonth} at ${rotationConfig.time}`
          : `weekly on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rotationConfig.dayOfWeek]} at ${rotationConfig.time}`;
    logger.info(
      `Structure pack rotation config: ${scheduleDesc} ${rotationConfig.timezone}`,
    );

    // Check for missed rotation
    const lastRotation = await this.getLastRotation();
    if (lastRotation) {
      const missed = this.checkMissedRotation(
        rotationConfig,
        lastRotation.rotatedAt,
      );
      if (missed) {
        logger.info("Missed rotation detected, executing now...");
        await this.executeRotation();
        return;
      }
    }

    this.scheduleNextRotation(rotationConfig);
  }

  /** Cancels the pending rotation timer, preventing any further automatic rotations. */
  shutdown(): void {
    if (this.nextRotationTimer) {
      clearTimeout(this.nextRotationTimer);
      this.nextRotationTimer = null;
    }
  }

  // ===========================================================================
  // SCHEDULING
  // ===========================================================================

  /**
   * Schedules the next rotation timer using the given config.
   *
   * If the computed next time is already in the past (e.g. due to clock skew),
   * it advances by one full period before scheduling.
   *
   * @private
   * @param rotationConfig - The current rotation configuration
   */
  private scheduleNextRotation(
    rotationConfig: StructurePackRotationConfig,
  ): void {
    if (this.nextRotationTimer) {
      clearTimeout(this.nextRotationTimer);
    }

    const nextTime = this.computeNextRotationTime(rotationConfig);
    const delayMs = nextTime.getTime() - Date.now();
    const period = rotationConfig.period as RotationPeriod;

    if (delayMs <= 0) {
      logger.warn(
        "Computed next rotation time is in the past, scheduling for next period",
      );
      const adjusted = new Date(nextTime.getTime() + periodIntervalMs(period));
      const adjustedDelay = adjusted.getTime() - Date.now();
      this.nextRotationTimer = setTimeout(
        () => this.executeRotation(),
        adjustedDelay,
      );
      logger.info(
        `Next structure pack rotation scheduled for ${adjusted.toISOString()}`,
      );
      return;
    }

    this.nextRotationTimer = setTimeout(() => this.executeRotation(), delayMs);
    logger.info(
      `Next structure pack rotation scheduled for ${nextTime.toISOString()}`,
    );
  }

  /**
   * Returns the next UTC instant at which a rotation should fire for the given config.
   *
   * All wall-clock comparisons are performed in the configured IANA timezone so that
   * DST transitions do not shift the scheduled time.
   *
   * @private
   * @param cfg - The current rotation configuration
   * @returns UTC Date of the next scheduled rotation
   */
  private computeNextRotationTime(cfg: StructurePackRotationConfig): Date {
    const [hours, minutes] = cfg.time.split(":").map(Number);
    const now = new Date();
    const period = cfg.period as RotationPeriod;

    // Get today's date components in the target timezone
    const todayParts = new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).formatToParts(now);

    const get = (type: string) =>
      Number(todayParts.find((p) => p.type === type)?.value ?? 0);

    const todayYear = get("year");
    const todayMonth = get("month") - 1;
    const todayDay = get("day");

    if (period === "daily") {
      // Next occurrence is today at the configured time, or tomorrow
      const target = dateInTimezone(
        todayYear,
        todayMonth,
        todayDay,
        hours,
        minutes,
        cfg.timezone,
      );
      if (target.getTime() <= now.getTime()) {
        return dateInTimezone(
          todayYear,
          todayMonth,
          todayDay + 1,
          hours,
          minutes,
          cfg.timezone,
        );
      }
      return target;
    }

    if (period === "monthly") {
      // Next occurrence is on dayOfMonth this month or next month
      const target = dateInTimezone(
        todayYear,
        todayMonth,
        cfg.dayOfMonth,
        hours,
        minutes,
        cfg.timezone,
      );
      if (target.getTime() <= now.getTime()) {
        return dateInTimezone(
          todayYear,
          todayMonth + 1,
          cfg.dayOfMonth,
          hours,
          minutes,
          cfg.timezone,
        );
      }
      return target;
    }

    // Weekly (default)
    const weekdayStr =
      todayParts.find((p) => p.type === "weekday")?.value ?? "";
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const currentDay = dayMap[weekdayStr] ?? now.getDay();

    let daysUntil = cfg.dayOfWeek - currentDay;
    if (daysUntil < 0) daysUntil += 7;

    const targetDate = new Date(
      Date.UTC(todayYear, todayMonth, todayDay + daysUntil),
    );
    const target = dateInTimezone(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      hours,
      minutes,
      cfg.timezone,
    );

    if (target.getTime() <= now.getTime()) {
      const nextWeek = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dateInTimezone(
        nextWeek.getUTCFullYear(),
        nextWeek.getUTCMonth(),
        nextWeek.getUTCDate(),
        hours,
        minutes,
        cfg.timezone,
      );
    }

    return target;
  }

  /**
   * Returns true if a rotation was missed since the last recorded rotation.
   *
   * A rotation is considered missed when the elapsed time since `lastRotatedAt`
   * exceeds one full period plus the configured grace period.
   *
   * @private
   * @param cfg - The current rotation configuration
   * @param lastRotatedAt - Timestamp of the most recent recorded rotation
   * @returns Whether a rotation should have fired and was missed
   */
  private checkMissedRotation(
    cfg: StructurePackRotationConfig,
    lastRotatedAt: Date,
  ): boolean {
    const now = Date.now();
    const expectedInterval = periodIntervalMs(cfg.period as RotationPeriod);
    const gracePeriod = cfg.gracePeriodMinutes * 60 * 1000;
    const timeSinceLastRotation = now - lastRotatedAt.getTime();

    return timeSinceLastRotation > expectedInterval + gracePeriod;
  }

  // ===========================================================================
  // ROTATION EXECUTION
  // ===========================================================================

  /**
   * Executes a full rotation cycle.
   *
   * Workflow steps:
   * 1. Guard against concurrent rotations
   * 2. Fetch eligible packs and compute selection weights
   * 3. Select the incoming pack via weighted-random draw
   * 4. Download and cache any uncached mod files from CurseForge
   * 5. Remove outgoing pack's mods and install the incoming pack's mods on the server
   * 6. Swap the active pack flag and record the rotation in the database
   * 7. Clear boost units consumed during this cycle
   * 8. Schedule the next rotation
   *
   * On any file-operations failure the rotation is recorded as failed and the
   * next rotation is still scheduled. On unexpected errors the timer is also
   * rescheduled so the service recovers automatically.
   *
   * @param _manual - Reserved for future use to distinguish manual vs automatic triggers
   * @returns Promise that resolves when the rotation (or its failure path) is complete
   */
  async executeRotation(_manual = false): Promise<void> {
    if (this.rotationInProgress) {
      throw new BadRequestError("A rotation is already in progress");
    }

    this.rotationInProgress = true;
    const startTime = Date.now();

    try {
      const rotationConfig =
        await Q.structure.pack.rotation.config.getOrCreateDefault();
      const activePack = await this.packService.getActivePack();
      const eligible = await Q.structure.pack.getEligibleForRotation(
        activePack?.id,
      );

      if (eligible.length === 0) {
        logger.warn("No eligible packs for rotation");
        await this.recordRotation(
          activePack?.id ?? null,
          0,
          false,
          "No eligible packs",
        );
        this.scheduleNextRotation(rotationConfig);
        return;
      }

      // Compute weights
      const cycleStart = this.computeCycleStart(rotationConfig);
      const boostData =
        await Q.structure.pack.boost.getBoostsByPackForCycle(cycleStart);
      const boostMap = new Map(boostData.map((b) => [b.packId, b.totalUnits]));
      const weights = this.computeWeights(
        eligible,
        boostMap,
        rotationConfig.timeWeightMultiplier,
        rotationConfig.boostWeightPerUnit,
      );

      // Select next pack
      const selectedPackId = this.selectWeightedRandom(weights);
      const incomingPack = await this.packService.getPack(selectedPackId);

      logger.info(
        `Rotation: ${activePack?.name ?? "(none)"} → ${incomingPack.name} (weights: ${JSON.stringify(weights)})`,
      );

      // File operations
      if (isFileOpsAllowed()) {
        try {
          // Download uncached mods
          await this.ensureModsCached(incomingPack.mods);

          // Build a set of filenames that the incoming pack owns
          const incomingFileNames = new Set(
            incomingPack.mods.map((m) => m.fileName),
          );

          // Remove outgoing pack's mods (skip files shared with the incoming pack)
          if (activePack) {
            for (const mod of activePack.mods) {
              if (incomingFileNames.has(mod.fileName)) continue;
              const modPath = `${MODS_DIR}/${mod.fileName}`;
              if (await fileExists(modPath)) {
                await deleteFile(modPath);
                logger.info(`Removed mod file: ${mod.fileName}`);
              }
            }
          }

          // Copy incoming pack's mods (skip if already present)
          for (const mod of incomingPack.mods) {
            const modPath = `${MODS_DIR}/${mod.fileName}`;
            if (await fileExists(modPath)) {
              logger.info(`Mod already in mods dir: ${mod.fileName}`);
              continue;
            }
            const cachePath = this.getCachePath(mod.fileName);
            await copyFileToServer(cachePath, modPath);
            logger.info(`Installed mod file: ${mod.fileName}`);
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          logger.error(`Rotation file operations failed: ${reason}`);
          await this.recordRotation(
            activePack?.id ?? null,
            selectedPackId,
            false,
            reason,
          );
          this.scheduleNextRotation(rotationConfig);
          return;
        }
      } else {
        logger.info(
          "File ops not available — rotation recorded without file changes",
        );
      }

      // DB transaction: swap active, record rotation, clear boosts
      await db.inTransaction(async (tx) => {
        if (activePack) {
          await tx.structure.pack.update(
            { id: activePack.id },
            { isActive: false },
          );
        }
        await tx.structure.pack.update(
          { id: selectedPackId },
          { isActive: true, lastActivatedAt: new Date() },
        );
      });

      await this.recordRotation(
        activePack?.id ?? null,
        selectedPackId,
        true,
        null,
        weights,
      );

      // Clear boosts for the completed cycle
      await Q.structure.pack.boost.clearCycleBoosts(cycleStart);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(
        `Rotation complete in ${elapsed}s: ${activePack?.name ?? "(none)"} → ${incomingPack.name}`,
      );

      // Schedule next
      this.scheduleNextRotation(rotationConfig);
    } catch (err) {
      logger.error("Rotation failed:", err);
      // Try to reschedule even on failure
      try {
        const cfg = await Q.structure.pack.rotation.config.getOrCreateDefault();
        this.scheduleNextRotation(cfg);
      } catch {
        logger.error("Failed to reschedule after rotation error");
      }
    } finally {
      this.rotationInProgress = false;
    }
  }

  // ===========================================================================
  // WEIGHT COMPUTATION
  // ===========================================================================

  /**
   * Computes a selection weight for each eligible pack.
   *
   * Weight formula per pack:
   *   `timeFactor * timeWeightMultiplier + boostUnits * boostWeightPerUnit`
   *
   * where `timeFactor` is the number of reference weeks (7 days) since the pack was
   * last active. Packs that have never been active default to 4 elapsed weeks so they
   * are reasonably competitive on their first rotation.
   *
   * @param packs - Eligible packs to weight
   * @param boosts - Map of packId → total boost units purchased this cycle
   * @param timeWeightMultiplier - Scalar applied to the time component
   * @param boostWeightPerUnit - Scalar applied to each boost unit
   * @returns Array of weight entries, one per pack, in the same order as `packs`
   */
  computeWeights(
    packs: StructurePack[],
    boosts: Map<number, number>,
    timeWeightMultiplier = 1.0,
    boostWeightPerUnit = 1.0,
  ): WeightEntry[] {
    const nowSec = Date.now() / 1000;
    const defaultElapsed = DEFAULT_ELAPSED_WEEKS * T_REF;

    return packs.map((pack) => {
      const lastActivated = pack.lastActivatedAt
        ? pack.lastActivatedAt.getTime() / 1000
        : nowSec - defaultElapsed;

      const timeFactor = (nowSec - lastActivated) / T_REF;
      const boostFactor = boosts.get(pack.id) ?? 0;

      return {
        packId: pack.id,
        packName: pack.name,
        weight:
          timeFactor * timeWeightMultiplier + boostFactor * boostWeightPerUnit,
        timeFactor: Math.round(timeFactor * 100) / 100,
        boostFactor,
      };
    });
  }

  /**
   * Selects a pack ID from the weight entries using weighted-random sampling.
   *
   * @param weights - Non-empty array of weight entries produced by `computeWeights`
   * @returns The packId of the selected entry
   */
  selectWeightedRandom(weights: WeightEntry[]): number {
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const entry of weights) {
      random -= entry.weight;
      if (random <= 0) return entry.packId;
    }

    // Fallback (shouldn't happen)
    return weights[weights.length - 1].packId;
  }

  // ===========================================================================
  // MOD FILE CACHING
  // ===========================================================================

  /**
   * Returns the absolute path to the mod file cache directory.
   *
   * Uses the configured local server path when available; falls back to a
   * `.structure-pack-cache` folder in the process working directory for SFTP mode.
   *
   * @private
   * @returns Absolute path to the cache directory
   */
  private getCacheDir(): string {
    const localPath = getLocalPath();
    if (localPath) {
      return path.join(localPath, CACHE_DIR);
    }
    // Fallback to temp dir for SFTP mode
    return path.join(process.cwd(), ".structure-pack-cache");
  }

  /**
   * Returns the full path to a specific mod file within the cache directory.
   *
   * @private
   * @param fileName - The mod's filename (e.g. `structurized-1.20.jar`)
   * @returns Absolute path to the cached file
   */
  private getCachePath(fileName: string): string {
    return path.join(this.getCacheDir(), fileName);
  }

  /**
   * Downloads any mods not already present in the local cache.
   *
   * Creates the cache directory if it does not exist, then iterates the provided
   * mod list, skipping files that are already cached and downloading the rest
   * from CurseForge.
   *
   * @private
   * @param mods - List of mods to ensure are cached
   * @returns Promise that resolves when all mods are available in the cache
   */
  private async ensureModsCached(mods: StructurePackMod[]): Promise<void> {
    const cacheDir = this.getCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });

    for (const mod of mods) {
      const cachePath = this.getCachePath(mod.fileName);
      try {
        await fs.access(cachePath);
        logger.info(`Mod already cached: ${mod.fileName}`);
      } catch {
        logger.info(
          `Downloading mod: ${mod.modName} (${mod.curseforgeModId}/${mod.curseforgeFileId})`,
        );
        await cfDownload(
          mod.curseforgeModId,
          mod.curseforgeFileId,
          cacheDir,
          mod.fileName,
        );
        logger.info(`Downloaded: ${mod.fileName}`);
      }
    }
  }

  // ===========================================================================
  // BOOST MANAGEMENT
  // ===========================================================================

  /**
   * Records a player's boost purchase for a structure pack in the current cycle.
   *
   * Validates that the target pack is available and not currently active, deducts
   * the cost from the player's balance, then creates the boost record.
   *
   * @param discordId - Discord ID of the purchasing player
   * @param packId - ID of the pack to boost
   * @param units - Number of boost units to purchase
   * @returns The created boost record
   */
  async purchaseBoost(
    discordId: string,
    packId: number,
    units: number,
  ): Promise<StructurePackBoost> {
    const pack = await Q.structure.pack.find({ id: packId });
    if (!pack || pack.deletedAt || !pack.enabled) {
      throw new BadRequestError("Pack is not available for boosting");
    }
    if (pack.isActive) {
      throw new BadRequestError("Cannot boost the currently active pack");
    }

    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cost = units * rotationConfig.boostUnitPrice;
    const cycleStart = this.computeCycleStart(rotationConfig);

    // Deduct player balance
    await balanceRepo.deduct(
      { discordId },
      cost,
      `Structure pack boost: ${units} unit(s) for "${pack.name}"`,
      BalanceTransactionType.PURCHASE,
      { packId, units, packName: pack.name },
    );

    return Q.structure.pack.boost.createAndReturn({
      discordId,
      packId,
      units,
      currencySpent: cost,
      cycleStart,
    });
  }

  /**
   * Returns all boost records placed by a player during the current rotation cycle.
   *
   * @param discordId - Discord ID of the player
   * @returns List of boost records for the current cycle
   */
  async getPlayerBoosts(discordId: string): Promise<StructurePackBoost[]> {
    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cycleStart = this.computeCycleStart(rotationConfig);
    return Q.structure.pack.boost.getPlayerBoostsForCycle(
      discordId,
      cycleStart,
    );
  }

  /**
   * Returns each eligible pack together with its current computed weight and
   * accumulated boost units for the active cycle.
   *
   * Intended for UI display so players can see how their boosts affect selection odds.
   *
   * @returns Array of objects containing the pack, its total weight, and boost unit count
   */
  async getPoolWithWeights(): Promise<
    Array<{ pack: StructurePack; weight: number; boostUnits: number }>
  > {
    const activePack = await this.packService.getActivePack();
    const eligible = await Q.structure.pack.getEligibleForRotation(
      activePack?.id,
    );
    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cycleStart = this.computeCycleStart(rotationConfig);
    const boostData =
      await Q.structure.pack.boost.getBoostsByPackForCycle(cycleStart);
    const boostMap = new Map(boostData.map((b) => [b.packId, b.totalUnits]));
    const weights = this.computeWeights(
      eligible,
      boostMap,
      rotationConfig.timeWeightMultiplier,
      rotationConfig.boostWeightPerUnit,
    );

    return eligible.map((pack) => {
      const w = weights.find((e) => e.packId === pack.id);
      return {
        pack,
        weight: w?.weight ?? 0,
        boostUnits: boostMap.get(pack.id) ?? 0,
      };
    });
  }

  // ===========================================================================
  // CONFIG
  // ===========================================================================

  /** Returns the current rotation configuration, creating the default record if none exists. */
  async getConfig(): Promise<StructurePackRotationConfig> {
    return Q.structure.pack.rotation.config.getOrCreateDefault();
  }

  /**
   * Persists partial updates to the rotation configuration and immediately
   * reschedules the next rotation to reflect the new settings.
   *
   * @param data - Fields to update; unspecified fields retain their current values
   * @returns The updated rotation configuration
   */
  async updateConfig(
    data: Partial<
      Pick<
        StructurePackRotationConfig,
        | "period"
        | "dayOfWeek"
        | "dayOfMonth"
        | "time"
        | "timezone"
        | "boostUnitPrice"
        | "timeWeightMultiplier"
        | "boostWeightPerUnit"
        | "gracePeriodMinutes"
      >
    >,
  ): Promise<StructurePackRotationConfig> {
    const current = await Q.structure.pack.rotation.config.getOrCreateDefault();
    const updated = await Q.structure.pack.rotation.config.updateAndReturn(
      { id: current.id },
      data,
    );

    // Reschedule with new config
    this.scheduleNextRotation(updated);
    logger.info("Rotation config updated, next rotation rescheduled");

    return updated;
  }

  // ===========================================================================
  // HISTORY
  // ===========================================================================

  /**
   * Returns a paginated list of past rotation records, ordered most-recent first.
   *
   * @param limit - Maximum number of records to return (default 20)
   * @param offset - Number of records to skip for pagination (default 0)
   * @returns Object containing the result rows and the total count of all rotations
   */
  async getRotationHistory(
    limit = 20,
    offset = 0,
  ): Promise<{ rows: StructurePackRotation[]; total: number }> {
    const total = await Q.structure.pack.rotation.count();

    const result = await Q.structure.pack.rotation.findAll(
      {},
      { limit, offset, orderBy: "rotatedAt", orderDirection: "desc" },
    );

    return { rows: result, total };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Returns the UTC start timestamp of the current rotation cycle.
   *
   * The cycle start is the most recent past occurrence of the configured
   * rotation time (daily, weekly, or monthly). Boost purchases are scoped
   * to this timestamp so they expire automatically after a rotation fires.
   *
   * @private
   * @param cfg - The current rotation configuration
   * @returns UTC Date representing the start of the active cycle
   */
  private computeCycleStart(cfg: StructurePackRotationConfig): Date {
    const [hours, minutes] = cfg.time.split(":").map(Number);
    const now = new Date();
    const period = cfg.period as RotationPeriod;

    const todayParts = new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).formatToParts(now);

    const get = (type: string) =>
      Number(todayParts.find((p) => p.type === type)?.value ?? 0);

    const todayYear = get("year");
    const todayMonth = get("month") - 1;
    const todayDay = get("day");

    if (period === "daily") {
      // Cycle started today at the configured time, or yesterday if time hasn't passed
      const cycleStart = dateInTimezone(
        todayYear,
        todayMonth,
        todayDay,
        hours,
        minutes,
        cfg.timezone,
      );
      if (cycleStart.getTime() > now.getTime()) {
        return dateInTimezone(
          todayYear,
          todayMonth,
          todayDay - 1,
          hours,
          minutes,
          cfg.timezone,
        );
      }
      return cycleStart;
    }

    if (period === "monthly") {
      // Cycle started on dayOfMonth this month, or last month
      const cycleStart = dateInTimezone(
        todayYear,
        todayMonth,
        cfg.dayOfMonth,
        hours,
        minutes,
        cfg.timezone,
      );
      if (cycleStart.getTime() > now.getTime()) {
        return dateInTimezone(
          todayYear,
          todayMonth - 1,
          cfg.dayOfMonth,
          hours,
          minutes,
          cfg.timezone,
        );
      }
      return cycleStart;
    }

    // Weekly (default)
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekdayStr =
      todayParts.find((p) => p.type === "weekday")?.value ?? "";
    const currentDay = dayMap[weekdayStr] ?? now.getDay();

    let daysDiff = currentDay - cfg.dayOfWeek;
    if (daysDiff < 0) daysDiff += 7;

    const baseDate = new Date(
      Date.UTC(todayYear, todayMonth, todayDay - daysDiff),
    );
    const cycleStart = dateInTimezone(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      hours,
      minutes,
      cfg.timezone,
    );

    if (cycleStart.getTime() > now.getTime()) {
      const prevWeek = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      return dateInTimezone(
        prevWeek.getUTCFullYear(),
        prevWeek.getUTCMonth(),
        prevWeek.getUTCDate(),
        hours,
        minutes,
        cfg.timezone,
      );
    }

    return cycleStart;
  }

  /**
   * Returns the most recent rotation record, or null if no rotations have occurred.
   *
   * @private
   * @returns The latest rotation record, or null
   */
  private async getLastRotation() {
    const rotations = await Q.structure.pack.rotation.findAll(
      {},
      { limit: 1, orderBy: "rotatedAt", orderDirection: "desc" },
    );
    return rotations[0] ?? null;
  }

  /**
   * Persists a rotation attempt to the database.
   *
   * @private
   * @param outgoingPackId - ID of the pack that was active before this rotation, or null if none
   * @param incomingPackId - ID of the pack selected for this rotation
   * @param success - Whether the rotation completed without errors
   * @param failureReason - Human-readable error message when `success` is false, otherwise null
   * @param weights - Optional weight snapshot taken at selection time, stored for auditing
   * @returns Promise that resolves when the record has been written
   */
  private async recordRotation(
    outgoingPackId: number | null,
    incomingPackId: number,
    success: boolean,
    failureReason: string | null,
    weights?: WeightEntry[],
  ): Promise<void> {
    await Q.structure.pack.rotation.create({
      outgoingPackId,
      incomingPackId,
      success,
      failureReason,
      weightsSnapshot: weights
        ? (weights as unknown as Record<string, unknown>)
        : null,
    });
  }

  /**
   * Clears the current rotation by deactivating the active pack and removing
   * its mod files from the server. Cycle boosts are also cleared.
   *
   * This is a manual admin action — it does not record a rotation history entry
   * since there is no incoming pack.
   */
  async clearRotation(): Promise<void> {
    const activePack = await this.packService.getActivePack();
    if (!activePack) {
      throw new BadRequestError("No active structure pack to clear");
    }

    // Remove mod files from the server
    if (isFileOpsAllowed()) {
      for (const mod of activePack.mods) {
        const modPath = `${MODS_DIR}/${mod.fileName}`;
        if (await fileExists(modPath)) {
          await deleteFile(modPath);
          logger.info(`Removed mod file: ${mod.fileName}`);
        }
      }
    } else {
      logger.info(
        "File ops not available — rotation cleared without file changes",
      );
    }

    // Deactivate the pack
    await Q.structure.pack.update({ id: activePack.id }, { isActive: false });

    // Clear cycle boosts
    const cfg = await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cycleStart = this.computeCycleStart(cfg);
    await Q.structure.pack.boost.clearCycleBoosts(cycleStart);

    logger.info(`Rotation cleared: deactivated pack "${activePack.name}"`);
  }

  /**
   * Validates that a mod's CurseForge download URL is resolvable.
   * Call this when adding a mod to a pack to fail early rather than at rotation time.
   */
  async validateModDownloadable(
    curseforgeModId: number,
    curseforgeFileId: number,
  ): Promise<void> {
    const url = await getModFileDownloadUrl(curseforgeModId, curseforgeFileId);
    if (!url) {
      throw new BadRequestError(
        "This mod file does not have a downloadable URL on CurseForge. " +
          "The author may have restricted API downloads.",
      );
    }
  }
}
