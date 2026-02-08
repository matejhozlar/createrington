import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, userProcedure } from "../../trpc";
import { jwtService } from "@/services/auth/jwt";
import {
  discordOAuth,
  AuthRole,
} from "@/services/discord/oauth/oauth.service";

export const authRouter = router({
  getDiscordUrl: publicProcedure
    .meta({
      description:
        "Returns a Discord OAuth authorization URL and a CSRF state token. Redirect the user to the returned URL to start the login flow.",
    })
    .query(() => {
    const state = Math.random().toString(36).substring(7);
    const url = discordOAuth.generateAuthUrl(state);

    return { url, state };
  }),

  discordCallback: publicProcedure
    .meta({
      description:
        "Completes the Discord OAuth flow. Pass the authorization code received from Discord. Returns a JWT token and user profile on success. Throws UNAUTHORIZED if the user is not registered.",
    })
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
    .meta({
      description:
        "Refreshes an expired or near-expiry JWT. Pass the old token as input (not via Authorization header, since it may be expired). Returns a new token with a fresh 7-day expiry.",
    })
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

  me: userProcedure
    .meta({
      description:
        "Returns the current authenticated user's profile from the JWT. Requires a valid Bearer token. Use this to hydrate user state on page load.",
    })
    .query(({ ctx }) => {
    return { user: ctx.user };
  }),

  logout: userProcedure
    .meta({
      description:
        "Logs out the current user. Server-side this is a no-op (logs the event); the client should delete the stored token from localStorage.",
    })
    .mutation(({ ctx }) => {
    logger.info(`User ${ctx.user.username} logged out`);
    return { success: true };
  }),

  status: publicProcedure
    .meta({
      description:
        "Checks if the current request is authenticated. Returns `{ authenticated: boolean, user }`. Works with or without a token — unauthenticated requests get `{ authenticated: false, user: null }`.",
    })
    .query(({ ctx }) => {
    return {
      authenticated: !!ctx.user,
      user: ctx.user ?? null,
    };
  }),
});
