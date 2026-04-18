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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>FAQ</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

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

          {loading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading FAQ entries..." />
            </CardContent>
          ) : error ? (
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
          ) : entries.length === 0 ? (
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
                <Table>
                  <TableHeader className="bg-sidebar-accent/50">
                    <TableRow>
                      <TableHead className="px-4">ID</TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("title")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Title
                          {renderSortIcon("title")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">Mode</TableHead>
                      <TableHead className="px-4">Pattern</TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("priority")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Priority
                          {renderSortIcon("priority")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("createdAt")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Created
                          {renderSortIcon("createdAt")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="px-4">
                          <p className="font-mono text-sm">#{entry.id}</p>
                        </TableCell>
                        <TableCell className="px-4">
                          <p className="font-medium">{entry.title}</p>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline" className="text-xs">
                            {entry.matchMode === "regex" ? "Regex" : "Keywords"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <p
                            className={cn(
                              "max-w-[200px] truncate text-xs text-muted-foreground",
                              entry.matchMode === "regex" && "font-mono",
                            )}
                            title={entry.pattern}
                          >
                            {entry.pattern}
                          </p>
                        </TableCell>
                        <TableCell className="px-4">
                          <p className="text-sm">{entry.priority}</p>
                        </TableCell>
                        <TableCell className="px-4">
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
                        </TableCell>
                        <TableCell className="px-4">
                          <p className="text-sm text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditModal({ open: true, entry })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDeleteModal({ open: true, entry })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Pagination */}
              <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-
                  {Math.min((page + 1) * limit, total)} of {total} entries
                </p>

                <PaginationContent className="justify-baseline sm:ml-auto sm:justify-end">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 0) handlePageChange(page - 1);
                      }}
                      className={cn(
                        page === 0 && "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>

                  {getPaginationItems().map((item, index) => (
                    <PaginationItem
                      key={item === "ellipsis" ? `ellipsis-${index}` : item}
                    >
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
                        if (page < totalPages - 1) handlePageChange(page + 1);
                      }}
                      className={cn(
                        page >= totalPages - 1 &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </CardFooter>
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
