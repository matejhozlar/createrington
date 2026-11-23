import { useMemo, type ReactNode } from "react";
import { Package, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { CellDate, CellText } from "@/components/cell-text";
import type { DataTableColumn } from "@/components/data-table";
import { PagedTable } from "@/components/paged-table";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { DISABLED_LABEL, projectKindLabel } from "@/features/workshop/format";
import type { ReleaseMod } from "@/features/admin/workshop/workshop-admin-detail/types";
import {
  ModCell,
  ModCellSkeleton,
} from "@/features/admin/workshop/workshop-admin-detail/components/ModCell";
import { PackCard } from "@/features/admin/workshop/workshop-admin-detail/components/in-pack/PackCard";

const MODS_PER_PAGE = 10;

const DESCRIPTION =
  "What this build shipped, frozen at the moment it was recorded.";

function releaseFileLabel(row: ReleaseMod) {
  return row.fileName ?? row.displayName ?? `File #${row.fileId}`;
}

const COLUMNS: DataTableColumn<ReleaseMod>[] = [
  {
    key: "mod",
    header: "Mod",
    minWidth: 220,
    skeleton: () => <ModCellSkeleton />,
    render: (row) => (
      <ModCell
        name={row.projectName}
        slug={row.projectSlug}
        thumbnailUrl={row.thumbnailUrl}
        classId={row.classId}
        required={row.required}
      />
    ),
  },
  {
    key: "file",
    header: "File",
    minWidth: 180,
    render: (row) => (
      <CellText
        value={releaseFileLabel(row)}
        className="text-sm text-muted-foreground"
      />
    ),
  },
  {
    key: "fileDate",
    header: "File Date",
    width: 130,
    render: (row) => <CellDate value={row.fileDate} />,
  },
];

export function ReleaseModsTable({
  releaseId,
  query,
  title,
  action,
}: {
  releaseId: number;
  query: string;
  title: string;
  action: ReactNode;
}) {
  const releaseModsQuery = useQuery(
    trpc.admin.modpacks.listReleaseMods.queryOptions({ releaseId }),
  );
  const rows = useMemo(
    () => releaseModsQuery.data ?? [],
    [releaseModsQuery.data],
  );

  const filtered = useMemo(() => {
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.projectName,
        row.projectSlug,
        row.fileName,
        projectKindLabel(row.classId),
        row.required ? null : DISABLED_LABEL,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [rows, query]);

  const paged = useClientPagination(filtered, {
    perPage: MODS_PER_PAGE,
    resetKey: [query, releaseId],
    loading: releaseModsQuery.isLoading,
    error: releaseModsQuery.error?.message ?? null,
    retry: () => void releaseModsQuery.refetch(),
  });

  return (
    <PackCard
      title={title}
      count={rows.length}
      description={DESCRIPTION}
      action={action}
    >
      <PagedTable
        variant="card"
        paged={paged}
        empty={
          rows.length === 0
            ? { icon: Package, message: "This release recorded no mods" }
            : { icon: Search, message: "No mods match your search" }
        }
        itemLabel="mod"
        columns={COLUMNS}
        rowKey={(row) => `${row.curseforgeProjectId}-${row.fileId}`}
      />
    </PackCard>
  );
}
