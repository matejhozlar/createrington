import { useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Filter, Lightbulb, Plus, Tags } from "lucide-react";
import { LabeledSwitch } from "@/components/labeled-switch";
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
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { useToastActions } from "@/hooks/use-toast";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_CATEGORIES,
  PLANNING_ITEM_STATUSES,
  type PlanningCategory,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { CreateItemDialog } from "./components/CreateItemDialog";
import { ItemSheet } from "./components/ItemSheet";
import { PlanningBoard } from "./components/PlanningBoard";
import { SubcategoriesDialog } from "./components/SubcategoriesDialog";
import { CATEGORY_CONFIG, OPEN_STATUSES } from "./constants";
import type { PlanningItem } from "./types";

type CategoryTab = "all" | PlanningCategory;
type AssigneeFilter = "anyone" | "me" | "unassigned";

const CATEGORY_TABS: { value: CategoryTab; label: string }[] = [
  { value: "all", label: "All" },
  ...PLANNING_CATEGORIES.map((value) => ({
    value,
    label: CATEGORY_CONFIG[value].label,
  })),
];

const ASSIGNEE_FILTERS: { value: AssigneeFilter; label: string }[] = [
  { value: "anyone", label: "Assigned to anyone" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const ALL_SUBCATEGORIES = "all";
const CARD_PARAM = "card";

export function AdminPlanning() {
  const { user } = useAuth();
  const toast = useToastActions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [category, setCategory] = useState<CategoryTab>("all");
  const [subcategory, setSubcategory] = useState(ALL_SUBCATEGORIES);
  const [assignee, setAssignee] = useState<AssigneeFilter>("anyone");
  const [search, setSearch] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [subcategoriesOpen, setSubcategoriesOpen] = useState(false);

  const itemsQuery = useQuery(trpc.admin.planning.items.list.queryOptions());
  const subcategoriesQuery = useQuery(
    trpc.admin.planning.subcategories.list.queryOptions(),
  );

  const listKey = trpc.admin.planning.items.list.queryKey();
  const move = useMutation(
    trpc.admin.planning.items.update.mutationOptions({
      onMutate: async ({ id, status }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(
          listKey,
          (current) =>
            current && {
              items: current.items.map((item) =>
                item.id === id && status ? { ...item, status } : item,
              ),
            },
        );
        return { previous };
      },
      onError: (error, _variables, context) => {
        queryClient.setQueryData(listKey, context?.previous);
        toast.error(error.message);
      },
      onSettled: () =>
        queryClient.invalidateQueries(trpc.admin.planning.pathFilter()),
    }),
  );

  const allItems = itemsQuery.data?.items ?? [];
  const subcategories = subcategoriesQuery.data?.subcategories ?? [];
  const statuses: readonly PlanningItemStatus[] = showRejected
    ? PLANNING_ITEM_STATUSES
    : OPEN_STATUSES;

  const cardParam = Number(searchParams.get(CARD_PARAM));
  const openItemId =
    Number.isInteger(cardParam) && cardParam > 0 ? cardParam : null;
  const openItem = (id: number | null) =>
    setSearchParams(
      (params) => {
        if (id === null) params.delete(CARD_PARAM);
        else params.set(CARD_PARAM, String(id));
        return params;
      },
      { replace: id === null },
    );

  const needle = search.trim().toLowerCase();
  const matchesFilters = (item: PlanningItem) =>
    (assignee === "anyone" ||
      (assignee === "unassigned"
        ? item.assignees.length === 0
        : item.assignees.some((a) => a.discordId === user?.discordId))) &&
    (!needle ||
      item.title.toLowerCase().includes(needle) ||
      (item.body ?? "").toLowerCase().includes(needle));

  const filtered = allItems.filter(
    (item) => statuses.includes(item.status) && matchesFilters(item),
  );
  const visible = filtered.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      (subcategory === ALL_SUBCATEGORIES ||
        item.subcategoryId === Number(subcategory)),
  );
  const countFor = (tab: CategoryTab) =>
    tab === "all"
      ? filtered.length
      : filtered.filter((item) => item.category === tab).length;

  const defaultCategory = category === "all" ? "modpack" : category;
  const error = itemsQuery.error ?? subcategoriesQuery.error;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Planning" },
        ]}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Planning"
          description="Ideas, problems and decisions the team is working through, in one place."
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
                New Card
              </Button>
            </>
          }
        />

        <Tabs
          value={category}
          onValueChange={(value) => {
            setCategory(value as CategoryTab);
            setSubcategory(ALL_SUBCATEGORIES);
          }}
        >
          <div className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="text-foreground/80">
              {CATEGORY_TABS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                  <Badge
                    variant="outline"
                    className="border-transparent bg-foreground/10"
                  >
                    {countFor(value)}
                  </Badge>
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
                placeholder="Search cards..."
                value={search}
                onValueChange={setSearch}
              />

              {category !== "all" && (
                <Select value={subcategory} onValueChange={setSubcategory}>
                  <SelectTrigger
                    className="w-full xs:w-52"
                    aria-label="Subcategory"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUBCATEGORIES}>
                      All subcategories
                    </SelectItem>
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
                onValueChange={(value) => setAssignee(value as AssigneeFilter)}
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

              <LabeledSwitch
                id="planning-show-rejected"
                checked={showRejected}
                onCheckedChange={setShowRejected}
                label="Show rejected"
              />
            </div>
          </CardContent>
        </Card>

        {error ? (
          <ErrorState
            message={error.message}
            onRetry={() => {
              void itemsQuery.refetch();
              void subcategoriesQuery.refetch();
            }}
            bordered
          />
        ) : itemsQuery.isLoading || subcategoriesQuery.isLoading ? (
          <LoadingState />
        ) : allItems.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            message="No cards yet"
            hint="Add the first idea, problem or open question."
          >
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Card
            </Button>
          </EmptyState>
        ) : (
          <PlanningBoard
            statuses={statuses}
            items={visible}
            subcategories={subcategories}
            showCategory={category === "all"}
            onOpen={(item) => openItem(item.id)}
            onMove={(item, status) =>
              move.mutate({ id: item.id, revision: item.revision, status })
            }
          />
        )}
      </div>

      <CreateItemDialog
        key={`create-${defaultCategory}`}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultCategory={defaultCategory}
        subcategories={subcategories}
      />

      <SubcategoriesDialog
        key={`subcategories-${defaultCategory}`}
        open={subcategoriesOpen}
        onClose={() => setSubcategoriesOpen(false)}
        defaultCategory={defaultCategory}
        subcategories={subcategories}
        items={allItems}
      />

      <ItemSheet
        itemId={openItemId}
        onClose={() => openItem(null)}
        subcategories={subcategories}
      />
    </div>
  );
}
