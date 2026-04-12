import { Router, type Request, type Response } from "express";
import axios, { AxiosError } from "axios";
import type { Readable } from "node:stream";
import {
  asyncHandler,
  authenticate,
  requireAdmin,
  BadRequestError,
  InternalServerError,
} from "@/app/middleware";
import { env, envMode } from "@/config/env/env.config";

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

// Upstream LLM calls can hang on network glitches — cap every outbound
// request so a stuck claude-automation can't pile up Express connections.
const UPSTREAM_TIMEOUT_MS = 30000;

const claudeClient = axios.create({ timeout: UPSTREAM_TIMEOUT_MS });

function claudeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.ADMIN_CHAT_SECRET) {
    headers["X-Admin-Chat-Secret"] = env.ADMIN_CHAT_SECRET;
  }
  return headers;
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
 * status + body (e.g. 403 when the kill switch is off). Non-axios errors
 * bubble up to the app-wide error handler.
 */
function forwardUpstreamError(err: unknown, res: Response): void {
  if (err instanceof AxiosError && err.response) {
    res
      .status(err.response.status)
      .json(err.response.data ?? { error: err.message });
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
      const r = await claudeClient.get(`${base}/api/chat/enabled`, {
        params: { repo: REPO, environment: ENVIRONMENT },
        headers: claudeHeaders(),
      });
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
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
      const r = await claudeClient.get(`${base}/api/chat/session`, {
        params: {
          username: adminUsername(req),
          environment: ENVIRONMENT,
        },
        headers: claudeHeaders(),
      });
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
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
    const { sessionId, afterId } = req.query;
    if (!sessionId) {
      throw new BadRequestError("sessionId is required");
    }
    try {
      const r = await claudeClient.get(`${base}/api/chat/messages`, {
        params: {
          username: adminUsername(req),
          sessionId,
          ...(afterId !== undefined && { afterId }),
        },
        headers: claudeHeaders(),
      });
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
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
    const { pageContext } = (req.body ?? {}) as {
      pageContext?: unknown;
    };
    try {
      const r = await claudeClient.post(
        `${base}/api/chat/start`,
        {
          username: adminUsername(req),
          repo: REPO,
          environment: ENVIRONMENT,
          ...(pageContext !== undefined && { pageContext }),
        },
        { headers: claudeHeaders() },
      );
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
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
    const { sessionId, message, pageContext } = (req.body ?? {}) as {
      sessionId?: number;
      message?: string;
      pageContext?: unknown;
    };
    if (typeof sessionId !== "number" || typeof message !== "string") {
      throw new BadRequestError("sessionId and message are required");
    }
    try {
      const r = await claudeClient.post(
        `${base}/api/chat/send`,
        {
          username: adminUsername(req),
          sessionId,
          message,
          ...(pageContext !== undefined && { pageContext }),
        },
        { headers: claudeHeaders() },
      );
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
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
      const r = await claudeClient.post(
        `${base}/api/chat/end`,
        { username: adminUsername(req), sessionId },
        { headers: claudeHeaders() },
      );
      res.json(r.data);
    } catch (err) {
      forwardUpstreamError(err, res);
    }
  }),
);

/**
 * SSE passthrough to claude-automation's /api/chat/stream. Axios streaming
 * responses are piped through so the widget sees events frame-by-frame.
 * The 30s UPSTREAM_TIMEOUT_MS on claudeClient does not apply here — the
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

    // Hold off on sending SSE headers until the upstream connects — if
    // the upstream rejects (404 session not found, 401 bad secret, etc.)
    // we want to surface the real status to the browser, not a 200 with
    // no body.
    let upstream;
    try {
      upstream = await axios.get(`${base}/api/chat/stream`, {
        params: { username: adminUsername(req), sessionId },
        headers: claudeHeaders(),
        responseType: "stream",
        // Disable axios timeout for the long-lived stream.
        timeout: 0,
      });
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        res
          .status(err.response.status)
          .json(err.response.data ?? { error: "upstream error" });
        return;
      }
      throw err;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const stream = upstream.data as Readable;
    // If the upstream drops (restart, network blip) mid-stream, close our
    // side cleanly instead of leaving Express in an undefined state.
    stream.on("error", (err) => {
      console.error("[admin-chat] upstream stream error:", err);
      res.end();
    });
    stream.pipe(res);
    req.on("close", () => {
      stream.destroy();
    });
  }),
);

export default router;
