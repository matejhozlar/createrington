import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import type { DimensionFilter } from "../types";
import { ChunkPlayerMemberRow } from "./ChunkPlayerMemberRow";

const MEMBERS_PER_PAGE = 25;

export function ChunkPartyExpandedRow({
  serverId,
  partyId,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  partyId: string;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [page, setPage] = useState(0);

  const membersQuery = trpc.admin.parties.chunkPartyMembers.useQuery({
    serverId,
    partyId,
    page,
    limit: MEMBERS_PER_PAGE,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Members</h4>
        {membersQuery.isLoading ? (
          <Loading size="small" />
        ) : !membersQuery.data?.items.length ? (
          <p className="text-sm text-muted-foreground">No members found</p>
        ) : (
          <div className="flex flex-col gap-2">
            {membersQuery.data.items.map((member) => (
              <ChunkPlayerMemberRow
                key={member.playerUuid}
                serverId={serverId}
                member={member}
                dimensionFilter={dimensionFilter}
                activeOnly={activeOnly}
              />
            ))}
            <Paginator
              page={membersQuery.data.pagination.page}
              limit={membersQuery.data.pagination.limit}
              total={membersQuery.data.pagination.total}
              totalPages={membersQuery.data.pagination.totalPages}
              onPageChange={setPage}
              itemLabel="member"
              className="mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
