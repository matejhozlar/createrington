import { Q } from "@/db";
import { refreshProjects } from "@/services/curseforge/ingest";
import {
  promoteRequiredDependencies,
  resolveModDependencies,
} from "./dependencies";
import { clearDanglingThreadIds } from "./discord";

/**
 * Daily sweep over open workshops: refreshes the cached CurseForge snapshots
 * (names, thumbnails, download counts), re-resolves each live mod's
 * dependencies, and heals any missed required-dependency promotions for
 * approved mods. Runs once on startup, then every 24 hours; overlapping runs
 * are skipped.
 */
export class VoteProjectRefreshService {
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
      `VoteProjectRefreshService initialized (refresh every ${this.REFRESH_INTERVAL / 3600000}h)`,
    );
  }

  /** Refreshes snapshots, dependencies, and missed promotions for open workshops. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const openVotes = await Q.vote.findAll({ status: "open" });
      if (openVotes.length === 0) return 0;

      let refreshed = 0;
      for (const vote of openVotes) {
        const mods = await Q.vote.mod.findAll({
          voteId: vote.id,
          status: { $in: ["pending", "approved"] },
        });
        const ids = [...new Set(mods.map((mod) => mod.curseforgeProjectId))];
        refreshed += await refreshProjects(ids);

        await resolveModDependencies(vote, mods);
        for (const mod of mods.filter((m) => m.status === "approved")) {
          await promoteRequiredDependencies(
            vote,
            mod,
            mod.reviewedBy ?? vote.createdBy,
          );
        }
        await clearDanglingThreadIds(mods);
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
      logger.info("VoteProjectRefreshService stopped");
    }
  }
}
