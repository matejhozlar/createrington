import { Q } from "@/db";
import { refreshProjects } from "@/services/curseforge/ingest";
import {
  promoteRequiredDependencies,
  pruneOrphanedDependencies,
  resolveModDependencies,
} from "./dependencies";
import { healThreads } from "./discord";

/**
 * Daily sweep over open and closed workshops. For open ones it refreshes the
 * cached CurseForge snapshots (names, thumbnails, download counts),
 * re-resolves each live mod's dependencies, and heals any missed
 * required-dependency promotions for approved mods. For both it prunes
 * orphaned dependency rows and reconciles Discord forum threads with the
 * stored thread ids. Runs once on startup, then every 24 hours; overlapping
 * runs are skipped.
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

    logger.info(
      `WorkshopProjectRefreshService initialized (refresh every ${this.REFRESH_INTERVAL / 3600000}h)`,
    );
  }

  /** Refreshes snapshots, dependencies, missed promotions, and forum threads. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const workshops = await Q.workshop.findAll({
        status: { $in: ["open", "closed"] },
      });
      if (workshops.length === 0) return 0;

      let refreshed = 0;
      for (const workshop of workshops) {
        try {
          const mods = await Q.workshop.mod.findAll({
            workshopId: workshop.id,
          });
          if (workshop.status === "open") {
            const liveMods = mods.filter(
              (mod) => mod.status === "pending" || mod.status === "approved",
            );
            const ids = [
              ...new Set(liveMods.map((mod) => mod.curseforgeProjectId)),
            ];
            refreshed += await refreshProjects(ids);

            await resolveModDependencies(workshop, liveMods);
            for (const mod of liveMods.filter((m) => m.status === "approved")) {
              await promoteRequiredDependencies(
                workshop,
                mod,
                mod.reviewedBy ?? workshop.createdBy,
              );
            }
          }
          await pruneOrphanedDependencies(workshop.id);
          await healThreads(workshop, mods);
        } catch (error) {
          logger.error(`Refresh failed for workshop #${workshop.id}:`, error);
        }
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
