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

function RowActionGroup({
  actions,
  busy,
}: {
  actions: DataTableAction[];
  busy: boolean;
}) {
  if (actions.length === 0) return null;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            aria-label="More actions"
            disabled={busy}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {rest.map((action) => (
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
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  actions?: (row: T) => DataTableAction[];
  actionSlots?: 1 | 2;
  isRowBusy?: (row: T) => boolean;
  expandedKey?: string | number | null;
  renderExpanded?: (row: T) => React.ReactNode;
  headerClassName?: string;
  headCellClassName?: string;
}) {
  const rowActions = actions ? rows.map((row) => actions(row)) : null;
  const actionsWidth =
    CELL_PADDING +
    actionSlots * ACTION_BUTTON_WIDTH +
    (actionSlots - 1) * ACTION_GAP;
  const fixedWidth =
    columns.reduce((sum, column) => sum + (column.width ?? 0), 0) +
    (rowActions ? actionsWidth : 0);
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
        {rowActions && <col style={{ width: actionsWidth }} />}
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
          {rowActions && (
            <TableHead className={cn("px-4", headCellClassName)}>
              <span className="sr-only">Actions</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
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
                  onRowClick ? (event) => handleRowClick(event, row) : undefined
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
