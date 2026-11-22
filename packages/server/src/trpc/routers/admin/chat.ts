import { z } from "zod";
import { ADMIN_CHAT_MODELS } from "@createrington/shared/admin-chat";
import { adminChatClient } from "@/services/claude-automation/admin-chat-client";
import { adminProcedure, router } from "@/trpc/trpc";
import { id } from "@/trpc/utils";

const pageContext = z
  .record(
    z.string().max(100),
    z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
  )
  .refine((value) => Object.keys(value).length <= 50, {
    message: "pageContext may contain at most 50 keys",
  });

const sessionInput = z.object({ sessionId: id() });

const sessionsRouter = router({
  current: adminProcedure
    .meta({
      description:
        "The caller's running assistant session, else their most recent finished one",
    })
    .query(({ ctx }) =>
      adminChatClient.currentSession(ctx.user.minecraftUsername),
    ),

  list: adminProcedure
    .meta({
      description:
        "The caller's finished assistant sessions, newest first, paged by cursor",
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        cursor: id().nullish(),
      }),
    )
    .query(({ ctx, input }) =>
      adminChatClient.sessions(ctx.user.minecraftUsername, {
        limit: input.limit,
        cursor: input.cursor ?? undefined,
      }),
    ),

  start: adminProcedure
    .meta({
      description:
        "Start an assistant session for the caller, or rejoin their running one",
    })
    .input(
      z.object({
        pageContext: pageContext.optional(),
        model: z.enum(ADMIN_CHAT_MODELS).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      adminChatClient.start(ctx.user.minecraftUsername, input),
    ),

  end: adminProcedure
    .meta({ description: "End the caller's running assistant session" })
    .input(sessionInput)
    .mutation(({ ctx, input }) =>
      adminChatClient.end(ctx.user.minecraftUsername, input.sessionId),
    ),
});

const messagesRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Messages of one of the caller's assistant sessions and whether it is still running",
    })
    .input(sessionInput)
    .query(({ ctx, input }) =>
      adminChatClient.messages(ctx.user.minecraftUsername, input.sessionId),
    ),

  send: adminProcedure
    .meta({
      description:
        "Send a message into the caller's running assistant session; the reply arrives on the stream",
    })
    .input(
      sessionInput.extend({
        message: z.string().min(1).max(10_000),
        pageContext: pageContext.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      adminChatClient.send(ctx.user.minecraftUsername, input),
    ),
});

export const adminChatRouter = router({
  enabled: adminProcedure
    .meta({
      description:
        "Whether the admin assistant is configured and enabled for this app and environment",
    })
    .query(() => adminChatClient.enabled()),

  repos: adminProcedure
    .meta({
      description:
        "Createrington repositories offered by the assistant's @-mention autocomplete",
    })
    .query(() => adminChatClient.repos()),

  sessions: sessionsRouter,
  messages: messagesRouter,
});
