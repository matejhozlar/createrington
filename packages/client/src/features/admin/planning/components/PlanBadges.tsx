import { Badge } from "@/components/ui/badge";
import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";
import {
  CATEGORY_CONFIG,
  STATUS_CONFIG,
} from "@/features/admin/planning/constants";

export function StatusBadge({ status }: { status: PlanningItemStatus }) {
  const { label, tone } = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" tone={tone}>
      {label}
    </Badge>
  );
}

export function CategoryBadges({
  categories,
  subcategories,
}: {
  categories: PlanningCategory[];
  subcategories: string[];
}) {
  return (
    <>
      {categories.map((category) => {
        const { label, tone } = CATEGORY_CONFIG[category];
        return (
          <Badge key={category} variant="outline" tone={tone}>
            {label}
          </Badge>
        );
      })}
      {subcategories.map((subcategory, index) => (
        <Badge key={`${index}-${subcategory}`} variant="outline">
          {subcategory}
        </Badge>
      ))}
    </>
  );
}
