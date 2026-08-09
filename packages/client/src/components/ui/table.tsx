import * as React from "react";

import { cn } from "@/lib/utils";

const COLUMN_WIDTHS = {
  // sized by what the column holds
  index: "w-[64px]",
  icon: "w-[56px]",
  id: "w-[64px]",
  count: "w-[100px]",
  amount: "w-[110px]",
  duration: "w-[110px]",
  tag: "w-[116px]",
  status: "w-[116px]",
  statusWide: "w-[168px]",
  date: "w-[120px]",
  dateTime: "w-[180px]",
  discordId: "w-[180px]",
  player: "w-[184px]",
  // neutral sizes for plain text columns with no more specific name
  sm: "w-[100px]",
  md: "w-[136px]",
  lg: "w-[180px]",
} as const;

type TableColumn = keyof typeof COLUMN_WIDTHS;

const ACTION_BUTTON = 38;
const ACTION_GAP = 8;
const CELL_PADDING = 24;
const ACTIONS_LABEL_WIDTH = 98;

function actionsColumnWidth(count: number, labelled: boolean) {
  const buttons =
    CELL_PADDING + count * ACTION_BUTTON + Math.max(count - 1, 0) * ACTION_GAP;
  return Math.max(buttons, labelled ? ACTIONS_LABEL_WIDTH : 0);
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full table-fixed caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-sidebar-accent/50 [&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  col,
  actions,
  children,
  style,
  ...props
}: React.ComponentProps<"th"> & { col?: TableColumn; actions?: number }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-10 truncate px-3 text-left align-middle text-[11px] font-medium tracking-wider uppercase [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        col && COLUMN_WIDTHS[col],
        className,
      )}
      style={
        actions === undefined
          ? style
          : { width: actionsColumnWidth(actions, children != null), ...style }
      }
      {...props}
    >
      {children}
    </th>
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "truncate px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[data-slot=badge]]:max-w-full [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
