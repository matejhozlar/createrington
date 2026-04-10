import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface ChangelogSection {
  version: string;
  date: string;
  entries: PackageEntry[];
}

interface PackageEntry {
  name: string;
  versionRange: string;
  items: string[];
}

function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let currentPkg: PackageEntry | null = null;

  for (const line of raw.split("\n")) {
    const headingMatch = line.match(/^## (v[\d.]+)\s+\((.+)\)$/);
    if (headingMatch) {
      current = {
        version: headingMatch[1],
        date: headingMatch[2],
        entries: [],
      };
      sections.push(current);
      currentPkg = null;
      continue;
    }

    const pkgMatch = line.match(/^### (.+?)(?:\s+\((.+)\))?$/);
    if (pkgMatch && current) {
      currentPkg = {
        name: pkgMatch[1],
        versionRange: pkgMatch[2] ?? "",
        items: [],
      };
      current.entries.push(currentPkg);
      continue;
    }

    const itemMatch = line.match(/^- (.+)$/);
    if (itemMatch && currentPkg) {
      currentPkg.items.push(itemMatch[1]);
    }
  }

  return sections;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const HEADER = (
  <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Changelog</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </header>
);

export function Changelog() {
  const { data, isLoading } = trpc.admin.changelog.get.useQuery();
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const content = data?.content;
  const sections = useMemo(
    () => (content ? parseChangelog(content) : []),
    [content],
  );

  const expandedVersions =
    expanded ??
    (sections.length > 0 ? new Set([sections[0].version]) : new Set<string>());

  const toggle = (version: string) => {
    setExpanded((prev) => {
      const base =
        prev ??
        (sections.length > 0
          ? new Set([sections[0].version])
          : new Set<string>());
      const next = new Set(base);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {HEADER}
        <div className="flex flex-1 items-center justify-center">
          <Loading size="medium" text="Loading changelog..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {HEADER}

      <div className="mx-auto w-full max-w-[800px] px-6 py-8">
        <div className="relative">
          {/* Timeline vertical line */}
          <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />

          {sections.map((section, i) => {
            const isOpen = expandedVersions.has(section.version);
            const isLatest = i === 0;
            const changeCount = section.entries.reduce(
              (sum, e) => sum + e.items.length,
              0,
            );

            return (
              <div
                key={section.version}
                className="relative grid grid-cols-[32px_1fr]"
                style={{
                  animation: `fade-in-up 0.4s ease-out ${i * 50}ms both`,
                }}
              >
                {/* Timeline dot */}
                <div className="flex justify-center pt-[17px]">
                  <div
                    className={cn(
                      "relative z-10 rounded-full ring-[5px] ring-background",
                      isLatest
                        ? "size-[11px] bg-primary"
                        : "size-[9px] bg-muted-foreground/25",
                    )}
                  />
                </div>

                {/* Version content */}
                <div className="min-w-0 pb-1">
                  {/* Clickable version header */}
                  <button
                    onClick={() => toggle(section.version)}
                    className="group -ml-1 flex w-[calc(100%+0.25rem)] items-center gap-3 rounded-md px-2 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "shrink-0 font-mono text-sm font-semibold tracking-tight",
                        isLatest ? "text-primary" : "text-foreground",
                      )}
                    >
                      {section.version}
                    </span>

                    {isLatest && (
                      <Badge
                        variant="default"
                        className="h-[18px] px-1.5 text-[10px] font-medium"
                      >
                        Latest
                      </Badge>
                    )}

                    <span className="text-[11px] text-muted-foreground">
                      {changeCount} {changeCount === 1 ? "change" : "changes"}
                    </span>

                    <span className="flex-1" />

                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDate(section.date)}
                    </span>

                    <ChevronRight
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>

                  {/* Collapsible entries */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-5 px-2 pb-5 pt-1">
                        {section.entries.map((entry) => (
                          <div key={entry.name}>
                            <div className="mb-2 flex items-baseline gap-2.5">
                              <span className="text-sm font-medium text-foreground/80">
                                {entry.name}
                              </span>
                              {entry.versionRange && (
                                <>
                                  <span className="text-muted-foreground/40">
                                    ·
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {entry.versionRange}
                                  </span>
                                </>
                              )}
                            </div>
                            <ul className="space-y-1">
                              {entry.items.map((item, k) => (
                                <li
                                  key={k}
                                  className="flex items-start gap-2.5 py-0.5 text-[13px] leading-relaxed text-muted-foreground"
                                >
                                  <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-muted-foreground/40" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
