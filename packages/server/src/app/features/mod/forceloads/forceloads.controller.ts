import { getValidated, InternalServerError } from "@/app/middleware";
import { resolveServerId } from "../shared/resolve-server-id";
import type { Request, Response } from "express";
import type { ForceloadSyncBody } from "./forceloads.schemas";
import { replaceForceloadState } from "./forceloads.service";

/**
 * Forceloads Controller
 *
 * Handles full-state forceload sync payloads from the opac-teams mod. Each
 * request replaces the stored forceload state for the originating server.
 */
export class ForceloadsController {
  static async sync(req: Request, res: Response): Promise<void> {
    const {
      body: { players, parties },
    } = getValidated<{ body: ForceloadSyncBody }>(res);
    const serverId = resolveServerId(req, "Forceload sync");

    try {
      await replaceForceloadState({ serverId, players, parties });

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
