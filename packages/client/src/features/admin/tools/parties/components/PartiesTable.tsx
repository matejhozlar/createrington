import { colorHex } from "@createrington/shared/team-tag";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  type DataTableColumn,
} from "@/components/data-table";
import { PlayerLabel } from "@/components/player-label";
import { TeamTagPlate } from "@/components/team-tag-plate";
import type { RouterOutput } from "@/lib/trpc";
import { PartyMembersPanel } from "./PartyMembersPanel";

export type PartyRow = RouterOutput["admin"]["parties"]["list"][number];
export type PartySortKey = "name" | "memberCount" | "claimCount" | "syncedAt";
export type PartySort = { key: PartySortKey; dir: "asc" | "desc" };

export function PartiesTable({
  parties,
  loading,
  sort,
  onSort,
  expandedId,
  onToggle,
  onShowClaims,
}: {
  parties: PartyRow[];
  loading: boolean;
  sort: PartySort;
  onSort: (key: PartySortKey) => void;
  expandedId: number | null;
  onToggle: (id: number) => void;
  onShowClaims: (partyId: number) => void;
}) {
  const sortable = (key: PartySortKey) => ({
    sorted: sort.key === key ? sort.dir : (false as const),
    onSort: () => onSort(key),
  });

  const columns: DataTableColumn<PartyRow>[] = [
    {
      key: "tag",
      header: "Tag",
      width: 96,
      render: (party) => <TeamTagPlate code={party.tagCode} />,
    },
    {
      key: "party",
      header: "Party",
      minWidth: 220,
      ...sortable("name"),
      render: (party) => (
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-sm ring-1 ring-inset ring-white/10"
            style={{ backgroundColor: `#${colorHex(party.color)}` }}
          />
          <div className="min-w-0">
            <CellText value={party.name} className="font-medium" />
            {party.description && (
              <CellText
                value={party.description}
                className="text-xs text-muted-foreground"
              />
            )}
          </div>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      minWidth: 200,
      render: (party) => (
        <PlayerLabel
          uuid={party.ownerUuid}
          name={party.ownerName ?? party.ownerUuid}
        />
      ),
    },
    {
      key: "members",
      header: "Members",
      width: 104,
      align: "right",
      cellClassName: "tabular-nums",
      ...sortable("memberCount"),
      render: (party) => party.memberCount,
    },
    {
      key: "allies",
      header: "Allies",
      width: 88,
      align: "right",
      cellClassName: "tabular-nums",
      render: (party) => party.allyCount,
    },
    {
      key: "claims",
      header: "Claims",
      width: 120,
      align: "right",
      ...sortable("claimCount"),
      render: (party) =>
        party.claimCount === null ? null : (
          <div className="flex flex-col items-end tabular-nums">
            <span className="text-sm">{party.claimCount}</span>
            {party.forceloadCount ? (
              <span className="text-xs text-muted-foreground">
                {party.forceloadCount} forceloaded
              </span>
            ) : null}
          </div>
        ),
    },
    {
      key: "joining",
      header: "Joining",
      width: 118,
      skeleton: () => <BadgeCellSkeleton />,
      render: (party) =>
        party.freeToJoin ? (
          <Badge
            variant="outline"
            className="border-green-500/20 bg-green-500/10 text-green-400"
          >
            Free to join
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-transparent bg-foreground/10 text-foreground/80"
          >
            Invite only
          </Badge>
        ),
    },
    {
      key: "synced",
      header: "Synced",
      width: 110,
      ...sortable("syncedAt"),
      render: (party) => <CellDate value={party.syncedAt} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={parties}
      loading={loading}
      loadingRows={3}
      rowKey={(party) => party.id}
      onRowClick={(party) => onToggle(party.id)}
      rowClassName={(party) =>
        party.id === expandedId ? "bg-muted/30" : undefined
      }
      expandedKey={expandedId}
      renderExpanded={(party) => (
        <PartyMembersPanel
          partyId={party.id}
          onShowClaims={() => onShowClaims(party.id)}
        />
      )}
    />
  );
}
