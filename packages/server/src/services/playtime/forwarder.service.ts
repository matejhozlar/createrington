import config from "@/config";
import type { PlaytimeService } from "./playtime.service";
import type {
  SessionStartEvent,
  SessionEndEvent,
  HeartbeatPlayer,
} from "./types";

/**
 * Playtime Forwarder Service
 *
 * Active only on the dev environment. Listens to PlaytimeService session
 * events and forwards them to the production server so that test-server
 * playtime is included in production totals.
 *
 * Also forwards heartbeat player lists so production can reconcile
 * sessions that were missed (e.g. after a prod restart).
 *
 * Forwarding is fire-and-forget: failures are logged but never block
 * the dev server's normal operation.
 */
export class PlaytimeForwarderService {
  private targetUrl: string;
  private secret: string;
  private endpoint: string;
  private heartbeatEndpoint: string;

  constructor(targetUrl: string, secret: string) {
    this.targetUrl = targetUrl;
    this.secret = secret;
    const base = targetUrl.replace(/\/+$/, "");
    this.endpoint = `${base}/api/internal/presence`;
    this.heartbeatEndpoint = `${base}/api/internal/presence/heartbeat`;
  }

  /** Subscribes to sessionStart and sessionEnd on the given service and forwards each event to production. */
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

  /** Posts the mod heartbeat player list to production so it can reconcile stale sessions on the test-server entry. */
  async forwardHeartbeat(players: HeartbeatPlayer[]): Promise<void> {
    try {
      const response = await fetch(this.heartbeatEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Secret": this.secret,
        },
        body: JSON.stringify({
          players: players.map((p) => ({
            uuid: p.uuid,
            minecraftUsername: p.username,
            playTimeTicks: p.playTimeTicks,
          })),
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logger.warn(
          `[sync] Heartbeat forward failed (${response.status}): ${text.slice(0, 200)}`,
        );
      } else {
        logger.debug(
          `[sync] Forwarded heartbeat with ${players.length} player(s)`,
        );
      }
    } catch (error) {
      logger.warn(
        "[sync] Heartbeat forward error:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async forwardJoin(event: SessionStartEvent): Promise<void> {
    await this.forward({
      uuid: event.uuid,
      minecraftUsername: event.username,
      state: "joined",
      timestamp: event.sessionStart.toISOString(),
      playTimeTicks: event.playTimeTicks,
    });
  }

  private async forwardLeave(event: SessionEndEvent): Promise<void> {
    await this.forward({
      uuid: event.uuid,
      minecraftUsername: event.username,
      state: "left",
      timestamp: event.sessionEnd.toISOString(),
      playTimeTicks: event.playTimeTicks,
    });
  }

  private async forward(
    payload: Record<string, string | number | undefined>,
  ): Promise<void> {
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
          `[sync] Forwarded ${payload.state} for ${payload.minecraftUsername}`,
        );
      }
    } catch (error) {
      logger.warn(
        `[sync] Forward error for ${payload.minecraftUsername}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

let forwarder: PlaytimeForwarderService | null | undefined;

/** The process-wide forwarder when PLAYTIME_SYNC_TARGET_URL and PLAYTIME_SYNC_SECRET are set, otherwise null. */
export function getPlaytimeForwarder(): PlaytimeForwarderService | null {
  if (forwarder === undefined) {
    forwarder =
      config.sync.targetUrl && config.sync.secret
        ? new PlaytimeForwarderService(
            config.sync.targetUrl,
            config.sync.secret,
          )
        : null;
    if (forwarder) {
      logger.info(`Playtime forwarder active → ${config.sync.targetUrl}`);
    }
  }
  return forwarder;
}
