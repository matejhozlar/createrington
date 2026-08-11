import { Fragment } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "react-router";
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
 * trail. Sticky on desktop; on small screens it scrolls away with the page
 * and the trail collapses to a back link to the nearest linked ancestor. The
 * last crumb (or any crumb without an `href`) renders as the current page.
 * Optional `children` render at the end of the bar for page-level actions.
 */
export function AdminPageHeader({
  trail,
  children,
}: {
  trail: Crumb[];
  children?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const parent = trail
    .slice(0, -1)
    .reverse()
    .find(
      (crumb): crumb is Crumb & { href: string } =>
        !!crumb.href && crumb.href !== pathname,
    );

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-sidebar px-4 py-2 md:sticky md:top-0 md:z-20 md:min-h-16">
      {parent && (
        <Link
          to={parent.href}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          <ChevronLeft className="size-4" />
          {parent.label}
        </Link>
      )}
      <Breadcrumb className={parent ? "hidden md:block" : undefined}>
        <BreadcrumbList>
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
            return (
              <Fragment key={crumb.label}>
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="line-clamp-1 max-w-md">
                      {crumb.label}
                    </BreadcrumbPage>
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
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </header>
  );
}
