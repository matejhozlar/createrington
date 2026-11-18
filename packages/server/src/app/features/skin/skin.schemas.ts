import { z } from "zod";
import { KNOWN_POSES } from "createrington-skin-api";
import {
  AVATAR_DEFAULT_SIZE,
  AVATAR_MAX_SIZE,
  AVATAR_MIN_SIZE,
} from "@/services/skin-api/avatar.service";

const SIZE_MESSAGE = `size must be an integer between ${AVATAR_MIN_SIZE} and ${AVATAR_MAX_SIZE}`;

const playerParam = z.string().min(1);

export const AvatarParamsSchema = z.object({ player: playerParam });

export const AvatarQuerySchema = z.object({
  size: z.coerce
    .number({ error: SIZE_MESSAGE })
    .int(SIZE_MESSAGE)
    .min(AVATAR_MIN_SIZE, SIZE_MESSAGE)
    .max(AVATAR_MAX_SIZE, SIZE_MESSAGE)
    .default(AVATAR_DEFAULT_SIZE),
});

export const PoseParamsSchema = z.object({
  player: playerParam,
  pose: z.enum(KNOWN_POSES, { error: "Unknown pose" }),
});

export type AvatarParams = z.infer<typeof AvatarParamsSchema>;
export type AvatarQuery = z.infer<typeof AvatarQuerySchema>;
export type PoseParams = z.infer<typeof PoseParamsSchema>;
