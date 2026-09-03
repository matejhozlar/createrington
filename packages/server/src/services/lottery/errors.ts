import { AppError } from "@/app/middleware";
import { formatDuration } from "@/utils/format";

/** Raised by `LotteryService.start` while the global start cooldown is running; carries when the next round may begin. */
export class LotteryCooldownError extends AppError {
  constructor(
    public readonly nextStartAt: Date,
    now: Date,
  ) {
    const message = `Next lottery can start in ${formatDuration(now, nextStartAt)}`;
    super(
      message,
      409,
      true,
      { nextStartAt: nextStartAt.toISOString() },
      { playerMessage: message, code: "LOTTERY_COOLDOWN" },
    );
    this.name = "LotteryCooldownError";
  }
}
