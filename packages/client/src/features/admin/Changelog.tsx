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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ChangelogSection {
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
    const dateMatch = line.match(/^## \[(.+)]$/);
    if (dateMatch) {
      current = { date: dateMatch[1], entries: [] };
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
    month: "long",
    day: "numeric",
  });
}

const PACKAGE_COLORS: Record<string, string> = {
  "@createrington/server": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "@createrington/client":
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Tooling: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

function ReleaseCard({
  section,
  isLatest,
  defaultOpen,
}: {
  section: ChangelogSection;
  isLatest: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {open ? (
              <ChevronDown className="text-muted-foreground size-4" />
            ) : (
              <ChevronRight className="text-muted-foreground size-4" />
            )}
            <span className="text-base font-semibold">
              {formatDate(section.date)}
            </span>
            {isLatest && (
              <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                Latest
              </Badge>
            )}
          </div>
          <div className="flex gap-1.5">
            {section.entries.map((entry) => (
              <Badge
                key={entry.name}
                variant="outline"
                className={
                  PACKAGE_COLORS[entry.name] ??
                  "bg-muted/50 text-muted-foreground"
                }
              >
                {entry.name.replace("@createrington/", "")}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5 border-t pt-5">
          {section.entries.map((entry) => (
            <div key={entry.name}>
              <div className="mb-2.5 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    PACKAGE_COLORS[entry.name] ??
                    "bg-muted/50 text-muted-foreground"
                  }
                >
                  {entry.name.replace("@createrington/", "")}
                </Badge>
                {entry.versionRange && (
                  <span className="text-muted-foreground text-xs">
                    {entry.versionRange}
                  </span>
                )}
              </div>
              <ul className="space-y-2 pl-1">
                {entry.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-muted-foreground flex items-start gap-2.5 text-sm"
                  >
                    <span className="bg-muted-foreground/40 mt-2 size-1 shrink-0 rounded-full" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
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

  const content = data?.content;
  const sections = useMemo(
    () => (content ? parseChangelog(content) : []),
    [content],
  );

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
    <div className="flex flex-1 flex-col gap-4">
      {HEADER}

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-3 px-4 pb-4">
        {sections.map((section, i) => (
          <ReleaseCard
            key={section.date}
            section={section}
            isLatest={i === 0}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
