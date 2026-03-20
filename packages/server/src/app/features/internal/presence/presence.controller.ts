import { BadRequestError, InternalServerError } from "@/app/middleware";
import { playtimeRepo, Q } from "@/db";
import type { Request, Response } from "express";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEST_SERVER_NAME = "Cogs & Steam (Test)";
const TEST_SERVER_IDENTIFIER = "cogs-test";

/** Cached test server ID to avoid repeated DB lookups */
let testServerIdCache: number | null = null;

/**
 * Ensures the test server entry exists in the database and returns its ID.
 *
 * On first call, looks up or creates a server row with identifier "cogs-test".
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
    const { uuid, username, state, timestamp } = req.body;

    if (!uuid || !username || !state) {
      throw new BadRequestError("uuid, username, and state are required");
    }

    if (!["joined", "left"].includes(state)) {
      throw new BadRequestError('state must be either "joined" or "left"');
    }

    if (!UUID_REGEX.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }

    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();

    try {
      const testServerId = await ensureTestServer();

      if (state === "joined") {
        const sessionId = await playtimeRepo.startSession({
          uuid,
          username,
          serverId: testServerId,
          sessionStart: eventTimestamp,
        });

        logger.info(
          `[sync] Session started for ${username} (${uuid}) on test server - ID: ${sessionId}`,
        );
      } else {
        // Use sessionId: 0 (orphaned mode) to find and close all active
        // sessions for this player on the test server
        await playtimeRepo.endSession({
          sessionId: 0,
          uuid,
          username,
          serverId: testServerId,
          sessionStart: eventTimestamp,
          sessionEnd: eventTimestamp,
          secondsPlayed: 0,
        });

        logger.info(
          `[sync] Session ended for ${username} (${uuid}) on test server`,
        );
      }

      res.json({
        success: true,
        message: "Synced presence processed",
        data: {
          username,
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
}
