import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Globe, MessageSquareOff } from "lucide-react";
import { Loading } from "@/components/loading-spinner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { IssueWorkshopBanModal } from "./modals/IssueWorkshopBanModal";
import { LiftWorkshopBanModal } from "./modals/LiftWorkshopBanModal";

type WorkshopBan =
  RouterOutput["admin"]["workshops"]["bans"]["listForUser"][number];

interface WorkshopBansSectionProps {
  discordId: string;
  playerUsername: string;
}

const isActive = (ban: WorkshopBan) =>
  !ban.unbanned && (!ban.expiresAt || new Date(ban.expiresAt) > new Date());

const scopeLabel = (ban: WorkshopBan) => ban.workshopName ?? "Every workshop";

export function WorkshopBansSection({
  discordId,
  playerUsername,
}: WorkshopBansSectionProps) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [liftBanId, setLiftBanId] = useState<number | null>(null);

  const bans = trpc.admin.workshops.bans.listForUser.useQuery({
    discordId,
    includeInactive: true,
  });

  const rows = bans.data ?? [];
  const active = rows.filter(isActive);
  const inactive = rows.filter((ban) => !isActive(ban));

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workshop Suggestions</h3>
          <p className="text-sm text-muted-foreground">
            Blocks new mod suggestions only — Minecraft access, Discord
            membership, upvotes and existing suggestions are untouched.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setIssueOpen(true)}>
          <MessageSquareOff className="size-4" />
          Block Suggestions
        </Button>
      </div>

      {bans.isLoading ? (
        <Loading className="py-4" text="Loading suggestion blocks..." />
      ) : bans.error ? (
        <p className="py-4 text-sm text-destructive">
          Could not load suggestion blocks: {bans.error.message}
        </p>
      ) : active.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Not blocked from suggesting.
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((ban) => (
            <div
              key={ban.id}
              className="flex items-start justify-between rounded-lg border border-border p-4"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ban.workshopId ? "outline" : "destructive"}>
                    {!ban.workshopId && <Globe className="size-3" />}
                    {scopeLabel(ban)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      ban.banType === "temporary"
                        ? "gap-1 border-orange-500 text-orange-500"
                        : "gap-1"
                    }
                  >
                    {ban.banType === "temporary" && (
                      <Clock className="size-3" />
                    )}
                    {ban.expiresAt
                      ? `Until ${new Date(ban.expiresAt).toLocaleDateString()}`
                      : "Permanent"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">{ban.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Blocked by {ban.bannedByUsername} on{" "}
                  {new Date(ban.bannedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLiftBanId(ban.id)}
              >
                Lift
              </Button>
            </div>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground">
            Past Suggestion Blocks
          </h4>
          <div className="mt-2 space-y-2">
            {inactive.map((ban) => (
              <div
                key={ban.id}
                className="rounded-lg border border-border bg-muted/50 p-4 opacity-60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{scopeLabel(ban)}</Badge>
                  <Badge variant="outline">
                    {ban.unbanned ? "Lifted" : "Expired"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">{ban.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Blocked by {ban.bannedByUsername} on{" "}
                  {new Date(ban.bannedAt).toLocaleDateString()}
                </p>
                {ban.unbanned && ban.unbannedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lifted by {ban.unbannedByUsername} on{" "}
                    {new Date(ban.unbannedAt).toLocaleDateString()}
                    {ban.unbanReason && ` - ${ban.unbanReason}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <IssueWorkshopBanModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        discordId={discordId}
        playerUsername={playerUsername}
        onSuccess={() => bans.refetch()}
      />

      {liftBanId !== null && (
        <LiftWorkshopBanModal
          open
          onClose={() => setLiftBanId(null)}
          banId={liftBanId}
          onSuccess={() => bans.refetch()}
        />
      )}
    </div>
  );
}
