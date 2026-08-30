import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth";
import { useAdminChat } from "@/contexts/admin-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatPanel } from "./components/ChatPanel";
import { ChatToggle } from "./components/ChatToggle";
import { useAdminChatSession } from "./hooks/use-admin-chat-session";
import { useModelSelection } from "./hooks/use-model-selection";
import { useUnreadTracker } from "./hooks/use-unread-tracker";

export function AdminChat(): React.JSX.Element | null {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { enabled, bubbleVisible, drawerOpen, openDrawer, closeDrawer } =
    useAdminChat();

  const isAdmin = Boolean(user?.isAdmin);
  const session = useAdminChatSession({ isAdmin, open: drawerOpen });
  const { selectedModel, setSelectedModel } = useModelSelection(
    user?.minecraftUsername,
  );
  const unread = useUnreadTracker(session.messages, drawerOpen);

  if (!enabled) return null;
  if (!bubbleVisible) return null;

  return (
    <div className="fixed right-5 bottom-5 z-[9999]">
      {drawerOpen && (
        <ChatPanel
          pathname={location.pathname}
          fullscreen={isMobile}
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
      {!(drawerOpen && isMobile) && (
        <ChatToggle
          open={drawerOpen}
          unread={unread}
          onToggle={() => (drawerOpen ? closeDrawer() : openDrawer())}
        />
      )}
    </div>
  );
}
