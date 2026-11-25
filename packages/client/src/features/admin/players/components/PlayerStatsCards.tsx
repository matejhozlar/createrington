import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Coins, Clock, AlertTriangle, Ticket, Users } from "lucide-react";
import { pluralize } from "@/lib/format";
import { formatMoney } from "@createrington/shared/format";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { MAIN_SERVER_ID } from "@/lib/minecraft";
import { useOverlayMask } from "@/hooks/use-admin-overlay";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

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
  const mask = useOverlayMask();
  const balance = player.balance ? parseFloat(player.balance.balance) : 0;
  const totalPlaytimeHours = Math.floor(player.playtime.totalSeconds / 3600);
  const activeStrikes = player.strikes.activeCount;
  const activeBans = player.bans.activeCount;
  const totalStrikes = player.strikes.totalCount;
  const totalBans = player.bans.totalCount;

  const partyQuery = useQuery(
    trpc.admin.parties.playerStatus.queryOptions({
      serverId: MAIN_SERVER_ID,
      playerUuid,
    }),
  );

  const party = partyQuery.data?.party ?? null;
  const allyOfCount = partyQuery.data?.allyOf.length ?? 0;
  const partyDetail = party
    ? `${party.rank.charAt(0).toUpperCase()}${party.rank.slice(1)} · ${pluralize(party.memberCount, "member")}`
    : allyOfCount > 0
      ? `Ally of ${pluralize(allyOfCount, "party", "parties")}`
      : "Not in a party";

  const totalOffenses = activeStrikes + activeBans;
  const allTimeOffenses = totalStrikes + totalBans;
  const offenseTone =
    activeBans > 0 ? "destructive" : activeStrikes > 0 ? "warning" : "success";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Balance"
        value={<span {...mask}>{formatMoney(balance)}</span>}
        icon={Coins}
        tone="chart-3"
        action={
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onAdjustBalance}
          >
            Adjust Balance
          </Button>
        }
      />
      <StatCard
        label="Total Playtime"
        value={`${totalPlaytimeHours}h`}
        icon={Clock}
        tone="primary"
        footer={`${player.playtime.totalSessions} sessions`}
      />
      <StatCard
        label="Active Offenses"
        value={totalOffenses}
        icon={AlertTriangle}
        tone={offenseTone}
        footer={`${allTimeOffenses} total`}
      />
      <StatCard
        label="Support Tickets"
        value={player.tickets.total}
        icon={Ticket}
        tone="chart-4"
        footer={`${player.tickets.open} open`}
      />
      <StatCard
        label="Party"
        value={party?.name ?? "None"}
        icon={Users}
        tone={party ? "chart-2" : "muted"}
        footer={partyDetail}
      />
    </div>
  );
}
