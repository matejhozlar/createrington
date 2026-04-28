import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp } from "@/services/playtime/config";
import type { Request, Response } from "express";
import {
  replaceAllyState,
  type AlliedPartyPayload,
  type AllyFakeMemberPayload,
  type AllyFakePartyPayload,
  type AllySyncPayload,
  type QualifiedPlayerPayload,
} from "./allies.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFakeMember(raw: unknown, index: number): AllyFakeMemberPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(
      `fakePlayerParty.members[${index}] must be an object`,
    );
  }
  const m = raw as Record<string, unknown>;
  if (typeof m.uuid !== "string" || !UUID_REGEX.test(m.uuid)) {
    throw new BadRequestError(
      `fakePlayerParty.members[${index}].uuid must be a valid UUID`,
    );
  }
  return { uuid: m.uuid };
}

function parseFakeParty(raw: unknown): AllyFakePartyPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError("fakePlayerParty must be an object");
  }
  const p = raw as Record<string, unknown>;
  if (typeof p.partyId !== "string" || !UUID_REGEX.test(p.partyId)) {
    throw new BadRequestError("fakePlayerParty.partyId must be a valid UUID");
  }
  if (typeof p.ownerUuid !== "string" || !UUID_REGEX.test(p.ownerUuid)) {
    throw new BadRequestError("fakePlayerParty.ownerUuid must be a valid UUID");
  }
  if (typeof p.ownerName !== "string" || p.ownerName.length === 0) {
    throw new BadRequestError(
      "fakePlayerParty.ownerName must be a non-empty string",
    );
  }
  if (!Array.isArray(p.members)) {
    throw new BadRequestError("fakePlayerParty.members must be an array");
  }
  return {
    partyId: p.partyId,
    ownerUuid: p.ownerUuid,
    ownerName: p.ownerName,
    members: p.members.map((m, i) => parseFakeMember(m, i)),
  };
}

function parseAlliedParty(raw: unknown, index: number): AlliedPartyPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`allies[${index}] must be an object`);
  }
  const a = raw as Record<string, unknown>;
  if (typeof a.partyId !== "string" || !UUID_REGEX.test(a.partyId)) {
    throw new BadRequestError(`allies[${index}].partyId must be a valid UUID`);
  }
  if (typeof a.alliedAt !== "number" || !Number.isFinite(a.alliedAt)) {
    throw new BadRequestError(`allies[${index}].alliedAt must be a number`);
  }
  return { partyId: a.partyId, alliedAt: a.alliedAt };
}

function parseQualifiedPlayer(
  raw: unknown,
  field: "qualified" | "pending",
  index: number,
): QualifiedPlayerPayload {
  if (!raw || typeof raw !== "object") {
    throw new BadRequestError(`${field}[${index}] must be an object`);
  }
  const q = raw as Record<string, unknown>;
  if (typeof q.uuid !== "string" || !UUID_REGEX.test(q.uuid)) {
    throw new BadRequestError(`${field}[${index}].uuid must be a valid UUID`);
  }
  if (typeof q.qualifiedAt !== "number" || !Number.isFinite(q.qualifiedAt)) {
    throw new BadRequestError(
      `${field}[${index}].qualifiedAt must be a number`,
    );
  }
  return { uuid: q.uuid, qualifiedAt: q.qualifiedAt };
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
    logger.warn(`Ally sync from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }
  return serverInfo.serverId;
}

/**
 * Allies Controller
 *
 * Handles full-state ally sync payloads from the opac-fakeplayer mod. Each
 * request replaces the stored ally state for the originating server.
 */
export class AlliesController {
  static async sync(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      throw new BadRequestError("Request body must be a JSON object");
    }
    if (!Array.isArray(body.allies)) {
      throw new BadRequestError("allies must be an array");
    }
    if (!Array.isArray(body.qualified)) {
      throw new BadRequestError("qualified must be an array");
    }
    if (!Array.isArray(body.pending)) {
      throw new BadRequestError("pending must be an array");
    }

    const serverId = resolveServerId(req);
    const fakePlayerParty = parseFakeParty(body.fakePlayerParty);
    const allies = body.allies.map((a, i) => parseAlliedParty(a, i));
    const qualified = body.qualified.map((q, i) =>
      parseQualifiedPlayer(q, "qualified", i),
    );
    const pending = body.pending.map((p, i) =>
      parseQualifiedPlayer(p, "pending", i),
    );

    const payload: AllySyncPayload = {
      serverId,
      fakePlayerParty,
      allies,
      qualified,
      pending,
    };

    try {
      await replaceAllyState(payload);

      logger.info(
        `Ally sync for server ${serverId}: ${allies.length} allied part${allies.length === 1 ? "y" : "ies"}, ${qualified.length} qualified, ${pending.length} pending`,
      );

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to process ally sync:", error);
      throw new InternalServerError(
        "Failed to process ally sync. Please try again.",
      );
    }
  }
}
