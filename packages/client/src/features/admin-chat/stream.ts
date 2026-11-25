import type {
  ChatActionRecord,
  ChatMessage,
} from "@createrington/shared/admin-chat";
import { HTTPError } from "ky";
import { api } from "@/services/api/client";
import { coerceAction } from "./actions";

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const FAILURES_BEFORE_NOTICE = 3;
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429]);

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onAction: (record: ChatActionRecord) => void;
  onOpen: () => void;
}

export async function runStream(
  sessionId: number,
  handlers: StreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  const response = await api.getClient().get("api/claude-chat/stream", {
    searchParams: { sessionId },
    signal: abort,
    timeout: false,
    retry: 0,
  });
  if (!response.body) throw new Error("Chat stream has no body");
  handlers.onOpen();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      try {
        const parsed = JSON.parse(dataLines.join("\n")) as unknown;
        if (event === "message") {
          handlers.onMessage(parsed as ChatMessage);
        } else if (event === "action") {
          const record = (parsed as { action?: ChatActionRecord }).action;
          if (record && coerceAction(record.payload)) {
            handlers.onAction(record);
          }
        } else if (event === "session_ended") {
          handlers.onSessionEnded();
        }
      } catch {}
    }
  }
}

interface LiveStreamHandlers extends Omit<StreamHandlers, "onOpen"> {
  onReconnect: () => void;
  onLost: () => void;
}

function isPermanentFailure(error: unknown): boolean {
  if (!(error instanceof HTTPError)) return false;
  const { status } = error.response;
  return (
    status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status)
  );
}

function wait(ms: number, abort: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    abort.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function keepStreamOpen(
  sessionId: number,
  handlers: LiveStreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  let ended = false;
  let opened = false;
  let failures = 0;

  while (!abort.aborted && !ended) {
    try {
      await runStream(
        sessionId,
        {
          ...handlers,
          onOpen: () => {
            if (opened) handlers.onReconnect();
            opened = true;
            failures = 0;
          },
          onSessionEnded: () => {
            ended = true;
            handlers.onSessionEnded();
          },
        },
        abort,
      );
    } catch (error) {
      if (abort.aborted) return;
      if (isPermanentFailure(error)) {
        handlers.onLost();
        return;
      }
    }
    if (abort.aborted || ended) return;
    failures++;
    if (failures === FAILURES_BEFORE_NOTICE) handlers.onLost();
    await wait(
      Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS),
      abort,
    );
  }
}
