import type { ChatActionRecord } from "./actions";

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
 * to say "you're already on /admin/players — click the Ban button on the
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
