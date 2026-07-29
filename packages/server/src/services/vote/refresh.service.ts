import { Q } from "@/db";
import { refreshProjects } from "@/services/curseforge/ingest";

/**
 * Daily refresh of the cached CurseForge snapshots for every project sitting
 * in an open workshop, so names, thumbnails, and download counts do not go
 * stale between suggest time and review. Runs once on startup, then every
 * 24 hours; overlapping runs are skipped.
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

  /** Refreshes snapshots for every project in an open workshop. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const openVotes = await Q.vote.findAll(
        { status: "open" },
        { select: ["id"] },
      );
      if (openVotes.length === 0) return 0;

      const mods = await Q.vote.mod.findAll(
        { voteId: { $in: openVotes.map((vote) => vote.id) } },
        { select: ["curseforgeProjectId"] },
      );
      const ids = [...new Set(mods.map((mod) => mod.curseforgeProjectId))];
      const refreshed = await refreshProjects(ids);
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
