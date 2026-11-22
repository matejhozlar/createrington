import { Q } from "@/db";
import { settings } from "@/services/settings";

const CAPACITY_MEMO_TTL_MS = 5_000;

/**
 * Server intake capacity: the player limit from settings minus registered
 * players and outstanding promotions. Reads are advisory snapshots for
 * display and gating; slot-taking writes re-read `getFreeSlots()` inside the
 * waitlist slot lock, which serializes them per process. `hasCapacity()`
 * fails closed, so a failed read queues the user instead of admitting them.
 */
export class WaitlistCapacityService {
  private capacityMemo: { value: boolean; expiresAt: number } | null = null;

  /** Unreserved free slots, zero while intake is closed. */
  async getFreeSlots(): Promise<number> {
    const intakeMode = await settings.getIntakeMode();
    if (intakeMode === "closed") {
      logger.debug("Capacity check: intake mode is closed");
      return 0;
    }

    const [currentPlayers, playerLimit, reserved] = await Promise.all([
      Q.player.count(),
      settings.getPlayerLimit(),
      Q.waitlist.entry.count({ status: "promoted" }),
    ]);

    const free = Math.max(0, playerLimit - currentPlayers - reserved);

    logger.debug(
      `Capacity check: players=${currentPlayers}, reserved=${reserved}, limit=${playerLimit}, free=${free}`,
    );

    return free;
  }

  /** True when intake is open and a slot is free; false when the read fails. */
  async hasCapacity(): Promise<boolean> {
    try {
      return (await this.getFreeSlots()) > 0;
    } catch (error) {
      logger.error("Failed to check capacity:", error);
      return false;
    }
  }

  /** `hasCapacity()` memoized for a few seconds, for unauthenticated high-frequency reads. */
  async hasCapacityMemoized(): Promise<boolean> {
    if (this.capacityMemo && Date.now() < this.capacityMemo.expiresAt) {
      return this.capacityMemo.value;
    }
    const value = await this.hasCapacity();
    this.capacityMemo = {
      value,
      expiresAt: Date.now() + CAPACITY_MEMO_TTL_MS,
    };
    return value;
  }
}

export const waitlistCapacityService = new WaitlistCapacityService();
