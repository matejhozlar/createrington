import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ArrowLeft } from "lucide-react";
import { useAdminPlayers } from "@/contexts/admin";
import { PlayerHeader } from "./components/PlayerHeader";
import { PlayerStatsCards } from "./components/PlayerStatsCards";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PlayerTabs, type PlayerTabType } from "./components/PlayerTabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { PartyTab } from "./components/tabs/PartyTab";
import { SessionsTab } from "./components/tabs/SessionsTab";
import { TicketsTab } from "./components/tabs/TicketsTab";
import { StrikesTab } from "./components/tabs/StrikesTab";
import { BansTab } from "./components/tabs/BansTab";
import { AuditTab } from "./components/tabs/AuditTab";
import { TransactionsTab } from "./components/tabs/TransactionsTab";
import { StatsTab } from "./components/tabs/StatsTab";
import { BalanceAdjustModal } from "./components/modals/BalanceAdjustModal";
import { IssueStrikeModal } from "./components/modals/IssueStrikeModal";
import { IssueBanModal } from "./components/modals/IssueBanModal";
import { UnbanModal } from "./components/modals/UnbanModal";
import { DeletePlayerModal } from "./components/modals/DeletePlayerModal";
import { EditPlayerModal } from "./components/modals/EditPlayerModal";
import { RemoveStrikeModal } from "./components/modals/RemoveStrikeModal";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

export function AdminPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  const [activeTab, setActiveTab] = useState<PlayerTabType>("overview");

  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceModalKey, setBalanceModalKey] = useState(0);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveStrikeModal, setShowRemoveStrikeModal] = useState(false);
  const [selectedStrikeId, setSelectedStrikeId] = useState<number | null>(null);
  const [selectedBanId, setSelectedBanId] = useState<number | null>(null);

  const openRemoveStrikeModal = (strikeId: number) => {
    setSelectedStrikeId(strikeId);
    setShowRemoveStrikeModal(true);
  };

  const closeRemoveStrikeModal = () => {
    setShowRemoveStrikeModal(false);
    setSelectedStrikeId(null);
  };

  const openUnbanModal = (banId: number) => {
    setSelectedBanId(banId);
    setShowUnbanModal(true);
  };

  const closeUnbanModal = () => {
    setShowUnbanModal(false);
    setSelectedBanId(null);
  };

  const playerQuery = useQuery(
    trpc.admin.players.players.get.queryOptions({ id: id! }, { enabled: !!id }),
  );

  const player = playerQuery.data;
  const loading = playerQuery.isLoading;
  const error = playerQuery.error?.message ?? null;

  if (loading) {
    return (
      <LoadingState
        size="large"
        text="Loading player data..."
        className="h-screen flex-none py-0"
      />
    );
  }

  const currentServerId = player
    ? getPlayerServerId(player.player.minecraftUuid)
    : null;

  if (error || !player) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error || "Player not found"}</p>
          <Button
            onClick={() => navigate("/admin/players")}
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Back to Players
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Players", href: "/admin/players" },
          { label: player.player.minecraftUsername },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 py-4">
        <PlayerHeader
          player={player.player}
          isOnline={isPlayerOnline(player.player.minecraftUuid)}
          currentServerName={
            currentServerId !== null ? getServerName(currentServerId) : null
          }
          onEdit={() => setShowEditModal(true)}
          onDelete={() => setShowDeleteModal(true)}
        />

        <PlayerStatsCards
          player={player}
          playerUuid={player.player.minecraftUuid}
          onAdjustBalance={() => {
            setBalanceModalKey((key) => key + 1);
            setShowBalanceModal(true);
          }}
        />

        <Tabs
          value={activeTab}
          onValueChange={(tab) => setActiveTab(tab as PlayerTabType)}
          className="gap-4"
        >
          <PlayerTabs />

          <TabsContent
            value={activeTab}
            className="mb-4 rounded-lg border border-border bg-card p-6"
          >
            {activeTab === "overview" && (
              <OverviewTab player={player} getServerName={getServerName} />
            )}

            {activeTab === "party" && (
              <PartyTab playerUuid={player.player.minecraftUuid} />
            )}

            {activeTab === "sessions" && id && (
              <SessionsTab playerId={id} getServerName={getServerName} />
            )}

            {activeTab === "stats" && id && (
              <StatsTab playerId={id} getServerName={getServerName} />
            )}

            {activeTab === "tickets" && <TicketsTab playerId={id!} />}

            {activeTab === "strikes" && (
              <StrikesTab
                player={player}
                onIssueStrike={() => setShowStrikeModal(true)}
                onRemoveStrike={openRemoveStrikeModal}
              />
            )}

            {activeTab === "bans" && (
              <BansTab
                player={player}
                onIssueBan={() => setShowBanModal(true)}
                onUnban={openUnbanModal}
              />
            )}

            {activeTab === "transactions" && <TransactionsTab playerId={id!} />}

            {activeTab === "audit" && <AuditTab playerId={id!} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <EditPlayerModal
        key={player.player.minecraftUuid}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player.player}
      />

      <BalanceAdjustModal
        key={balanceModalKey}
        open={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        playerId={id!}
        playerName={player.player.minecraftUsername}
        currentBalance={player.balance ? parseFloat(player.balance.balance) : 0}
      />

      <IssueStrikeModal
        open={showStrikeModal}
        onClose={() => setShowStrikeModal(false)}
        playerId={id!}
      />

      <IssueBanModal
        open={showBanModal}
        onClose={() => setShowBanModal(false)}
        playerId={id!}
        playerUsername={player.player.minecraftUsername}
      />

      {selectedBanId !== null && (
        <UnbanModal
          open={showUnbanModal}
          onClose={closeUnbanModal}
          banId={selectedBanId}
        />
      )}

      <DeletePlayerModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        player={player.player}
        onSuccess={() => navigate("/admin/players")}
      />

      {selectedStrikeId !== null && (
        <RemoveStrikeModal
          open={showRemoveStrikeModal}
          onClose={closeRemoveStrikeModal}
          playerId={id!}
          strikeId={selectedStrikeId}
        />
      )}
    </div>
  );
}
