import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export type ChunkParty =
  RouterOutput["admin"]["parties"]["chunkParties"][number];

export function ChunkPartiesTable({
  serverId,
  parties,
  totalParties,
  filters,
}: {
  serverId: number;
  parties: ChunkParty[];
  totalParties: number;
  filters: PartyFilters;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (totalParties === 0) {
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
    <div className="px-0 [&_[data-slot=table-container]]:overflow-x-clip">
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
          {parties.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                No parties match the current filters
              </TableCell>
            </TableRow>
          ) : (
            parties.map((party) => {
              const isExpanded = expandedId === party.partyId;
              return (
                <Fragment key={party.partyId}>
                  <TableRow
                    className={cn(
                      "cursor-pointer",
                      isExpanded &&
                        "[&>td]:sticky [&>td]:top-0 [&>td]:z-10 [&>td]:bg-card [&>td]:shadow-[0_1px_0_var(--color-border)]",
                    )}
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
    </div>
  );
}
