import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp } from "@/services/playtime/config";
import type { Request, Response } from "express";
import {
  replaceForceloadState,
  type ChunkPayload,
  type ForceloadSyncPayload,
  type PartyPayload,
  type PlayerPayload,
} from "./forceloads.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseChunk(raw: unknown, context: string): ChunkPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`${context}: chunk must be an object`);
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.dimension !== "string" || c.dimension.length === 0) {
    throw new BadRequestError(`${context}: chunk.dimension must be a string`);
  }
  if (typeof c.x !== "number" || !Number.isInteger(c.x)) {
    throw new BadRequestError(`${context}: chunk.x must be an integer`);
  }
  if (typeof c.z !== "number" || !Number.isInteger(c.z)) {
    throw new BadRequestError(`${context}: chunk.z must be an integer`);
  }
  if (typeof c.active !== "boolean") {
    throw new BadRequestError(`${context}: chunk.active must be a boolean`);
  }
  return { dimension: c.dimension, x: c.x, z: c.z, active: c.active };
}

function parsePlayer(raw: unknown, index: number): PlayerPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`players[${index}] must be an object`);
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.uuid !== "string" || !UUID_REGEX.test(p.uuid)) {
    throw new BadRequestError(`players[${index}].uuid must be a valid UUID`);
  }
  if (!Array.isArray(p.chunks)) {
    throw new BadRequestError(`players[${index}].chunks must be an array`);
  }
  return {
    uuid: p.uuid,
    chunks: p.chunks.map((c, i) =>
      parseChunk(c, `players[${index}].chunks[${i}]`),
    ),
  };
}

function parseParty(raw: unknown, index: number): PartyPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`parties[${index}] must be an object`);
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.partyId !== "string" || !UUID_REGEX.test(p.partyId)) {
    throw new BadRequestError(`parties[${index}].partyId must be a valid UUID`);
  }
  if (typeof p.partyName !== "string") {
    throw new BadRequestError(`parties[${index}].partyName must be a string`);
  }
  if (typeof p.memberCount !== "number" || !Number.isInteger(p.memberCount)) {
    throw new BadRequestError(
      `parties[${index}].memberCount must be an integer`,
    );
  }
  if (typeof p.optedIn !== "boolean") {
    throw new BadRequestError(`parties[${index}].optedIn must be a boolean`);
  }
  if (!Array.isArray(p.members)) {
    throw new BadRequestError(`parties[${index}].members must be an array`);
  }
  if (!Array.isArray(p.chunks)) {
    throw new BadRequestError(`parties[${index}].chunks must be an array`);
  }

  const members = p.members.map((m, i) => {
    if (!m || typeof m !== "object") {
      throw new BadRequestError(
        `parties[${index}].members[${i}] must be an object`,
      );
    }
    const uuid = (m as Record<string, unknown>).uuid;
    if (typeof uuid !== "string" || !UUID_REGEX.test(uuid)) {
      throw new BadRequestError(
        `parties[${index}].members[${i}].uuid must be a valid UUID`,
      );
    }
    return { uuid };
  });

  return {
    partyId: p.partyId,
    partyName: p.partyName,
    memberCount: p.memberCount,
    optedIn: p.optedIn,
    members,
    chunks: p.chunks.map((c, i) =>
      parseChunk(c, `parties[${index}].chunks[${i}]`),
    ),
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
    logger.warn(`Forceload sync from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }
  return serverInfo.serverId;
}

/**
 * Forceloads Controller
 *
 * Handles full-state forceload sync payloads from the opac-teams mod. Each
 * request replaces the stored forceload state for the originating server.
 */
export class ForceloadsController {
  static async sync(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      throw new BadRequestError("Request body must be a JSON object");
    }
    if (!Array.isArray(body.players)) {
      throw new BadRequestError("players must be an array");
    }
    if (!Array.isArray(body.parties)) {
      throw new BadRequestError("parties must be an array");
    }

    const serverId = resolveServerId(req);
    const players = body.players.map((p, i) => parsePlayer(p, i));
    const parties = body.parties.map((p, i) => parseParty(p, i));

    const payload: ForceloadSyncPayload = { serverId, players, parties };

    try {
      await replaceForceloadState(payload);

      logger.info(
        `Forceload sync for server ${serverId}: ${players.length} solo player(s), ${parties.length} opted-in part${parties.length === 1 ? "y" : "ies"}`,
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to process forceload sync:", error);
      throw new InternalServerError(
        "Failed to process forceload sync. Please try again.",
      );
    }
  }
}
