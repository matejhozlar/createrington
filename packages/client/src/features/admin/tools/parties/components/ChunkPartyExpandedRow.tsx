import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import type { DimensionFilter } from "../types";
import { ChunkPlayerMemberRow } from "./ChunkPlayerMemberRow";

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
  const membersQuery = trpc.admin.parties.chunkPartyMembers.useQuery({
    serverId,
    partyId,
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
              <ChunkPlayerMemberRow
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
    </div>
  );
}
