import type {
  ChatActionRecord,
  ChatMessage,
} from "@createrington/shared/admin-chat";
import { api } from "@/services/api/client";
import { coerceAction } from "./actions";

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onAction: (record: ChatActionRecord) => void;
  onOpen?: () => void;
  onError?: () => void;
}

export async function runStream(
  sessionId: number,
  handlers: StreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await api.getClient().get("api/claude-chat/stream", {
      searchParams: { sessionId },
      signal: abort,
      timeout: false,
      retry: 0,
    });
  } catch (error) {
    if ((error as { name?: string }).name !== "AbortError") {
      handlers.onError?.();
    }
    return;
  }
  if (!response.body) {
    handlers.onError?.();
    return;
  }
  handlers.onOpen?.();
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
