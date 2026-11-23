export const ADMIN_CHAT_MODELS = ["claude-opus-5-5"] as const;

export type AdminChatModel = (typeof ADMIN_CHAT_MODELS)[number];

export function isAdminChatModel(value: unknown): value is AdminChatModel {
  return (
    typeof value === "string" &&
    (ADMIN_CHAT_MODELS as readonly string[]).includes(value)
  );
}

export type ChatMessageKind = "text" | "ack" | "progress" | "streaming";

export interface ChatActionRecord {
  id: number;
  sessionId: number;
  chatMessageId: number;
  type: string;
  payload?: unknown;
  createdAt: string;
}

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

export interface ChatHistorySession {
  id: number;
  status: string;
  title: string;
  createdAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
  messageCount: number;
}

export interface RepoSuggestion {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  private: boolean;
}

export interface CurrentChatSession {
  id: number | null;
  active: boolean;
  model: AdminChatModel | null;
}
