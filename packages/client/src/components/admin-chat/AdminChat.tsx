import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { claudeFetch } from "./api";
import { ChatPanel } from "./ChatPanel";
import { ChatToggle } from "./ChatToggle";
import { useAdminChatSession } from "./use-admin-chat-session";

const BUBBLE_KEY = "admin-chat:bubble-visible";

export function AdminChat(): React.JSX.Element | null {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [enabledFromServer, setEnabledFromServer] = useState<boolean | null>(
    null,
  );
  const [open, setOpen] = useState(false);

  const isAdmin = Boolean(user?.isAdmin);

  const session = useAdminChatSession({ isAdmin, open });

  // Check if admin chat is enabled. Non-admins short-circuit to `false`
  // via the derived `enabled` below rather than an extra setState here —
  // avoids a synchronous state write in an effect body.
  useEffect(() => {
    if (!isAdmin) return;
    claudeFetch("/enabled")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: { enabled?: boolean }) =>
        setEnabledFromServer(data.enabled === true),
      )
      .catch(() => setEnabledFromServer(false));
  }, [isAdmin]);

  const enabled = isAdmin ? enabledFromServer : false;

  // Track last-seen assistant message id. "Adjust during render" pattern:
  // whenever the drawer is open, reconcile `seen` with the latest id. The
  // unread dot is derived purely — no effect needed.
  const latestAssistantId = session.messages
    .filter((m) => m.role === "assistant")
    .reduce((max, m) => (m.id > max ? m.id : max), 0);
  const [seenAssistantId, setSeenAssistantId] = useState(0);
  if (open && seenAssistantId !== latestAssistantId) {
    setSeenAssistantId(latestAssistantId);
  }
  const unread = !open && latestAssistantId > seenAssistantId;

  // Bubble visibility — default hidden, toggled by Ctrl/Cmd+I. Clicking
  // the bubble (when shown) still opens/closes the drawer exactly as
  // before. Persisted in localStorage so an admin who enabled it doesn't
  // have to re-press on every page nav.
  const [bubbleVisible, setBubbleVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BUBBLE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(BUBBLE_KEY, bubbleVisible ? "1" : "0");
    } catch {
      // Non-fatal — state still works within this tab.
    }
  }, [bubbleVisible]);

  // Global shortcut (Ctrl/Cmd+I) toggles the bubble's visibility.
  // Intentionally not documented in-app — if you found this comment
  // you're probably an admin who earned it. Only attaches when `enabled`
  // so non-admins and kill-switch-off sessions never even bind it.
  // Hiding the bubble also closes the drawer so there's no orphaned
  // panel floating without its toggle.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          setBubbleVisible((v) => {
            if (v) setOpen(false);
            return !v;
          });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);

  if (!enabled) return null;
  if (!bubbleVisible) return null;

  return (
    <div className="fixed right-5 bottom-5 z-[9999]">
      {open && (
        <ChatPanel
          pathname={location.pathname}
          messages={session.messages}
          sessionId={session.sessionId}
          sessionActive={session.sessionActive}
          starting={session.starting}
          sending={session.sending}
          awaitingReply={session.awaitingReply}
          onStart={(prefillMessage) => void session.start(prefillMessage)}
          onSend={(message) => void session.send(message)}
          onEnd={() => void session.end()}
          onClose={() => setOpen(false)}
          navigate={navigate}
        />
      )}
      <ChatToggle
        open={open}
        unread={unread}
        onToggle={() => setOpen((o) => !o)}
      />
    </div>
  );
}
