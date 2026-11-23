import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderActions } from "@/features/admin/components/HeaderActions";
import { cn } from "@/lib/utils";

export function TabSectionHeader({
  title,
  description,
  actions,
  onRefresh,
  refreshing = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-auto">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {(actions || onRefresh) && (
        <HeaderActions>
          {actions}
          {onRefresh && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("size-4", refreshing && "animate-spin")}
              />
              Refresh
            </Button>
          )}
        </HeaderActions>
      )}
    </div>
  );
}
