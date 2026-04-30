import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
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
import {
  formatFullDateSafe,
  formatRelativeDateSafe,
} from "@/features/admin/format";
import type { RouterOutput } from "@/lib/trpc";
import type { PartyFilters } from "../types";
import { ChunkPartyExpandedRow } from "./ChunkPartyExpandedRow";

type ChunkParty = RouterOutput["admin"]["parties"]["chunkParties"][number];

export function ChunkPartiesTable({
  serverId,
  parties,
  filters,
}: {
  serverId: number;
  parties: ChunkParty[];
  filters: PartyFilters;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const needle = filters.search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      parties.filter((p) => {
        if (filters.alliedOnly && !p.isAllied) return false;
        if (filters.activeForceloadsOnly && p.activeChunks === 0) return false;
        if (filters.optedInOnly && p.partyOptedIn !== true) return false;
        if (needle && !p.partyName.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [parties, filters, needle],
  );

  if (parties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
          <Users className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No parties with claimed chunks
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
              <TableHead>Party name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead>Forceloadable</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No parties match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((party) => {
                const isExpanded = expandedId === party.partyId;
                return (
                  <Fragment key={party.partyId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : party.partyId)
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
                        <div className="flex flex-col">
                          <span className="font-medium">{party.partyName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {party.partyId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{party.memberCount}</TableCell>
                      <TableCell className="font-medium">
                        {party.totalChunks}
                      </TableCell>
                      <TableCell>
                        {party.forceloadableChunks > 0 ? (
                          <span className="font-medium">
                            {party.forceloadableChunks}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {party.activeChunks > 0 ? (
                          <span className="font-medium text-success">
                            {party.activeChunks}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {party.isAllied && (
                            <Badge
                              variant="outline"
                              className="border-blue-500 bg-blue-500/10 text-blue-400"
                            >
                              Allied
                            </Badge>
                          )}
                          {party.activeChunks > 0 && (
                            <Badge
                              variant="outline"
                              className="border-success bg-success/10 text-success"
                            >
                              Active
                            </Badge>
                          )}
                          {party.partyOptedIn === true ? (
                            <Badge variant="outline">Opted in</Badge>
                          ) : party.partyOptedIn === false ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500 bg-amber-500/10 text-amber-500"
                            >
                              Opted out
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              {formatRelativeDateSafe(party.lastSyncedAt)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatFullDateSafe(party.lastSyncedAt)}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <ChunkPartyExpandedRow
                            serverId={serverId}
                            partyId={party.partyId}
                            dimensionFilter={filters.dimension}
                            activeOnly={filters.activeForceloadsOnly}
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
