import { useMemo } from "react";
import { Network, PackagePlus, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { FilterBar } from "@/features/admin/components/FilterBar";
import {
  DEPENDENCY_COVERAGE_STYLES,
  dependencyIsCovered,
} from "@/features/workshop/format";
import type { WorkshopDependency } from "../../types";
import { ModCell, ModCellSkeleton } from "../ModCell";
import { useQuery } from "@tanstack/react-query";

const DEPS_PER_PAGE = 10;

function dependencyName(row: WorkshopDependency) {
  return row.name ?? `Project #${row.curseforgeProjectId}`;
}

export function DependenciesTab({
  workshopId,
  search,
  onSearchChange,
  onAddProject,
  busyProjectId,
}: {
  workshopId: number;
  search: string;
  onSearchChange: (value: string) => void;
  onAddProject: (projectId: number, name: string) => void;
  busyProjectId: number | null;
}) {
  const depsQuery = useQuery(
    trpc.admin.workshops.listDependencies.queryOptions({
      workshopId,
    }),
  );

  const rows = useMemo(() => depsQuery.data ?? [], [depsQuery.data]);
  const query = search.trim().toLowerCase();

  const sorted = useMemo(() => {
    const gapFirst = (row: WorkshopDependency) =>
      dependencyIsCovered(row.coverage) || row.requiredBy.length === 0 ? 1 : 0;
    return [...rows].sort(
      (a, b) =>
        gapFirst(a) - gapFirst(b) ||
        dependencyName(a).localeCompare(dependencyName(b)),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    if (!query) return sorted;
    return sorted.filter((row) =>
      [row.name, row.slug, ...row.requiredBy.map((entry) => entry.name)].some(
        (value) => value?.toLowerCase().includes(query),
      ),
    );
  }, [sorted, query]);

  const paged = useClientPagination(filtered, {
    perPage: DEPS_PER_PAGE,
    resetKey: query,
    loading: depsQuery.isLoading,
    error: depsQuery.error?.message ?? null,
    retry: () => void depsQuery.refetch(),
  });

  const columns: DataTableColumn<WorkshopDependency>[] = [
    {
      key: "dependency",
      header: "Dependency",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (row) => (
        <ModCell
          name={dependencyName(row)}
          slug={row.slug}
          thumbnailUrl={row.thumbnailUrl}
          classId={row.classId ?? undefined}
        />
      ),
    },
    {
      key: "neededBy",
      header: "Needed By",
      minWidth: 200,
      render: (row) => (
        <>
          {row.requiredBy.length > 0 ? (
            <CellText
              value={row.requiredBy.map((entry) => entry.name).join(", ")}
              className="text-sm"
            />
          ) : (
            <span className="text-sm text-muted-foreground">Optional only</span>
          )}
          {(row.optionalByCount > 0 || row.shippingDemand > 1) && (
            <CellText
              value={[
                row.optionalByCount > 0
                  ? `+${row.optionalByCount} optional`
                  : null,
                row.shippingDemand > 1
                  ? `wanted by ${row.shippingDemand} shipping mods`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              className="text-xs text-muted-foreground"
            />
          )}
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => (
        <Badge variant={row.requiredBy.length > 0 ? "outline" : "secondary"}>
          {row.requiredBy.length > 0 ? "Required" : "Optional"}
        </Badge>
      ),
    },
    {
      key: "coverage",
      header: "Coverage",
      width: 170,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => {
        const style = DEPENDENCY_COVERAGE_STYLES[row.coverage];
        return style ? (
          <Badge tone={style.tone} className="text-xs">
            {style.label}
          </Badge>
        ) : null;
      },
    },
  ];

  const rowActions = (row: WorkshopDependency): DataTableAction[] =>
    row.coverage === "missing"
      ? [
          {
            label: "Add to Workshop",
            icon: PackagePlus,
            onClick: () =>
              onAddProject(row.curseforgeProjectId, dependencyName(row)),
          },
        ]
      : [];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search dependencies..."
        activeCount={query ? 1 : 0}
      />

      <TableCard
        title="Dependencies"
        count={
          query
            ? `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()}`
            : rows.length.toLocaleString()
        }
        description="Everything the workshop's mods pull in, with where each dependency stands relative to the pack. Gaps in required coverage sort first."
        paged={paged}
        empty={
          rows.length === 0
            ? { icon: Network, message: "No dependencies pulled in yet" }
            : { icon: Search, message: "No dependencies match your search" }
        }
        itemLabel="dependency"
        columns={columns}
        rowKey={(row) => row.curseforgeProjectId}
        actions={rowActions}
        actionSlots={1}
        isRowBusy={(row) => busyProjectId === row.curseforgeProjectId}
      />
    </>
  );
}
