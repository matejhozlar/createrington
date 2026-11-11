import { Navigate } from "react-router";
import type { ServerStatus } from "@createrington/shared/socket";
import { useServerData } from "@/contexts/server-data";
import { useWebSocket } from "@/contexts/websocket";
import { ChatFallback } from "./chat-fallback";

export function ChatRedirect() {
  const { servers, loading, error } = useServerData();
  const { connectionState } = useWebSocket();

  const target = servers.reduce<ServerStatus | undefined>(
    (min, s) => (!min || s.serverId < min.serverId ? s : min),
    undefined,
  );

  if (target) {
    return <Navigate to={`/chat/${target.serverSlug}`} replace />;
  }

  if (error || connectionState === "error") {
    return <ChatFallback message="Chat is unavailable right now" />;
  }

  return <ChatFallback loading={loading} message="No servers available" />;
}
