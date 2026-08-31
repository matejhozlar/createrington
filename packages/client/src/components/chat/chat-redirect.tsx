import { Navigate } from "react-router";
import { useServerData } from "@/contexts/server-data";
import { Loading } from "../loading-spinner";

export function ChatRedirect() {
  const { servers, loading } = useServerData();

  const target = [...servers].sort((a, b) => a.serverId - b.serverId)[0];

  if (target) {
    return <Navigate to={`/chat/${target.serverSlug}`} replace />;
  }

  return (
    <div className="flex h-full items-center justify-center">
      {loading ? (
        <Loading size="medium" text="Loading chat..." />
      ) : (
        <p className="text-muted-foreground">No servers available</p>
      )}
    </div>
  );
}
