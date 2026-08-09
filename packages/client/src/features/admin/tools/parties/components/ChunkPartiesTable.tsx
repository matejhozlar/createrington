import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

type SortKey =
  | "partyName"
  | "memberCount"
  | "totalChunks"
  | "forceloadableChunks"
  | "activeChunks"
  | "lastSyncedAt";

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export function ChunkPartiesTable({
  serverId,
  parties,
  totalParties,
  filters,
  initialExpandedPartyId,
}: {
  serverId: number;
  parties: ChunkParty[];
  totalParties: number;
  filters: PartyFilters;
  initialExpandedPartyId?: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    initialExpandedPartyId ?? null,
  );
  const [sort, setSort] = useState<SortState>(null);
  const scrollTargetId = initialExpandedPartyId ?? null;
  const hasScrolledRef = useRef(false);
  const scrollRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!scrollTargetId) return;
    if (!parties.some((p) => p.partyId === scrollTargetId)) return;
    scrollRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    hasScrolledRef.current = true;
  }, [parties, scrollTargetId]);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  const renderSortIcon = useCallback(
    (key: SortKey) => {
      if (sort?.key !== key) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return sort.dir === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [sort],
  );

  const sortedParties = useMemo(() => {
    if (!sort) return parties;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...parties].sort((a, b) => {
      switch (sort.key) {
        case "partyName":
          return (
            dir *
            a.partyName.localeCompare(b.partyName, undefined, {
              sensitivity: "base",
            })
          );
        case "memberCount":
        case "totalChunks":
        case "forceloadableChunks":
        case "activeChunks":
          return dir * (a[sort.key] - b[sort.key]);
        case "lastSyncedAt": {
          const ta = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
          const tb = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
          return dir * (ta - tb);
        }
      }
    });
  }, [parties, sort]);

  if (totalParties === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Users className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No parties with claimed chunks
        </p>
      </div>
    );
  }

  return (
    <div className="px-0">
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow>
            <TableHead col="icon" />
            <TableHead>
              <button
                type="button"
                onClick={() => handleSort("partyName")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Party name
                {renderSortIcon("partyName")}
              </button>
            </TableHead>
            <TableHead col="count">
              <button
                type="button"
                onClick={() => handleSort("memberCount")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Members
                {renderSortIcon("memberCount")}
              </button>
            </TableHead>
            <TableHead col="count">
              <button
                type="button"
                onClick={() => handleSort("totalChunks")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Claimed
                {renderSortIcon("totalChunks")}
              </button>
            </TableHead>
            <TableHead col="count">
              <button
                type="button"
                onClick={() => handleSort("forceloadableChunks")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Forceloadable
                {renderSortIcon("forceloadableChunks")}
              </button>
            </TableHead>
            <TableHead col="count">
              <button
                type="button"
                onClick={() => handleSort("activeChunks")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Active
                {renderSortIcon("activeChunks")}
              </button>
            </TableHead>
            <TableHead col="status">Status</TableHead>
            <TableHead col="dateTime">
              <button
                type="button"
                onClick={() => handleSort("lastSyncedAt")}
                className="inline-flex cursor-pointer items-center gap-1 uppercase"
              >
                Last synced
                {renderSortIcon("lastSyncedAt")}
              </button>
            </TableHead>
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
            sortedParties.map((party) => {
              const isExpanded = expandedId === party.partyId;
              const isScrollTarget = scrollTargetId === party.partyId;
              return (
                <Fragment key={party.partyId}>
                  <TableRow
                    ref={isScrollTarget ? scrollRowRef : undefined}
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
