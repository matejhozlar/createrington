import { getValidated } from "@/app/middleware";
import type { Request, Response } from "express";
import { resolveServerId } from "../shared/resolve-server-id";
import { runSync } from "../shared/run-sync";
import type { PartySyncBody } from "./parties.schemas";
import { replacePartyState } from "./parties.service";

export class PartiesController {
  static async sync(req: Request, res: Response): Promise<void> {
    const {
      body: { parties },
    } = getValidated<{ body: PartySyncBody }>(res);
    const serverId = resolveServerId(req, "Party sync");

    await runSync("party sync", () => replacePartyState({ serverId, parties }));

    logger.info(
      `Party sync for server ${serverId}: ${parties.length} part${parties.length === 1 ? "y" : "ies"}`,
    );

    res.json({ success: true });
  }
}
