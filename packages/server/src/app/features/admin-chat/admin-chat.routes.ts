import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { z } from "zod";
import { asyncHandler, authenticate, requireAdmin } from "@/app/middleware";
import { BadRequestError, InternalServerError } from "@/errors";
import config from "@/config";
import {
  describeHttpError,
  fetchJson,
  HttpStatusError,
  readBody,
  withQuery,
} from "@/utils/http";

const router = Router();

const REPO = "Createrington/app";
const ENVIRONMENT = config.envMode.isDevDeployment ? "dev" : "prod";

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
  if (config.adminChat.secret) {
    headers["X-Admin-Chat-Secret"] = config.adminChat.secret;
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
  if (!config.adminChat.url) {
    res.status(503).json({ error: "admin chat not configured" });
    return null;
  }
  return config.adminChat.url;
}

function adminUsername(req: Request): string {
  return req.user!.minecraftUsername;
}

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

    const disconnect = new AbortController();
    res.on("close", () => disconnect.abort());

    let upstream;
    try {
      upstream = await fetch(
        withQuery(`${base}/api/chat/stream`, {
          username: adminUsername(req),
          sessionId,
        }),
        { headers: claudeHeaders(), signal: disconnect.signal },
      );
    } catch (error) {
      if (disconnect.signal.aborted) return;
      throw error;
    }
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
    stream.on("error", (err) => {
      if (disconnect.signal.aborted) return;
      logger.error(
        "[admin-chat] upstream stream error:",
        describeHttpError(err),
      );
      res.end();
    });
    stream.pipe(res);
  }),
);

export default router;
