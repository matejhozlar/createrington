import { BadRequestError, InternalServerError } from "@/app/middleware";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import type { HeartbeatPlayer, PlaytimeService } from "@/services/playtime";
import { parsePlayTimeTicks } from "@/services/playtime/credit";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";
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
   * @param req - Express request with forwarded presence data
   * @param res - Express response
   */
  static async handleSyncedPresence(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { uuid, minecraftUsername: username, state, timestamp } = req.body;

    if (!uuid || !username || !state) {
      throw new BadRequestError(
        "uuid, minecraftUsername, and state are required",
      );
    }

    if (!["joined", "left"].includes(state)) {
      throw new BadRequestError('state must be either "joined" or "left"');
    }

    if (!MC_UUID_REGEX.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }

    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
    const playTimeTicks = parsePlayTimeTicks(req.body.playTimeTicks);

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
    req: Request,
    res: Response,
  ): Promise<void> {
    const { players } = req.body;

    if (!Array.isArray(players)) {
      throw new BadRequestError("players must be an array");
    }

    const onlinePlayers: HeartbeatPlayer[] = [];
    for (const p of players) {
      if (!p.uuid || !p.minecraftUsername) continue;
      if (!MC_UUID_REGEX.test(p.uuid)) continue;
      onlinePlayers.push({
        uuid: p.uuid,
        username: p.minecraftUsername,
        playTimeTicks: parsePlayTimeTicks(p.playTimeTicks),
      });
    }

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
