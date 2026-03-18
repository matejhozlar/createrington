import React, { useState } from "react";
import { useAuth } from "@/contexts/auth";
import { useServerData } from "@/contexts/server-data";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import { Loading } from "@/components/loading-spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Gift,
  CheckCircle,
  Lock,
  Pickaxe,
  Sword,
  Compass,
  Coins,
  Clock,
  TrendingUp,
} from "lucide-react";

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  mining: { label: "Mining", icon: Pickaxe, color: "text-amber-400" },
  combat: { label: "Combat", icon: Sword, color: "text-destructive" },
  exploration: {
    label: "Exploration",
    icon: Compass,
    color: "text-emerald-400",
  },
  economy: { label: "Economy", icon: Coins, color: "text-yellow-400" },
  playtime: { label: "Playtime", icon: Clock, color: "text-blue-400" },
  trading: { label: "Trading", icon: TrendingUp, color: "text-purple-400" },
};

const TIER_LABELS = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
];

export const Achievements: React.FC = () => {
  const { user } = useAuth();
  const { servers } = useServerData();
  const toast = useToastActions();

  const onlineServers = servers.filter((s) => s.online);
  const [serverId, setServerId] = useState<number | null>(
    onlineServers[0]?.serverId ?? servers[0]?.serverId ?? null,
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const {
    data: progress,
    isLoading,
    refetch,
  } = trpc.user.achievements.getProgress.useQuery(
    { serverId: serverId! },
    { enabled: !!serverId },
  );

  const claimMutation = trpc.user.achievements.claim.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Claimed $${result.reward} for ${result.groupId} ${TIER_LABELS[result.tier]}`,
      );
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const claimAllMutation = trpc.user.achievements.claimAll.useMutation({
    onSuccess: (results) => {
      if (results.length === 0) {
        toast.info("No rewards to claim");
      } else {
        const total = results.reduce((sum, r) => sum + r.reward, 0);
        toast.success(
          `Claimed ${results.length} reward(s) for $${total} total`,
        );
      }
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Please log in to view achievements.
        </p>
      </div>
    );
  }

  const filtered =
    categoryFilter === "all"
      ? progress
      : progress?.filter((p) => p.group.category === categoryFilter);

  const unclaimedCount =
    progress?.reduce(
      (sum, p) => sum + p.completedTiers.filter((t) => !t.claimedAt).length,
      0,
    ) ?? 0;

  const completedCount =
    progress?.reduce((sum, p) => sum + p.completedTiers.length, 0) ?? 0;

  const totalTiers =
    progress?.reduce((sum, p) => sum + p.group.tiers.length, 0) ?? 0;

  return (
    <div className="flex flex-1 flex-col pb-20">
      {/* Header */}
      <div className="px-5 md:px-8 pt-8 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="size-7 text-primary" />
            <h1 className="text-2xl font-semibold">Achievements</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Track your in-game progress and claim rewards for completed
            milestones.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 md:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          {/* Server selector */}
          <Select
            value={serverId?.toString() ?? ""}
            onValueChange={(v) => setServerId(Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select server" />
            </SelectTrigger>
            <SelectContent>
              {servers.map((s) => (
                <SelectItem key={s.serverId} value={s.serverId.toString()}>
                  {s.serverName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Claim all button */}
          {unclaimedCount > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={claimAllMutation.isPending}
              onClick={() => serverId && claimAllMutation.mutate({ serverId })}
            >
              <Gift className="size-4 mr-1" />
              {claimAllMutation.isPending
                ? "Claiming..."
                : `Claim All (${unclaimedCount})`}
            </Button>
          )}

          {/* Stats summary */}
          {progress && (
            <div className="ml-auto text-sm text-muted-foreground">
              {completedCount}/{totalTiers} tiers completed
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 md:px-8 py-4">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <Loading size="medium" text="Loading achievements..." />
          ) : !progress || !serverId ? (
            <p className="text-muted-foreground text-center py-12">
              Select a server to view achievements.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered?.map((item) => (
                <AchievementCard
                  key={item.group.id}
                  item={item}
                  serverId={serverId}
                  onClaim={(groupId, tier) =>
                    claimMutation.mutate({ serverId, groupId, tier })
                  }
                  claimingKey={
                    claimMutation.isPending
                      ? `${claimMutation.variables?.groupId}:${claimMutation.variables?.tier}`
                      : null
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AchievementCardProps {
  item: {
    group: {
      id: string;
      name: string;
      description: string;
      category: string;
      tiers: { tier: number; threshold: number; reward: number }[];
    };
    currentValue: number;
    highestCompletedTier: number;
    completedTiers: {
      tier: number;
      completedAt: string;
      claimedAt: string | null;
    }[];
    nextTier: { tier: number; threshold: number; reward: number } | null;
  };
  serverId: number;
  onClaim: (groupId: string, tier: number) => void;
  claimingKey: string | null;
}

function AchievementCard({ item, onClaim, claimingKey }: AchievementCardProps) {
  const { group, currentValue, completedTiers, nextTier } = item;
  const catMeta = CATEGORY_META[group.category] ?? {
    label: group.category,
    icon: Trophy,
    color: "text-muted-foreground",
  };
  const Icon = catMeta.icon;

  const unclaimedTiers = completedTiers.filter((t) => !t.claimedAt);
  const progressPercent = nextTier
    ? Math.min((currentValue / nextTier.threshold) * 100, 100)
    : 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("size-5", catMeta.color)} />
            <CardTitle className="text-base">{group.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {catMeta.label}
          </Badge>
        </div>
        <CardDescription>{group.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier pills */}
        <div className="flex gap-2 flex-wrap">
          {group.tiers.map((tierDef) => {
            const completed = completedTiers.find(
              (c) => c.tier === tierDef.tier,
            );
            const unclaimed = completed && !completed.claimedAt;
            const isClaiming = claimingKey === `${group.id}:${tierDef.tier}`;

            return (
              <div
                key={tierDef.tier}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                    completed && completed.claimedAt
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : unclaimed
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {completed && completed.claimedAt ? (
                    <CheckCircle className="size-3" />
                  ) : unclaimed ? (
                    <Gift className="size-3" />
                  ) : (
                    <Lock className="size-3" />
                  )}
                  <span>{TIER_LABELS[tierDef.tier]}</span>
                  <span className="text-muted-foreground">
                    ({tierDef.threshold.toLocaleString()})
                  </span>
                </div>

                {unclaimed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    disabled={isClaiming}
                    onClick={() => onClaim(group.id, tierDef.tier)}
                  >
                    {isClaiming ? "..." : `+$${tierDef.reward}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {nextTier ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {currentValue.toLocaleString()} /{" "}
                {nextTier.threshold.toLocaleString()}
              </span>
              <span>
                Tier {TIER_LABELS[nextTier.tier]} — ${nextTier.reward}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="size-3 text-primary" />
            All tiers completed
            {unclaimedTiers.length > 0 &&
              ` — ${unclaimedTiers.length} unclaimed`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
