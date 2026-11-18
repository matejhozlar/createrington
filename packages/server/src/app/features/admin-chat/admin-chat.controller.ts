import type { Request, Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getValidated } from "@/app/middleware/validation.middleware";
import {
  AppError,
  InternalServerError,
  ServiceUnavailableError,
} from "@/errors";
import config from "@/config";
import {
  describeHttpError,
  fetchJson,
  HttpStatusError,
  readBody,
  withQuery,
} from "@/utils/http";
import type {
  EndBody,
  MessagesQuery,
  SendBody,
  SessionsQuery,
  StartBody,
  StreamQuery,
} from "./admin-chat.schemas";

const REPO = "Createrington/app";
const ENVIRONMENT = config.envMode.isDevDeployment ? "dev" : "prod";
const UPSTREAM_TIMEOUT_MS = 30000;
const UPSTREAM_FAILED = "Upstream chat request failed";

function upstreamBase(): string {
  if (!config.adminChat.url) {
    throw new ServiceUnavailableError("Admin chat is not configured");
  }
  return config.adminChat.url;
}

function claudeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.adminChat.secret) {
    headers["X-Admin-Chat-Secret"] = config.adminChat.secret;
  }
  return headers;
}

function upstreamMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const { error, message } = body as Record<string, unknown>;
    if (typeof error === "string" && error) return error;
    if (typeof message === "string" && message) return message;
  }
  if (typeof body === "string" && body) return body;
  return UPSTREAM_FAILED;
}

async function proxy(res: Response, request: () => Promise<unknown>) {
  let body: unknown;
  try {
    body = await request();
  } catch (error) {
    if (error instanceof HttpStatusError) {
      throw new AppError(upstreamMessage(error.body), error.status);
    }
    throw new InternalServerError(UPSTREAM_FAILED);
  }
  res.json(body);
}

function claudeGet(path: string, query: Parameters<typeof withQuery>[1]) {
  const url = withQuery(`${upstreamBase()}${path}`, query);
  return () =>
    fetchJson(url, {
      headers: claudeHeaders(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
}

function claudePost(path: string, body: object) {
  const url = `${upstreamBase()}${path}`;
  return () =>
    fetchJson(url, {
      method: "POST",
      headers: claudeHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
}

function adminUsername(req: Request): string {
  return req.user!.minecraftUsername;
}

export class AdminChatController {
  static async enabled(_req: Request, res: Response): Promise<void> {
    await proxy(
      res,
      claudeGet("/api/chat/enabled", { repo: REPO, environment: ENVIRONMENT }),
    );
  }

  static async repos(_req: Request, res: Response): Promise<void> {
    await proxy(res, claudeGet("/api/chat/repos", {}));
  }

  static async session(req: Request, res: Response): Promise<void> {
    await proxy(
      res,
      claudeGet("/api/chat/session", {
        username: adminUsername(req),
        environment: ENVIRONMENT,
      }),
    );
  }

  static async sessions(req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: SessionsQuery }>(res);
    await proxy(
      res,
      claudeGet("/api/chat/sessions", {
        username: adminUsername(req),
        environment: ENVIRONMENT,
        limit: query.limit,
        cursor: query.cursor,
      }),
    );
  }

  static async messages(req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: MessagesQuery }>(res);
    await proxy(
      res,
      claudeGet("/api/chat/messages", {
        username: adminUsername(req),
        sessionId: query.sessionId,
        afterId: query.afterId,
      }),
    );
  }

  static async start(req: Request, res: Response): Promise<void> {
    const {
      body: { pageContext, model },
    } = getValidated<{ body: StartBody }>(res);
    await proxy(
      res,
      claudePost("/api/chat/start", {
        username: adminUsername(req),
        repo: REPO,
        environment: ENVIRONMENT,
        ...(pageContext !== undefined && { pageContext }),
        ...(model !== undefined && { model }),
      }),
    );
  }

  static async send(req: Request, res: Response): Promise<void> {
    const {
      body: { sessionId, message, pageContext },
    } = getValidated<{ body: SendBody }>(res);
    await proxy(
      res,
      claudePost("/api/chat/send", {
        username: adminUsername(req),
        sessionId,
        message,
        ...(pageContext !== undefined && { pageContext }),
      }),
    );
  }

  static async end(req: Request, res: Response): Promise<void> {
    const {
      body: { sessionId },
    } = getValidated<{ body: EndBody }>(res);
    await proxy(
      res,
      claudePost("/api/chat/end", { username: adminUsername(req), sessionId }),
    );
  }

  static async stream(req: Request, res: Response): Promise<void> {
    const {
      query: { sessionId },
    } = getValidated<{ query: StreamQuery }>(res);
    const base = upstreamBase();

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
      throw new AppError(
        upstreamMessage(await readBody(upstream)),
        upstream.status,
      );
    }
    if (!upstream.body) {
      throw new InternalServerError(UPSTREAM_FAILED);
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
  }
}
