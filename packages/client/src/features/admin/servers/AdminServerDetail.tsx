import { useState } from "react";
import { useParams } from "react-router";
import { Server } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useLiveServerState } from "@/contexts/server-data";
import { ServerHeader } from "./components/ServerHeader";
import { ServerStatsCards } from "./components/ServerStatsCards";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ServerTabs, type ServerTabType } from "./components/ServerTabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { SessionsTab } from "./components/tabs/SessionsTab";
import { AnalyticsTab } from "./components/tabs/AnalyticsTab";
import { MaintenanceToggle } from "./components/MaintenanceToggle";
import { ServerManagement } from "./components/ServerManagement";
import { useQuery } from "@tanstack/react-query";

export function AdminServerDetail() {
  const { id } = useParams<{ id: string }>();
  const serverId = parseInt(id ?? "0", 10);

  const serverQuery = useQuery(
    trpc.admin.servers.get.queryOptions(
      { id: serverId },
      { enabled: serverId > 0 },
    ),
  );

  const serverData = serverQuery.data;
  const loading = serverQuery.isLoading;
  const error = serverQuery.error?.message ?? null;
  const notFound = serverQuery.error?.data?.code === "NOT_FOUND";

  if (loading) {
    return (
      <LoadingState
        size="large"
        text="Loading server data..."
        className="h-screen flex-none py-0"
      />
    );
  }

  if (error && !notFound) {
    return (
      <ErrorState
        message={error}
        onRetry={() => serverQuery.refetch()}
        className="h-screen flex-none py-0"
      />
    );
  }

  if (!serverData) {
    return (
      <EmptyState
        icon={Server}
        message="Server not found"
        className="h-screen flex-none py-0"
      />
    );
  }

  return <ServerDetail serverId={serverId} serverData={serverData} />;
}

function ServerDetail({
  serverId,
  serverData,
}: {
  serverId: number;
  serverData: RouterOutput["admin"]["servers"]["get"];
}) {
  const [activeTab, setActiveTab] = useState<ServerTabType>("overview");
  const { online, maintenance, playerCount, presence } = useLiveServerState(
    serverData.server,
  );

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Servers", href: "/admin/servers" },
        { label: serverData.server.serverName },
      ]}
    >
      <ServerHeader
        serverName={serverData.server.serverName}
        ip={serverData.server.ip}
        port={serverData.server.port}
        presence={presence}
      />

      <ServerStatsCards
        isOnline={online}
        playerCount={playerCount}
        maxPlayers={serverData.server.maxPlayers}
        totalHours={serverData.stats.totalHours}
        avgSessionSeconds={serverData.stats.avgSessionSeconds}
      />

      <MaintenanceToggle serverId={serverId} isMaintenance={maintenance} />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as ServerTabType)}
        className="gap-4"
      >
        <ServerTabs />

        <TabsContent value={activeTab} tabIndex={-1} asChild>
          <Card className="p-6">
            {activeTab === "overview" && (
              <OverviewTab serverId={serverId} serverData={serverData} />
            )}

            {activeTab === "management" && (
              <ServerManagement serverId={serverId} />
            )}

            {activeTab === "sessions" && <SessionsTab serverId={serverId} />}

            {activeTab === "analytics" && <AnalyticsTab serverId={serverId} />}
          </Card>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
