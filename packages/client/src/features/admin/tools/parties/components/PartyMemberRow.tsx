import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import type { RouterOutput } from "@/lib/trpc";
import type { DimensionFilter } from "../types";
import { ChunkTable } from "./ChunkTable";

type Member = RouterOutput["admin"]["parties"]["members"][number];

export function PartyMemberRow({
  serverId,
  member,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  member: Member;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const chunksQuery = trpc.admin.parties.playerChunks.useQuery(
    { serverId, playerUuid: member.playerUuid },
    { enabled: expanded && member.hasSoloForceloads },
  );

  const canExpand = member.hasSoloForceloads;
  const displayName = member.minecraftUsername ?? member.playerUuid;

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          disabled={!canExpand}
          aria-expanded={canExpand ? expanded : undefined}
          aria-label="Expand player chunks"
          className="disabled:cursor-default"
        >
          {canExpand ? (
            expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          ) : (
            <span className="size-4" />
          )}
        </button>
        <PlayerLabel
          uuid={member.playerUuid}
          name={displayName}
          linkable={Boolean(member.minecraftUsername)}
          size={20}
        />
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          disabled={!canExpand}
          className="flex flex-1 items-center justify-end gap-1 rounded px-1 py-0.5 hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
        >
          {canExpand ? (
            <Badge variant="outline" className="text-[10px]">
              {member.activeChunks} / {member.totalChunks} chunks
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              No solo chunks
            </span>
          )}
        </button>
      </div>

      {expanded && canExpand && (
        <div className="border-t border-border p-3">
          {chunksQuery.isLoading ? (
            <Loading size="small" />
          ) : chunksQuery.data ? (
            <ChunkTable
              chunks={chunksQuery.data}
              dimensionFilter={dimensionFilter}
              activeOnly={activeOnly}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
