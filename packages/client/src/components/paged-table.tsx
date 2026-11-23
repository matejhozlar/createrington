import * as React from "react";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableProps } from "@/components/data-table";
import { Paginator } from "@/components/paginator";
import { EmptyState, ErrorState } from "@/components/query-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PagedRows } from "@/hooks/use-paged-query";

export type PagedTableProps<T> = Omit<
  DataTableProps<T>,
  "rows" | "loading" | "loadingRows"
> & {
  paged: PagedRows<T>;
  empty: React.ComponentProps<typeof EmptyState>;
  itemLabel: string;
  compact?: boolean;
};

export function PagedTable<T>({
  paged,
  empty,
  itemLabel,
  compact = false,
  variant = "plain",
  ...table
}: PagedTableProps<T> & { variant?: "plain" | "card" }) {
  if (paged.error) {
    return (
      <ErrorState
        message={paged.error}
        onRetry={paged.retry}
        compact={compact}
      />
    );
  }

  if (!paged.loading && paged.total === 0) {
    return <EmptyState {...empty} />;
  }

  const dataTable = (
    <DataTable
      {...table}
      rows={paged.rows}
      loading={paged.loading}
      loadingRows={paged.loadingRows}
    />
  );
  const paginator = (className: string) => (
    <Paginator
      page={paged.page}
      limit={paged.limit}
      total={paged.total}
      totalPages={paged.totalPages}
      onPageChange={paged.setPage}
      itemLabel={itemLabel}
      className={className}
    />
  );

  if (variant === "card") {
    return (
      <>
        <CardContent className="px-0">{dataTable}</CardContent>
        {paged.total > 0 && (
          <CardFooter className="border-t">{paginator("w-full")}</CardFooter>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {dataTable}
      {paginator("border-t border-border pt-4")}
    </div>
  );
}

export function TableCard<T>({
  title,
  count,
  description,
  header,
  className,
  ...table
}: PagedTableProps<T> & {
  title?: React.ReactNode;
  count?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}) {
  const hasHeader = header !== undefined || title !== undefined;

  return (
    <Card className={cn("gap-0", !hasHeader && "pt-0", className)}>
      {header !== undefined ? (
        <CardHeader className="border-b">{header}</CardHeader>
      ) : (
        title !== undefined && (
          <CardHeader
            className={cn("border-b", description === undefined && "gap-0")}
          >
            <CardTitle>
              {title} ({count ?? table.paged.total.toLocaleString()})
            </CardTitle>
            {description !== undefined && (
              <CardDescription>{description}</CardDescription>
            )}
          </CardHeader>
        )
      )}
      <PagedTable {...table} variant="card" />
    </Card>
  );
}
