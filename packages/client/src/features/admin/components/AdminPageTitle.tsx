import type { LucideIcon } from "lucide-react";
import { HeaderActions } from "@/features/admin/components/HeaderActions";

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
