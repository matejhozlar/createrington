import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp } from "@/services/playtime/config";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";
import type { Request, Response } from "express";
import {
  syncChunkState,
  type ChunkSyncPayload,
  type PlayerChunkData,
  type PlayerChunkEntry,
} from "./chunks.service";

const MAX_CHUNKS_PER_SYNC = 50_000;

function parseChunkEntry(
  raw: unknown,
  playerIndex: number,
  chunkIndex: number,
): PlayerChunkEntry {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}] must be an object`,
    );
  }
  const c = raw as Record<string, unknown>;

  if (typeof c.dimension !== "string" || c.dimension.length === 0) {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}].dimension must be a non-empty string`,
    );
  }
  if (typeof c.x !== "number" || !Number.isInteger(c.x)) {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}].x must be an integer`,
    );
  }
  if (typeof c.z !== "number" || !Number.isInteger(c.z)) {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}].z must be an integer`,
    );
  }
  if (typeof c.forceloadable !== "boolean") {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}].forceloadable must be a boolean`,
    );
  }
  if (typeof c.active !== "boolean") {
    throw new BadRequestError(
      `players[${playerIndex}].chunks[${chunkIndex}].active must be a boolean`,
    );
  }

  return {
    dimension: c.dimension,
    x: c.x,
    z: c.z,
    forceloadable: c.forceloadable,
    active: c.active,
  };
}

function parsePlayer(raw: unknown, index: number): PlayerChunkData {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`players[${index}] must be an object`);
  }
  const p = raw as Record<string, unknown>;

  if (typeof p.playerUuid !== "string" || !MC_UUID_REGEX.test(p.playerUuid)) {
    throw new BadRequestError(
      `players[${index}].playerUuid must be a valid UUID`,
    );
  }

  const partyId =
    p.partyId === null || p.partyId === undefined
      ? null
      : typeof p.partyId === "string" && MC_UUID_REGEX.test(p.partyId)
        ? p.partyId
        : (() => {
            throw new BadRequestError(
              `players[${index}].partyId must be a valid UUID or null`,
            );
          })();

  const partyName =
    p.partyName === null || p.partyName === undefined
      ? null
      : typeof p.partyName === "string"
        ? p.partyName
        : (() => {
            throw new BadRequestError(
              `players[${index}].partyName must be a string or null`,
            );
          })();

  const partyOptedIn =
    p.partyOptedIn === null || p.partyOptedIn === undefined
      ? null
      : typeof p.partyOptedIn === "boolean"
        ? p.partyOptedIn
        : (() => {
            throw new BadRequestError(
              `players[${index}].partyOptedIn must be a boolean or null`,
            );
          })();

  if (!Array.isArray(p.chunks)) {
    throw new BadRequestError(`players[${index}].chunks must be an array`);
  }

  const chunks = p.chunks.map((c, i) => parseChunkEntry(c, index, i));

  return {
    playerUuid: p.playerUuid,
    partyId,
    partyName,
    partyOptedIn,
    chunks,
  };
}

function resolveServerId(req: Request): number {
  const bodyServerId = (req.body as { serverId?: unknown })?.serverId;

  if (bodyServerId !== undefined && bodyServerId !== null) {
    const parsed =
      typeof bodyServerId === "number"
        ? bodyServerId
        : parseInt(String(bodyServerId), 10);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestError("Invalid serverId format");
    }
    return parsed;
  }

  const serverIp = req.serverIp;
  if (!serverIp) {
    throw new InternalServerError(
      "Server IP not detected - IP verification middleware may not be properly configured",
    );
  }

  const serverInfo = getServerByIp(serverIp);
  if (!serverInfo) {
    logger.warn(`Chunk sync from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }
  return serverInfo.serverId;
}

/**
 * Chunks Controller
 *
 * Handles full-state chunk sync payloads from the opac-teams mod. Each
 * request upserts all claimed chunks for the originating server using
 * mark-and-sweep to handle ownership transfers and chunk unclaims.
 *
 * Wire format is grouped by player so party context is sent once per
 * player. The service layer flattens to per-chunk rows before upsert.
 */
export class ChunksController {
  static async sync(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      throw new BadRequestError("Request body must be a JSON object");
    }
    if (!Array.isArray(body.players)) {
      throw new BadRequestError("players must be an array");
    }

    const serverId = resolveServerId(req);
    const players = body.players.map((p, i) => parsePlayer(p, i));

    const totalChunks = players.reduce((sum, p) => sum + p.chunks.length, 0);
    if (totalChunks > MAX_CHUNKS_PER_SYNC) {
      throw new BadRequestError(
        `total chunk count exceeds maximum size of ${MAX_CHUNKS_PER_SYNC}`,
      );
    }

    const payload: ChunkSyncPayload = { serverId, players };

    try {
      await syncChunkState(payload);

      logger.info(
        `Chunk sync for server ${serverId}: ${players.length} player(s), ${totalChunks} chunk(s)`,
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to process chunk sync:", error);
      throw new InternalServerError(
        "Failed to process chunk sync. Please try again.",
      );
    }
  }
}
