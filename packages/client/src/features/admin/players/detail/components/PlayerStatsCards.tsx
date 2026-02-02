import { Button } from "@/components/ui/button";
import { Coins, Clock, AlertTriangle, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPlayerDetailed } from "@createrington/shared/api";

interface PlayerStatsCardsProps {
  player: AdminPlayerDetailed;
  onAdjustBalance: () => void;
  onIssueStrike: () => void;
}

export function PlayerStatsCards({
  player,
  onAdjustBalance,
  onIssueStrike,
}: PlayerStatsCardsProps) {
  const balance = player.balance ? parseFloat(player.balance.balance) : 0;
  const totalPlaytimeHours = Math.floor(player.playtime.totalSeconds / 3600);
  const activeStrikes = player.strikes.activeCount;

  return (
    <div className="mx-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          className="mt-4 w-full cursor-pointer"
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
          className="mt-4 w-full cursor-pointer"
          onClick={onIssueStrike}
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
  );
}
