import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeDate, formatFullDate } from "@/features/admin/format";
import type { DimensionFilter } from "../AdminForceloads";
import { ChunkTable } from "./ChunkTable";
import { PlayerLabel } from "@/components/player-label";

interface Party {
  id: number;
  partyId: string;
  partyName: string;
  memberCount: number;
  optedIn: boolean;
  syncedAt: string;
  totalChunks: number;
  activeChunks: number;
  chunksByDimension: Record<string, { total: number; active: number }>;
}

function PartyDetails({
  partyId,
  dimensionFilter,
  activeOnly,
}: {
  partyId: number;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const membersQuery = trpc.admin.forceloads.partyMembers.useQuery({
    partyId,
  });
  const chunksQuery = trpc.admin.forceloads.chunks.useQuery({
    ownerId: partyId,
    ownerType: "party",
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
          <div className="flex flex-wrap gap-2">
            {membersQuery.data.map((member) => {
              const resolved = Boolean(member.minecraftUsername);
              const displayName = member.minecraftUsername ?? member.playerUuid;
              return (
                <div
                  key={member.playerUuid}
                  className="rounded-md border px-2 py-1"
                >
                  <PlayerLabel
                    uuid={member.playerUuid}
                    name={displayName}
                    linkable={resolved}
                    size={20}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Chunks</h4>
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

export function PartyForceloadsTable({
  parties,
  search,
  dimensionFilter,
  activeOnly,
}: {
  parties: Party[];
  search: string;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const needle = search.trim().toLowerCase();
  const filtered = parties.filter((p) => {
    if (needle && !p.partyName.toLowerCase().includes(needle)) {
      return false;
    }
    if (dimensionFilter === "all") {
      if (activeOnly && p.activeChunks === 0) return false;
      return true;
    }
    const dimStats = p.chunksByDimension[dimensionFilter];
    if (!dimStats) return false;
    if (activeOnly && dimStats.active === 0) return false;
    return true;
  });

  if (parties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
          <Users className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No party forceloads on this server
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="border-b">
        <CardTitle>
          Parties ({filtered.length}
          {filtered.length !== parties.length && ` of ${parties.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Party Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Total Chunks</TableHead>
              <TableHead>Active Chunks</TableHead>
              <TableHead>Last Synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No parties match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((party) => {
                const isExpanded = expandedId === party.id;

                return (
                  <Fragment key={party.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : party.id)
                      }
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{party.partyName}</span>
                          {!party.optedIn && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 bg-amber-500/10 text-amber-500"
                            >
                              Opted Out
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{party.memberCount}</TableCell>
                      <TableCell>{party.totalChunks}</TableCell>
                      <TableCell>{party.activeChunks}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatRelativeDate(party.syncedAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatFullDate(party.syncedAt)}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <PartyDetails
                            partyId={party.id}
                            dimensionFilter={dimensionFilter}
                            activeOnly={activeOnly}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
