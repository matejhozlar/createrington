import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { ChatPanel } from "./ChatPanel";
import { ChatToggle } from "./ChatToggle";
import { useAdminChat } from "./use-admin-chat";
import { useAdminChatSession } from "./use-admin-chat-session";
import {
  DEFAULT_ADMIN_CHAT_MODEL,
  isAdminChatModel,
  type AdminChatModel,
} from "./types";

function modelStorageKey(username: string | undefined): string | null {
  if (!username) return null;
  return `admin-chat:model:${username}`;
}

function loadStoredModel(username: string | undefined): AdminChatModel {
  const key = modelStorageKey(username);
  if (!key || typeof window === "undefined") return DEFAULT_ADMIN_CHAT_MODEL;
  try {
    const raw = window.localStorage.getItem(key);
    return isAdminChatModel(raw) ? raw : DEFAULT_ADMIN_CHAT_MODEL;
  } catch {
    return DEFAULT_ADMIN_CHAT_MODEL;
  }
}

export function AdminChat(): React.JSX.Element | null {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { enabled, bubbleVisible, drawerOpen, openDrawer, closeDrawer } =
    useAdminChat();

  const isAdmin = Boolean(user?.isAdmin);
  const username = user?.minecraftUsername;

  const session = useAdminChatSession({ isAdmin, open: drawerOpen });

  const [selectedModel, setSelectedModelState] = useState<AdminChatModel>(() =>
    loadStoredModel(username),
  );

  const setSelectedModel = useCallback(
    (next: AdminChatModel): void => {
      setSelectedModelState(next);
      const key = modelStorageKey(username);
      if (!key || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // localStorage can throw in private mode / quota - best-effort only.
      }
    },
    [username],
  );

  // Track last-seen assistant message id. "Adjust during render" pattern:
  // whenever the drawer is open, reconcile `seen` with the latest id. The
  // unread dot is derived purely — no effect needed.
  const latestAssistantId = session.messages
    .filter((m) => m.role === "assistant")
    .reduce((max, m) => (m.id > max ? m.id : max), 0);
  const [seenAssistantId, setSeenAssistantId] = useState(0);
  if (drawerOpen && seenAssistantId !== latestAssistantId) {
    setSeenAssistantId(latestAssistantId);
  }
  const unread = !drawerOpen && latestAssistantId > seenAssistantId;

  if (!enabled) return null;
  if (!bubbleVisible) return null;

  return (
    <div className="fixed right-5 bottom-5 z-[9999]">
      {drawerOpen && (
        <ChatPanel
          pathname={location.pathname}
          messages={session.messages}
          sessionId={session.sessionId}
          sessionActive={session.sessionActive}
          activeModel={session.activeModel}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          starting={session.starting}
          sending={session.sending}
          awaitingReply={session.awaitingReply}
          onStart={(prefillMessage) =>
            void session.start(prefillMessage, selectedModel)
          }
          onSend={(message) => void session.send(message)}
          onEnd={() => void session.end()}
          onClose={closeDrawer}
          navigate={navigate}
        />
      )}
      <ChatToggle
        open={drawerOpen}
        unread={unread}
        onToggle={() => (drawerOpen ? closeDrawer() : openDrawer())}
      />
    </div>
  );
}
