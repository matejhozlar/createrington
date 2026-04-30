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
import { PartyExpandedRow } from "./PartyExpandedRow";

type Party = RouterOutput["admin"]["parties"]["list"][number];

export function PartiesTable({
  serverId,
  parties,
  filters,
}: {
  serverId: number;
  parties: Party[];
  filters: PartyFilters;
}) {
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

  const needle = filters.search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      parties.filter((p) => {
        if (filters.alliedOnly && !p.isAllied) return false;
        if (filters.activeForceloadsOnly && p.activeChunks === 0) return false;
        if (filters.optedInOnly && !p.optedIn) return false;
        if (needle && !p.partyName.toLowerCase().includes(needle)) return false;
        if (filters.dimension !== "all") {
          const dim = p.chunksByDimension[filters.dimension];
          if (!dim) return false;
        }
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
            No parties on this server
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
              <TableHead>Chunks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last synced</TableHead>
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
                const isExpanded = expandedUuid === party.partyUuid;
                return (
                  <Fragment key={party.partyUuid}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedUuid(isExpanded ? null : party.partyUuid)
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
                            {party.partyUuid}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{party.memberCount}</TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {party.activeChunks}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {party.totalChunks}
                        </span>
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
                              Active forceloads
                            </Badge>
                          )}
                          {party.optedIn ? (
                            <Badge variant="outline">Opted in</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500 bg-amber-500/10 text-amber-500"
                            >
                              Opted out
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              {formatRelativeDateSafe(party.syncedAt)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatFullDateSafe(party.syncedAt)}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <PartyExpandedRow
                            serverId={serverId}
                            partyUuid={party.partyUuid}
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
