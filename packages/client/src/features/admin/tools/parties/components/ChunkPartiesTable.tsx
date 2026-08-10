import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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

  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!scrollTargetId) return;
    if (!parties.some((p) => p.partyId === scrollTargetId)) return;
    document
      .querySelector(`[data-row-key="${scrollTargetId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    hasScrolledRef.current = true;
  }, [parties, scrollTargetId]);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

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

  const sortProps = (key: SortKey) => ({
    sorted: sort?.key === key ? sort.dir : (false as const),
    onSort: () => handleSort(key),
  });

  const columns: DataTableColumn<ChunkParty>[] = [
    {
      key: "expander",
      width: 56,
      render: (party) =>
        expandedId === party.partyId ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        ),
    },
    {
      key: "partyName",
      header: "Party name",
      minWidth: 200,
      ...sortProps("partyName"),
      render: (party) => (
        <>
          <CellText value={party.partyName} className="font-medium" />
          <CellText
            value={party.partyId}
            className="font-mono text-[10px] text-muted-foreground"
          />
        </>
      ),
    },
    {
      key: "memberCount",
      header: "Members",
      width: 120,
      ...sortProps("memberCount"),
      render: (party) => party.memberCount,
    },
    {
      key: "totalChunks",
      header: "Claimed",
      width: 115,
      ...sortProps("totalChunks"),
      cellClassName: "font-medium",
      render: (party) => party.totalChunks,
    },
    {
      key: "forceloadableChunks",
      header: "Forceloadable",
      width: 155,
      ...sortProps("forceloadableChunks"),
      render: (party) =>
        party.forceloadableChunks > 0 ? (
          <span className="font-medium">{party.forceloadableChunks}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "activeChunks",
      header: "Active",
      width: 105,
      ...sortProps("activeChunks"),
      render: (party) =>
        party.activeChunks > 0 ? (
          <span className="font-medium text-success">{party.activeChunks}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      minWidth: 160,
      render: (party) => (
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
      ),
    },
    {
      key: "lastSyncedAt",
      header: "Last synced",
      width: 140,
      ...sortProps("lastSyncedAt"),
      cellClassName: "text-muted-foreground",
      render: (party) =>
        party.lastSyncedAt && (
          <CellText
            value={formatFullDateSafe(party.lastSyncedAt)}
            display={formatRelativeDateSafe(party.lastSyncedAt)}
          />
        ),
    },
  ];

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

  if (parties.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No parties match the current filters
      </p>
    );
  }

  return (
    <div className="px-0">
      <DataTable
        columns={columns}
        rows={sortedParties}
        rowKey={(party) => party.partyId}
        onRowClick={(party) =>
          setExpandedId(expandedId === party.partyId ? null : party.partyId)
        }
        rowClassName={(party) =>
          cn(
            expandedId === party.partyId &&
              "[&>td]:sticky [&>td]:top-0 [&>td]:z-10 [&>td]:bg-card [&>td]:shadow-[0_1px_0_var(--color-border)]",
          )
        }
        expandedKey={expandedId}
        renderExpanded={(party) => (
          <ChunkPartyExpandedRow
            serverId={serverId}
            partyId={party.partyId}
            dimensionFilter={filters.dimension}
            activeOnly={filters.activeForceloadsOnly}
          />
        )}
      />
    </div>
  );
}
