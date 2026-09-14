import { BadRequestError, InternalServerError } from "@/app/middleware";
import { playtimeRepo, Q } from "@/db";
import { computeCredit, parsePlayTimeTicks } from "@/services/playtime/credit";
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

/**
 * Internal Presence Controller
 *
 * Handles forwarded player join/leave events from the dev environment.
 * Sessions are recorded under the test server entry so they appear
 * separately from production playtime while still contributing to totals.
 */
export class InternalPresenceController {
  /**
   * Processes a forwarded presence event from the dev server.
   *
   * Validates the payload, ensures the test server entry exists,
   * and delegates to the PlaytimeRepository for session management.
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
      const testServerId = await ensureTestServer();

      if (state === "joined") {
        const sessionId = await playtimeRepo.startSession({
          uuid,
          username,
          serverId: testServerId,
          sessionStart: eventTimestamp,
          playTimeTicks,
        });

        logger.info(
          `[sync] Session started for ${username} (${uuid}) on test server - ID: ${sessionId}`,
        );
      } else {
        await playtimeRepo.endSession({
          sessionId: 0,
          uuid,
          username,
          serverId: testServerId,
          sessionStart: eventTimestamp,
          sessionEnd: eventTimestamp,
          secondsPlayed: 0,
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
          serverId: testServerId,
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
   * Processes a forwarded heartbeat from the dev server.
   *
   * Receives the full online player list from the dev test server and
   * reconciles sessions on the production test server entry: credits
   * present players, ends stale sessions at their last observation, and
   * starts missing ones.
   */
  static async handleSyncedHeartbeat(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { players } = req.body;

    if (!Array.isArray(players)) {
      throw new BadRequestError("players must be an array");
    }

    const onlinePlayers: Array<{
      uuid: string;
      username: string;
      playTimeTicks?: number;
    }> = [];
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
      const testServerId = await ensureTestServer();
      const now = new Date();

      const openSessions = await playtimeRepo.getOpenSessions(testServerId);
      const openUuids = new Set(openSessions.map((s) => s.playerMinecraftUuid));
      const present = new Map(onlinePlayers.map((p) => [p.uuid, p]));

      let ended = 0;
      let progressed = 0;
      for (const session of openSessions) {
        const player = present.get(session.playerMinecraftUuid);
        if (!player) {
          await playtimeRepo.endSession({
            sessionId: 0,
            uuid: session.playerMinecraftUuid,
            username: session.minecraftUsername,
            serverId: testServerId,
            sessionStart: session.sessionStart,
            sessionEnd: session.lastSeenAt ?? session.sessionStart,
            secondsPlayed: session.activeSeconds,
          });
          ended++;
          continue;
        }

        await playtimeRepo.progressSession({
          sessionId: session.id,
          uuid: session.playerMinecraftUuid,
          username: session.minecraftUsername,
          serverId: testServerId,
          credit: computeCredit({
            periodStart: session.lastSeenAt ?? session.sessionStart,
            periodEnd: now,
            lastPlayTicks: session.lastPlayTicks,
            playTimeTicks: player.playTimeTicks,
          }),
        });
        progressed++;
      }

      let started = 0;
      for (const player of onlinePlayers) {
        if (!openUuids.has(player.uuid)) {
          await playtimeRepo.startSession({
            uuid: player.uuid,
            username: player.username,
            serverId: testServerId,
            sessionStart: now,
            playTimeTicks: player.playTimeTicks,
          });
          started++;
        }
      }

      logger.info(
        `[sync] Heartbeat reconciled: ${ended} ended, ${progressed} progressed, ${started} started, ${onlinePlayers.length} reported online`,
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
