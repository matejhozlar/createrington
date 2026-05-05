import { Button } from "@/components/ui/button";
import { Coins, Clock, AlertTriangle, Ticket, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

const SERVER_ID = 1;

interface PlayerStatsCardsProps {
  player: PlayerDetailed;
  playerUuid: string;
  onAdjustBalance: () => void;
}

export function PlayerStatsCards({
  player,
  playerUuid,
  onAdjustBalance,
}: PlayerStatsCardsProps) {
  const balance = player.balance ? parseFloat(player.balance.balance) : 0;
  const totalPlaytimeHours = Math.floor(player.playtime.totalSeconds / 3600);
  const activeStrikes = player.strikes.activeCount;
  const activeBans = player.bans.activeCount;
  const totalStrikes = player.strikes.totalCount;
  const totalBans = player.bans.totalCount;

  const statusQuery = trpc.admin.parties.playerStatus.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });

  const { qualification, partyAlliance } = statusQuery.data ?? {};

  const allyStatus: {
    label: string;
    detail: string;
    color: "blue" | "amber" | "muted";
  } = (() => {
    if (qualification && !qualification.isPending && partyAlliance) {
      return {
        label: "Allied",
        detail: partyAlliance.partyName ?? "Allied party",
        color: "blue",
      };
    }
    if (qualification?.isPending) {
      return {
        label: "Pending",
        detail: "Qualified, awaiting party",
        color: "amber",
      };
    }
    if (!qualification && partyAlliance) {
      return {
        label: "Allied via Party",
        detail: partyAlliance.partyName ?? "Allied party",
        color: "blue",
      };
    }
    return {
      label: "Not Qualified",
      detail: "Requirements not met",
      color: "muted",
    };
  })();

  const totalOffenses = activeStrikes + activeBans;
  const allTimeOffenses = totalStrikes + totalBans;
  const hasAnyBans = activeBans > 0;
  const offenseColor = hasAnyBans
    ? "red"
    : activeStrikes > 0
      ? "yellow"
      : "green";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          onClick={onAdjustBalance}
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

      {/* Active Offenses (Strikes + Bans) */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Active Offenses</p>
            <p className="text-2xl font-semibold">{totalOffenses}</p>
          </div>
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              offenseColor === "red" && "bg-destructive/10",
              offenseColor === "yellow" && "bg-yellow-500/10",
              offenseColor === "green" && "bg-green-500/10",
            )}
          >
            <AlertTriangle
              className={cn(
                "size-6",
                offenseColor === "red" && "text-destructive",
                offenseColor === "yellow" && "text-yellow-500",
                offenseColor === "green" && "text-green-500",
              )}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {allTimeOffenses} total
        </p>
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

      {/* Ally Status */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Ally Status</p>
            <p className="text-2xl font-semibold">{allyStatus.label}</p>
          </div>
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              allyStatus.color === "blue" && "bg-blue-500/10",
              allyStatus.color === "amber" && "bg-amber-500/10",
              allyStatus.color === "muted" && "bg-muted",
            )}
          >
            <Handshake
              className={cn(
                "size-6",
                allyStatus.color === "blue" && "text-blue-400",
                allyStatus.color === "amber" && "text-amber-500",
                allyStatus.color === "muted" && "text-muted-foreground",
              )}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {allyStatus.detail}
        </p>
      </div>
    </div>
  );
}
