import type { AdminChatModel } from "@createrington/shared/admin-chat";

export const ADMIN_CHAT_MODEL_LABELS: Record<AdminChatModel, string> = {
  "claude-opus-5-5": "Opus 5.5",
};
export const DEFAULT_ADMIN_CHAT_MODEL: AdminChatModel = "claude-opus-5-5";

export type PageContext = {
  type: "admin-chat" | "admin" | "page";
  owner: "Createrington";
  repo: "app";
  pathname: string;
  search?: string;
  title?: string;
};

export interface MentionState {
  start: number;
  query: string;
}
