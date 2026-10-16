import { getValidated, InternalServerError } from "@/app/middleware";
import { resolveServerId } from "../shared/resolve-server-id";
import type { Request, Response } from "express";
import type { AllySyncBody } from "./allies.schemas";
import { replaceAllyState } from "./allies.service";

/**
 * Allies Controller
 *
 * Handles full-state ally sync payloads from the opac-fakeplayer mod. Each
 * request replaces the stored ally state for the originating server.
 */
export class AlliesController {
  static async sync(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: AllySyncBody }>(res);
    const serverId = resolveServerId(req, "Ally sync");
    const { allies, qualified, pending } = body;

    try {
      await replaceAllyState({ serverId, ...body });

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
