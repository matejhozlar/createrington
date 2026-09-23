import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import {
  parseCell,
  type CellAlign,
  type CellSegment,
  type ParsedTable,
} from "../parse";

const ALIGN_CLASS: Record<CellAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function Cell({ segments }: { segments: CellSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={index}
          className={cn(segment.highlight && "font-semibold text-primary")}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}

function isContinuation(row: CellSegment[][]) {
  return row[0].every((segment) => !segment.text.trim());
}

export const TableCard = forwardRef<HTMLDivElement, { table: ParsedTable }>(
  function TableCard({ table }, ref) {
    return (
      <div
        ref={ref}
        className="relative w-fit min-w-[640px] overflow-hidden bg-background p-10 text-foreground"
      >
        <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo/logo.png" alt="" className="size-12" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Createrington
              </span>
              {table.title && (
                <h1 className="font-[Minecraft] text-3xl leading-none">
                  {table.title}
                </h1>
              )}
            </div>
          </div>

          {table.intro.length > 0 && (
            <div className="flex flex-col gap-1 text-base text-muted-foreground">
              {table.intro.map((line, index) => (
                <p key={index}>
                  <Cell segments={parseCell(line)} />
                </p>
              ))}
            </div>
          )}

          {table.columns.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full border-collapse tabular-nums">
                <thead>
                  <tr className="bg-muted/60">
                    {table.columns.map((column, index) => (
                      <th
                        key={index}
                        className={cn(
                          "whitespace-nowrap px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                          ALIGN_CLASS[table.aligns[index]],
                        )}
                      >
                        <Cell segments={column} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={cn(
                        "border-t",
                        isContinuation(row)
                          ? "border-border/40"
                          : "border-border",
                      )}
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={cn(
                            "whitespace-nowrap px-6 py-3.5 text-lg",
                            cellIndex === 0 && "font-medium",
                            ALIGN_CLASS[table.aligns[cellIndex]],
                          )}
                        >
                          <Cell segments={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-end justify-between gap-8 text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              {table.notes.map((line, index) => (
                <p key={index}>
                  <Cell segments={parseCell(line)} />
                </p>
              ))}
            </div>
            <span className="shrink-0">createrington.com</span>
          </div>
        </div>
      </div>
    );
  },
);
