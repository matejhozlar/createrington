import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG } from "../constants";
import type { PlanningItem } from "../types";
import { AvatarStack } from "./PersonChip";

interface PlanningCardProps {
  item: PlanningItem;
  subcategory: string | null;
  showCategory: boolean;
  className?: string;
}

export function PlanningCard({
  item,
  subcategory,
  showCategory,
  className,
}: PlanningCardProps) {
  const category = CATEGORY_CONFIG[item.category];

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40",
        className,
      )}
    >
      <p className="line-clamp-3 break-words text-sm font-medium">
        {item.title}
      </p>

      {(showCategory || subcategory) && (
        <div className="flex flex-wrap gap-1">
          {showCategory && (
            <Badge variant="outline" tone={category.tone} className="text-xs">
              {category.label}
            </Badge>
          )}
          {subcategory && (
            <Badge variant="outline" className="text-xs">
              {subcategory}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AvatarStack people={item.assignees} />
        {item.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {item.commentCount}
          </span>
        )}
        <span className="ml-auto">{formatRelativeDate(item.updatedAt)}</span>
      </div>
    </div>
  );
}
