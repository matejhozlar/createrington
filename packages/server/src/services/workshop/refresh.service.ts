import { Q } from "@/db";
import { refreshProjects } from "@/services/curseforge/ingest";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import { modpackService } from "@/services/modpack";
import {
  WORKSHOP_LIVE_STATUSES,
  WORKSHOP_VISIBLE_STATUSES,
} from "@createrington/shared/workshop";
import {
  pruneStaleDependencyEdges,
  resolveProjectDependencies,
  type DependencySubject,
} from "./dependencies";
import { healThreads } from "./discord";

/**
 * Daily sweep over user-visible workshops and every modpack. For running
 * workshops it refreshes the cached CurseForge snapshots (names, thumbnails,
 * download counts), re-resolves dependencies, and heals missed
 * required-dependency promotions. For all it cleans stale dependency edges
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
    this.running = true;
    try {
      if (!(await featureFlagService.isEnabled(FeatureFlags.workshop))) {
        return 0;
      }
      const workshops = await Q.workshop.findAll({
        status: { $in: [...WORKSHOP_VISIBLE_STATUSES] },
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
          if (WORKSHOP_LIVE_STATUSES.includes(workshop.status)) {
            const liveMods = mods.filter((mod) => mod.status !== "rejected");
            const subjects = new Map<number, DependencySubject>();
            for (const subject of [...liveMods, ...packRows]) {
              if (!subjects.has(subject.curseforgeProjectId)) {
                subjects.set(subject.curseforgeProjectId, subject);
              }
            }
            refreshed += await refreshProjects([...subjects.keys()]);

            await resolveProjectDependencies(workshop, [...subjects.values()]);
          }
          await pruneStaleDependencyEdges(workshop);
          await healThreads(workshop, mods);
        } catch (error) {
          logger.error(`Refresh failed for workshop #${workshop.id}:`, error);
        }
      }

      const modpacks = await Q.modpack.findAll({});
      for (const modpack of modpacks) {
        await modpackService.tryReconcile(modpack.id);
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
