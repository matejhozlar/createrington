import type { ChatActionRecord } from "./actions";

/**
 * Models the admin can pin a chat session to. Must stay in sync with the
 * server-side allowlists (claude-automation `chat.routes.ts` worker, app
 * `admin-chat.routes.ts` proxy). Sonnet is the default for routine work
 * (DB lookups, page-aware highlights); Opus is the opt-in for deeper code
 * investigations.
 */
export const ADMIN_CHAT_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-8",
] as const;
export type AdminChatModel = (typeof ADMIN_CHAT_MODELS)[number];
export const DEFAULT_ADMIN_CHAT_MODEL: AdminChatModel = "claude-sonnet-4-6";

export const ADMIN_CHAT_MODEL_LABELS: Record<AdminChatModel, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-8": "Opus 4.8",
};

export function isAdminChatModel(value: unknown): value is AdminChatModel {
  return (
    typeof value === "string" &&
    (ADMIN_CHAT_MODELS as readonly string[]).includes(value)
  );
}

export type ChatMessageKind = "text" | "ack" | "progress" | "streaming";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  kind?: ChatMessageKind;
  metadata?: {
    isIdleWarning?: boolean;
    isIdleTimeout?: boolean;
  } | null;
  createdAt: string;
  actions?: ChatActionRecord[];
}

/**
 * pageContext passed to the proxy on every start/send. Gives Claude enough
 * to say "you're already on /admin/players, click the Ban button on the
 * row" instead of guessing where features live.
 */
export interface PageContext {
  type: "admin-chat" | "admin" | "page";
  owner: "Createrington";
  repo: "app";
  pathname: string;
  search?: string;
  title?: string;
}

export interface RepoSuggestion {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  private: boolean;
}

export interface MentionState {
  /** Index of the `@` trigger in the input string. */
  start: number;
  /** Text typed after `@`, before the cursor. */
  query: string;
}
