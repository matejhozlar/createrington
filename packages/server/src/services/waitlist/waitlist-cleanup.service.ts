import { waitlistService } from "./waitlist.service";

/**
 * Periodic waitlist maintenance: re-queues promotions whose 7-day
 * registration window lapsed (or expires them when the member left) and
 * auto-promotes the oldest queued entries into any free slots. Runs once on
 * startup, then every hour; player deletions also trigger an immediate
 * promotion pass, so the interval is only a backstop.
 */
export class WaitlistCleanupService {
  private intervalId?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

  /** Runs an immediate maintenance pass and schedules the hourly interval. */
  async initialize(): Promise<void> {
    logger.info("Initializing WaitlistCleanupService...");

    // Run once on startup to clear anything stale from downtime.
    this.runCycle().catch((error) => {
      logger.error("Initial waitlist maintenance failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.runCycle().catch((error) => {
        logger.error("Scheduled waitlist maintenance failed:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      `WaitlistCleanupService initialized (maintenance every ${this.CHECK_INTERVAL / 3600000}h)`,
    );
  }

  /** Cancels the scheduled maintenance; an in-flight pass is allowed to finish. */
  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("WaitlistCleanupService stopped");
    }
  }

  private async runCycle(): Promise<void> {
    await waitlistService.runMaintenance();
  }
}
