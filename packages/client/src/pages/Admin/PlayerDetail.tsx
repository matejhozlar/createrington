// packages/client/src/pages/Admin/PlayerDetail.tsx
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loading } from "@/components/Loading";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Coins,
  Clock,
  AlertTriangle,
  Ticket,
  Edit,
  Trash2,
  Plus,
  Minus,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminPlayerDetailed,
  GetAdminPlayerResponse,
  AdjustPlayerBalanceResponse,
  IssueStrikeResponse,
  RemoveStrikeResponse,
  StrikeClassification,
} from "@createrington/shared/api";

export function AdminPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Player data state
  const [player, setPlayer] = useState<AdminPlayerDetailed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "overview" | "sessions" | "tickets" | "strikes" | "audit"
  >("overview");

  // Modals state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Balance adjustment state
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Strike state
  const [strikeClassification, setStrikeClassification] =
    useState<StrikeClassification>("rule_violation");
  const [strikeDescription, setStrikeDescription] = useState("");
  const [strikeSeverity, setStrikeSeverity] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [strikeLoading, setStrikeLoading] = useState(false);

  // Delete state
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  /**
   * Fetch player details
   */
  const fetchPlayer = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch(`/api/admin/players/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetAdminPlayerResponse = await response.json();

      if (data.success) {
        setPlayer(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch player:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch player data",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load player on mount
  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  /**
   * Adjust player balance
   */
  const handleBalanceAdjust = useCallback(async () => {
    if (!id || !balanceAmount || !balanceReason) return;

    try {
      setBalanceLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`/api/admin/players/${id}/balance/adjust`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(balanceAmount),
          reason: balanceReason,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AdjustPlayerBalanceResponse = await response.json();

      if (data.success) {
        // Refresh player data
        await fetchPlayer();

        // Reset form
        setBalanceAmount("");
        setBalanceReason("");
        setShowBalanceModal(false);

        alert(
          `Balance adjusted successfully! New balance: $${data.data.newBalance}`,
        );
      }
    } catch (err) {
      console.error("Failed to adjust balance:", err);
      alert("Failed to adjust balance");
    } finally {
      setBalanceLoading(false);
    }
  }, [id, balanceAmount, balanceReason, fetchPlayer]);

  /**
   * Issue strike
   */
  const handleIssueStrike = useCallback(async () => {
    if (!id || !strikeDescription) return;

    try {
      setStrikeLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`/api/admin/players/${id}/strikes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classification: strikeClassification,
          description: strikeDescription,
          severity: strikeSeverity,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: IssueStrikeResponse = await response.json();

      if (data.success) {
        // Refresh player data
        await fetchPlayer();

        // Reset form
        setStrikeDescription("");
        setStrikeSeverity(1);
        setShowStrikeModal(false);

        alert("Strike issued successfully!");
      }
    } catch (err) {
      console.error("Failed to issue strike:", err);
      alert("Failed to issue strike");
    } finally {
      setStrikeLoading(false);
    }
  }, [
    id,
    strikeClassification,
    strikeDescription,
    strikeSeverity,
    fetchPlayer,
  ]);

  /**
   * Remove strike
   */
  const handleRemoveStrike = useCallback(
    async (strikeId: number) => {
      if (!id) return;

      const reason = prompt("Enter reason for removing this strike:");
      if (!reason) return;

      try {
        const token = localStorage.getItem("auth_token");
        if (!token) throw new Error("No authentication token");

        const response = await fetch(
          `/api/admin/players/${id}/strikes/${strikeId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason }),
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: RemoveStrikeResponse = await response.json();

        if (data.success) {
          // Refresh player data
          await fetchPlayer();
          alert("Strike removed successfully!");
        }
      } catch (err) {
        console.error("Failed to remove strike:", err);
        alert("Failed to remove strike");
      }
    },
    [id, fetchPlayer],
  );

  /**
   * Delete player
   */
  const handleDeletePlayer = useCallback(async () => {
    if (!id || !deleteReason) return;

    const confirmText = prompt(
      'Type "DELETE" to confirm permanent deletion of this player:',
    );
    if (confirmText !== "DELETE") return;

    try {
      setDeleteLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`/api/admin/players/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: deleteReason }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      alert("Player deleted successfully!");
      navigate("/admin/players");
    } catch (err) {
      console.error("Failed to delete player:", err);
      alert("Failed to delete player");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }, [id, deleteReason, navigate]);

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

  const balance = player.balance ? parseFloat(player.balance.balance) : 0;
  const totalPlaytimeHours = Math.floor(player.playtime.totalSeconds / 3600);
  const activeStrikes = player.strikes.activeCount;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/players">Players</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{player.player.minecraftUsername}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Back Button */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/admin/players")}
        >
          <ArrowLeft className="size-4" />
          Back to Players
        </Button>
      </div>

      {/* Player Header Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarImage
                src={`https://mc-heads.net/avatar/${player.player.minecraftUuid}`}
                alt={player.player.minecraftUsername}
              />
              <AvatarFallback>
                {player.player.minecraftUsername.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {player.player.minecraftUsername}
                </h1>
                <Badge
                  variant={player.player.online ? "default" : "outline"}
                  className={cn(
                    player.player.online &&
                      "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                  )}
                >
                  {player.player.online ? "Online" : "Offline"}
                </Badge>
                {activeStrikes > 0 && (
                  <Badge variant="destructive">
                    {activeStrikes} Active Strike{activeStrikes > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Discord: {player.player.minecraftUsername}
              </p>
              <p className="text-xs text-muted-foreground">
                UUID: {player.player.minecraftUuid}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered:{" "}
                {new Date(player.player.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Last seen:{" "}
                {new Date(player.player.lastSeen).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Balance */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-2xl font-semibold">
                ${balance.toLocaleString()}
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
              <Coins className="size-6 text-chart-3" />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setShowBalanceModal(true)}
          >
            Adjust Balance
          </Button>
        </div>

        {/* Playtime */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Playtime</p>
              <p className="text-2xl font-semibold">{totalPlaytimeHours}h</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
              <Clock className="size-6 text-sidebar-primary" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {player.playtime.totalSessions} sessions
          </p>
        </div>

        {/* Strikes */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Strikes</p>
              <p className="text-2xl font-semibold">{activeStrikes}</p>
            </div>
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full",
                activeStrikes > 0 ? "bg-destructive/10" : "bg-green-500/10",
              )}
            >
              <AlertTriangle
                className={cn(
                  "size-6",
                  activeStrikes > 0 ? "text-destructive" : "text-green-500",
                )}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setShowStrikeModal(true)}
          >
            Issue Strike
          </Button>
        </div>

        {/* Tickets */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Support Tickets</p>
              <p className="text-2xl font-semibold">{player.tickets.total}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
              <Ticket className="size-6 text-chart-4" />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {player.tickets.open} open
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { id: "overview" as const, label: "Overview" },
          { id: "sessions" as const, label: "Sessions" },
          { id: "tickets" as const, label: "Tickets" },
          { id: "strikes" as const, label: "Strikes" },
          { id: "audit" as const, label: "Audit Log" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-sidebar-primary text-sidebar-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Playtime by Server</h3>
              <div className="mt-4 space-y-2">
                {player.playtime.summary.map((server) => (
                  <div
                    key={server.serverId}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">Server {server.serverId}</p>
                      <p className="text-xs text-muted-foreground">
                        {server.totalSessions} sessions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {Math.floor(parseInt(server.totalSeconds) / 3600)}h{" "}
                        {Math.floor(
                          (parseInt(server.totalSeconds) % 3600) / 60,
                        )}
                        m
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg:{" "}
                        {Math.floor(parseInt(server.avgSessionSeconds) / 60)}m
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {player.waitlist && (
              <div>
                <h3 className="text-lg font-semibold">Waitlist Status</h3>
                <div className="mt-4 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Status: {player.waitlist.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted:{" "}
                        {new Date(
                          player.waitlist.submittedAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    {player.waitlist.acceptedAt && (
                      <Badge variant="default">Accepted</Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Session History</h3>
            <p className="text-muted-foreground">
              Session history will be loaded here...
            </p>
          </div>
        )}

        {activeTab === "tickets" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Support Tickets</h3>
            <p className="text-muted-foreground">
              Tickets will be loaded here...
            </p>
          </div>
        )}

        {activeTab === "strikes" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Strikes</h3>
              <Button size="sm" onClick={() => setShowStrikeModal(true)}>
                <Shield className="size-4" />
                Issue Strike
              </Button>
            </div>

            {player.strikes.active.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No active strikes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {player.strikes.active.map((strike) => (
                  <div
                    key={strike.id}
                    className="flex items-start justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">
                          Severity {strike.severity}
                        </Badge>
                        <Badge variant="outline">{strike.classification}</Badge>
                      </div>
                      <p className="mt-2 text-sm">{strike.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Issued by {strike.issuedByDiscordId} on{" "}
                        {new Date(strike.issuedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveStrike(strike.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {player.strikes.all.length > player.strikes.active.length && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Removed Strikes
                </h4>
                <div className="mt-2 space-y-2">
                  {player.strikes.all
                    .filter((s) => s.removedAt)
                    .map((strike) => (
                      <div
                        key={strike.id}
                        className="rounded-lg border border-border bg-muted/50 p-4 opacity-60"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            Severity {strike.severity}
                          </Badge>
                          <Badge variant="outline">
                            {strike.classification}
                          </Badge>
                          <Badge variant="outline">Removed</Badge>
                        </div>
                        <p className="mt-2 text-sm">{strike.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Removed by {strike.removedByDiscordId} on{" "}
                          {new Date(strike.removedAt!).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "audit" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Audit Log</h3>
            <p className="text-muted-foreground">
              Audit log will be loaded here...
            </p>
          </div>
        )}
      </div>

      {/* Balance Adjustment Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Adjust Balance</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBalanceModal(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setBalanceAmount((prev) =>
                        prev.startsWith("-") ? prev.slice(1) : `-${prev}`,
                      )
                    }
                  >
                    {balanceAmount.startsWith("-") ? (
                      <Plus className="size-4" />
                    ) : (
                      <Minus className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current balance: ${balance.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Reason</label>
                <Input
                  type="text"
                  placeholder="Enter reason for adjustment"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBalanceModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBalanceAdjust}
                  disabled={!balanceAmount || !balanceReason || balanceLoading}
                >
                  {balanceLoading ? "Adjusting..." : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strike Modal */}
      {showStrikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Issue Strike</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStrikeModal(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Classification</label>
                <select
                  value={strikeClassification}
                  onChange={(e) =>
                    setStrikeClassification(
                      e.target.value as StrikeClassification,
                    )
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="pvp">PvP</option>
                  <option value="theft">Theft</option>
                  <option value="griefing">Griefing</option>
                  <option value="laggy_machines">Laggy Machines</option>
                  <option value="inappropriate_chat">Inappropriate Chat</option>
                  <option value="harassment">Harassment</option>
                  <option value="exploiting">Exploiting</option>
                  <option value="rule_violation">Rule Violation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Severity (1-5)</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={strikeSeverity}
                  onChange={(e) =>
                    setStrikeSeverity(
                      parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
                    )
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Describe the violation..."
                  value={strikeDescription}
                  onChange={(e) => setStrikeDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowStrikeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleIssueStrike}
                  disabled={!strikeDescription || strikeLoading}
                >
                  {strikeLoading ? "Issuing..." : "Issue Strike"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-destructive">
                Delete Player
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteModal(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              This will permanently delete all player data including balance,
              sessions, tickets, and strikes. This action cannot be undone.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Reason</label>
                <Input
                  type="text"
                  placeholder="Enter reason for deletion"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeletePlayer}
                  disabled={!deleteReason || deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Delete Player"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
