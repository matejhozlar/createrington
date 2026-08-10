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
import { RefreshCw, Search, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { CellText } from "@/components/cell-text";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import { trpc } from "@/lib/trpc";

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function UnlinkedMembersCard() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const listQuery = trpc.admin.inactivity.unlinked.list.useQuery({
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });

  const refreshMembers = trpc.admin.inactivity.unlinked.refresh.useMutation();

  const { refetch: refetchList } = listQuery;

  const members = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const lastRefreshedAt = listQuery.data?.lastRefreshedAt ?? null;
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

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshMembers.mutateAsync();
      toast.success(`Cache refreshed: ${result.count} member(s)`);
      refetchList();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh unlinked member cache",
      );
    }
  }, [refreshMembers, toast, refetchList]);

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
    <Card className="gap-0">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserSearch className="size-5 text-muted-foreground" />
              Members Missing from Database
            </CardTitle>
            <CardDescription className="mt-1">
              Verified Discord members with no matching player record. Read-only
              audit, cache populated on demand.
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
              disabled={refreshMembers.isPending}
            >
              <RefreshCw
                className={cn(
                  "mr-2 size-4",
                  refreshMembers.isPending && "animate-spin",
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
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
      </CardHeader>

      {loading ? (
        <CardContent className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading members..." />
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
      ) : members.length === 0 ? (
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <UserSearch className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {lastRefreshedAt
                ? "No unlinked members in the cache"
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
                  <TableHead className="px-4">Member</TableHead>
                  <TableHead className="px-4">Discord ID</TableHead>
                  <TableHead className="px-4">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const joinedIso = member.joinedAt
                    ? toIso(member.joinedAt)
                    : null;

                  return (
                    <TableRow key={member.discordId}>
                      <TableCell className="px-4">
                        <div>
                          <CellText
                            copy
                            value={member.displayName}
                            className="font-medium"
                          />
                          <CellText
                            copy
                            value={member.username}
                            display={`@${member.username}`}
                            className="font-mono text-xs text-muted-foreground"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <CellText
                          copy
                          value={member.discordId}
                          className="font-mono text-xs text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="px-4">
                        {joinedIso ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeDate(joinedIso)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start">
                              {formatFullDate(joinedIso)}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
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
              of {total} members
            </p>

            <PaginationContent className="justify-baseline sm:ml-auto sm:justify-end">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 0) handlePageChange(page - 1);
                  }}
                  className={cn(page === 0 && "pointer-events-none opacity-50")}
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
                    page >= totalPages - 1 && "pointer-events-none opacity-50",
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
