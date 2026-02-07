import { route } from "@/app/middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { Router } from "express";
import { PlayerController } from "./player.controller";
import {
  GetPlayerParamsSchema,
  GetPlayersCountQuerySchema,
  GetPlayersQuerySchema,
} from "@createrington/shared/api/public/players";

const router = Router();

/**
 * Player Routes
 * Base path: /api/players
 */

/**
 * GET /api/players/count
 *
 * Get count of players matching optional filter criteria
 *
 * Query Parameters (all optional):
 * - online: Count only online players (true/false)
 * - currentServerId: Count players on specific server
 * - createdAfter: Count players created after date (ISO 8601)
 * - createdBefore: Count players created before date (ISO 8601)
 * - lastSeenAfter: Count players last seen after date (ISO 8601)
 *
 * Response: GetPlayersCountResponse
 */
router.get(
  "/count",
  ...route(
    "public",
    validate({ query: GetPlayersCountQuerySchema }),
    PlayerController.getCount,
  ),
);

/**
 * GET /api/players
 *
 * Get a list of players with filtering and pagination
 *
 * Query Parameters:
 * - discordId: Filter by Discord ID
 * - minecraftUuid: Filter by Minecraft UUID
 * - minecraftUsername: Filter by username (case-insensitive partial match)
 * - isActive: Filter by active status (true/false)
 * - page: Page number (0-indexed, default: 0)
 * - limit: Results per page (1-100, default: 20)
 * - orderBy: Field to sort by (createdAt, minecraftUsername, updatedAt)
 * - orderDirection: Sort direction (asc/desc, default: desc)
 *
 * Response: GetPlayersResponse
 */
router.get(
  "/",
  ...route(
    "public",
    validate({ query: GetPlayersQuerySchema }),
    PlayerController.getPlayers,
  ),
);

/**
 * GET /api/players/:id
 *
 * Get information about a specific player
 *
 * Path Parameters:
 * - id: Discord ID (17-20 digits), Minecraft UUID (UUID format), or Minecraft username
 *
 * Response: GetPlayerResponse
 * Errors: 400 (invalid ID format), 404 (player not found)
 */
router.get(
  "/:id",
  ...route(
    "public",
    validate({ params: GetPlayerParamsSchema }),
    PlayerController.getPlayer,
  ),
);

export default router;
