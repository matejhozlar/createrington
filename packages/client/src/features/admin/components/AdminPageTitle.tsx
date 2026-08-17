import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderActions } from "@/features/admin/components/HeaderActions";

/**
 * Standard admin page title: the h1 that opens a page's content area, with an
 * optional leading icon, inline badges, description block, and trailing action
 * group. The title, badges, and actions all wrap onto their own lines as the
 * viewport narrows rather than being pinned to one row.
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
    <div
      className={cn(
        "flex flex-wrap justify-between gap-3",
        description ? "items-start" : "items-center",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {Icon && <Icon className="mt-1.5 size-5 shrink-0 text-primary" />}
            <h1 className="min-w-0 text-2xl font-semibold">{title}</h1>
          </div>
          {badges}
        </div>
        {description && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && <HeaderActions>{actions}</HeaderActions>}
    </div>
  );
}
