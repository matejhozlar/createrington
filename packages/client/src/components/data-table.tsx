/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
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

const INLINE_ACTION_LIMIT = 2;
const DEFAULT_LOADING_ROWS = 10;
const CELL_PADDING = 32;
const ACTION_BUTTON_WIDTH = 38;
const ACTION_GAP = 8;
const FLEX_COLUMN_MIN_WIDTH = 120;
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, [role=menuitem], [role=checkbox]";

export type DataTableColumn<T> = {
  key: string;
  header?: React.ReactNode;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  cellClassName?: string;
  sorted?: "asc" | "desc" | false;
  onSort?: () => void;
  render: (row: T, index: number) => React.ReactNode;
  skeleton?: () => React.ReactNode;
};

export type DataTableAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  iconClassName?: string;
  disabled?: boolean;
};

const ALIGN_CLASSES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function loadingRowCount(
  page: number,
  limit: number,
  total: number,
): number {
  return total > 0 ? Math.min(limit, Math.max(total - page * limit, 1)) : limit;
}

export function BadgeCellSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-[22px] w-14 rounded-full", className)} />;
}

export function TwoLineCellSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-5 items-center">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function AvatarCellSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className="size-8 shrink-0 rounded-xs" />
      <TwoLineCellSkeleton />
    </div>
  );
}

function SortIcon({ sorted }: { sorted: "asc" | "desc" | false }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-50" />;
}

function ActionButton({
  action,
  busy,
  spinner,
}: {
  action: DataTableAction;
  busy: boolean;
  spinner: boolean;
}) {
  const disabled = action.disabled || busy;
  const button = (
    <Button
      size="sm"
      variant={action.variant ?? "outline"}
      aria-label={action.label}
      disabled={disabled}
      onClick={action.onClick}
    >
      {busy && spinner ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <action.icon className={cn("size-4", action.iconClassName)} />
      )}
    </Button>
  );

  return (
    <Tooltip delayDuration={500} disableHoverableContent>
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

function ActionMenu({
  actions,
  busy,
  spinner,
}: {
  actions: DataTableAction[];
  busy: boolean;
  spinner: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label="More actions"
          disabled={busy}
        >
          {busy && spinner ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            className={
              action.variant === "destructive"
                ? "text-destructive focus:text-destructive"
                : undefined
            }
          >
            <action.icon className={cn("size-4", action.iconClassName)} />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActionGroup({
  actions,
  busy,
  menuOnly,
}: {
  actions: DataTableAction[];
  busy: boolean;
  menuOnly: boolean;
}) {
  if (actions.length === 0) return null;

  if (menuOnly) {
    return (
      <div className="flex justify-end">
        <ActionMenu actions={actions} busy={busy} spinner />
      </div>
    );
  }

  if (actions.length <= INLINE_ACTION_LIMIT) {
    return (
      <div className="flex justify-end gap-2">
        {actions.map((action, index) => (
          <ActionButton
            key={action.label}
            action={action}
            busy={busy}
            spinner={index === 0}
          />
        ))}
      </div>
    );
  }

  const primaryIndex = Math.max(
    actions.findIndex((action) => action.variant !== "destructive"),
    0,
  );
  const primary = actions[primaryIndex];
  const rest = actions.filter((_, index) => index !== primaryIndex);

  return (
    <div className="flex justify-end gap-2">
      <ActionButton action={primary} busy={busy} spinner />
      <ActionMenu actions={rest} busy={busy} spinner={false} />
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  actions,
  actionSlots = 2,
  isRowBusy,
  expandedKey,
  renderExpanded,
  headerClassName,
  headCellClassName,
  loading = false,
  loadingRows = DEFAULT_LOADING_ROWS,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  actions?: (row: T) => DataTableAction[];
  actionSlots?: 0 | 1 | 2;
  isRowBusy?: (row: T) => boolean;
  expandedKey?: string | number | null;
  renderExpanded?: (row: T) => React.ReactNode;
  headerClassName?: string;
  headCellClassName?: string;
  loading?: boolean;
  loadingRows?: number;
}) {
  const hasActions = Boolean(actions);
  const rowActions =
    actions && !loading ? rows.map((row) => actions(row)) : null;
  const actionsWidth =
    CELL_PADDING +
    Math.max(actionSlots, 1) * ACTION_BUTTON_WIDTH +
    Math.max(actionSlots - 1, 0) * ACTION_GAP;
  const fixedWidth =
    columns.reduce((sum, column) => sum + (column.width ?? 0), 0) +
    (hasActions ? actionsWidth : 0);
  const flexMinWidths = columns
    .filter((column) => !column.width)
    .map((column) => column.minWidth ?? FLEX_COLUMN_MIN_WIDTH);
  // Flexible columns split the remainder equally under table-fixed, so the
  // scroll threshold must fit every flexible column at the largest min.
  const minWidth =
    fixedWidth +
    (flexMinWidths.length > 0
      ? flexMinWidths.length * Math.max(...flexMinWidths)
      : 0);

  const handleRowClick = (
    event: React.MouseEvent<HTMLTableRowElement>,
    row: T,
  ) => {
    if (!onRowClick) return;
    const target = event.target as Element;
    if (!event.currentTarget.contains(target)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    onRowClick(row);
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    row: T,
  ) => {
    if (!onRowClick) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const forward = event.key === "ArrowDown";
      let sibling = forward
        ? event.currentTarget.nextElementSibling
        : event.currentTarget.previousElementSibling;
      while (sibling && !sibling.hasAttribute("data-row-key")) {
        sibling = forward
          ? sibling.nextElementSibling
          : sibling.previousElementSibling;
      }
      (sibling as HTMLElement | null)?.focus();
    }
  };

  return (
    <Table className="table-fixed" style={{ minWidth }}>
      <colgroup>
        {columns.map((column) => (
          <col
            key={column.key}
            style={column.width ? { width: column.width } : undefined}
          />
        ))}
        {hasActions && <col style={{ width: actionsWidth }} />}
      </colgroup>
      <TableHeader className={headerClassName ?? "bg-sidebar-accent/50"}>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                "px-4",
                ALIGN_CLASSES[column.align ?? "left"],
                headCellClassName,
              )}
            >
              {column.onSort ? (
                <button
                  type="button"
                  onClick={column.onSort}
                  className="inline-flex items-center gap-1 text-sm font-medium"
                >
                  {column.header}
                  <SortIcon sorted={column.sorted ?? false} />
                </button>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
          {hasActions && (
            <TableHead className={cn("px-4", headCellClassName)}>
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading &&
          Array.from({ length: loadingRows }, (_, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "overflow-hidden px-4",
                    ALIGN_CLASSES[column.align ?? "left"],
                    column.cellClassName,
                  )}
                >
                  {column.skeleton ? (
                    column.skeleton()
                  ) : (
                    <div
                      className={cn(
                        "flex h-5 items-center",
                        column.align === "right" && "justify-end",
                        column.align === "center" && "justify-center",
                      )}
                    >
                      <Skeleton className="h-4 w-3/5 max-w-32" />
                    </div>
                  )}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell className="px-4">
                  <div className="flex justify-end gap-2">
                    {Array.from(
                      { length: Math.max(actionSlots, 1) },
                      (_, slot) => (
                        <Skeleton
                          key={slot}
                          className="h-8"
                          style={{ width: ACTION_BUTTON_WIDTH }}
                        />
                      ),
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        {!loading &&
          rows.map((row, index) => {
            const key = rowKey(row);
            return (
              <React.Fragment key={key}>
                <TableRow
                  data-row-key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row),
                  )}
                  onClick={
                    onRowClick
                      ? (event) => handleRowClick(event, row)
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => handleRowKeyDown(event, row)
                      : undefined
                  }
                >
                  {columns.map((column) => {
                    const content = column.render(row, index);
                    const empty =
                      content == null || content === "" || content === false;
                    return (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "overflow-hidden px-4",
                          ALIGN_CLASSES[column.align ?? "left"],
                          column.cellClassName,
                        )}
                      >
                        {empty ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          content
                        )}
                      </TableCell>
                    );
                  })}
                  {rowActions && (
                    <TableCell className="px-4">
                      <RowActionGroup
                        actions={rowActions[index]}
                        busy={isRowBusy?.(row) ?? false}
                        menuOnly={actionSlots === 0}
                      />
                    </TableCell>
                  )}
                </TableRow>
                {renderExpanded && expandedKey === key && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (rowActions ? 1 : 0)}
                      className="bg-muted/30 p-4"
                    >
                      {renderExpanded(row)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
      </TableBody>
    </Table>
  );
}
