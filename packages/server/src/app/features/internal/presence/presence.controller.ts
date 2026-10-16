import {
  BadRequestError,
  getValidated,
  InternalServerError,
} from "@/app/middleware";
import type {
  HeartbeatBody,
  PresenceBody,
} from "@/app/features/mod/presence/presence.schemas";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import type { HeartbeatPlayer, PlaytimeService } from "@/services/playtime";
import { parseEventTimestamp } from "@/services/playtime/credit";
import type { Request, Response } from "express";

const TEST_SERVER_NAME = "Rails 'n Sails (Test)";
const TEST_SERVER_IDENTIFIER = "rails-test";

/** Cached test server ID to avoid repeated DB lookups */
let testServerIdCache: number | null = null;

/**
 * Ensures the test server entry exists in the database and returns its ID.
 *
 * On first call, looks up or creates a server row with identifier "rails-test".
 * The result is cached for the lifetime of the process.
 */
async function ensureTestServer(): Promise<number> {
  if (testServerIdCache !== null) return testServerIdCache;

  const existing = await Q.server.find({ identifier: TEST_SERVER_IDENTIFIER });
  if (existing) {
    testServerIdCache = existing.id;
    return existing.id;
  }

  const created = await Q.server.createAndReturn({
    name: TEST_SERVER_NAME,
    identifier: TEST_SERVER_IDENTIFIER,
  });

  testServerIdCache = created.id;
  logger.info(
    `Created test server entry: "${TEST_SERVER_NAME}" (ID: ${created.id})`,
  );

  return created.id;
}

async function testServerPlaytime(): Promise<{
  serverId: number;
  service: PlaytimeService;
}> {
  const serverId = await ensureTestServer();
  const playtimeManager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
  const service = await playtimeManager.ensureService(serverId);
  return { serverId, service };
}

/**
 * Internal Presence Controller
 *
 * Handles forwarded player join/leave events and heartbeats from the dev
 * environment. They are fed to the test server's PlaytimeService, the same
 * tracker the mod endpoints use, so sessions are recorded under the test
 * server entry and appear separately from production playtime while still
 * contributing to totals.
 */
export class InternalPresenceController {
  /**
   * Processes a forwarded presence event from the dev server.
   *
   * @param res - Express response carrying the validated presence data
   */
  static async handleSyncedPresence(
    _req: Request,
    res: Response,
  ): Promise<void> {
    const {
      body: {
        uuid,
        minecraftUsername: username,
        state,
        timestamp,
        playTimeTicks,
      },
    } = getValidated<{ body: PresenceBody }>(res);

    const eventTimestamp = parseEventTimestamp(timestamp);
    if (!eventTimestamp) {
      throw new BadRequestError("Invalid timestamp");
    }

    try {
      const { serverId, service } = await testServerPlaytime();

      if (state === "joined") {
        await service.handlePlayerJoinFromMod({
          uuid,
          username,
          timestamp: eventTimestamp,
          playTimeTicks,
        });

        logger.info(
          `[sync] Session started for ${username} (${uuid}) on test server`,
        );
      } else {
        await service.handlePlayerLeaveFromMod({
          uuid,
          username,
          timestamp: eventTimestamp,
          playTimeTicks,
        });

        logger.info(
          `[sync] Session ended for ${username} (${uuid}) on test server`,
        );
      }

      res.json({
        success: true,
        message: "Synced presence processed",
        data: {
          minecraftUsername: username,
          uuid,
          state,
          serverId,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("[sync] Failed to process synced presence:", error);
      throw new InternalServerError(
        "Failed to process synced presence update.",
      );
    }
  }

  /**
   * Processes a forwarded heartbeat from the dev server: reconciles the test
   * server's tracked sessions against the reported online roster.
   */
  static async handleSyncedHeartbeat(
    _req: Request,
    res: Response,
  ): Promise<void> {
    const {
      body: { players },
    } = getValidated<{ body: HeartbeatBody }>(res);
    const onlinePlayers: HeartbeatPlayer[] = players
      .filter((p) => p !== null)
      .map((p) => ({
        uuid: p.uuid,
        username: p.minecraftUsername,
        playTimeTicks: p.playTimeTicks,
      }));

    try {
      const { service } = await testServerPlaytime();
      const { ended, started } = service.reconcileWithHeartbeat(onlinePlayers);

      logger.info(
        `[sync] Heartbeat reconciled: ${ended} ended, ${started} started, ${onlinePlayers.length} reported online`,
      );

      res.json({
        success: true,
        message: "Heartbeat reconciled",
        data: {
          playersReported: onlinePlayers.length,
          sessionsEnded: ended,
          sessionsStarted: started,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("[sync] Failed to process synced heartbeat:", error);
      throw new InternalServerError("Failed to process synced heartbeat.");
    }
  }
}
