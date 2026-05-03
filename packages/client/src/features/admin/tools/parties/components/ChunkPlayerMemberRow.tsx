import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import type { RouterOutput } from "@/lib/trpc";
import type { DimensionFilter } from "../types";
import { ChunkDetailTable } from "./ChunkDetailTable";

type ChunkMember =
  RouterOutput["admin"]["parties"]["chunkPartyMembers"]["items"][number];

const CHUNKS_PER_PAGE = 50;

export function ChunkPlayerMemberRow({
  serverId,
  member,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  member: ChunkMember;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Reset to page 0 whenever filters change ("store info from previous render" pattern).
  const filtersKey = `${dimensionFilter}|${activeOnly}`;
  const [page, setPage] = useState(0);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(0);
  }

  const chunksQuery = trpc.admin.parties.chunkPlayerDetail.useQuery(
    {
      serverId,
      playerUuid: member.playerUuid,
      page,
      limit: CHUNKS_PER_PAGE,
      dimension: dimensionFilter === "all" ? undefined : dimensionFilter,
      activeOnly: activeOnly || undefined,
    },
    { enabled: expanded },
  );

  const displayName = member.minecraftUsername ?? member.playerUuid;
  const hasActiveFilters = dimensionFilter !== "all" || activeOnly;

  return (
    <div className="rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <div className="flex-1">
          <PlayerLabel
            uuid={member.playerUuid}
            name={displayName}
            linkable={Boolean(member.minecraftUsername)}
            size={20}
          />
        </div>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-[10px]">
            {member.totalChunks} claimed
          </Badge>
          {member.forceloadableChunks > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500 bg-amber-500/10 text-[10px] text-amber-500"
            >
              {member.forceloadableChunks} forceloadable
            </Badge>
          )}
          {member.activeChunks > 0 && (
            <Badge
              variant="outline"
              className="border-success bg-success/10 text-[10px] text-success"
            >
              {member.activeChunks} active
            </Badge>
          )}
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          {chunksQuery.isLoading ? (
            <Loading size="small" />
          ) : chunksQuery.data ? (
            <>
              <ChunkDetailTable
                chunks={chunksQuery.data.items}
                hasActiveFilters={hasActiveFilters}
              />
              <Paginator
                page={chunksQuery.data.pagination.page}
                limit={chunksQuery.data.pagination.limit}
                total={chunksQuery.data.pagination.total}
                totalPages={chunksQuery.data.pagination.totalPages}
                onPageChange={setPage}
                itemLabel="chunk"
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
