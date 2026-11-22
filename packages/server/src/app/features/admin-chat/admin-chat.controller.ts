import type { Request, Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getValidated } from "@/app/middleware/validation.middleware";
import { InternalServerError } from "@/errors";
import { adminChatClient } from "@/services/claude-automation/admin-chat-client";
import { describeHttpError } from "@/utils/http";
import type { StreamQuery } from "./admin-chat.schemas";

export class AdminChatController {
  static async stream(req: Request, res: Response): Promise<void> {
    const {
      query: { sessionId },
    } = getValidated<{ query: StreamQuery }>(res);

    const disconnect = new AbortController();
    res.on("close", () => disconnect.abort());

    let upstream;
    try {
      upstream = await adminChatClient.openStream(
        req.user!.minecraftUsername,
        sessionId,
        disconnect.signal,
      );
    } catch (error) {
      if (disconnect.signal.aborted) return;
      throw error;
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
  }
}
