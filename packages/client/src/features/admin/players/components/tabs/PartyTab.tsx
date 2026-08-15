import { useState } from "react";
import { Link } from "react-router";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Handshake,
  MapPin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { formatRelativeDateSafe } from "@/features/admin/format";
import { ChunkPartyExpandedRow } from "@/features/admin/tools/parties/components/ChunkPartyExpandedRow";

const SERVER_ID = 1;

interface PartyTabProps {
  playerUuid: string;
}

export function PartyTab({ playerUuid }: PartyTabProps) {
  const statusQuery = trpc.admin.parties.playerStatus.useQuery({
    serverId: SERVER_ID,
    playerUuid,
  });

  const partyAlliance = statusQuery.data?.partyAlliance ?? null;

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <Loading size="small" />
      </div>
    );
  }

  if (!partyAlliance) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <MapPin className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This player is not in an allied party.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PartyBlind
        serverId={SERVER_ID}
        partyId={partyAlliance.partyId}
        partyName={partyAlliance.partyName}
        alliedAt={partyAlliance.alliedAt}
      />
    </div>
  );
}

function PartyBlind({
  serverId,
  partyId,
  partyName,
  alliedAt,
}: {
  serverId: number;
  partyId: string;
  partyName: string | null;
  alliedAt: Date | string;
}) {
  const [open, setOpen] = useState(false);

  const detailsQuery = trpc.admin.parties.partyDetails.useQuery({
    serverId,
    partyId,
  });

  const details = detailsQuery.data;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-accent"
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{partyName ?? "Allied party"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {partyId}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {detailsQuery.isLoading ? (
                <span className="text-xs text-muted-foreground">
                  Loading...
                </span>
              ) : details ? (
                <>
                  <Badge variant="outline" className="text-[10px]">
                    {details.totalChunks} claimed
                  </Badge>
                  {details.forceloadableChunks > 0 && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 bg-amber-500/10 text-[10px] text-amber-500"
                    >
                      {details.forceloadableChunks} forceloadable
                    </Badge>
                  )}
                  {details.activeChunks > 0 && (
                    <Badge
                      variant="outline"
                      className="border-success bg-success/10 text-[10px] text-success"
                    >
                      {details.activeChunks} active
                    </Badge>
                  )}
                  {details.partyOptedIn === true ? (
                    <Badge variant="outline" className="text-[10px]">
                      Party Forceloads
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500 bg-amber-500/10 text-[10px] text-amber-500"
                    >
                      Not opted in
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  No chunks
                </Badge>
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 rounded-b-lg border-x border-b border-border bg-card p-4">
          <AlliesBlind serverId={serverId} partyId={partyId} />

          <ChunkPartyExpandedRow
            serverId={serverId}
            partyId={partyId}
            dimensionFilter="all"
            activeOnly={false}
          />

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Allied {formatRelativeDateSafe(alliedAt)}
            </p>
            <Link
              to={`/admin/tools/parties?partyId=${encodeURIComponent(partyId)}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View in Parties admin
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AlliesBlind({
  serverId,
  partyId,
}: {
  serverId: number;
  partyId: string;
}) {
  const [open, setOpen] = useState(false);

  const alliesQuery = trpc.admin.parties.alliedParties.useQuery({
    serverId,
    partyId,
  });

  const allies = alliesQuery.data ?? [];
  const count = allies.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border bg-background p-3 text-left transition hover:bg-muted/50"
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <Handshake className="size-4 text-blue-400" />
          <span className="text-sm font-semibold">Allies</span>
          <Badge
            variant="outline"
            className="ml-auto border-blue-500 bg-blue-500/10 text-[10px] text-blue-400"
          >
            {alliesQuery.isLoading ? "..." : count}{" "}
            {count === 1 ? "party" : "parties"}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {alliesQuery.isLoading ? (
            <Loading size="small" />
          ) : allies.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No other allied parties
            </p>
          ) : (
            allies.map((ally) => (
              <Link
                key={ally.partyId}
                to={`/admin/tools/parties?partyId=${encodeURIComponent(ally.partyId)}`}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 transition hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {ally.partyName ?? ally.partyId}
                    </p>
                    {ally.partyName && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {ally.partyId}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {ally.memberCount ?? 0}{" "}
                    {ally.memberCount === 1 ? "member" : "members"}
                  </Badge>
                  <ExternalLink className="size-3 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
