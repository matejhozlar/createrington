import { Badge } from "@/components/ui/badge";
import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";
import { CATEGORY_CONFIG, STATUS_CONFIG } from "../constants";

export function StatusBadge({ status }: { status: PlanningItemStatus }) {
  const { label, tone } = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" tone={tone}>
      {label}
    </Badge>
  );
}

export function CategoryBadges({
  category,
  subcategory,
}: {
  category: PlanningCategory;
  subcategory: string | null;
}) {
  const { label, tone } = CATEGORY_CONFIG[category];
  return (
    <>
      <Badge variant="outline" tone={tone}>
        {label}
      </Badge>
      {subcategory && <Badge variant="outline">{subcategory}</Badge>}
    </>
  );
}
