import { MC_UUID_REGEX } from "@/utils/zod-schemas";
import { z } from "zod";

const uuidSchema = z.string().regex(MC_UUID_REGEX, "Invalid UUID");
const playerNameSchema = z.string().min(1).max(32);

export const TrainCrashBodySchema = z.object({
  trainId: z.string().min(1).max(100),
  trainName: z.string().min(1).max(100),
  speed: z.number().finite().optional(),
  carriageCount: z.number().int().nonnegative().optional(),
  position: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      z: z.number().finite(),
    })
    .nullable()
    .optional(),
  dimension: z.string().max(100).optional(),
  timestamp: z.number().int().nonnegative().optional(),
  owner: uuidSchema.optional(),
  driverUuid: uuidSchema.optional(),
  passengers: z
    .array(
      z.object({
        uuid: uuidSchema,
        name: playerNameSchema.optional(),
        isDriver: z.boolean(),
      }),
    )
    .max(64)
    .optional(),
  backwardsDriver: z
    .object({ uuid: uuidSchema, name: playerNameSchema.optional() })
    .optional(),
});

export type TrainCrashBody = z.infer<typeof TrainCrashBodySchema>;
