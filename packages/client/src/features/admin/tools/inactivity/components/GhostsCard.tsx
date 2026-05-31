import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Ghost, RefreshCw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { RemoveGhostModal } from "./modals/RemoveGhostModal";

type GhostMember =
  RouterOutput["admin"]["inactivity"]["ghosts"]["list"]["items"][number];

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function GhostsCard({ canMutate }: { canMutate: boolean }) {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const [removeModal, setRemoveModal] = useState<{
    open: boolean;
    ghost: GhostMember | null;
  }>({ open: false, ghost: null });

  const capabilitiesQuery =
    trpc.admin.inactivity.ghosts.capabilities.useQuery();
  const listQuery = trpc.admin.inactivity.ghosts.list.useQuery({
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });

  const refreshGhosts = trpc.admin.inactivity.ghosts.refresh.useMutation();

  const { refetch: refetchList } = listQuery;
  const { refetch: refetchCapabilities } = capabilitiesQuery;

  const ghosts = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const lastRefreshedAt =
    capabilitiesQuery.data?.lastRefreshedAt ??
    listQuery.data?.lastRefreshedAt ??
    null;
  const loading = listQuery.isLoading;
  const error = listQuery.error?.message ?? null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setPage(0);
    },
    [],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleCopy = useCopyToClipboard();

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshGhosts.mutateAsync();
      toast.success(`Cache refreshed: ${result.count} ghost(s)`);
      refetchList();
      refetchCapabilities();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh ghost cache",
      );
    }
  }, [refreshGhosts, toast, refetchList, refetchCapabilities]);

  const handleRemoveSuccess = useCallback(() => {
    setRemoveModal({ open: false, ghost: null });
    refetchList();
    refetchCapabilities();
  }, [refetchList, refetchCapabilities]);

  const handleRemoveClose = useCallback(() => {
    setRemoveModal({ open: false, ghost: null });
    // Always refetch on close: if verify evicted the user mid-dialog,
    // they should disappear from the table immediately.
    refetchList();
  }, [refetchList]);

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
    <>
      <Card className="gap-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ghost className="size-5 text-muted-foreground" />
                Members Missing from Discord
              </CardTitle>
              <CardDescription className="mt-1">
                Registered players who are no longer in the Discord guild.
                Manual cleanup only, cache populated on demand.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {lastRefreshedAt
                  ? `Last refreshed ${formatRelativeDate(toIso(lastRefreshedAt))}`
                  : "Cache not yet populated"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshGhosts.isPending}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 size-4",
                    refreshGhosts.isPending && "animate-spin",
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Minecraft username..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>
        </CardHeader>

        {loading ? (
          <CardContent className="flex items-center justify-center py-12">
            <Loading size="medium" text="Loading ghosts..." />
          </CardContent>
        ) : error ? (
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={() => listQuery.refetch()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        ) : ghosts.length === 0 ? (
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Ghost className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                {lastRefreshedAt
                  ? "No ghost members in the cache"
                  : "Click Refresh to populate the cache"}
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardContent className="px-0">
              <Table>
                <TableHeader className="bg-sidebar-accent/50">
                  <TableRow>
                    <TableHead className="px-4">Player</TableHead>
                    <TableHead className="px-4">Discord ID</TableHead>
                    <TableHead className="px-4">Registered</TableHead>
                    <TableHead className="px-4">Last Seen</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ghosts.map((ghost) => {
                    const createdAtIso = toIso(ghost.playerCreatedAt);
                    const lastSeenIso = toIso(ghost.playerLastSeen);

                    return (
                      <TableRow key={ghost.discordId}>
                        <TableCell className="px-4">
                          <div>
                            <button
                              type="button"
                              onClick={(e) =>
                                handleCopy(e, ghost.minecraftUsername)
                              }
                              className="group/copy flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                            >
                              {ghost.minecraftUsername}
                              <Copy className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/copy:opacity-100" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) =>
                                handleCopy(e, ghost.minecraftUuid)
                              }
                              className="group/copy flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {ghost.minecraftUuid.slice(0, 8)}…
                              <Copy className="size-2.5 opacity-0 transition-opacity group-hover/copy:opacity-100" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <button
                            type="button"
                            onClick={(e) => handleCopy(e, ghost.discordId)}
                            className="group/copy flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {ghost.discordId}
                            <Copy className="size-3 opacity-0 transition-opacity group-hover/copy:opacity-100" />
                          </button>
                        </TableCell>
                        <TableCell className="px-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeDate(createdAtIso)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start">
                              {formatFullDate(createdAtIso)}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="px-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeDate(lastSeenIso)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start">
                              {formatFullDate(lastSeenIso)}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="cursor-pointer"
                                  disabled={!canMutate}
                                  onClick={() =>
                                    setRemoveModal({ open: true, ghost })
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {canMutate
                                ? "Remove now"
                                : "Only available on the production deployment"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>

            <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
              <p className="text-sm text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
                of {total} ghosts
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

      {removeModal.ghost !== null && (
        <RemoveGhostModal
          open={removeModal.open}
          onClose={handleRemoveClose}
          ghost={removeModal.ghost}
          canMutate={canMutate}
          onSuccess={handleRemoveSuccess}
        />
      )}
    </>
  );
}
