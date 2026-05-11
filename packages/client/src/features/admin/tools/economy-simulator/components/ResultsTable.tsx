import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AggregateStats, PlayerRow, SimulationResult } from "../types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const formatCurrency = (n: number): string => currencyFormatter.format(n);

const formatPercent = (n: number): string =>
  `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

const formatHours = (seconds: number): string => (seconds / 3600).toFixed(1);

type SortKey = keyof Pick<
  PlayerRow,
  | "username"
  | "joined"
  | "opEraSeconds"
  | "oldWorth"
  | "newBalance"
  | "alpha"
  | "percentChange"
>;

type SortState = {
  key: SortKey;
  dir: "asc" | "desc";
};

const STAT_ROWS: { key: keyof AggregateStats; label: string }[] = [
  { key: "totalSupply", label: "Total supply" },
  { key: "max", label: "Max balance" },
  { key: "mean", label: "Mean" },
  { key: "p50", label: "p50" },
  { key: "p75", label: "p75" },
  { key: "p90", label: "p90" },
  { key: "p95", label: "p95" },
  { key: "p99", label: "p99" },
];

type Props = {
  result: SimulationResult;
  threshold: number;
};

export function ResultsTable({ result, threshold }: Props) {
  const [sort, setSort] = useState<SortState>({
    key: "oldWorth",
    dir: "desc",
  });

  const filtered = useMemo(
    () => result.rows.filter((r) => r.oldWorth > threshold),
    [result.rows, threshold],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-2">
        <CardHeader>
          <CardTitle>Aggregate stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[max-content_1fr_1fr_1fr] items-center gap-x-6 gap-y-2 text-sm">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Metric
            </div>
            <div className="text-xs font-semibold uppercase text-muted-foreground text-right">
              Before
            </div>
            <div className="text-xs font-semibold uppercase text-muted-foreground text-right">
              After
            </div>
            <div className="text-xs font-semibold uppercase text-muted-foreground text-right">
              Delta
            </div>

            {STAT_ROWS.map(({ key, label }) => {
              const before = result.beforeStats[key];
              const after = result.afterStats[key];
              const delta = before > 0 ? ((after - before) / before) * 100 : 0;
              return (
                <div key={key} className="contents">
                  <div className="text-muted-foreground">{label}</div>
                  <div className="text-right font-mono">
                    {formatCurrency(before)}
                  </div>
                  <div className="text-right font-mono">
                    {formatCurrency(after)}
                  </div>
                  <div
                    className={cn(
                      "text-right font-mono",
                      delta < 0
                        ? "text-destructive"
                        : delta > 0
                          ? "text-emerald-500"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatPercent(delta)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="border-b gap-0">
          <CardTitle>Players above {formatCurrency(threshold)}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader className="bg-sidebar-accent/50">
              <TableRow>
                <SortableHead
                  label="Username"
                  active={sort}
                  field="username"
                  onClick={toggleSort}
                />
                <SortableHead
                  label="Joined"
                  active={sort}
                  field="joined"
                  onClick={toggleSort}
                />
                <SortableHead
                  label="OP-era hours"
                  active={sort}
                  field="opEraSeconds"
                  onClick={toggleSort}
                  align="right"
                />
                <SortableHead
                  label="Old worth"
                  active={sort}
                  field="oldWorth"
                  onClick={toggleSort}
                  align="right"
                />
                <SortableHead
                  label="New balance"
                  active={sort}
                  field="newBalance"
                  onClick={toggleSort}
                  align="right"
                />
                <SortableHead
                  label="Alpha"
                  active={sort}
                  field="alpha"
                  onClick={toggleSort}
                  align="right"
                />
                <SortableHead
                  label="Change"
                  active={sort}
                  field="percentChange"
                  onClick={toggleSort}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No players above threshold.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.uuid}>
                    <TableCell className="font-medium">
                      {row.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {row.joined}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(row.opEraSeconds)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.oldWorth)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.newBalance)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.alpha.toFixed(3)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono",
                        row.percentChange < 0
                          ? "text-destructive"
                          : row.percentChange > 0
                            ? "text-emerald-500"
                            : "text-muted-foreground",
                      )}
                    >
                      {formatPercent(row.percentChange)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type SortableHeadProps = {
  label: string;
  field: SortKey;
  active: SortState;
  onClick: (field: SortKey) => void;
  align?: "left" | "right";
};

function SortableHead({
  label,
  field,
  active,
  onClick,
  align = "left",
}: SortableHeadProps) {
  const isActive = active.key === field;
  return (
    <TableHead className={cn("px-4", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={cn(
          "inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        {isActive &&
          (active.dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          ))}
      </button>
    </TableHead>
  );
}
