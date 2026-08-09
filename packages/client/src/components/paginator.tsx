import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function getPageItems(
  page: number,
  totalPages: number,
): (number | "ellipsis")[] {
  const items: (number | "ellipsis")[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  items.push(0);
  if (page <= 2) {
    items.push(1, 2, 3, "ellipsis", totalPages - 1);
  } else if (page >= totalPages - 3) {
    items.push(
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
    );
  } else {
    items.push(
      "ellipsis",
      page - 1,
      page,
      page + 1,
      "ellipsis",
      totalPages - 1,
    );
  }
  return items;
}

export interface PaginatorProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Singular noun for the entry label, e.g. "chunk", "member", "player". Defaults to "entry". */
  itemLabel?: string;
  className?: string;
}

/**
 * Compact pagination footer: "Showing N-M of T entries" + page controls.
 * Renders as a single-line summary when there's only one page (or none).
 */
export function Paginator({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  itemLabel = "entry",
  className,
}: PaginatorProps) {
  const plural = total === 1 ? itemLabel : `${itemLabel}s`;

  if (totalPages <= 1) {
    if (total === 0) return null;
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Showing {total} {plural}
      </p>
    );
  }

  const start = page * limit + 1;
  const end = Math.min((page + 1) * limit, total);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing {start}-{end} of {total} {plural}
      </p>
      <Pagination className="sm:mx-0 sm:ml-auto sm:w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 0) onPageChange(page - 1);
              }}
              className={cn(page === 0 && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
          {getPageItems(page, totalPages).map((item, idx) => (
            <PaginationItem key={item === "ellipsis" ? `e-${idx}` : item}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(item);
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
                if (page < totalPages - 1) onPageChange(page + 1);
              }}
              className={cn(
                page >= totalPages - 1 && "pointer-events-none opacity-50",
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
