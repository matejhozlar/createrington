import { api } from "@/services/api/client";
import { coerceAction, type ChatActionRecord } from "./actions";
import type {
  AdminChatModel,
  ChatMessage,
  PageContext,
  RepoSuggestion,
} from "./types";

const PREFIX = "api/claude-chat";

export interface ChatHistorySession {
  id: number;
  status: string;
  title: string;
  createdAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
  messageCount: number;
}

export interface ChatHistoryPage {
  sessions: ChatHistorySession[];
  nextCursor: number | null;
}

export interface SessionStatusResponse {
  active?: boolean;
  sessionId?: number | null;
  lastSessionId?: number | null;
  model?: string | null;
  lastSessionModel?: string | null;
}

export interface StartSessionResponse {
  sessionId?: number;
  error?: string;
  model?: string | null;
}

export interface MessagesResponse {
  messages: ChatMessage[];
  sessionActive: boolean;
}

export interface EnabledResponse {
  enabled?: boolean;
}

export interface ReposResponse {
  repos?: RepoSuggestion[];
}

export function fetchChatSessions(params: {
  limit?: number;
  cursor?: number;
}): Promise<ChatHistoryPage> {
  return api.get<ChatHistoryPage>(`${PREFIX}/sessions`, {
    ...(params.limit !== undefined && { limit: params.limit }),
    ...(params.cursor !== undefined && { cursor: params.cursor }),
  });
}

export function fetchChatMessages(
  sessionId: number,
): Promise<MessagesResponse> {
  return api.get<MessagesResponse>(`${PREFIX}/messages`, { sessionId });
}

export function fetchChatEnabled(): Promise<EnabledResponse> {
  return api.get<EnabledResponse>(`${PREFIX}/enabled`);
}

export function fetchSessionStatus(): Promise<SessionStatusResponse> {
  return api.get<SessionStatusResponse>(`${PREFIX}/session`);
}

export function fetchRepos(): Promise<ReposResponse> {
  return api.get<ReposResponse>(`${PREFIX}/repos`);
}

export function startSession(body: {
  pageContext: PageContext;
  model?: AdminChatModel;
}): Promise<StartSessionResponse> {
  return api.post<StartSessionResponse>(`${PREFIX}/start`, body);
}

export function sendChatMessage(body: {
  sessionId: number;
  message: string;
  pageContext: PageContext;
}): Promise<unknown> {
  return api.post(`${PREFIX}/send`, body);
}

export function endSession(sessionId: number): Promise<unknown> {
  return api.post(`${PREFIX}/end`, { sessionId });
}

interface StreamHandlers {
  onMessage: (m: ChatMessage) => void;
  onSessionEnded: () => void;
  onAction: (record: ChatActionRecord) => void;
  onOpen?: () => void;
  onError?: () => void;
}

/**
 * Open an SSE stream through the proxy. EventSource cannot attach a Bearer
 * token, so we drive ky directly: this gets us shared auth-header injection
 * and 401 silent refresh, while letting us disable timeout/retry which would
 * otherwise kill a long-lived stream. The SSE frame parser stays manual.
 */
export async function runStream(
  sessionId: number,
  handlers: StreamHandlers,
  abort: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await api.getClient().get(`${PREFIX}/stream`, {
      searchParams: { sessionId },
      signal: abort,
      timeout: false,
      retry: 0,
    });
  } catch (err) {
    if ((err as { name?: string }).name !== "AbortError") {
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
      } catch {
        // Ignore malformed frame: next one will probably be fine.
      }
    }
  }
}
