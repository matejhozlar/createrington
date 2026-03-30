import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAdminPlayers } from "@/contexts/admin";
import { PlayerHeader } from "./components/PlayerHeader";
import { PlayerStatsCards } from "./components/PlayerStatsCards";
import { PlayerTabs } from "./components/PlayerTabs";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { SessionsTab } from "./components/tabs/SessionsTab";
import { TicketsTab } from "./components/tabs/TicketsTab";
import { StrikesTab } from "./components/tabs/StrikesTab";
import { BansTab } from "./components/tabs/BansTab";
import { AuditTab } from "./components/tabs/AuditTab";
import { TransactionsTab } from "./components/tabs/TransactionsTab";
import { BalanceAdjustModal } from "./components/modals/BalanceAdjustModal";
import { IssueStrikeModal } from "./components/modals/IssueStrikeModal";
import { IssueBanModal } from "./components/modals/IssueBanModal";
import { UnbanModal } from "./components/modals/UnbanModal";
import { DeletePlayerModal } from "./components/modals/DeletePlayerModal";
import { EditPlayerModal } from "./components/modals/EditPlayerModal";
import { RemoveStrikeModal } from "./components/modals/RemoveStrikeModal";
import { trpc } from "@/lib/trpc";

type TabType =
  | "overview"
  | "sessions"
  | "tickets"
  | "strikes"
  | "bans"
  | "transactions"
  | "audit";

export function AdminPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
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

  // tRPC query for player data
  const playerQuery = trpc.admin.players.players.get.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  const player = playerQuery.data;
  const loading = playerQuery.isLoading;
  const error = playerQuery.error?.message ?? null;

  const refetchPlayer = () => {
    playerQuery.refetch();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="large" text="Loading player data..." />
      </div>
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
            className="mt-4 cursor-pointer"
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
    <div className="flex flex-1 flex-col gap-4">
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
        onAdjustBalance={() => setShowBalanceModal(true)}
      />

      <PlayerTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mx-4 mb-4 rounded-lg border border-border bg-card p-6">
        {activeTab === "overview" && (
          <OverviewTab player={player} getServerName={getServerName} />
        )}

        {activeTab === "sessions" && id && (
          <SessionsTab playerId={id} getServerName={getServerName} />
        )}

        {activeTab === "tickets" && <TicketsTab playerId={id!} />}

        {activeTab === "strikes" && (
          <StrikesTab
            player={player}
            onIssueStrike={() => setShowStrikeModal(true)}
            onRefresh={refetchPlayer}
            onRemoveStrike={openRemoveStrikeModal}
          />
        )}

        {activeTab === "bans" && (
          <BansTab
            player={player}
            onIssueBan={() => setShowBanModal(true)}
            onRefresh={refetchPlayer}
            onUnban={openUnbanModal}
          />
        )}

        {activeTab === "transactions" && <TransactionsTab playerId={id!} />}

        {activeTab === "audit" && <AuditTab playerId={id!} />}
      </div>

      {/* Modals */}
      <EditPlayerModal
        key={player.player.minecraftUuid}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player.player}
        onSuccess={refetchPlayer}
      />

      <BalanceAdjustModal
        open={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        playerId={id!}
        currentBalance={player.balance ? parseFloat(player.balance.balance) : 0}
        onSuccess={refetchPlayer}
      />

      <IssueStrikeModal
        open={showStrikeModal}
        onClose={() => setShowStrikeModal(false)}
        playerId={id!}
        onSuccess={refetchPlayer}
      />

      <IssueBanModal
        open={showBanModal}
        onClose={() => setShowBanModal(false)}
        playerId={id!}
        playerUsername={player.player.minecraftUsername}
        onSuccess={refetchPlayer}
      />

      {selectedBanId !== null && (
        <UnbanModal
          open={showUnbanModal}
          onClose={closeUnbanModal}
          banId={selectedBanId}
          onSuccess={refetchPlayer}
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
          onSuccess={refetchPlayer}
        />
      )}
    </div>
  );
}
