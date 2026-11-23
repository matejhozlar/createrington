import { z } from "zod";
import { MC_USERNAME_REGEX } from "@/utils/zod-schemas";

export const VerifyBodySchema = z.object({
  username: z.string().regex(MC_USERNAME_REGEX, "Invalid username"),
  serverId: z.string().regex(/^[0-9a-f]{40}$/, "Invalid serverId"),
});

export const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().regex(/^[0-9a-f]{80}$/, "Invalid refresh token"),
});

export type VerifyBody = z.infer<typeof VerifyBodySchema>;
export type RefreshTokenBody = z.infer<typeof RefreshTokenBodySchema>;
