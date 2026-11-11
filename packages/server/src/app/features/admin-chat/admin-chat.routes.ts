import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { z } from "zod";
import {
  asyncHandler,
  authenticate,
  requireAdmin,
  BadRequestError,
  InternalServerError,
} from "@/app/middleware";
import { env, envMode } from "@/config/env/env.config";
import {
  describeHttpError,
  fetchJson,
  HttpStatusError,
  readBody,
  withQuery,
} from "@/utils/http";

/**
 * Admin chat proxy routes. Forwards to claude-automation's chat endpoints
 * with the shared secret so the widget never ships the secret to browsers.
 *
 * Identity is taken from the authenticated JWT (requireAdmin enforces admin),
 * so widget payloads don't need to carry `username` / `repo` / `environment`.
 */
const router = Router();

const REPO = "Createrington/app";
// Both deployments run with NODE_ENV=production. Dev vs prod is determined
// by the WEBSITE_URL (dev.* subdomain or localhost) via envMode.isDevDeployment.
const ENVIRONMENT = envMode.isDevDeployment ? "dev" : "prod";

// Upstream LLM calls can hang on network glitches, cap every outbound
// request so a stuck claude-automation can't pile up Express connections.
const UPSTREAM_TIMEOUT_MS = 30000;

const pageContextValueSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
]);
const pageContextSchema = z
  .record(z.string().max(100), pageContextValueSchema)
  .refine((val) => Object.keys(val).length <= 50, {
    message: "pageContext may contain at most 50 keys",
  });

// Models the admin can pin a chat session to, must stay in sync with the
// claude-automation allowlist in `chat.routes.ts`.
const ADMIN_CHAT_MODELS = ["claude-opus-5-5"] as const;

const startBodySchema = z.object({
  pageContext: pageContextSchema.optional(),
  model: z.enum(ADMIN_CHAT_MODELS).optional(),
});

const sendBodySchema = z.object({
  sessionId: z.number().int(),
  message: z.string().min(1).max(10_000),
  pageContext: pageContextSchema.optional(),
});

function claudeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.ADMIN_CHAT_SECRET) {
    headers["X-Admin-Chat-Secret"] = env.ADMIN_CHAT_SECRET;
  }
  return headers;
}

function claudeGet(url: string): Promise<unknown> {
  return fetchJson(url, {
    headers: claudeHeaders(),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

function claudePost(url: string, body: object): Promise<unknown> {
  return fetchJson(url, {
    method: "POST",
    headers: claudeHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requireUpstream(res: Response): string | null {
  if (!env.CLAUDE_API_URL) {
    res.status(503).json({ error: "admin chat not configured" });
    return null;
  }
  return env.CLAUDE_API_URL;
}

function adminUsername(req: Request): string {
  // requireAdmin guarantees req.user exists and is admin.
  return req.user!.minecraftUsername;
}

/**
 * Forward an upstream error response verbatim so the widget sees the real
 * status + body (e.g. 403 when the kill switch is off). Anything else
 * (network failure, timeout) bubbles up to the app-wide error handler.
 */
function forwardUpstreamError(err: unknown, res: Response): void {
  if (err instanceof HttpStatusError) {
    res.status(err.status).json(err.body ?? { error: err.message });
    return;
  }
  throw new InternalServerError("Upstream chat request failed");
}

router.get(
  "/enabled",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    try {
      res.json(
        await claudeGet(
          withQuery(`${base}/api/chat/enabled`, {
            repo: REPO,
            environment: ENVIRONMENT,
          }),
        ),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.get(
  "/repos",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (_req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    try {
      res.json(await claudeGet(`${base}/api/chat/repos`));
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.get(
  "/session",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    try {
      res.json(
        await claudeGet(
          withQuery(`${base}/api/chat/session`, {
            username: adminUsername(req),
            environment: ENVIRONMENT,
          }),
        ),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.get(
  "/sessions",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    try {
      res.json(
        await claudeGet(
          withQuery(`${base}/api/chat/sessions`, {
            username: adminUsername(req),
            environment: ENVIRONMENT,
            limit: queryString(req.query.limit),
            cursor: queryString(req.query.cursor),
          }),
        ),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.get(
  "/messages",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    const sessionId = queryString(req.query.sessionId);
    if (!sessionId) {
      throw new BadRequestError("sessionId is required");
    }
    try {
      res.json(
        await claudeGet(
          withQuery(`${base}/api/chat/messages`, {
            username: adminUsername(req),
            sessionId,
            afterId: queryString(req.query.afterId),
          }),
        ),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.post(
  "/start",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    const parsed = startBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new BadRequestError("Invalid start payload");
    }
    const { pageContext, model } = parsed.data;
    try {
      res.json(
        await claudePost(`${base}/api/chat/start`, {
          username: adminUsername(req),
          repo: REPO,
          environment: ENVIRONMENT,
          ...(pageContext !== undefined && { pageContext }),
          ...(model !== undefined && { model }),
        }),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.post(
  "/send",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    const parsed = sendBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new BadRequestError("sessionId and message are required");
    }
    const { sessionId, message, pageContext } = parsed.data;
    try {
      res.json(
        await claudePost(`${base}/api/chat/send`, {
          username: adminUsername(req),
          sessionId,
          message,
          ...(pageContext !== undefined && { pageContext }),
        }),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

router.post(
  "/end",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    const { sessionId } = (req.body ?? {}) as { sessionId?: number };
    if (typeof sessionId !== "number") {
      throw new BadRequestError("sessionId is required");
    }
    try {
      res.json(
        await claudePost(`${base}/api/chat/end`, {
          username: adminUsername(req),
          sessionId,
        }),
      );
    } catch (error) {
      forwardUpstreamError(error, res);
    }
  }),
);

/**
 * SSE passthrough to claude-automation's /api/chat/stream. The upstream
 * body is piped through so the widget sees events frame-by-frame.
 * The 30s UPSTREAM_TIMEOUT_MS of the other routes does not apply here: the
 * stream is long-lived, bounded by the upstream's 20s ping keeping it alive
 * plus the admin eventually closing the drawer.
 */
router.get(
  "/stream",
  asyncHandler(authenticate),
  asyncHandler(requireAdmin),
  asyncHandler(async (req: Request, res: Response) => {
    const base = requireUpstream(res);
    if (!base) return;
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== "string" || !sessionId) {
      throw new BadRequestError("sessionId is required");
    }

    // Hold off on sending SSE headers until the upstream connects: if
    // the upstream rejects (404 session not found, 401 bad secret, etc.)
    // we want to surface the real status to the browser, not a 200 with
    // no body.
    const upstream = await fetch(
      withQuery(`${base}/api/chat/stream`, {
        username: adminUsername(req),
        sessionId,
      }),
      { headers: claudeHeaders() },
    );
    if (!upstream.ok) {
      res
        .status(upstream.status)
        .json((await readBody(upstream)) ?? { error: "upstream error" });
      return;
    }
    if (!upstream.body) {
      throw new InternalServerError("Upstream chat request failed");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const stream = Readable.fromWeb(
      upstream.body as NodeReadableStream<Uint8Array>,
    );
    // If the upstream drops (restart, network blip) mid-stream, close our
    // side cleanly instead of leaving Express in an undefined state.
    stream.on("error", (err) => {
      logger.error(
        "[admin-chat] upstream stream error:",
        describeHttpError(err),
      );
      res.end();
    });
    stream.pipe(res);
    req.on("close", () => {
      stream.destroy();
    });
  }),
);

export default router;
