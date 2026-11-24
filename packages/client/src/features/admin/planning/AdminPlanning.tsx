import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Filter, Lightbulb, Plus, SearchX, Tags } from "lucide-react";
import { Paginator } from "@/components/paginator";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  PLANNING_CATEGORIES,
  PLANNING_ITEM_STATUSES,
  type PlanningCategory,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { PlanCard } from "./components/PlanCard";
import { PlanFormDialog } from "./components/PlanFormDialog";
import { SubcategoriesDialog } from "./components/SubcategoriesDialog";
import {
  CATEGORY_CONFIG,
  PAGE_SIZE,
  SORT_OPTIONS,
  STATUS_CONFIG,
  type SortValue,
} from "./constants";
import { subcategoryNames } from "./format";

type StatusTab = "all" | PlanningItemStatus;
type CategoryFilter = "all" | PlanningCategory;
type AssigneeFilter = "anyone" | "me" | "unassigned";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All" },
  ...PLANNING_ITEM_STATUSES.map((value) => ({
    value,
    label: STATUS_CONFIG[value].label,
  })),
];

const ASSIGNEE_FILTERS: { value: AssigneeFilter; label: string }[] = [
  { value: "anyone", label: "Assigned to anyone" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const ALL = "all";

export function AdminPlanning() {
  const { user } = useAuth();

  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<StatusTab>(ALL);
  const [category, setCategory] = useState<CategoryFilter>(ALL);
  const [subcategory, setSubcategory] = useState(ALL);
  const [assignee, setAssignee] = useState<AssigneeFilter>("anyone");
  const [sort, setSort] = useState<SortValue>("edited");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [subcategoriesOpen, setSubcategoriesOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const sortOption =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  const itemsQuery = useQuery(
    trpc.admin.planning.items.list.queryOptions(
      {
        page,
        limit: PAGE_SIZE,
        orderBy: sortOption.orderBy,
        orderDirection: sortOption.orderDirection,
        status: status === ALL ? undefined : status,
        category: category === ALL ? undefined : category,
        subcategoryId: subcategory === ALL ? undefined : Number(subcategory),
        assignee:
          assignee === "me"
            ? user?.discordId
            : assignee === "unassigned"
              ? "unassigned"
              : undefined,
        search: debouncedSearch.trim() || undefined,
      },
      { placeholderData: keepPreviousData },
    ),
  );
  const subcategoriesQuery = useQuery(
    trpc.admin.planning.subcategories.list.queryOptions(),
  );

  const items = itemsQuery.data?.items ?? [];
  const pagination = itemsQuery.data?.pagination;
  const counts = itemsQuery.data?.counts;
  const subcategories = subcategoriesQuery.data?.subcategories ?? [];
  const totalPlans = counts
    ? PLANNING_ITEM_STATUSES.reduce((sum, value) => sum + counts[value], 0)
    : 0;
  const isFiltered =
    debouncedSearch.trim() !== "" || category !== ALL || assignee !== "anyone";
  const defaultCategory = category === ALL ? "modpack" : category;

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(0);
  };

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Planning" },
      ]}
    >
      <AdminPageTitle
        title="Planning"
        description="Ideas, problems and open questions the team is working through."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setSubcategoriesOpen(true)}
            >
              <Tags className="mr-2 size-4" />
              Subcategories
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Plan
            </Button>
          </>
        }
      />

      <Tabs
        value={status}
        onValueChange={(value) =>
          changeFilter(() => setStatus(value as StatusTab))
        }
      >
        <div className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="text-foreground/80">
            {STATUS_TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {counts && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-foreground/10"
                  >
                    {value === ALL ? totalPlans : counts[value]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <SearchInput
              className="min-w-48 flex-1"
              placeholder="Search plans..."
              value={search}
              onValueChange={(value) => changeFilter(() => setSearch(value))}
            />

            <Select
              value={category}
              onValueChange={(value) =>
                changeFilter(() => {
                  setCategory(value as CategoryFilter);
                  setSubcategory(ALL);
                })
              }
            >
              <SelectTrigger className="w-full xs:w-44" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {PLANNING_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_CONFIG[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {category !== ALL && (
              <Select
                value={subcategory}
                onValueChange={(value) =>
                  changeFilter(() => setSubcategory(value))
                }
              >
                <SelectTrigger
                  className="w-full xs:w-52"
                  aria-label="Subcategory"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All subcategories</SelectItem>
                  {subcategories
                    .filter((s) => s.category === category)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={assignee}
              onValueChange={(value) =>
                changeFilter(() => setAssignee(value as AssigneeFilter))
              }
            >
              <SelectTrigger className="w-full xs:w-52" aria-label="Assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNEE_FILTERS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sort}
              onValueChange={(value) =>
                changeFilter(() => setSort(value as SortValue))
              }
            >
              <SelectTrigger className="w-full xs:w-44" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {itemsQuery.error ? (
        <ErrorState
          message={itemsQuery.error.message}
          onRetry={() => void itemsQuery.refetch()}
          bordered
        />
      ) : itemsQuery.isLoading ? (
        <LoadingState />
      ) : totalPlans === 0 && !isFiltered ? (
        <EmptyState
          icon={Lightbulb}
          message="No plans yet"
          hint="Write down the first idea, problem or open question."
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            New Plan
          </Button>
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState icon={SearchX} message="No plans match these filters" />
      ) : (
        <>
          <div
            className={cn(
              "grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3",
              itemsQuery.isPlaceholderData && "opacity-60",
            )}
          >
            {items.map((item) => (
              <PlanCard
                key={item.id}
                item={item}
                subcategories={subcategoryNames(
                  subcategories,
                  item.subcategoryIds,
                )}
              />
            ))}
          </div>

          {pagination && (
            <Paginator
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              itemLabel="plan"
              className="w-full"
            />
          )}
        </>
      )}

      <PlanFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultCategory={defaultCategory}
      />

      <SubcategoriesDialog
        open={subcategoriesOpen}
        onClose={() => setSubcategoriesOpen(false)}
        defaultCategory={defaultCategory}
        subcategories={subcategories}
      />
    </AdminPage>
  );
}
