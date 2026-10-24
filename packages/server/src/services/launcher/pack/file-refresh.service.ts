import { launcherPackService } from "./launcher-pack.service";

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

/**
 * Keeps the launcher's stored pack files fresh off the request path: every
 * hour it has `launcherPackService.recheckStaleFiles` look up the manual files
 * and built CDN addresses that are due again, so a player's files/resolve
 * request only ever reads what is stored. The first run waits a minute after
 * startup; overlapping runs are skipped.
 */
export class LauncherPackFileRefreshService {
  private intervalId?: NodeJS.Timeout;
  private firstRunId?: NodeJS.Timeout;
  private running = false;

  /** Schedules the hourly recheck, the first one a minute from now. */
  async initialize(): Promise<void> {
    this.firstRunId = setTimeout(() => {
      this.firstRunId = undefined;
      void this.refresh();
    }, FIRST_RUN_DELAY_MS);
    this.firstRunId.unref();
    this.intervalId = setInterval(
      () => void this.refresh(),
      REFRESH_INTERVAL_MS,
    );
    this.intervalId.unref();
    logger.info(
      `LauncherPackFileRefreshService initialized (recheck every ${REFRESH_INTERVAL_MS / 3600000}h)`,
    );
  }

  /** Rechecks one batch of due files now; returns how many were looked up, 0 while a run is in flight. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const rechecked = await launcherPackService.recheckStaleFiles();
      if (rechecked > 0) {
        logger.info(`Looked up ${rechecked} launcher pack file(s) again`);
      }
      return rechecked;
    } catch (error) {
      logger.warn("Launcher pack files could not be looked up again:", error);
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Cancels the schedule; an in-flight recheck is allowed to finish. */
  async shutdown(): Promise<void> {
    if (this.firstRunId) {
      clearTimeout(this.firstRunId);
      this.firstRunId = undefined;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("LauncherPackFileRefreshService stopped");
    }
  }
}
