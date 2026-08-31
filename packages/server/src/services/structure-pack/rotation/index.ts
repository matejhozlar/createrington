import config from "@/config";
import { Q, db, balanceRepo } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { BadRequestError } from "@/app/middleware/error-handler";
import {
  isFileOpsAllowed,
  copyFileToServer,
  deleteFile,
  fileExists,
} from "@/services/mc-server/file-ops";
import { getModFileDownloadUrl } from "@/services/curseforge";
import type { StructurePackService } from "../index";
import type { StructurePackWithMods } from "@/db/queries/structure/pack";
import type {
  StructurePackMod,
  StructurePackRotationConfig,
  StructurePackRotation,
  StructurePackBoost,
} from "@createrington/shared/db";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import { MODS_DIR } from "./constants";
import { periodIntervalMs } from "./timezone";
import {
  checkMissedRotation,
  computeCycleStart,
  computeNextRotationTime,
} from "./scheduling";
import { computeWeights, selectWeightedRandom } from "./weights";
import { ensureModsCached, getCachePath } from "./mod-cache";
import type { RotationPeriod, WeightEntry } from "./types";

/**
 * Structure Pack Rotation Service
 *
 * Manages the automated weekly (or configurable period) rotation of active structure packs:
 * - Schedules rotations at configurable times using IANA timezone-aware scheduling
 * - Detects and recovers from missed rotations on startup
 * - Selects the next pack via a weighted-random algorithm (time-since-last + boost units)
 * - Downloads and caches mod files from CurseForge before installing them on the server
 * - Records every rotation attempt (success or failure) with a weights snapshot for
 *   auditing; attempts with no eligible packs are log-only and leave no history row
 * - Handles player-purchased boost units that increase a pack's selection weight for a cycle
 * - Can be disabled entirely via the `enabled` flag on the rotation config: no scheduling,
 *   no automatic rotations, and no boost purchases while disabled (manual rotation still works)
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

  /**
   * Initializes the rotation scheduler
   *
   * Loads the rotation config, logs the active schedule, and either triggers an
   * immediate rotation (if one was missed while the server was down) or schedules
   * the next rotation at the configured time. Does nothing while rotation is
   * disabled in the config.
   */
  async initialize(): Promise<void> {
    if (config.envMode.isDev) {
      logger.warn(
        "Skipping structure pack rotation in development environment",
      );
      return;
    }

    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    if (!rotationConfig.enabled) {
      logger.warn("Structure pack rotation is disabled, scheduler not started");
      return;
    }

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

    const lastRotation = await this.getLastRotation();
    if (lastRotation) {
      const missed = checkMissedRotation(
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
      this.nextRotationTimer = null;
    }

    if (!rotationConfig.enabled) {
      logger.info("Structure pack rotation is disabled, no rotation scheduled");
      return;
    }

    const nextTime = computeNextRotationTime(rotationConfig);
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
   * Automatic rotations are skipped while rotation is disabled in the config;
   * manual triggers still run. When no packs are eligible, nothing is rotated
   * and no history row is recorded.
   *
   * @param manual - Whether this rotation was triggered manually by an admin
   * @returns Promise that resolves when the rotation (or its failure path) is complete
   */
  async executeRotation(manual = false): Promise<void> {
    if (this.rotationInProgress) {
      throw new BadRequestError("A rotation is already in progress");
    }

    this.rotationInProgress = true;
    const startTime = Date.now();

    try {
      const rotationConfig =
        await Q.structure.pack.rotation.config.getOrCreateDefault();
      if (!rotationConfig.enabled && !manual) {
        logger.info("Structure pack rotation is disabled, skipping rotation");
        return;
      }

      const activePack = await this.packService.getActivePack();
      const eligible = await Q.structure.pack.getEligibleForRotation(
        activePack?.id,
      );

      if (eligible.length === 0) {
        logger.warn("No eligible packs for rotation, skipping");
        if (manual) {
          throw new BadRequestError("No eligible packs for rotation");
        }
        this.scheduleNextRotation(rotationConfig);
        return;
      }

      const cycleStart = computeCycleStart(rotationConfig);
      const boostData =
        await Q.structure.pack.boost.getBoostsByPackForCycle(cycleStart);
      const boostMap = new Map(boostData.map((b) => [b.packId, b.totalUnits]));
      const weights = computeWeights(
        eligible,
        boostMap,
        rotationConfig.timeWeightMultiplier,
        rotationConfig.boostWeightPerUnit,
      );

      const selectedPackId = selectWeightedRandom(weights);
      const incomingPack = await this.packService.getPack(selectedPackId);

      logger.info(
        `Rotation: ${activePack?.name ?? "(none)"} → ${incomingPack.name} (weights: ${JSON.stringify(weights)})`,
      );

      if (isFileOpsAllowed()) {
        try {
          await ensureModsCached(incomingPack.mods);

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
            const cachePath = getCachePath(mod.fileName);
            await copyFileToServer(cachePath, modPath);
            logger.info(`Installed mod file: ${mod.fileName}`);
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          logger.error(`Rotation file operations failed: ${reason}`);
          await this.recordRotation(
            activePack?.id ?? null,
            selectedPackId,
            false,
            reason,
          );
          this.scheduleNextRotation(rotationConfig);
          if (manual) {
            throw new BadRequestError(`Rotation failed: ${reason}`);
          }
          return;
        }
      } else {
        logger.info(
          "File ops not available, rotation recorded without file changes",
        );
      }

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

      await Q.structure.pack.boost.clearCycleBoosts(cycleStart);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(
        `Rotation complete in ${elapsed}s: ${activePack?.name ?? "(none)"} → ${incomingPack.name}`,
      );

      this.scheduleNextRotation(rotationConfig);
    } catch (error) {
      logger.error("Rotation failed:", error);
      // Try to reschedule even on failure
      try {
        const cfg = await Q.structure.pack.rotation.config.getOrCreateDefault();
        this.scheduleNextRotation(cfg);
      } catch {
        logger.error("Failed to reschedule after rotation error");
      }
      if (manual) {
        throw error;
      }
    } finally {
      this.rotationInProgress = false;
    }
  }

  /**
   * Records a player's boost purchase for a structure pack in the current cycle.
   *
   * Validates that the target pack is available and not currently active, then
   * deducts the cost from the player's balance and creates the boost record in
   * one transaction, so a failed insert never leaves the player charged.
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
    if (!rotationConfig.enabled) {
      throw new BadRequestError("Rotations are currently disabled");
    }
    const cost = units * rotationConfig.boostUnitPrice;
    const cycleStart = computeCycleStart(rotationConfig);

    return db.inTransaction(async (tx) => {
      await balanceRepo.deduct(
        { discordId },
        cost,
        `Structure pack boost: ${units} unit(s) for "${pack.name}"`,
        BalanceTransactionType.PURCHASE,
        { metadata: { packId, units, packName: pack.name }, tx },
      );

      return tx.structure.pack.boost.createAndReturn({
        discordId,
        packId,
        units,
        currencySpent: cost,
        cycleStart,
      });
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
    const cycleStart = computeCycleStart(rotationConfig);
    return Q.structure.pack.boost.getPlayerBoostsForCycle(
      discordId,
      cycleStart,
    );
  }

  /**
   * Returns each eligible pack together with its current computed weight and
   * accumulated boost units for the active cycle. Each pack also includes its
   * full mod list so the UI can display mod counts and a detailed inspect view.
   *
   * Intended for UI display so players can see how their boosts affect selection odds.
   *
   * @returns Array of objects containing the pack (with mods), its total weight, and boost unit count
   */
  async getPoolWithWeights(): Promise<
    Array<{ pack: StructurePackWithMods; weight: number; boostUnits: number }>
  > {
    const activePack = await this.packService.getActivePack();
    const eligible = await Q.structure.pack.getEligibleForRotation(
      activePack?.id,
    );

    const packIds = eligible.map((p) => p.id);
    const mods =
      packIds.length > 0
        ? await Q.structure.pack.mod.findAll({
            packId: { $in: packIds },
          })
        : [];
    const modsByPackId = new Map<number, StructurePackMod[]>();
    for (const mod of mods) {
      const list = modsByPackId.get(mod.packId);
      if (list) {
        list.push(mod);
      } else {
        modsByPackId.set(mod.packId, [mod]);
      }
    }

    const rotationConfig =
      await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cycleStart = computeCycleStart(rotationConfig);
    const boostData =
      await Q.structure.pack.boost.getBoostsByPackForCycle(cycleStart);
    const boostMap = new Map(boostData.map((b) => [b.packId, b.totalUnits]));
    const weights = computeWeights(
      eligible,
      boostMap,
      rotationConfig.timeWeightMultiplier,
      rotationConfig.boostWeightPerUnit,
    );

    return eligible.map((pack) => {
      const w = weights.find((e) => e.packId === pack.id);
      return {
        pack: { ...pack, mods: modsByPackId.get(pack.id) ?? [] },
        weight: w?.weight ?? 0,
        boostUnits: boostMap.get(pack.id) ?? 0,
      };
    });
  }

  /** Returns the current rotation configuration, creating the default record if none exists. */
  async getConfig(): Promise<StructurePackRotationConfig> {
    return Q.structure.pack.rotation.config.getOrCreateDefault();
  }

  /**
   * Returns the next scheduled rotation time, boost unit price, and current
   * cycle number. The next rotation time is null while rotation is disabled.
   */
  async getNextRotationInfo(): Promise<{
    nextRotationAt: string | null;
    boostUnitPrice: number;
    cycle: number;
  }> {
    const cfg = await this.getConfig();
    const pastRotations = await Q.structure.pack.rotation.count();
    return {
      nextRotationAt: cfg.enabled
        ? computeNextRotationTime(cfg).toISOString()
        : null,
      boostUnitPrice: cfg.boostUnitPrice,
      cycle: pastRotations + 1,
    };
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
        | "enabled"
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

    this.scheduleNextRotation(updated);
    logger.info("Rotation config updated");

    return updated;
  }

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

  /**
   * Clears the current rotation by deactivating the active pack and removing
   * its mod files from the server. Cycle boosts are also cleared.
   *
   * This is a manual admin action: it does not record a rotation history entry
   * since there is no incoming pack.
   */
  async clearRotation(): Promise<void> {
    const activePack = await this.packService.getActivePack();
    if (!activePack) {
      throw new BadRequestError("No active structure pack to clear");
    }

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
        "File ops not available, rotation cleared without file changes",
      );
    }

    await Q.structure.pack.update({ id: activePack.id }, { isActive: false });

    const cfg = await Q.structure.pack.rotation.config.getOrCreateDefault();
    const cycleStart = computeCycleStart(cfg);
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

  /** Returns the most recent rotation record, or null if no rotations have occurred. */
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
   * @param outgoingPackId - ID of the pack that was active before this rotation, or null if none
   * @param incomingPackId - ID of the pack selected for this rotation
   * @param success - Whether the rotation completed without errors
   * @param failureReason - Human-readable error message when `success` is false, otherwise null
   * @param weights - Optional weight snapshot taken at selection time, stored for auditing
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
}
