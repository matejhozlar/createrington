import type {
  AdminChatModel,
  ChatHistorySession,
  ChatMessage,
  CurrentChatSession,
  RepoSuggestion,
} from "@createrington/shared/admin-chat";
import { isAdminChatModel } from "@createrington/shared/admin-chat";
import config from "@/config";
import {
  AppError,
  InternalServerError,
  ServiceUnavailableError,
} from "@/errors";
import { fetchJson, HttpStatusError, readBody, withQuery } from "@/utils/http";

const REPO = "Createrington/app";
const ENVIRONMENT = config.envMode.isDevDeployment ? "dev" : "prod";
const UPSTREAM_TIMEOUT_MS = 30000;
const UPSTREAM_FAILED = "Upstream chat request failed";

export type ChatPageContext = Record<string, string | number | boolean | null>;

export interface ChatHistoryPage {
  items: ChatHistorySession[];
  nextCursor: number | null;
}

export interface ChatTranscript {
  messages: ChatMessage[];
  sessionActive: boolean;
}

export interface StartedChatSession {
  sessionId: number;
  model: AdminChatModel | null;
}

interface UpstreamSession {
  active?: boolean;
  sessionId?: number | null;
  lastSessionId?: number | null;
  model?: string | null;
  lastSessionModel?: string | null;
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

/**
 * Client for the admin chat API of claude-automation (`/api/chat/*`), called
 * on behalf of one admin identified by Minecraft username. Stateless; every
 * call throws ServiceUnavailableError while CLAUDE_API_URL is unset, an
 * AppError carrying the upstream status and message when claude-automation
 * refuses, and InternalServerError when it cannot be reached.
 */
export class AdminChatClient {
  /** Whether claude-automation serves admin chat for this app and environment; false when it is not configured. */
  async enabled(): Promise<boolean> {
    if (!config.adminChat.url) return false;
    const body = await this.get<{ enabled?: boolean }>("/api/chat/enabled", {
      repo: REPO,
      environment: ENVIRONMENT,
    });
    return body.enabled === true;
  }

  /** Createrington org repositories offered by the @-mention autocomplete. */
  async repos(): Promise<RepoSuggestion[]> {
    const body = await this.get<{ repos?: RepoSuggestion[] }>(
      "/api/chat/repos",
      {},
    );
    return body.repos ?? [];
  }

  /** The admin's running session, else their most recent finished one, else none. */
  async currentSession(username: string): Promise<CurrentChatSession> {
    const body = await this.get<UpstreamSession>("/api/chat/session", {
      username,
      environment: ENVIRONMENT,
    });
    const active = body.active === true;
    const model = active ? body.model : body.lastSessionModel;
    return {
      id: (active ? body.sessionId : body.lastSessionId) ?? null,
      active,
      model: isAdminChatModel(model) ? model : null,
    };
  }

  /** One page of the admin's finished sessions, newest first. */
  async sessions(
    username: string,
    page: { limit?: number; cursor?: number },
  ): Promise<ChatHistoryPage> {
    const body = await this.get<{
      sessions: ChatHistorySession[];
      nextCursor: number | null;
    }>("/api/chat/sessions", {
      username,
      environment: ENVIRONMENT,
      limit: page.limit,
      cursor: page.cursor,
    });
    return { items: body.sessions, nextCursor: body.nextCursor ?? null };
  }

  /** The messages of one of the admin's sessions and whether it is still running. */
  async messages(username: string, sessionId: number): Promise<ChatTranscript> {
    return this.get<ChatTranscript>("/api/chat/messages", {
      username,
      sessionId,
    });
  }

  /** Starts a session, or rejoins the admin's running one. */
  async start(
    username: string,
    options: { pageContext?: ChatPageContext; model?: AdminChatModel },
  ): Promise<StartedChatSession> {
    const body = await this.post<{ sessionId?: number; model?: string | null }>(
      "/api/chat/start",
      {
        username,
        repo: REPO,
        environment: ENVIRONMENT,
        ...(options.pageContext !== undefined && {
          pageContext: options.pageContext,
        }),
        ...(options.model !== undefined && { model: options.model }),
      },
    );
    if (typeof body.sessionId !== "number") {
      throw new InternalServerError(UPSTREAM_FAILED);
    }
    return {
      sessionId: body.sessionId,
      model: isAdminChatModel(body.model) ? body.model : null,
    };
  }

  /** Posts a message into the admin's running session; the reply arrives on the stream. */
  async send(
    username: string,
    message: {
      sessionId: number;
      message: string;
      pageContext?: ChatPageContext;
    },
  ): Promise<void> {
    await this.post("/api/chat/send", {
      username,
      sessionId: message.sessionId,
      message: message.message,
      ...(message.pageContext !== undefined && {
        pageContext: message.pageContext,
      }),
    });
  }

  /** Ends the admin's running session. */
  async end(username: string, sessionId: number): Promise<void> {
    await this.post("/api/chat/end", { username, sessionId });
  }

  /** Opens the session's server-sent event stream; the response body is the open stream. */
  async openStream(
    username: string,
    sessionId: number,
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(
      withQuery(`${this.base()}/api/chat/stream`, { username, sessionId }),
      { headers: this.headers(), signal },
    );
    if (!response.ok) {
      throw new AppError(
        upstreamMessage(await readBody(response)),
        response.status,
      );
    }
    return response;
  }

  private base(): string {
    if (!config.adminChat.url) {
      throw new ServiceUnavailableError("Admin chat is not configured");
    }
    return config.adminChat.url;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.adminChat.secret) {
      headers["X-Admin-Chat-Secret"] = config.adminChat.secret;
    }
    return headers;
  }

  private get<T>(
    path: string,
    query: Parameters<typeof withQuery>[1],
  ): Promise<T> {
    const url = withQuery(`${this.base()}${path}`, query);
    return this.request(() =>
      fetchJson<T>(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
    );
  }

  private post<T>(path: string, body: object): Promise<T> {
    const url = `${this.base()}${path}`;
    return this.request(() =>
      fetchJson<T>(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
    );
  }

  private async request<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof HttpStatusError) {
        throw new AppError(upstreamMessage(error.body), error.status);
      }
      throw new InternalServerError(UPSTREAM_FAILED);
    }
  }
}

export const adminChatClient = new AdminChatClient();
