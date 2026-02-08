import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, userProcedure } from "../../trpc";
import { jwtService } from "@/services/auth/jwt";
import {
  discordOAuth,
  AuthRole,
} from "@/services/discord/oauth/oauth.service";

export const authRouter = router({
  getDiscordUrl: publicProcedure.query(() => {
    const state = Math.random().toString(36).substring(7);
    const url = discordOAuth.generateAuthUrl(state);

    return { url, state };
  }),

  discordCallback: publicProcedure
    .input(
      z.object({
        code: z.string().min(1, "Authorization code is required"),
        state: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const user = await discordOAuth.authenticate(input.code);

        if (user.role === AuthRole.UNVERIFIED) {
          logger.warn(
            `Unverified user ${user.username} (${user.discordId}) attempted to login`,
          );
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "You are not registered. Please contact an administrator.",
          });
        }

        const token = jwtService.generate(user);

        logger.info(
          `User ${user.username} (${user.discordId}) logged in successfully`,
        );

        return {
          token,
          user: {
            discordId: user.discordId,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            isAdmin: user.isAdmin,
            minecraftUuid: user.minecraftUuid,
            minecraftName: user.minecraftUsername,
          },
        };
      } catch (error) {
        logger.error("Discord OAuth callback failed:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication failed",
        });
      }
    }),

  refreshToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "Token is required"),
      }),
    )
    .mutation(({ input }) => {
      try {
        const newToken = jwtService.refresh(input.token);
        return { token: newToken };
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to refresh token",
        });
      }
    }),

  me: userProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),

  logout: userProcedure.mutation(({ ctx }) => {
    logger.info(`User ${ctx.user.username} logged out`);
    return { success: true };
  }),

  status: publicProcedure.query(({ ctx }) => {
    return {
      authenticated: !!ctx.user,
      user: ctx.user ?? null,
    };
  }),
});
