import type { PlaytimeService } from "./playtime.service";
import type { SessionStartEvent, SessionEndEvent } from "./types";

/**
 * Playtime Forwarder Service
 *
 * Active only on the dev environment. Listens to PlaytimeService session
 * events and forwards them to the production server so that test-server
 * playtime is included in production totals.
 *
 * Forwarding is fire-and-forget: failures are logged but never block
 * the dev server's normal operation.
 */
export class PlaytimeForwarderService {
  private targetUrl: string;
  private secret: string;
  private endpoint: string;

  constructor(targetUrl: string, secret: string) {
    this.targetUrl = targetUrl;
    this.secret = secret;
    this.endpoint = `${targetUrl.replace(/\/+$/, "")}/api/internal/presence`;
  }

  /**
   * Connects the forwarder to a PlaytimeService instance.
   *
   * Subscribes to sessionStart and sessionEnd events and forwards
   * each event to the production server's internal presence endpoint.
   *
   * @param service - PlaytimeService to listen to
   * @param serverId - Server ID (for logging only)
   */
  connectToService(service: PlaytimeService, serverId: number): void {
    service.on("sessionStart", (event) => {
      void this.forwardJoin(event);
    });

    service.on("sessionEnd", (event) => {
      void this.forwardLeave(event);
    });

    logger.info(
      `PlaytimeForwarder connected to server ${serverId} → ${this.endpoint}`,
    );
  }

  private async forwardJoin(event: SessionStartEvent): Promise<void> {
    await this.forward({
      uuid: event.uuid,
      username: event.username,
      state: "joined",
      timestamp: event.sessionStart.toISOString(),
    });
  }

  private async forwardLeave(event: SessionEndEvent): Promise<void> {
    await this.forward({
      uuid: event.uuid,
      username: event.username,
      state: "left",
      timestamp: event.sessionEnd.toISOString(),
    });
  }

  private async forward(payload: Record<string, string>): Promise<void> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Secret": this.secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logger.warn(
          `[sync] Forward failed (${response.status}): ${text.slice(0, 200)}`,
        );
      } else {
        logger.debug(
          `[sync] Forwarded ${payload.state} for ${payload.username}`,
        );
      }
    } catch (error) {
      logger.warn(
        `[sync] Forward error for ${payload.username}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
