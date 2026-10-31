import { Loading } from "@/components/loading-spinner";
import { PlayerLabel } from "@/components/player-label";
import { Button } from "@/components/ui/button";
import { formatDimension } from "@/lib/minecraft";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PartyRankBadge } from "./PartyRankBadge";

const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const LIST_CLASS =
  "divide-y divide-border rounded-md border border-border bg-card";

export function PartyMembersPanel({
  partyId,
  onShowClaims,
}: {
  partyId: number;
  onShowClaims?: () => void;
}) {
  const query = trpc.admin.parties.members.useQuery({ partyId });
  const claimsQuery = trpc.admin.parties.claims.useQuery({ partyId });

  if (query.isLoading || claimsQuery.isLoading) {
    return <Loading size="small" />;
  }

  const members = query.data?.members ?? [];
  const allies = query.data?.allies ?? [];
  const claims = claimsQuery.data ?? null;
  const claimTotal = claims?.reduce((sum, d) => sum + d.claimCount, 0) ?? 0;

  return (
    <div
      className={cn(
        "grid gap-4",
        claims
          ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]"
          : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
      )}
    >
      <section className="flex flex-col gap-2">
        <h4 className={SECTION_LABEL}>Members · {members.length}</h4>
        <ul className={LIST_CLASS}>
          {members.map((member) => (
            <li
              key={member.minecraftUuid}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <PlayerLabel
                  uuid={member.minecraftUuid}
                  name={member.minecraftUsername ?? member.minecraftUuid}
                />
              </div>
              <PartyRankBadge rank={member.rank} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className={SECTION_LABEL}>Allies · {allies.length}</h4>
        {allies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No player holds the ally rank in this party.
          </p>
        ) : (
          <ul className={LIST_CLASS}>
            {allies.map((ally) => (
              <li key={ally.minecraftUuid} className="px-3 py-2">
                <PlayerLabel
                  uuid={ally.minecraftUuid}
                  name={ally.minecraftUsername ?? ally.minecraftUuid}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {claims && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className={SECTION_LABEL}>
              Territory · {claimTotal} chunk{claimTotal === 1 ? "" : "s"}
            </h4>
            {onShowClaims && claimTotal > 0 && (
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={onShowClaims}
              >
                Browse chunks
              </Button>
            )}
          </div>
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This party has not claimed any chunk.
            </p>
          ) : (
            <ul className={LIST_CLASS}>
              {claims.map((entry) => (
                <li
                  key={entry.dimension}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {formatDimension(entry.dimension)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.dimension}
                    </p>
                  </div>
                  <div className="flex flex-col items-end tabular-nums">
                    <span className="text-sm">{entry.claimCount}</span>
                    {entry.forceloadCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {entry.forceloadCount} forceloaded
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
