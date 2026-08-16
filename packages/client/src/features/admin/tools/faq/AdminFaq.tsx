import { useCallback, useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  MessageCircleQuestion,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData } from "@tanstack/react-query";
import { CreateFaqModal } from "./components/modals/CreateFaqModal";
import { EditFaqModal } from "./components/modals/EditFaqModal";
import { DeleteFaqModal } from "./components/modals/DeleteFaqModal";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["entries"][number];

type SortField = "priority" | "title" | "createdAt";
type EnabledFilter = "all" | "enabled" | "disabled";

export function AdminFaq() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");

  const [orderBy, setOrderBy] = useState<SortField>("priority");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    entry: FaqEntry | null;
  }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    entry: FaqEntry | null;
  }>({ open: false, entry: null });

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  const repostWelcome = trpc.admin.faq.repostWelcome.useMutation();

  const entriesQuery = trpc.admin.faq.list.useQuery(
    {
      page,
      limit,
      orderBy,
      orderDirection,
      search: debouncedSearch.trim() || undefined,
      enabled:
        enabledFilter === "enabled"
          ? true
          : enabledFilter === "disabled"
            ? false
            : undefined,
    },
    { placeholderData: keepPreviousData },
  );

  const entries = entriesQuery.data?.entries ?? [];
  const total = entriesQuery.data?.pagination.total ?? 0;
  const totalPages = entriesQuery.data?.pagination.totalPages ?? 0;
  const loading = entriesQuery.isLoading || entriesQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = entriesQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (orderBy === field) {
        setOrderDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setOrderBy(field);
        setOrderDirection("desc");
      }
      setPage(0);
    },
    [orderBy],
  );

  const handleSuccess = useCallback(() => {
    setCreateModal(false);
    setEditModal({ open: false, entry: null });
    setDeleteModal({ open: false, entry: null });
    entriesQuery.refetch();
  }, [entriesQuery]);

  const handleRepostWelcome = useCallback(async () => {
    try {
      await repostWelcome.mutateAsync();
      toast.success("Welcome message reposted");
    } catch {
      toast.error("Failed to repost welcome message");
    }
  }, [repostWelcome, toast]);

  const columns: DataTableColumn<FaqEntry>[] = [
    {
      key: "id",
      header: "ID",
      width: 70,
      render: (entry) => <p className="font-mono text-sm">#{entry.id}</p>,
    },
    {
      key: "title",
      header: "Title",
      minWidth: 200,
      sorted: orderBy === "title" ? orderDirection : false,
      onSort: () => handleSort("title"),
      render: (entry) => (
        <CellText value={entry.title} className="font-medium" />
      ),
    },
    {
      key: "mode",
      header: "Mode",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => (
        <Badge variant="outline" className="text-xs">
          {entry.matchMode === "regex" ? "Regex" : "Keywords"}
        </Badge>
      ),
    },
    {
      key: "pattern",
      header: "Pattern",
      minWidth: 160,
      render: (entry) => (
        <CellText
          value={entry.pattern}
          className={cn(
            "text-xs text-muted-foreground",
            entry.matchMode === "regex" && "font-mono",
          )}
        />
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: 105,
      sorted: orderBy === "priority" ? orderDirection : false,
      onSort: () => handleSort("priority"),
      cellClassName: "text-sm",
      render: (entry) => entry.priority,
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => (
        <Badge
          variant="outline"
          className={
            entry.enabled
              ? "border-success bg-success/10 text-success"
              : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
          }
        >
          {entry.enabled ? "Enabled" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      width: 130,
      sorted: orderBy === "createdAt" ? orderDirection : false,
      onSort: () => handleSort("createdAt"),
      render: (entry) => <CellDate value={entry.createdAt} />,
    },
  ];

  const entryActions = (entry: FaqEntry): DataTableAction[] => [
    {
      label: "Edit",
      icon: Pencil,
      onClick: () => setEditModal({ open: true, entry }),
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => setDeleteModal({ open: true, entry }),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "FAQ" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">FAQ Auto-Responder</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRepostWelcome}
              disabled={repostWelcome.isPending}
            >
              <RefreshCw
                className={cn(
                  "mr-2 size-4",
                  repostWelcome.isPending && "animate-spin",
                )}
              />
              Repost Welcome
            </Button>
            <Button onClick={() => setCreateModal(true)}>
              <Plus className="mr-2 size-4" />
              New Entry
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={enabledFilter}
                onValueChange={(v) => {
                  setEnabledFilter(v as EnabledFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entries</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" className="min-w-[85px]">
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* FAQ Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>FAQ Entries ({total.toLocaleString()})</CardTitle>
          </CardHeader>

          {error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => entriesQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : !loading && entries.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <MessageCircleQuestion className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No FAQ entries found
                </p>
                <Button onClick={() => setCreateModal(true)} className="mt-4">
                  <Plus className="mr-2 size-4" />
                  Create First Entry
                </Button>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <DataTable
                  columns={columns}
                  rows={entries}
                  loading={loading}
                  loadingRows={loadingRows}
                  rowKey={(entry) => entry.id}
                  actions={entryActions}
                />
              </CardContent>

              {total > 0 && (
                <CardFooter className="border-t">
                  <Paginator
                    page={page}
                    limit={limit}
                    total={total}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    itemLabel="entry"
                    className="w-full"
                  />
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Modals */}
      <CreateFaqModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        onSuccess={handleSuccess}
      />

      {editModal.entry !== null && (
        <EditFaqModal
          open={editModal.open}
          onClose={() => setEditModal({ open: false, entry: null })}
          entry={editModal.entry}
          onSuccess={handleSuccess}
        />
      )}

      {deleteModal.entry !== null && (
        <DeleteFaqModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, entry: null })}
          entry={deleteModal.entry}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
