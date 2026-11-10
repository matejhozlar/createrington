import { useState } from "react";
import { useParams } from "react-router";
import { LoadingState } from "@/components/query-states";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { trpc } from "@/lib/trpc";
import { useServerData } from "@/contexts/server-data";
import { ServerHeader } from "./components/ServerHeader";
import { ServerStatsCards } from "./components/ServerStatsCards";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ServerTabs, type ServerTabType } from "./components/ServerTabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { SessionsTab } from "./components/tabs/SessionsTab";
import { AnalyticsTab } from "./components/tabs/AnalyticsTab";
import { MaintenanceToggle } from "./components/MaintenanceToggle";
import { ServerManagement } from "./components/ServerManagement";
import { useQuery } from "@tanstack/react-query";

export function AdminServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { getServer } = useServerData();
  const serverId = parseInt(id ?? "0", 10);

  const [activeTab, setActiveTab] = useState<ServerTabType>("overview");

  const serverQuery = useQuery(
    trpc.admin.servers.get.queryOptions(
      { id: serverId },
      { enabled: serverId > 0 },
    ),
  );

  const serverData = serverQuery.data;
  const loading = serverQuery.isLoading;
  const error = serverQuery.error?.message ?? null;

  if (loading) {
    return (
      <LoadingState
        size="large"
        text="Loading server data..."
        className="h-screen flex-none py-0"
      />
    );
  }

  if (error || !serverData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">{error || "Server not found"}</p>
      </div>
    );
  }

  const liveData = getServer(serverId);
  const isOnline = liveData?.online ?? serverData.server.status === "online";
  const isMaintenance =
    liveData?.maintenance ?? serverData.server.maintenance ?? false;
  const livePlayerCount =
    liveData?.playerCount ?? serverData.server.playerCount;

  return (
    <div className="flex flex-1 flex-col">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Servers", href: "/admin/servers" },
          { label: serverData.server.serverName },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 py-4">
        <ServerHeader
          serverName={serverData.server.serverName}
          ip={serverData.server.ip}
          port={serverData.server.port}
          isOnline={isOnline}
          isMaintenance={isMaintenance}
        />

        <ServerStatsCards
          isOnline={isOnline}
          playerCount={livePlayerCount}
          maxPlayers={serverData.server.maxPlayers}
          totalHours={serverData.stats.totalHours}
          avgSessionSeconds={serverData.stats.avgSessionSeconds}
        />

        <MaintenanceToggle serverId={serverId} isMaintenance={isMaintenance} />

        <Tabs
          value={activeTab}
          onValueChange={(tab) => setActiveTab(tab as ServerTabType)}
          className="gap-4"
        >
          <ServerTabs />

          <TabsContent
            value={activeTab}
            className="rounded-lg border border-border bg-card p-6"
          >
            {activeTab === "overview" && (
              <OverviewTab serverId={serverId} serverData={serverData} />
            )}

            {activeTab === "management" && (
              <ServerManagement serverId={serverId} />
            )}

            {activeTab === "sessions" && <SessionsTab serverId={serverId} />}

            {activeTab === "analytics" && <AnalyticsTab serverId={serverId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
