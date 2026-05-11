import { waitlistRepo } from "@/db";

/**
 * Periodically sweeps waitlist entries whose single-use Discord invite has
 * expired without the applicant ever joining the guild. These rows carry no
 * useful audit data (no linked Discord account, no ability to contact the
 * user) so removing them keeps the waitlist table clean.
 *
 * Runs daily; orphan rows may linger up to 24 hours past their invite TTL but
 * they're harmless: the Discord-side invites are already dead.
 */
export class WaitlistCleanupService {
  private intervalId?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  async initialize(): Promise<void> {
    logger.info("Initializing WaitlistCleanupService...");

    // Run once on startup to clear anything stale from downtime.
    this.runCycle().catch((error) => {
      logger.error("Initial waitlist sweep failed:", error);
    });

    this.intervalId = setInterval(() => {
      this.runCycle().catch((error) => {
        logger.error("Scheduled waitlist sweep failed:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      `WaitlistCleanupService initialized (sweep every ${this.CHECK_INTERVAL / 3600000}h)`,
    );
  }

  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("WaitlistCleanupService stopped");
    }
  }

  private async runCycle(): Promise<void> {
    await waitlistRepo.sweepExpiredUnclaimedEntries();
  }
}
