import type { PlaytimeRepository } from "@/db/repositories/playtime";
import { markJoinedMinecraft } from "@/services/waitlist/progress-embed";
import type { PlaytimeService } from "./playtime.service";

type SessionWriter = Pick<
  PlaytimeRepository,
  "startSession" | "progressSession" | "endSession"
>;

/**
 * Drives the playtime repository from PlaytimeService events: a session start
 * is persisted and its row id handed back to the service, a heartbeat slice
 * that fails to persist is returned to the service so the next heartbeat
 * credits it again, and `sessionAggregated` is emitted once a session end is
 * stored. A player's first session also completes the waitlist "joined
 * Minecraft" step. Every write is tracked so shutdown can wait for them.
 */
export class PlaytimePersistence {
  private pending = new Set<Promise<unknown>>();

  constructor(private readonly writer: SessionWriter) {}

  /** Subscribes to one PlaytimeService; call once per server. */
  connect(service: PlaytimeService, serverId: number): void {
    service.on("sessionStart", (event) => {
      this.track(
        this.writer
          .startSession(event)
          .then(async (started) => {
            if (!started) return;
            service.setSessionId(event.uuid, started.sessionId);
            await markJoinedMinecraft(started.discordId).catch((error) => {
              logger.warn(
                `Failed to mark waitlist "joined Minecraft" for ${started.discordId}:`,
                error,
              );
            });
          })
          .catch((error) => {
            logger.error(
              `Failed to handle sessionStart event for server ${serverId}:`,
              error,
            );
          }),
      );
    });

    service.on("sessionProgress", (event) => {
      this.track(
        this.writer.progressSession(event).catch((error) => {
          logger.error(
            `Failed to handle sessionProgress event for server ${serverId}:`,
            error,
          );
          if (!service.revertProgress(event)) {
            logger.warn(
              `Dropped ${event.credit.seconds}s of playtime for ${event.username} (${event.uuid}): the session moved on before the failed slice could be retried`,
            );
          }
        }),
      );
    });

    service.on("sessionEnd", (event) => {
      this.track(
        this.writer
          .endSession(event)
          .then(() => {
            service.emit("sessionAggregated", event);
          })
          .catch((error) => {
            logger.error(
              `Failed to handle sessionEnd event for server ${serverId}:`,
              error,
            );
          }),
      );
    });

    logger.info(`Playtime persistence connected for server ${serverId}`);
  }

  /** Waits for in-flight writes to settle, up to `timeoutMs`. */
  async flush(timeoutMs: number): Promise<void> {
    if (this.pending.size === 0) return;

    logger.info(
      `Waiting for ${this.pending.size} in-flight playtime write(s)...`,
    );

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled(Array.from(this.pending)),
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (this.pending.size > 0) {
      logger.warn(
        `${this.pending.size} playtime write(s) still in flight after ${timeoutMs}ms`,
      );
    }
  }

  private track(promise: Promise<unknown>): void {
    this.pending.add(promise);
    void promise.finally(() => this.pending.delete(promise));
  }
}
