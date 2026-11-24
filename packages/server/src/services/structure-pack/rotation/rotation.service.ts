import config from "@/config";
import { Q, db, balanceRepo } from "@/db";
import { BadRequestError, errorMessage } from "@/errors";
import {
  isFileOpsAllowed,
  copyFileToServer,
  deleteFile,
  fileExists,
} from "@/services/mc-server/file-ops";
import { getModFileDownloadUrl } from "@/services/curseforge/downloads";
import type { DatabaseQueries } from "@/generated/db";
import type { StructurePackService } from "../structure-pack.service";
import type { StructurePackWithMods } from "@/db/queries/structure/pack";
import type {
  StructurePack,
  StructurePackMod,
  StructurePackRotationConfig,
  StructurePackBoost,
} from "@createrington/shared/db";
import { MODS_DIR } from "./constants";
import { periodIntervalMs } from "./timezone";
import {
  checkMissedRotation,
  describeSchedule,
  nextOccurrence,
} from "./scheduling";
import { computeWeights, selectWeightedRandom } from "./weights";
import { ensureModsCached, getCachePath } from "./mod-cache";
import {
  toRotationConfig,
  type RotationConfig,
  type WeightEntry,
} from "./types";

interface WeighedPool {
  weights: WeightEntry[];
  boostUnits: Map<number, number>;
  boostIds: number[];
}

async function removePackMods(
  pack: StructurePackWithMods,
  keepFileNames: ReadonlySet<string> = new Set(),
): Promise<void> {
  for (const mod of pack.mods) {
    if (keepFileNames.has(mod.fileName)) continue;
    const modPath = `${MODS_DIR}/${mod.fileName}`;
    if (await fileExists(modPath)) {
      await deleteFile(modPath);
      logger.info(`Removed mod file: ${mod.fileName}`);
    }
  }
}

async function installPackMods(pack: StructurePackWithMods): Promise<void> {
  for (const mod of pack.mods) {
    const modPath = `${MODS_DIR}/${mod.fileName}`;
    if (await fileExists(modPath)) {
      logger.info(`Mod already in mods dir: ${mod.fileName}`);
      continue;
    }
    await copyFileToServer(getCachePath(mod.fileName), modPath);
    logger.info(`Installed mod file: ${mod.fileName}`);
  }
}

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
 * - Handles player-purchased boost units that increase a pack's selection weight: a boost
 *   stays open until the next successful draw counts it, whenever that draw runs (on
 *   schedule, after a missed rotation at boot, or manually), and is deleted by that draw;
 *   a boost the draw could not count (on a pack outside the draw, or bought mid-draw for
 *   the pack that won) is refunded instead
 * - Can be disabled entirely via the `enabled` flag on the rotation config: no scheduling,
 *   no automatic rotations, and no boost purchases while disabled (manual rotation still
 *   works); disabling refunds all open boosts
 *
 * NOTE: File operations (mod installs/removals) are skipped when `isFileOpsAllowed()` returns
 * false; the rotation is still recorded in the database in that case.
 */
export class StructurePackRotationService {
  private nextRotationTimer: ReturnType<typeof setTimeout> | null = null;
  private rotationInProgress = false;

  constructor(private packService: StructurePackService) {}

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

    const rotationConfig = await this.getConfig();
    if (!rotationConfig.enabled) {
      logger.info("Structure pack rotation is disabled, scheduler not started");
      return;
    }

    logger.info(
      `Structure pack rotation config: ${describeSchedule(rotationConfig)} ${rotationConfig.timezone}`,
    );

    const lastRotation = await this.getLastRotation();
    if (
      lastRotation &&
      checkMissedRotation(rotationConfig, lastRotation.rotatedAt)
    ) {
      logger.info("Missed rotation detected, executing now...");
      await this.executeRotation();
      return;
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

  private scheduleNextRotation(rotationConfig: RotationConfig): void {
    if (this.nextRotationTimer) {
      clearTimeout(this.nextRotationTimer);
      this.nextRotationTimer = null;
    }

    if (!rotationConfig.enabled) {
      logger.info("Structure pack rotation is disabled, no rotation scheduled");
      return;
    }

    let nextTime = nextOccurrence(rotationConfig, new Date());
    if (nextTime.getTime() <= Date.now()) {
      logger.warn(
        "Computed next rotation time is in the past, scheduling for next period",
      );
      nextTime = new Date(
        nextTime.getTime() + periodIntervalMs(rotationConfig.period),
      );
    }

    this.nextRotationTimer = setTimeout(
      () => this.runScheduledRotation(),
      nextTime.getTime() - Date.now(),
    );
    logger.info(
      `Next structure pack rotation scheduled for ${nextTime.toISOString()}`,
    );
  }

  private runScheduledRotation(): void {
    this.executeRotation().catch((error: unknown) => {
      logger.error("Scheduled structure pack rotation failed:", error);
    });
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
   * 7. Delete the boosts the draw counted and refund the ones it could not count; a boost
   *    bought during the draw for another eligible pack stays open for the next one
   * 8. Schedule the next rotation
   *
   * On any file-operations failure the rotation is recorded as failed and the
   * next rotation is still scheduled. On unexpected errors the timer is also
   * rescheduled so the service recovers automatically.
   *
   * Automatic rotations are skipped while rotation is disabled in the config;
   * manual triggers still run. When no packs are eligible, nothing is rotated
   * and no history row is recorded. Automatic rotations only log a refusal
   * (empty pool, failed file ops); manual triggers get it as BadRequestError
   * and get unexpected errors rethrown after the reschedule.
   */
  async executeRotation(manual = false): Promise<void> {
    if (this.rotationInProgress) {
      throw new BadRequestError("A rotation is already in progress");
    }

    this.rotationInProgress = true;
    let refusal: string | null;
    try {
      refusal = await this.rotate(manual);
    } catch (error) {
      logger.error("Rotation failed:", error);
      await this.getConfig()
        .then((cfg) => this.scheduleNextRotation(cfg))
        .catch(() => logger.error("Failed to reschedule after rotation error"));
      if (manual) throw error;
      return;
    } finally {
      this.rotationInProgress = false;
    }

    if (refusal !== null && manual) throw new BadRequestError(refusal);
  }

  private async rotate(manual: boolean): Promise<string | null> {
    const startTime = Date.now();
    const rotationConfig = await this.getConfig();
    if (!rotationConfig.enabled && !manual) {
      logger.info("Structure pack rotation is disabled, skipping rotation");
      return null;
    }

    const activePack = await this.packService.getActivePack();
    const eligible = await Q.structure.pack.getEligibleForRotation(
      activePack?.id,
    );
    if (eligible.length === 0) {
      logger.warn("No eligible packs for rotation, skipping");
      this.scheduleNextRotation(rotationConfig);
      return "No eligible packs for rotation";
    }

    const { weights, boostIds } = await this.weighPool(
      eligible,
      rotationConfig,
    );
    const selectedPackId = selectWeightedRandom(weights);
    const incomingPack = await this.packService.getPack(selectedPackId);
    logger.info(
      `Rotation: ${activePack?.name ?? "(none)"} → ${incomingPack.name} (weights: ${JSON.stringify(weights)})`,
    );

    const fileFailure = await this.swapModFiles(activePack, incomingPack);
    if (fileFailure !== null) {
      await this.recordRotation(
        activePack?.id ?? null,
        selectedPackId,
        false,
        fileFailure,
      );
      this.scheduleNextRotation(rotationConfig);
      return `Rotation failed: ${fileFailure}`;
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
      await this.settleBoosts(tx, eligible, selectedPackId, boostIds);
    });
    await this.recordRotation(
      activePack?.id ?? null,
      selectedPackId,
      true,
      null,
      weights,
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      `Rotation complete in ${elapsed}s: ${activePack?.name ?? "(none)"} → ${incomingPack.name}`,
    );
    this.scheduleNextRotation(rotationConfig);
    return null;
  }

  private async swapModFiles(
    outgoing: StructurePackWithMods | null,
    incoming: StructurePackWithMods,
  ): Promise<string | null> {
    if (!isFileOpsAllowed()) {
      logger.info(
        "File ops not available, rotation recorded without file changes",
      );
      return null;
    }
    try {
      await ensureModsCached(incoming.mods);
      if (outgoing) {
        await removePackMods(
          outgoing,
          new Set(incoming.mods.map((mod) => mod.fileName)),
        );
      }
      await installPackMods(incoming);
      return null;
    } catch (error) {
      const reason = errorMessage(error);
      logger.error(`Rotation file operations failed: ${reason}`);
      return reason;
    }
  }

  /**
   * Records a player's boost purchase for a structure pack, counted in the next successful draw.
   *
   * Validates that the target pack is available and not currently active, then
   * deducts the cost from the player's balance and creates the boost record in
   * one transaction, so a failed insert never leaves the player charged.
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

    const rotationConfig = await this.getConfig();
    if (!rotationConfig.enabled) {
      throw new BadRequestError("Rotations are currently disabled");
    }
    const cost = units * rotationConfig.boostUnitPrice;

    return db.inTransaction(async (tx) => {
      await balanceRepo.deduct(
        { discordId },
        cost,
        `Structure pack boost: ${units} unit(s) for "${pack.name}"`,
        "purchase",
        { metadata: { packId, units, packName: pack.name }, tx },
      );

      return tx.structure.pack.boost.createAndReturn({
        discordId,
        packId,
        units,
        currencySpent: cost,
      });
    });
  }

  /** Returns a player's open boosts (not yet counted by a draw), newest first. */
  async getPlayerBoosts(discordId: string): Promise<StructurePackBoost[]> {
    return Q.structure.pack.boost.findAll(
      { discordId },
      { orderBy: "createdAt", orderDirection: "desc" },
    );
  }

  /**
   * Returns each eligible pack together with its current computed weight and
   * open boost units for the next draw. Each pack also includes its
   * full mod list so the UI can display mod counts and a detailed inspect view.
   *
   * Intended for UI display so players can see how their boosts affect selection odds.
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

    const { weights, boostUnits } = await this.weighPool(
      eligible,
      await this.getConfig(),
    );

    return eligible.map((pack) => {
      const w = weights.find((e) => e.packId === pack.id);
      return {
        pack: { ...pack, mods: modsByPackId.get(pack.id) ?? [] },
        weight: w?.weight ?? 0,
        boostUnits: boostUnits.get(pack.id) ?? 0,
      };
    });
  }

  /** Returns the current rotation configuration, creating the default record if none exists. */
  async getConfig(): Promise<RotationConfig> {
    return toRotationConfig(
      await Q.structure.pack.rotation.config.getOrCreateDefault(),
    );
  }

  /**
   * Returns the next scheduled rotation time, boost unit price, and current
   * cycle number. The next rotation time is null while rotation is disabled.
   */
  async getNextRotationInfo(): Promise<{
    enabled: boolean;
    nextRotationAt: string | null;
    boostUnitPrice: number;
    cycle: number;
  }> {
    const cfg = await this.getConfig();
    const pastRotations = await Q.structure.pack.rotation.count();
    return {
      enabled: cfg.enabled,
      nextRotationAt: cfg.enabled
        ? nextOccurrence(cfg, new Date()).toISOString()
        : null,
      boostUnitPrice: cfg.boostUnitPrice,
      cycle: pastRotations + 1,
    };
  }

  /**
   * Persists partial updates to the rotation configuration and immediately
   * reschedules the next rotation to reflect the new settings. Disabling
   * rotation refunds and removes all open boosts in the same transaction, so
   * players never pay for a rotation that will not happen.
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
  ): Promise<RotationConfig> {
    const current = await this.getConfig();
    const disabling = current.enabled && data.enabled === false;

    const updated = await db.inTransaction(async (tx) => {
      const next = await tx.structure.pack.rotation.config.updateAndReturn(
        { id: current.id },
        data,
      );

      if (disabling) {
        await this.refundBoosts(
          tx,
          await tx.structure.pack.boost.findAll({}),
          "rotations disabled",
        );
      }

      return toRotationConfig(next);
    });

    this.scheduleNextRotation(updated);
    logger.info("Rotation config updated");

    return updated;
  }

  /**
   * Clears the current rotation by deactivating the active pack and removing
   * its mod files from the server. Open boosts are kept for the next draw.
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
      await removePackMods(activePack);
    } else {
      logger.info(
        "File ops not available, rotation cleared without file changes",
      );
    }

    await Q.structure.pack.update({ id: activePack.id }, { isActive: false });

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

  private async settleBoosts(
    tx: DatabaseQueries,
    eligible: StructurePack[],
    selectedPackId: number,
    countedIds: number[],
  ): Promise<void> {
    const counted = new Set(countedIds);
    const eligibleIds = new Set(eligible.map((pack) => pack.id));
    const uncounted = (await tx.structure.pack.boost.findAll({})).filter(
      (boost) =>
        !counted.has(boost.id) &&
        (boost.packId === selectedPackId || !eligibleIds.has(boost.packId)),
    );

    if (countedIds.length > 0) {
      await tx.structure.pack.boost.deleteAll({ id: { $in: countedIds } });
    }
    await this.refundBoosts(tx, uncounted, "not counted by the draw");
  }

  private async refundBoosts(
    tx: DatabaseQueries,
    boosts: StructurePackBoost[],
    reason: string,
  ): Promise<void> {
    if (boosts.length === 0) return;

    for (const boost of boosts) {
      await balanceRepo.add(
        { discordId: boost.discordId },
        boost.currencySpent,
        `Structure pack boost refund: ${boost.units} unit(s), ${reason}`,
        "refund",
        {
          metadata: {
            packId: boost.packId,
            units: boost.units,
            boostId: boost.id,
          },
          tx,
        },
      );
    }
    await tx.structure.pack.boost.deleteAll({
      id: { $in: boosts.map((boost) => boost.id) },
    });
    logger.info(`Refunded ${boosts.length} structure pack boost(s): ${reason}`);
  }

  private async weighPool(
    eligible: StructurePack[],
    rotationConfig: RotationConfig,
  ): Promise<WeighedPool> {
    const boosts = await Q.structure.pack.boost.findAll({});
    const boostUnits = new Map<number, number>();
    for (const boost of boosts) {
      boostUnits.set(
        boost.packId,
        (boostUnits.get(boost.packId) ?? 0) + boost.units,
      );
    }
    const weights = computeWeights(
      eligible,
      boostUnits,
      rotationConfig.timeWeightMultiplier,
      rotationConfig.boostWeightPerUnit,
    );
    const eligibleIds = new Set(eligible.map((pack) => pack.id));
    const boostIds = boosts
      .filter((boost) => eligibleIds.has(boost.packId))
      .map((boost) => boost.id);
    return { weights, boostUnits, boostIds };
  }

  private async getLastRotation() {
    const rotations = await Q.structure.pack.rotation.findAll(
      {},
      { limit: 1, orderBy: "rotatedAt", orderDirection: "desc" },
    );
    return rotations[0] ?? null;
  }

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
      weightsSnapshot: weights ?? null,
    });
  }
}
