import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import type { DimensionFilter } from "../types";
import { ChunkTable } from "./ChunkTable";
import { PartyMemberRow } from "./PartyMemberRow";

export function PartyExpandedRow({
  serverId,
  partyUuid,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  partyUuid: string;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const membersQuery = trpc.admin.parties.members.useQuery({
    serverId,
    partyUuid,
  });
  const chunksQuery = trpc.admin.parties.partyChunks.useQuery({
    serverId,
    partyUuid,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Members</h4>
        {membersQuery.isLoading ? (
          <Loading size="small" />
        ) : !membersQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No members found</p>
        ) : (
          <div className="flex flex-col gap-2">
            {membersQuery.data.map((member) => (
              <PartyMemberRow
                key={member.playerUuid}
                serverId={serverId}
                member={member}
                dimensionFilter={dimensionFilter}
                activeOnly={activeOnly}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Party chunks</h4>
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
    </div>
  );
}
