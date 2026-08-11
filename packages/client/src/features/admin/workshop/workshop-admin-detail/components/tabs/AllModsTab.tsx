import { useMemo, useState } from "react";
import { Heart, Lightbulb, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Paginator } from "@/components/paginator";
import { CellDate } from "@/components/cell-text";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { PlayerLabel } from "@/components/player-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import {
  MOD_STATUS_STYLES,
  projectCategories,
} from "@/features/workshop/format";
import { modReviewActions, type ModReviewHandlers } from "../../actions";
import type { AdminWorkshopMod } from "../../types";
import { DependencyCell } from "../DependencyCell";
import { ModCell } from "../ModCell";

const MODS_PER_PAGE = 10;

export function AllModsTab({
  mods,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  page: requestedPage,
  onPageChange,
  busyModId,
  onView,
  onReview,
  onReject,
}: {
  mods: AdminWorkshopMod[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
} & ModReviewHandlers) {
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
  const totalPages = Math.ceil(filtered.length / MODS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));
  const visible = filtered.slice(
    page * MODS_PER_PAGE,
    (page + 1) * MODS_PER_PAGE,
  );

  const columns: DataTableColumn<AdminWorkshopMod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 220,
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
      key: "status",
      header: "Status",
      width: 124,
      render: (mod) => {
        const status = MOD_STATUS_STYLES[mod.status];
        return status ? (
          <Badge variant="outline" className={cn("text-xs", status.className)}>
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
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>
          All Mods (
          {filtering
            ? `${filtered.length.toLocaleString()} of ${mods.length.toLocaleString()}`
            : mods.length.toLocaleString()}
          )
        </CardTitle>
        <CardAction className="flex items-center gap-2 max-md:col-span-full max-md:row-start-2 max-md:mt-3 max-md:flex-col max-md:items-stretch max-md:justify-self-stretch">
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              onPageChange(0);
            }}
          >
            <SelectTrigger className="w-full md:w-[170px]">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by mod or player..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full pl-9 md:w-64"
            />
          </div>
        </CardAction>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading mods..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : mods.length === 0 ? (
        <CardEmpty icon={Lightbulb} message="No suggestions yet" />
      ) : filtered.length === 0 ? (
        <CardEmpty icon={Search} message="No mods match your filters" />
      ) : (
        <CardContent className="px-0">
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(mod) => mod.id}
            onRowClick={(mod) => onView(mod.id)}
            actions={(mod) => modReviewActions(mod, { onReview, onReject })}
            actionSlots={0}
            isRowBusy={(mod) => busyModId === mod.id}
          />

          <Paginator
            page={page}
            limit={MODS_PER_PAGE}
            total={filtered.length}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemLabel="mod"
            className="px-4 pt-4"
          />
        </CardContent>
      )}
    </Card>
  );
}
