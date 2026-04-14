import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

interface StrikesTabProps {
  player: PlayerDetailed;
  onIssueStrike: () => void;
  onRefresh: () => void;
  onRemoveStrike: (strikeId: number) => void;
}

export function StrikesTab({
  player,
  onIssueStrike,
  // onRefresh,
  onRemoveStrike,
}: StrikesTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Strikes</h3>
        <Button size="sm" onClick={onIssueStrike}>
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
                onClick={() => onRemoveStrike(strike.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {player.strikes.all.length > player.strikes.active.length && (
        <div>
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
                    <Badge variant="outline">Severity {strike.severity}</Badge>
                    <Badge variant="outline">{strike.classification}</Badge>
                    <Badge variant="outline">Removed</Badge>
                  </div>
                  <p className="mt-2 text-sm">{strike.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Removed by {strike.removedByUsername} on{" "}
                    {new Date(strike.removedAt!).toLocaleDateString()}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
