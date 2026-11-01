import { getValidated } from "@/app/middleware";
import type { Request, Response } from "express";
import { resolveServerId } from "../shared/resolve-server-id";
import { runSync } from "../shared/run-sync";
import type { PartyClaimsBody, PartySyncBody } from "./parties.schemas";
import {
  replacePartyClaims,
  replacePartyState,
  type PartyClaimsResult,
} from "./parties.service";

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

  static async claims(req: Request, res: Response): Promise<void> {
    const {
      body: { hash, dimensions },
    } = getValidated<{ body: PartyClaimsBody }>(res);
    const serverId = resolveServerId(req, "Party claims sync");

    let result: PartyClaimsResult = { stored: 0, changed: false };
    await runSync("party claims sync", async () => {
      result = await replacePartyClaims({ serverId, hash, dimensions });
    });

    logger.info(
      `Party claims sync for server ${serverId}: ${result.stored} chunk${result.stored === 1 ? "" : "s"} ${result.changed ? "stored" : "unchanged"}`,
    );

    res.json({ success: true, stored: result.stored });
  }
}
