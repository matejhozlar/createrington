import { mcUuid } from "@/utils/zod-schemas";
import { z } from "zod";
import {
  chunkCoordinate,
  dimensionId,
  MAX_SYNC_CHUNKS,
  syncList,
  syncName,
} from "../shared/sync-schemas";

export const ChunkSyncBodySchema = z
  .object({
    players: syncList(
      z.object({
        playerUuid: mcUuid,
        partyId: mcUuid.nullable().default(null),
        partyName: syncName.nullable().default(null),
        partyOptedIn: z.boolean().nullable().default(null),
        chunks: syncList(
          z.object({
            dimension: dimensionId,
            x: chunkCoordinate,
            z: chunkCoordinate,
            forceloadable: z.boolean(),
            active: z.boolean(),
          }),
          MAX_SYNC_CHUNKS,
        ),
      }),
    ),
  })
  .refine(
    ({ players }) =>
      players.reduce((sum, p) => sum + p.chunks.length, 0) <= MAX_SYNC_CHUNKS,
    {
      message: `total chunk count exceeds maximum size of ${MAX_SYNC_CHUNKS}`,
      path: ["players"],
    },
  );

export type ChunkSyncBody = z.infer<typeof ChunkSyncBodySchema>;
