import { Link } from "react-router";
import { MessageSquare } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";
import { markdownPreview } from "../format";
import type { PlanningItem } from "../types";
import { CategoryBadges, StatusBadge } from "./PlanBadges";
import { AvatarStack } from "./PersonChip";

interface PlanCardProps {
  item: PlanningItem;
  subcategory: string | null;
}

export function PlanCard({ item, subcategory }: PlanCardProps) {
  const preview = markdownPreview(item.body);

  return (
    <Link
      to={`/admin/planning/${item.id}`}
      className="flex h-full min-h-64 flex-col gap-3 rounded-xl border border-border bg-card p-5 outline-none transition-colors hover:border-primary/40 focus-visible:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={item.status} />
        <CategoryBadges category={item.category} subcategory={subcategory} />
      </div>

      <h2 className="line-clamp-2 break-words text-lg font-semibold leading-snug">
        {item.title}
      </h2>

      <p className="line-clamp-4 break-words text-sm text-muted-foreground">
        {preview || "No description yet."}
      </p>

      <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
        <AvatarStack people={item.assignees} />
        {item.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {item.commentCount}
          </span>
        )}
        <span className="ml-auto">
          Edited {formatRelativeDate(item.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
