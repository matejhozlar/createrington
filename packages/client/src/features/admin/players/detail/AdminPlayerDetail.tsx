import React, { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/Loading";
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
import { AuditTab } from "./components/tabs/AuditTab";
import { BalanceAdjustModal } from "./components/modals/BalanceAdjustModal";
import { IssueStrikeModal } from "./components/modals/IssueStrikeModal";
import { DeletePlayerModal } from "./components/modals/DeletePlayerModal";
import { EditPlayerModal } from "./components/modals/EditPlayerModal";
import type { AdminPlayerDetailed } from "@createrington/shared/api";
import { RemoveStrikeModal } from "./components/modals/RemoveStrikeModal";
import { adminPlayerApi } from "@/services/api/admin/admin-players";

type TabType = "overview" | "sessions" | "tickets" | "strikes" | "audit";

export function AdminPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  // Player data state
  const [player, setPlayer] = useState<AdminPlayerDetailed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveStrikeModal, setShowRemoveStrikeModal] = useState(false);
  const [selectedStrikeId, setSelectedStrikeId] = useState<number | null>(null);

  const openRemoveStrikeModal = (strikeId: number) => {
    setSelectedStrikeId(strikeId);
    setShowRemoveStrikeModal(true);
  };

  const closeRemoveStrikeModal = () => {
    setShowRemoveStrikeModal(false);
    setSelectedStrikeId(null);
  };

  /**
   * Fetch player details
   */
  const fetchPlayer = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const data = await adminPlayerApi.getById(id);
      setPlayer(data);
    } catch (error) {
      console.error("Failed to fetch player:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch player data",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load player on mount
  React.useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="large" text="Loading player data..." />
      </div>
    );
  }

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
          getPlayerServerId(player.player.minecraftUuid)
            ? getServerName(getPlayerServerId(player.player.minecraftUuid)!)
            : null
        }
        onNavigateBack={() => navigate("/admin/players")}
        onEdit={() => setShowEditModal(true)}
        onDelete={() => setShowDeleteModal(true)}
      />

      <PlayerStatsCards
        player={player}
        onAdjustBalance={() => setShowBalanceModal(true)}
        onIssueStrike={() => setShowStrikeModal(true)}
      />

      <PlayerTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mx-4 rounded-lg border border-border bg-card p-6">
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
            onRefresh={fetchPlayer}
            onRemoveStrike={openRemoveStrikeModal}
          />
        )}

        {activeTab === "audit" && <AuditTab playerId={id!} />}
      </div>

      {/* Modals */}
      <EditPlayerModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        player={player.player}
        onSuccess={fetchPlayer}
      />

      <BalanceAdjustModal
        open={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        playerId={id!}
        currentBalance={player.balance ? parseFloat(player.balance.balance) : 0}
        onSuccess={fetchPlayer}
      />

      <IssueStrikeModal
        open={showStrikeModal}
        onClose={() => setShowStrikeModal(false)}
        playerId={id!}
        onSuccess={fetchPlayer}
      />

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
          onSuccess={fetchPlayer}
        />
      )}
    </div>
  );
}
