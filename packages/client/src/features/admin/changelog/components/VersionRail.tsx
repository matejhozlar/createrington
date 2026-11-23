import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  versionBump,
  type ChangelogSection,
} from "@/features/admin/changelog/parse";

export function VersionRail({
  sections,
  activeVersion,
  onSelect,
}: {
  sections: ChangelogSection[];
  activeVersion: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <aside className="hidden min-[920px]:block">
      <div className="sticky top-22">
        <div className="mb-3 px-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Releases
        </div>
        <ul className="rail-scroll relative m-0 max-h-[calc(100vh-200px)] list-none overflow-y-auto p-0 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-[linear-gradient(to_bottom,transparent_0%,var(--border-strong)_8%,var(--border-strong)_92%,transparent_100%)] before:content-['']">
          {sections.map((s) => {
            const isActive = activeVersion === s.version;
            const bump = versionBump(s.version);
            return (
              <li key={s.version}>
                <a
                  href={`#${s.version}`}
                  onClick={() => onSelect(s.version)}
                  className={cn(
                    "relative grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-lg px-2 py-[7px] pl-2 pr-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
                    isActive && "bg-white/[0.05] text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 ml-[5px] block size-[9px] rounded-full border-2 border-background",
                      bump === "major" &&
                        "bg-primary shadow-[0_0_0_1px_var(--primary),0_0_12px_var(--primary-glow)]",
                      bump === "minor" &&
                        "bg-c-add shadow-[0_0_0_1px_var(--c-add)]",
                      bump === "patch" &&
                        "bg-secondary shadow-[0_0_0_1px_var(--border-strong)]",
                      isActive &&
                        "shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-glow)]",
                    )}
                  />
                  <span
                    className={cn(
                      "font-mono text-xs font-medium",
                      isActive && "text-primary",
                    )}
                  >
                    {s.version}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {formatRelativeDay(s.date)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
