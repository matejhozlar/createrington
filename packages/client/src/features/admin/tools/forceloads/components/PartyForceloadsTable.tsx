import { useState } from "react";
import { ChevronDown, ChevronRight, UsersRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
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

interface Party {
  id: number;
  partyId: string;
  partyName: string;
  memberCount: number;
  optedIn: boolean;
  syncedAt: string;
  totalChunks: number;
  activeChunks: number;
}

function PartyDetails({ partyId }: { partyId: number }) {
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
              const displayName = member.minecraftUsername ?? member.playerUuid;
              return (
                <div
                  key={member.playerUuid}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1"
                >
                  <MinecraftAvatar
                    username={displayName}
                    uuid={member.playerUuid}
                    size={20}
                  />
                  <span className="text-sm">{displayName}</span>
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
        ) : !chunksQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">No chunks found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimension</TableHead>
                <TableHead>X</TableHead>
                <TableHead>Z</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunksQuery.data.map((chunk) => (
                <TableRow key={chunk.id}>
                  <TableCell className="font-mono text-xs">
                    {chunk.dimension}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{chunk.x}</TableCell>
                  <TableCell className="font-mono text-xs">{chunk.z}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        chunk.active
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                          : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                      }
                    >
                      {chunk.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function PartyForceloadsTable({ parties }: { parties: Party[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (parties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
          <UsersRound className="size-10 text-muted-foreground" />
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
        <CardTitle>Parties ({parties.length})</CardTitle>
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
            {parties.map((party) => {
              const isExpanded = expandedId === party.id;

              return (
                <>
                  <TableRow
                    key={party.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : party.id)}
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
                      {new Date(party.syncedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${party.id}-details`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <PartyDetails partyId={party.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
