import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

type Crumb = { label: string; href?: string };

/**
 * Standard admin page header: the shared sidebar/border bar with a breadcrumb
 * trail. The last crumb (or any crumb without an `href`) renders as the current
 * page. Optional `children` render at the end of the bar for page-level actions.
 */
export function AdminPageHeader({
  trail,
  children,
}: {
  trail: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-sidebar px-4 py-2">
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
            return (
              <Fragment key={crumb.label}>
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </header>
  );
}
