import { useState } from "react";
import type { ChatMessage } from "../types";

/**
 * Derive an unread-message indicator for the chat bubble. Uses the
 * "adjust during render" pattern: whenever the drawer is open we
 * reconcile `seen` with the latest assistant id, so the dot turns off
 * without an effect.
 */
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
