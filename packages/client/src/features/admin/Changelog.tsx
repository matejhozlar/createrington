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
import { useMemo } from "react";

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
    month: "long",
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

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-4 px-4 pb-4">
        <Accordion type="multiple" defaultValue={[sections[0]?.version]}>
          {sections.map((section) => (
            <AccordionItem key={section.version} value={section.version}>
              <AccordionTrigger className="text-base hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{section.version}</span>
                  <span className="text-muted-foreground text-sm font-normal">
                    {formatDate(section.date)}
                  </span>
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
                      <ul className="space-y-1.5 pl-1">
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
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
