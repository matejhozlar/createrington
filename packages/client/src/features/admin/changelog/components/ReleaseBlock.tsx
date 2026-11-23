import { formatDate } from "@createrington/shared/format";
import { formatRelativeDay, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PackageBlock } from "@/features/admin/changelog/components/PackageBlock";
import {
  versionBump,
  type ChangelogSection,
} from "@/features/admin/changelog/parse";

export function ReleaseBlock({
  section,
  isLatest,
  refSetter,
}: {
  section: ChangelogSection;
  isLatest: boolean;
  refSetter: (el: HTMLElement | null) => void;
}) {
  const bump = versionBump(section.version);
  const totalChanges = section.entries.reduce((s, e) => s + e.items.length, 0);

  return (
    <article
      ref={refSetter}
      id={section.version}
      data-version={section.version}
      className={cn(
        "relative scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-border-strong",
        isLatest &&
          "border-primary-dim shadow-[0_0_0_1px_var(--primary-glow),0_24px_48px_-32px_var(--primary-glow)]",
      )}
    >
      {isLatest && (
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 60% 30% at 0% 0%, var(--primary-glow), transparent 60%)",
          }}
        />
      )}

      <header
        className="relative flex flex-wrap items-center gap-4 border-b border-border px-5 py-[18px]"
        style={{
          background:
            "linear-gradient(180deg, oklch(1 0 0 / 0.02), transparent), var(--card)",
        }}
      >
        <div className="flex flex-1 items-center gap-[18px]">
          <div
            className={cn(
              "flex w-[78px] shrink-0 flex-col items-center rounded-[10px] border border-border-strong px-2 pb-2 pt-2.5",
              bump === "major" && "border-primary-dim",
              bump === "minor" && "border-c-add/40",
            )}
            style={{
              background:
                "linear-gradient(180deg, oklch(1 0 0 / 0.04), oklch(0 0 0 / 0.05))",
            }}
          >
            <div
              className={cn(
                "font-mono text-sm font-semibold leading-tight tracking-[-0.01em]",
                bump === "major" ? "text-primary" : "text-foreground",
              )}
            >
              {section.version}
            </div>
            <div
              className={cn(
                "mt-1 w-full border-t border-border pt-1 text-center font-mono text-[9.5px] uppercase tracking-[0.1em]",
                bump === "major" && "text-primary",
                bump === "minor" && "text-c-add",
                bump === "patch" && "text-muted-foreground",
              )}
            >
              {bump}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[13px] font-medium text-foreground">
              {formatDate(section.date)}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {formatRelativeDay(section.date)}
              </span>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {pluralize(totalChanges, "change")} across{" "}
              {pluralize(section.entries.length, "package")}
            </div>
          </div>
        </div>
        {isLatest && (
          <span className="inline-flex items-center rounded-full border border-primary-dim px-2.5 py-[5px] font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary bg-primary-glow">
            latest
          </span>
        )}
      </header>

      <div className="relative flex flex-col gap-1 px-5 pb-5 pt-2">
        {section.entries.map((entry) => (
          <PackageBlock key={entry.name} entry={entry} />
        ))}
      </div>
    </article>
  );
}
