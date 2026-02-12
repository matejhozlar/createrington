import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  MessageCircleQuestion,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");

  // Sorting state
  const [orderBy, setOrderBy] = useState<SortField>("priority");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  // Modal state
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    entry: FaqEntry | null;
  }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    entry: FaqEntry | null;
  }>({ open: false, entry: null });

  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const repostWelcome = trpc.admin.faq.repostWelcome.useMutation();

  // tRPC query
  const entriesQuery = trpc.admin.faq.list.useQuery({
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
  });

  const entries = entriesQuery.data?.entries ?? [];
  const total = entriesQuery.data?.pagination.total ?? 0;
  const totalPages = entriesQuery.data?.pagination.totalPages ?? 0;
  const loading = entriesQuery.isLoading;
  const error = entriesQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
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

  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (orderBy !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return orderDirection === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [orderBy, orderDirection],
  );

  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    items.push(0);

    if (page <= 2) {
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>FAQ</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">FAQ Auto-Responder</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRepostWelcome}
              disabled={repostWelcome.isPending}
              className="cursor-pointer"
            >
              <RefreshCw
                className={cn(
                  "mr-2 size-4",
                  repostWelcome.isPending && "animate-spin",
                )}
              />
              Repost Welcome
            </Button>
            <Button
              onClick={() => setCreateModal(true)}
              className="cursor-pointer"
            >
              <Plus className="mr-2 size-4" />
              New Entry
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Filters</h3>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={enabledFilter === "all" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setEnabledFilter("all");
                  setPage(0);
                }}
                className="min-w-[85px] cursor-pointer"
              >
                All
              </Button>
              <Button
                type="button"
                variant={enabledFilter === "enabled" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setEnabledFilter("enabled");
                  setPage(0);
                }}
                className="min-w-[85px] cursor-pointer"
              >
                Enabled
              </Button>
              <Button
                type="button"
                variant={enabledFilter === "disabled" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setEnabledFilter("disabled");
                  setPage(0);
                }}
                className="min-w-[85px] cursor-pointer"
              >
                Disabled
              </Button>
            </div>
          </form>
        </div>

        {/* FAQ Table */}
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">
              FAQ Entries ({total.toLocaleString()})
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading FAQ entries..." />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => entriesQuery.refetch()}
                  className="mt-4 cursor-pointer"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <MessageCircleQuestion className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No FAQ entries found
                </p>
                <Button
                  onClick={() => setCreateModal(true)}
                  className="mt-4 cursor-pointer"
                >
                  <Plus className="mr-2 size-4" />
                  Create First Entry
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-sidebar-accent/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        ID
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("title")}
                      >
                        <div className="flex items-center">
                          Title
                          {renderSortIcon("title")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Pattern
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("priority")}
                      >
                        <div className="flex items-center">
                          Priority
                          {renderSortIcon("priority")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Status
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("createdAt")}
                      >
                        <div className="flex items-center">
                          Created
                          {renderSortIcon("createdAt")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="transition-colors hover:bg-sidebar-accent/30"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm">#{entry.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{entry.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
                            title={entry.pattern}
                          >
                            {entry.pattern}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{entry.priority}</p>
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() =>
                                setEditModal({ open: true, entry })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() =>
                                setDeleteModal({ open: true, entry })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center border-t border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * limit + 1}-
                    {Math.min((page + 1) * limit, total)} of {total} entries
                  </p>

                  <PaginationContent className="ml-auto flex-nowrap justify-end">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 0) handlePageChange(page - 1);
                        }}
                        className={cn(
                          page === 0 && "pointer-events-none opacity-50",
                          "cursor-pointer",
                        )}
                      />
                    </PaginationItem>

                    {getPaginationItems().map((item, index) => (
                      <PaginationItem key={index}>
                        {item === "ellipsis" ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(item);
                            }}
                            isActive={page === item}
                            className="cursor-pointer"
                          >
                            {item + 1}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages - 1)
                            handlePageChange(page + 1);
                        }}
                        className={cn(
                          page >= totalPages - 1 &&
                            "pointer-events-none opacity-50",
                          "cursor-pointer",
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </div>
              )}
            </>
          )}
        </div>
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
