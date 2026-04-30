import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp } from "@/services/playtime/config";
import type { Request, Response } from "express";
import {
  syncChunkState,
  type ChunkPayload,
  type ChunkSyncPayload,
} from "./chunks.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CHUNKS_PER_SYNC = 50_000;

function parseChunk(raw: unknown, index: number): ChunkPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`chunks[${index}] must be an object`);
  }
  const c = raw as Record<string, unknown>;

  if (typeof c.playerUuid !== "string" || !UUID_REGEX.test(c.playerUuid)) {
    throw new BadRequestError(
      `chunks[${index}].playerUuid must be a valid UUID`,
    );
  }
  if (typeof c.dimension !== "string" || c.dimension.length === 0) {
    throw new BadRequestError(
      `chunks[${index}].dimension must be a non-empty string`,
    );
  }
  if (typeof c.x !== "number" || !Number.isInteger(c.x)) {
    throw new BadRequestError(`chunks[${index}].x must be an integer`);
  }
  if (typeof c.z !== "number" || !Number.isInteger(c.z)) {
    throw new BadRequestError(`chunks[${index}].z must be an integer`);
  }
  if (typeof c.forceloadable !== "boolean") {
    throw new BadRequestError(
      `chunks[${index}].forceloadable must be a boolean`,
    );
  }
  if (typeof c.active !== "boolean") {
    throw new BadRequestError(`chunks[${index}].active must be a boolean`);
  }

  // Optional party fields
  const partyId =
    c.partyId === null || c.partyId === undefined
      ? null
      : typeof c.partyId === "string" && UUID_REGEX.test(c.partyId)
        ? c.partyId
        : (() => {
            throw new BadRequestError(
              `chunks[${index}].partyId must be a valid UUID or null`,
            );
          })();

  const partyName =
    c.partyName === null || c.partyName === undefined
      ? null
      : typeof c.partyName === "string"
        ? c.partyName
        : (() => {
            throw new BadRequestError(
              `chunks[${index}].partyName must be a string or null`,
            );
          })();

  const partyOptedIn =
    c.partyOptedIn === null || c.partyOptedIn === undefined
      ? null
      : typeof c.partyOptedIn === "boolean"
        ? c.partyOptedIn
        : (() => {
            throw new BadRequestError(
              `chunks[${index}].partyOptedIn must be a boolean or null`,
            );
          })();

  return {
    playerUuid: c.playerUuid,
    dimension: c.dimension,
    x: c.x,
    z: c.z,
    partyId,
    partyName,
    partyOptedIn,
    forceloadable: c.forceloadable,
    active: c.active,
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
 */
export class ChunksController {
  static async sync(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      throw new BadRequestError("Request body must be a JSON object");
    }
    if (!Array.isArray(body.chunks)) {
      throw new BadRequestError("chunks must be an array");
    }
    if (body.chunks.length > MAX_CHUNKS_PER_SYNC) {
      throw new BadRequestError(
        `chunks array exceeds maximum size of ${MAX_CHUNKS_PER_SYNC}`,
      );
    }

    const serverId = resolveServerId(req);
    const chunks = body.chunks.map((c, i) => parseChunk(c, i));

    const payload: ChunkSyncPayload = { serverId, chunks };

    try {
      await syncChunkState(payload);

      logger.info(
        `Chunk sync for server ${serverId}: ${chunks.length} chunk(s)`,
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
