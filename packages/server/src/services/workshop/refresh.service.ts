import { Q } from "@/db";
import { refreshProjects } from "@/services/curseforge/ingest";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import { modpackService } from "@/services/modpack";
import {
  promoteRequiredDependencies,
  pruneStaleDependencyEdges,
  resolveProjectDependencies,
  type DependencySubject,
} from "./dependencies";
import { healThreads } from "./discord";

/**
 * Daily sweep over open and closed workshops and every modpack. For open
 * workshops it refreshes the cached CurseForge snapshots (names, thumbnails,
 * download counts), re-resolves dependencies, and heals missed
 * required-dependency promotions. For both it cleans stale dependency edges
 * and reconciles Discord forum threads with the stored thread ids. Every
 * modpack is then reconciled: missing rows for approved suggestions are
 * healed, live state is derived from the published pack's manifest, and
 * orphaned dependencies are pruned. Runs once on startup, then every 24
 * hours; overlapping runs are skipped and the sweep is a no-op while the
 * workshop feature flag is off.
 */
export class WorkshopProjectRefreshService {
  private intervalId?: NodeJS.Timeout;
  private running = false;
  private readonly REFRESH_INTERVAL = 24 * 60 * 60 * 1000;

  /** Runs an immediate refresh and schedules the daily interval. */
  async initialize(): Promise<void> {
    this.refresh().catch((error) => {
      logger.error("Initial workshop project refresh failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.refresh().catch((error) => {
        logger.error("Scheduled workshop project refresh failed:", error);
      });
    }, this.REFRESH_INTERVAL);
    this.intervalId.unref();

    logger.info(
      `WorkshopProjectRefreshService initialized (refresh every ${this.REFRESH_INTERVAL / 3600000}h)`,
    );
  }

  /** Refreshes snapshots, dependencies, forum threads, and modpack live state. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    if (!(await featureFlagService.isEnabled(FeatureFlags.workshop))) return 0;
    this.running = true;
    try {
      const workshops = await Q.workshop.findAll({
        status: { $in: ["open", "closed"] },
      });

      let refreshed = 0;
      for (const workshop of workshops) {
        try {
          const mods = await Q.workshop.mod.findAll({
            workshopId: workshop.id,
          });
          const packRows = await Q.modpack.mod.findAll({
            modpackId: workshop.modpackId,
          });
          if (workshop.status === "open") {
            const liveMods = mods.filter(
              (mod) => mod.status === "pending" || mod.status === "approved",
            );
            const subjects = new Map<number, DependencySubject>();
            for (const subject of [...liveMods, ...packRows]) {
              if (!subjects.has(subject.curseforgeProjectId)) {
                subjects.set(subject.curseforgeProjectId, subject);
              }
            }
            refreshed += await refreshProjects([...subjects.keys()]);

            await resolveProjectDependencies(workshop, [...subjects.values()]);
            for (const row of packRows) {
              if (row.origin === "import") continue;
              await promoteRequiredDependencies(
                workshop,
                row,
                row.addedBy ?? workshop.createdBy,
                { resolveIfEmpty: false },
              );
            }
          }
          await pruneStaleDependencyEdges(workshop);
          await healThreads(workshop, mods);
        } catch (error) {
          logger.error(`Refresh failed for workshop #${workshop.id}:`, error);
        }
      }

      const modpacks = await Q.modpack.findAll({});
      for (const modpack of modpacks) {
        await modpackService.reconcile(modpack.id);
      }

      if (refreshed > 0) {
        logger.info(`Refreshed ${refreshed} workshop project snapshots`);
      }
      return refreshed;
    } finally {
      this.running = false;
    }
  }

  /** Cancels the schedule; an in-flight refresh is allowed to finish. */
  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("WorkshopProjectRefreshService stopped");
    }
  }
}
