import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useServerData } from "@/contexts/server-data";
import { ServerHeader } from "./components/ServerHeader";
import { ServerStatsCards } from "./components/ServerStatsCards";
import { ServerTabs, type ServerTabType } from "./components/ServerTabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { SessionsTab } from "./components/tabs/SessionsTab";
import { AnalyticsTab } from "./components/tabs/AnalyticsTab";

export function AdminServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getServer } = useServerData();
  const serverId = parseInt(id ?? "0", 10);

  const [activeTab, setActiveTab] = useState<ServerTabType>("overview");

  const serverQuery = trpc.admin.servers.get.useQuery(
    { id: serverId },
    { enabled: serverId > 0 },
  );

  const serverData = serverQuery.data;
  const loading = serverQuery.isLoading;
  const error = serverQuery.error?.message ?? null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="large" text="Loading server data..." />
      </div>
    );
  }

  if (error || !serverData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error || "Server not found"}</p>
          <Button
            onClick={() => navigate("/admin/servers")}
            className="mt-4 cursor-pointer"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Back to Servers
          </Button>
        </div>
      </div>
    );
  }

  const liveData = getServer(serverId);
  const isOnline = liveData?.online ?? serverData.server.status === "online";
  const livePlayerCount =
    liveData?.playerCount ?? serverData.server.playerCount;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ServerHeader
        serverName={serverData.server.serverName}
        ip={serverData.server.ip}
        port={serverData.server.port}
        isOnline={isOnline}
        onNavigateBack={() => navigate("/admin/servers")}
      />

      <ServerStatsCards
        isOnline={isOnline}
        playerCount={livePlayerCount}
        maxPlayers={serverData.server.maxPlayers}
        totalHours={serverData.stats.totalHours}
        avgSessionSeconds={serverData.stats.avgSessionSeconds}
      />

      <ServerTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mx-4 rounded-lg border border-border bg-card p-6">
        {activeTab === "overview" && (
          <OverviewTab serverId={serverId} serverData={serverData} />
        )}

        {activeTab === "sessions" && <SessionsTab serverId={serverId} />}

        {activeTab === "analytics" && <AnalyticsTab serverId={serverId} />}
      </div>
    </div>
  );
}
