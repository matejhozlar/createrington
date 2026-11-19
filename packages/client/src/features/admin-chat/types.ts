import type { ChatActionRecord } from "./actions";

export const ADMIN_CHAT_MODEL_LABELS = {
  "claude-opus-5-5": "Opus 5.5",
} as const;
export type AdminChatModel = keyof typeof ADMIN_CHAT_MODEL_LABELS;
export const DEFAULT_ADMIN_CHAT_MODEL: AdminChatModel = "claude-opus-5-5";

export function isAdminChatModel(value: unknown): value is AdminChatModel {
  return (
    typeof value === "string" &&
    Object.keys(ADMIN_CHAT_MODEL_LABELS).includes(value)
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
  start: number;
  query: string;
}
