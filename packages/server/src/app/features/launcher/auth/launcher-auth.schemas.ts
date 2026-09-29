import { z } from "zod";

export const VerifyBodySchema = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{1,16}$/, "Invalid username"),
  serverId: z.string().regex(/^[0-9a-f]{40}$/, "Invalid serverId"),
});

export const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().regex(/^[0-9a-f]{80}$/, "Invalid refresh token"),
});

export type VerifyBody = z.infer<typeof VerifyBodySchema>;
export type RefreshTokenBody = z.infer<typeof RefreshTokenBodySchema>;
