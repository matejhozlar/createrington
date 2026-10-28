import { mcUuid } from "@/utils/zod-schemas";
import { z } from "zod";
import {
  chunkCoordinate,
  dimensionId,
  MAX_SYNC_CHUNKS,
  syncList,
  syncName,
} from "../shared/sync-schemas";

const ForceloadChunksSchema = syncList(
  z.object({
    dimension: dimensionId,
    x: chunkCoordinate,
    z: chunkCoordinate,
    active: z.boolean(),
  }),
  MAX_SYNC_CHUNKS,
);

export const ForceloadSyncBodySchema = z
  .object({
    players: syncList(
      z.object({
        uuid: mcUuid,
        chunks: ForceloadChunksSchema,
      }),
    ),
    parties: syncList(
      z.object({
        partyId: mcUuid,
        partyName: syncName,
        memberCount: z.int32().nonnegative(),
        optedIn: z.boolean(),
        members: syncList(z.object({ uuid: mcUuid })),
        chunks: ForceloadChunksSchema,
      }),
    ),
  })
  .refine(
    ({ players, parties }) =>
      [...players, ...parties].reduce((sum, o) => sum + o.chunks.length, 0) <=
      MAX_SYNC_CHUNKS,
    {
      message: `total chunk count exceeds maximum size of ${MAX_SYNC_CHUNKS}`,
      path: ["players"],
    },
  );

export type ForceloadSyncBody = z.infer<typeof ForceloadSyncBodySchema>;
