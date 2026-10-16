import { getValidated } from "@/app/middleware";
import { resolveServerId } from "../shared/resolve-server-id";
import { runSync } from "../shared/run-sync";
import type { Request, Response } from "express";
import type { ChunkSyncBody } from "./chunks.schemas";
import { syncChunkState } from "./chunks.service";

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
    const {
      body: { players },
    } = getValidated<{ body: ChunkSyncBody }>(res);
    const serverId = resolveServerId(req, "Chunk sync");
    const totalChunks = players.reduce((sum, p) => sum + p.chunks.length, 0);

    await runSync("chunk sync", () => syncChunkState({ serverId, players }));

    logger.info(
      `Chunk sync for server ${serverId}: ${players.length} player(s), ${totalChunks} chunk(s)`,
    );

    res.json({ success: true });
  }
}
