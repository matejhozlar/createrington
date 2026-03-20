import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loading } from "@/components/loading-spinner";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface SessionsTabProps {
  serverId: number;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Active";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SessionsTab({ serverId }: SessionsTabProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const limit = 20;

  const sessionsQuery = trpc.admin.servers.sessions.useQuery({
    serverId,
    page,
    limit,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const pagination = sessionsQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? 0;
  const loading = sessionsQuery.isLoading;

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="medium" text="Loading sessions..." />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No sessions found for this server
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader className="bg-sidebar-accent/50">
          <TableRow>
            <TableHead className="px-4">Player</TableHead>
            <TableHead className="px-4">Joined</TableHead>
            <TableHead className="px-4">Left</TableHead>
            <TableHead className="px-4">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="px-4">
                <div className="flex items-center gap-3">
                  <MinecraftAvatar
                    uuid={session.playerMinecraftUuid}
                    username={session.minecraftUsername}
                  />
                  <button
                    type="button"
                    className="font-medium hover:underline cursor-pointer"
                    onClick={() =>
                      navigate(`/admin/players/${session.playerMinecraftUuid}`)
                    }
                  >
                    {session.minecraftUsername}
                  </button>
                </div>
              </TableCell>
              <TableCell className="px-4 text-sm text-muted-foreground">
                {new Date(session.sessionStart).toLocaleString()}
              </TableCell>
              <TableCell className="px-4 text-sm text-muted-foreground">
                {session.sessionEnd
                  ? new Date(session.sessionEnd).toLocaleString()
                  : "Active"}
              </TableCell>
              <TableCell className="px-4 text-sm">
                {formatDuration(session.secondsPlayed)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of{" "}
            {total} sessions
          </p>

          <PaginationContent>
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
        </div>
      )}
    </div>
  );
}
