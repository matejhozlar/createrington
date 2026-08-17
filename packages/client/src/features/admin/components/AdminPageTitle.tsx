import type { LucideIcon } from "lucide-react";
import { HeaderActions } from "@/features/admin/components/HeaderActions";

/**
 * Standard admin page title: the h1 that opens a page's content area, with an
 * optional leading icon, inline badges, description block, and trailing action
 * group. Only the heading and the actions share a row, so the actions drop to
 * their own line as soon as the heading no longer fits its natural width
 * beside them, rather than squeezing it into a narrow column. The description
 * spans the full width beneath both.
 */
export function AdminPageTitle({
  title,
  icon: Icon,
  badges,
  description,
  actions,
}: {
  title: React.ReactNode;
  icon?: LucideIcon;
  badges?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-auto flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {Icon && <Icon className="mt-1.5 size-5 shrink-0 text-primary" />}
            <h1 className="min-w-0 break-words text-2xl font-semibold">
              {title}
            </h1>
          </div>
          {badges}
        </div>
        {actions && <HeaderActions>{actions}</HeaderActions>}
      </div>
      {description && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {description}
        </div>
      )}
    </div>
  );
}
