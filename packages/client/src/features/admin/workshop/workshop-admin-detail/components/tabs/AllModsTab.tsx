import { useMemo, useState } from "react";
import { Heart, Lightbulb, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CellDate } from "@/components/cell-text";
import {
  AvatarCellSkeleton,
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { PlayerLabel } from "@/components/player-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/features/admin/components/FilterBar";
import {
  MOD_STATUS_STYLES,
  projectCategories,
} from "@/features/workshop/format";
import { EnvironmentCell } from "@/features/workshop/components/EnvironmentCell";
import {
  modReviewActions,
  type ModTableProps,
} from "@/features/admin/workshop/workshop-admin-detail/actions";
import type { AdminWorkshopMod } from "@/features/admin/workshop/workshop-admin-detail/types";
import { DependencyCell } from "@/features/admin/workshop/workshop-admin-detail/components/DependencyCell";
import {
  ModCell,
  ModCellSkeleton,
} from "@/features/admin/workshop/workshop-admin-detail/components/ModCell";

const MODS_PER_PAGE = 10;

export function AllModsTab({
  mods,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  busyModId,
  onView,
  envDisplay,
  onSetEnvironment,
  onReview,
  onReject,
}: {
  mods: AdminWorkshopMod[];
} & ModTableProps) {
  const [category, setCategory] = useState("all");
  const query = search.trim().toLowerCase();

  const categories = useMemo(
    () =>
      [
        ...new Set(
          mods.flatMap((mod) => projectCategories(mod.project.categories)),
        ),
      ].sort(),
    [mods],
  );

  const filtered = useMemo(() => {
    return mods.filter((mod) => {
      if (
        category !== "all" &&
        !projectCategories(mod.project.categories).includes(category)
      ) {
        return false;
      }
      if (!query) return true;
      return [mod.project.name, mod.project.slug, mod.submitterName].some(
        (value) => value?.toLowerCase().includes(query),
      );
    });
  }, [mods, category, query]);

  const filtering = query !== "" || category !== "all";
  const paged = useClientPagination(filtered, {
    perPage: MODS_PER_PAGE,
    resetKey: [query, category],
    loading: isLoading,
    error,
    retry: onRetry,
  });

  const columns: DataTableColumn<AdminWorkshopMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
      skeleton: () => <ModCellSkeleton />,
      render: (mod) => (
        <ModCell
          name={mod.project.name}
          slug={mod.project.slug}
          thumbnailUrl={mod.project.thumbnailUrl}
        />
      ),
    },
    {
      key: "submitter",
      header: "Submitted by",
      minWidth: 150,
      skeleton: () => <AvatarCellSkeleton />,
      render: (mod) => (
        <PlayerLabel
          name={mod.submitterName ?? mod.submittedBy}
          playerId={mod.submittedBy}
          size={20}
        />
      ),
    },
    {
      key: "upvotes",
      header: <Heart className="mx-auto size-3.5" />,
      width: 56,
      align: "center",
      cellClassName: "text-sm",
      render: (mod) => mod.upvoteCount,
    },
    {
      key: "dependencies",
      header: "Pulls In",
      width: 90,
      align: "center",
      render: (mod) =>
        mod.dependencies.length > 0 && <DependencyCell mod={mod} />,
    },
    {
      key: "environment",
      header: "Environment",
      width: 140,
      skeleton: () => <BadgeCellSkeleton />,
      render: (mod) => (
        <EnvironmentCell
          projectId={mod.project.id}
          environment={mod.project.environment}
          source={mod.project.environmentSource}
          display={envDisplay}
          onSetEnvironment={onSetEnvironment}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 124,
      skeleton: () => <BadgeCellSkeleton />,
      render: (mod) => {
        const status = MOD_STATUS_STYLES[mod.status];
        return status ? (
          <Badge tone={status.tone} className="text-xs">
            {status.tableLabel}
          </Badge>
        ) : null;
      },
    },
    {
      key: "date",
      header: "Suggested",
      width: 130,
      render: (mod) => <CellDate value={mod.createdAt} />,
    },
  ];

  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        placeholder="Search by mod or player..."
        activeCount={(query ? 1 : 0) + (category !== "all" ? 1 : 0)}
      >
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="min-w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <TableCard
        title="All Mods"
        count={
          filtering
            ? `${filtered.length.toLocaleString()} of ${mods.length.toLocaleString()}`
            : mods.length.toLocaleString()
        }
        paged={paged}
        empty={
          mods.length === 0
            ? { icon: Lightbulb, message: "No suggestions yet" }
            : { icon: Search, message: "No mods match your filters" }
        }
        itemLabel="mod"
        columns={columns}
        rowKey={(mod) => mod.id}
        onRowClick={(mod) => onView(mod.id)}
        actions={(mod) =>
          modReviewActions(mod, { onReview, onReject }, envDisplay)
        }
        actionSlots={0}
        isRowBusy={(mod) => busyModId === mod.id}
      />
    </>
  );
}
