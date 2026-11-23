import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { ArrowLeft, UserX } from "lucide-react";
import { useAdminPlayers } from "@/contexts/admin";
import { PlayerHeader } from "@/features/admin/players/components/PlayerHeader";
import { PlayerStatsCards } from "@/features/admin/players/components/PlayerStatsCards";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  PlayerTabs,
  type PlayerTabType,
} from "@/features/admin/players/components/PlayerTabs";
import { OverviewTab } from "@/features/admin/players/components/tabs/OverviewTab";
import { PartyTab } from "@/features/admin/players/components/tabs/PartyTab";
import { SessionsTab } from "@/features/admin/players/components/tabs/SessionsTab";
import { TicketsTab } from "@/features/admin/players/components/tabs/TicketsTab";
import { StrikesTab } from "@/features/admin/players/components/tabs/StrikesTab";
import { BansTab } from "@/features/admin/players/components/tabs/BansTab";
import { AuditTab } from "@/features/admin/players/components/tabs/AuditTab";
import { TransactionsTab } from "@/features/admin/players/components/tabs/TransactionsTab";
import { StatsTab } from "@/features/admin/players/components/tabs/StatsTab";
import { BalanceAdjustModal } from "@/features/admin/players/components/modals/BalanceAdjustModal";
import { IssueStrikeModal } from "@/features/admin/players/components/modals/IssueStrikeModal";
import { IssueBanModal } from "@/features/admin/players/components/modals/IssueBanModal";
import { UnbanModal } from "@/features/admin/players/components/modals/UnbanModal";
import { DeletePlayerModal } from "@/features/admin/players/components/modals/DeletePlayerModal";
import { EditPlayerModal } from "@/features/admin/players/components/modals/EditPlayerModal";
import { RemoveStrikeModal } from "@/features/admin/players/components/modals/RemoveStrikeModal";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

type PlayerDialog =
  | { kind: "edit" | "delete" | "balance" | "issueStrike" | "issueBan" }
  | { kind: "removeStrike"; strikeId: number }
  | { kind: "unban"; banId: number };

export function AdminPlayerDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  const [activeTab, setActiveTab] = useState<PlayerTabType>("overview");
  const [dialog, setDialog] = useState<PlayerDialog | null>(null);
  const closeDialog = () => setDialog(null);

  const playerQuery = useQuery(
    trpc.admin.players.players.get.queryOptions({ id }, { enabled: !!id }),
  );

  const player = playerQuery.data;
  const loading = playerQuery.isLoading;
  const error = playerQuery.error?.message ?? null;
  const notFound = playerQuery.error?.data?.code === "NOT_FOUND";

  if (loading) {
    return (
      <LoadingState
        size="large"
        text="Loading player data..."
        className="h-screen flex-none py-0"
      />
    );
  }

  if (error || !player) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        {error && !notFound ? (
          <ErrorState
            message={error}
            onRetry={() => playerQuery.refetch()}
            className="flex-none py-0"
          />
        ) : (
          <EmptyState
            icon={UserX}
            message="Player not found"
            className="flex-none py-0"
          />
        )}
        <Button onClick={() => navigate("/admin/players")} variant="outline">
          <ArrowLeft className="size-4" />
          Back to Players
        </Button>
      </div>
    );
  }

  const playerId = player.player.minecraftUuid;
  const currentServerId = getPlayerServerId(playerId);

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Players", href: "/admin/players" },
        { label: player.player.minecraftUsername },
      ]}
    >
      <PlayerHeader
        player={player.player}
        isOnline={isPlayerOnline(playerId)}
        currentServerName={
          currentServerId !== null ? getServerName(currentServerId) : null
        }
        onEdit={() => setDialog({ kind: "edit" })}
        onDelete={() => setDialog({ kind: "delete" })}
      />

      <PlayerStatsCards
        player={player}
        playerUuid={playerId}
        onAdjustBalance={() => setDialog({ kind: "balance" })}
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as PlayerTabType)}
        className="gap-4"
      >
        <PlayerTabs />

        <TabsContent value={activeTab} tabIndex={-1} asChild>
          <Card className="p-6">
            {activeTab === "overview" && (
              <OverviewTab player={player} getServerName={getServerName} />
            )}

            {activeTab === "party" && <PartyTab playerUuid={playerId} />}

            {activeTab === "sessions" && (
              <SessionsTab playerId={playerId} getServerName={getServerName} />
            )}

            {activeTab === "stats" && (
              <StatsTab playerId={playerId} getServerName={getServerName} />
            )}

            {activeTab === "tickets" && <TicketsTab playerId={playerId} />}

            {activeTab === "strikes" && (
              <StrikesTab
                player={player}
                onIssueStrike={() => setDialog({ kind: "issueStrike" })}
                onRemoveStrike={(strikeId) =>
                  setDialog({ kind: "removeStrike", strikeId })
                }
              />
            )}

            {activeTab === "bans" && (
              <BansTab
                player={player}
                onIssueBan={() => setDialog({ kind: "issueBan" })}
                onUnban={(banId) => setDialog({ kind: "unban", banId })}
              />
            )}

            {activeTab === "transactions" && (
              <TransactionsTab playerId={playerId} />
            )}

            {activeTab === "audit" && <AuditTab playerId={playerId} />}
          </Card>
        </TabsContent>
      </Tabs>

      <EditPlayerModal
        open={dialog?.kind === "edit"}
        onClose={closeDialog}
        player={player.player}
      />

      <BalanceAdjustModal
        open={dialog?.kind === "balance"}
        onClose={closeDialog}
        playerId={playerId}
        playerName={player.player.minecraftUsername}
        currentBalance={player.balance ? parseFloat(player.balance.balance) : 0}
      />

      <IssueStrikeModal
        open={dialog?.kind === "issueStrike"}
        onClose={closeDialog}
        playerId={playerId}
      />

      <IssueBanModal
        open={dialog?.kind === "issueBan"}
        onClose={closeDialog}
        playerId={playerId}
        playerUsername={player.player.minecraftUsername}
      />

      <UnbanModal
        banId={dialog?.kind === "unban" ? dialog.banId : null}
        onClose={closeDialog}
      />

      <DeletePlayerModal
        open={dialog?.kind === "delete"}
        onClose={closeDialog}
        player={player.player}
        onSuccess={() => navigate("/admin/players")}
      />

      <RemoveStrikeModal
        strikeId={dialog?.kind === "removeStrike" ? dialog.strikeId : null}
        onClose={closeDialog}
        playerId={playerId}
      />
    </AdminPage>
  );
}
