import { mcUsername, mcUuid } from "@/utils/zod-schemas";
import { z } from "zod";
import { dimensionId, syncList } from "../shared/sync-schemas";

const MAX_HEARTBEAT_PLAYERS = 1_000;

const playTimeTicks = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .catch(undefined);

export const PresenceBodySchema = z.object({
  minecraftUsername: mcUsername,
  uuid: mcUuid,
  state: z.enum(["joined", "left"]),
  timestamp: z.union([z.number(), z.string().max(64)]).nullish(),
  playTimeTicks,
  position: z
    .object({ x: z.number(), y: z.number(), z: z.number() })
    .optional()
    .catch(undefined),
  dimension: dimensionId.optional().catch(undefined),
});

export const HeartbeatBodySchema = z.object({
  players: syncList(
    z
      .object({
        uuid: mcUuid,
        minecraftUsername: mcUsername,
        playTimeTicks,
      })
      .nullable()
      .catch(null),
    MAX_HEARTBEAT_PLAYERS,
  ),
});

export type PresenceBody = z.infer<typeof PresenceBodySchema>;
export type HeartbeatBody = z.infer<typeof HeartbeatBodySchema>;
