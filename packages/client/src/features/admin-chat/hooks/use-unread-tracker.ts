import { useState } from "react";
import type { ChatMessage } from "@createrington/shared/admin-chat";

export function useUnreadTracker(
  messages: ChatMessage[],
  drawerOpen: boolean,
): boolean {
  const latestAssistantId = messages
    .filter((m) => m.role === "assistant")
    .reduce((max, m) => (m.id > max ? m.id : max), 0);
  const [seenAssistantId, setSeenAssistantId] = useState(0);
  if (drawerOpen && seenAssistantId !== latestAssistantId) {
    setSeenAssistantId(latestAssistantId);
  }
  return !drawerOpen && latestAssistantId > seenAssistantId;
}
