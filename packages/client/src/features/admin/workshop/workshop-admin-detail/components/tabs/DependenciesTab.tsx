import { useMemo, useState } from "react";
import { Network, PackagePlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Paginator } from "@/components/paginator";
import { CellText } from "@/components/cell-text";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { FilterBar } from "@/features/admin/components/FilterBar";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import {
  DEPENDENCY_COVERAGE_STYLES,
  dependencyIsCovered,
} from "@/features/workshop/format";
import type { WorkshopDependency } from "../../types";
import { ModCell } from "../ModCell";

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
  onAddProject: (projectId: number) => void;
  busyProjectId: number | null;
}) {
  const depsQuery = trpc.admin.workshops.listDependencies.useQuery({
    workshopId,
  });
  const [requestedPage, setRequestedPage] = useState(0);

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

  const totalPages = Math.ceil(filtered.length / DEPS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));
  const visible = filtered.slice(
    page * DEPS_PER_PAGE,
    (page + 1) * DEPS_PER_PAGE,
  );

  const columns: DataTableColumn<WorkshopDependency>[] = [
    {
      key: "dependency",
      header: "Dependency",
      minWidth: 220,
      render: (row) => (
        <ModCell
          name={dependencyName(row)}
          slug={row.slug}
          thumbnailUrl={row.thumbnailUrl}
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
      render: (row) => {
        const style = DEPENDENCY_COVERAGE_STYLES[row.coverage];
        return style ? (
          <Badge variant="outline" className={cn("text-xs", style.className)}>
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
            onClick: () => onAddProject(row.curseforgeProjectId),
          },
        ]
      : [];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={(value) => {
          onSearchChange(value);
          setRequestedPage(0);
        }}
        placeholder="Search dependencies..."
        activeCount={query ? 1 : 0}
      />

      <Card className="gap-0">
        <CardHeader className="border-b">
          <CardTitle>
            Dependencies (
            {query
              ? `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()}`
              : rows.length.toLocaleString()}
            )
          </CardTitle>
          <CardDescription>
            Everything the workshop's mods pull in, with where each dependency
            stands relative to the pack. Gaps in required coverage sort first.
          </CardDescription>
        </CardHeader>

        {depsQuery.isLoading ? (
          <CardLoading text="Loading dependencies..." />
        ) : depsQuery.error ? (
          <CardError
            message={depsQuery.error.message}
            onRetry={() => depsQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <CardEmpty icon={Network} message="No dependencies pulled in yet" />
        ) : filtered.length === 0 ? (
          <CardEmpty
            icon={Search}
            message="No dependencies match your search"
          />
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={visible}
              rowKey={(row) => row.curseforgeProjectId}
              actions={rowActions}
              actionSlots={1}
              isRowBusy={(row) => busyProjectId === row.curseforgeProjectId}
            />

            <Paginator
              page={page}
              limit={DEPS_PER_PAGE}
              total={filtered.length}
              totalPages={totalPages}
              onPageChange={setRequestedPage}
              itemLabel="dependency"
              className="px-4 pt-4"
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}
