import { formatDate } from "@createrington/shared/format";
import { cn } from "@/lib/utils";
import {
  shortPkg,
  type ChangelogSection,
  type ChangelogStats,
} from "@/features/admin/changelog/parse";

export function Hero({
  latest,
  stats,
}: {
  latest: ChangelogSection;
  stats: ChangelogStats;
}) {
  return (
    <div
      className="relative mb-7 overflow-hidden rounded-[18px] border border-border-strong p-9 pb-8 shadow-[0_1px_0_oklch(1_0_0_/_0.04)_inset,0_24px_48px_-24px_oklch(0_0_0_/_0.6)]"
      style={{
        background:
          "radial-gradient(ellipse 70% 100% at 100% 0%, oklch(0.26 0.014 285) 0%, transparent 65%), linear-gradient(180deg, oklch(0.215 0.011 285) 0%, oklch(0.185 0.009 285) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] opacity-85"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--primary) 30%, var(--primary) 70%, transparent 100%)",
        }}
      />
      <div className="relative">
        <div className="mb-[18px] font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
          Latest release · {formatDate(latest.date)}
        </div>
        <h1 className="m-0 mb-3 flex items-baseline gap-4 font-semibold tracking-[-0.025em]">
          <span className="font-mono text-[46px] font-semibold leading-none tracking-[-0.02em] text-primary">
            {latest.version}
          </span>
          <span className="h-7 w-px bg-border-strong" />
          <span className="text-2xl font-medium text-foreground">
            Workshop log
          </span>
        </h1>
        <p
          className="m-0 max-w-[60ch] text-[14.5px] text-muted-foreground"
          style={{ textWrap: "pretty" }}
        >
          A running record of every gear we&apos;ve added, every belt we&apos;ve
          tightened, and every leak we&apos;ve sealed across the Createrington
          platform.
        </p>
        <div className="mt-7 flex flex-wrap gap-8 border-t border-dashed border-border pt-[22px]">
          <Stat n={stats.releases} label="releases" />
          <Stat n={stats.total} label="changes" />
          <Stat n={stats.adds} label="new things" tone="add" />
          <Stat n={stats.fixes} label="fixes" tone="fix" />
        </div>
        <div className="mt-[22px] flex flex-wrap items-center gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            In this release
          </div>
          <div className="flex flex-wrap gap-2">
            {latest.entries.map((e) => (
              <span
                key={e.name}
                className="inline-block whitespace-nowrap rounded-full border border-border bg-white/[0.04] px-2.5 py-[5px] text-xs"
              >
                <span className="font-medium text-foreground">
                  {shortPkg(e.name)}
                </span>
                {e.versionRange && (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {e.versionRange}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "add" | "fix";
}) {
  return (
    <div>
      <div
        className={cn(
          "font-mono text-[22px] font-semibold tabular-nums tracking-[-0.01em]",
          tone === "add" && "text-c-add",
          tone === "fix" && "text-c-fix",
          !tone && "text-foreground",
        )}
      >
        {n}
      </div>
      <div className="mt-0.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
