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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

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
  const date = new Date(dateStr + "T00:00:00");
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

export function Changelog() {
  const { data, isLoading } = trpc.admin.changelog.get.useQuery();

  const content = data?.content;
  const sections = useMemo(
    () => (content ? parseChangelog(content) : []),
    [content],
  );

  if (isLoading) return <Loading />;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
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
        </div>
      </header>

      <div className="mx-auto w-full max-w-[900px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold">Changelog</h1>
          <span className="text-muted-foreground text-sm">
            v{__APP_VERSION__}
          </span>
        </div>

        <Accordion type="multiple" defaultValue={[sections[0]?.date]}>
          {sections.map((section) => (
            <AccordionItem key={section.date} value={section.date}>
              <AccordionTrigger className="text-base">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {formatDate(section.date)}
                  </span>
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
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {section.entries.map((entry) => (
                    <div key={entry.name}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {entry.name}
                        </span>
                        {entry.versionRange && (
                          <span className="text-muted-foreground text-xs">
                            {entry.versionRange}
                          </span>
                        )}
                      </div>
                      <ul className="text-muted-foreground space-y-1.5 text-sm">
                        {entry.items.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground/50 mt-0.5">
                              -
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  );
}
