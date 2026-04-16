import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ban, Clock } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

interface BansTabProps {
  player: PlayerDetailed;
  onIssueBan: () => void;
  onRefresh: () => void;
  onUnban: (banId: number) => void;
}

export function BansTab({
  player,
  onIssueBan,
  // onRefresh,
  onUnban,
}: BansTabProps) {
  const activeBans = player.bans.active;
  const removedBans = player.bans.history.filter((b) => b.unbannedAt);
  const currentBan = player.bans.current;

  /**
   * Format expiry date or show "Never" for permanent bans
   */
  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never (Permanent)";
    const date = new Date(expiresAt);
    const now = new Date();

    if (date < now) return "Expired";

    return date.toLocaleDateString();
  };

  /**
   * Check if ban is expired
   */
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bans</h3>
        <Button size="sm" onClick={onIssueBan}>
          <Ban className="size-4" />
          Issue Ban
        </Button>
      </div>

      {/* Current Active Ban Warning */}
      {currentBan && !isExpired(currentBan.expiresAt) && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Ban className="size-4 text-destructive" />
                <p className="font-semibold text-destructive">
                  Player is currently banned
                </p>
              </div>
              <p className="mt-2 text-sm">
                {currentBan.banType === "permanent" ? (
                  <span className="font-medium text-destructive">
                    Permanent Ban - Player data will be deleted
                  </span>
                ) : (
                  <span>Expires: {formatExpiry(currentBan.expiresAt)}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeBans.length === 0 ? (
        <div className="py-12 text-center">
          <Ban className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No active bans</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeBans.map((ban) => {
            const expired = isExpired(ban.expiresAt);

            return (
              <div
                key={ban.id}
                className={cn(
                  "flex items-start justify-between rounded-lg border border-border p-4",
                  expired && "border-yellow-500/50 bg-yellow-500/5",
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        ban.banType === "permanent" ? "destructive" : "default"
                      }
                      className={cn(
                        ban.banType === "temporary" &&
                          "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30",
                      )}
                    >
                      {ban.banType === "permanent" ? "Permanent" : "Temporary"}
                    </Badge>
                    {ban.banType === "temporary" && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="size-3" />
                        {expired
                          ? "Expired"
                          : `Expires ${formatExpiry(ban.expiresAt)}`}
                      </Badge>
                    )}
                    {expired && (
                      <Badge
                        variant="outline"
                        className="border-yellow-500 text-yellow-500"
                      >
                        Needs Cleanup
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{ban.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Issued by {ban.bannedByUsername} on{" "}
                    {new Date(ban.bannedAt).toLocaleDateString()}
                  </p>
                  {ban.serverId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Server ID: {ban.serverId}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUnban(ban.id)}
                >
                  Unban
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {removedBans.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">
            Lifted Bans
          </h4>
          <div className="mt-2 space-y-2">
            {removedBans.map((ban) => (
              <div
                key={ban.id}
                className="rounded-lg border border-border bg-muted/50 p-4 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {ban.banType === "permanent" ? "Permanent" : "Temporary"}
                  </Badge>
                  {ban.banType === "temporary" && (
                    <Badge variant="outline">
                      Expired: {formatExpiry(ban.expiresAt)}
                    </Badge>
                  )}
                  <Badge variant="outline">Lifted</Badge>
                </div>
                <p className="mt-2 text-sm">{ban.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Issued by {ban.bannedByUsername} on{" "}
                  {new Date(ban.bannedAt).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lifted by {ban.unbannedByUsername} on{" "}
                  {new Date(ban.unbannedAt!).toLocaleDateString()}
                  {ban.unbanReason && ` - ${ban.unbanReason}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
