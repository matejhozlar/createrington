import { getAccessToken } from "@/services/auth/token-manager";
import { coerceAction, type ChatActionRecord } from "./actions";
import type { ChatMessage } from "./types";

export const API_BASE = "/api/claude-chat";

/**
 * Fetch through the app backend proxy, which injects the admin-chat shared
 * secret and forwards to claude-automation. The JWT auth header is required
 * so the proxy can gate on isAdmin and derive the username.
 */
export async function claudeFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onAction: (record: ChatActionRecord) => void;
  onOpen?: () => void;
  onError?: () => void;
}

/**
 * Open an SSE stream through the proxy. EventSource can't attach the
 * Bearer token, so we use fetch + ReadableStream and parse SSE frames
 * manually. Each frame is separated by a blank line; event-type defaults
 * to "message" when omitted.
 */
export async function runStream(
  sessionId: number,
  handlers: StreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/stream?sessionId=${sessionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: abort,
  });
  if (!response.ok || !response.body) {
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
      } catch {
        // Ignore malformed frame — next one will probably be fine.
      }
    }
  }
}
