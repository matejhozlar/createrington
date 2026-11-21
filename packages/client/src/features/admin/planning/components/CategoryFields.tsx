import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLANNING_CATEGORIES,
  type PlanningCategory,
} from "@createrington/shared/planning";
import { CATEGORY_CONFIG, NO_SUBCATEGORY } from "../constants";
import type { PlanningSubcategory } from "../types";

interface CategoryFieldsProps {
  idPrefix: string;
  category: PlanningCategory;
  subcategoryId: number | null;
  subcategories: PlanningSubcategory[];
  onChange: (next: {
    category: PlanningCategory;
    subcategoryId: number | null;
  }) => void;
}

export function CategoryFields({
  idPrefix,
  category,
  subcategoryId,
  subcategories,
  onChange,
}: CategoryFieldsProps) {
  const options = subcategories.filter((s) => s.category === category);

  return (
    <div className="grid gap-4 xs:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-category`}>Category</FieldLabel>
        <Select
          value={category}
          onValueChange={(value) =>
            onChange({
              category: value as PlanningCategory,
              subcategoryId: null,
            })
          }
        >
          <SelectTrigger id={`${idPrefix}-category`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANNING_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {CATEGORY_CONFIG[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-subcategory`}>Subcategory</FieldLabel>
        <Select
          value={
            subcategoryId === null ? NO_SUBCATEGORY : String(subcategoryId)
          }
          onValueChange={(value) =>
            onChange({
              category,
              subcategoryId: value === NO_SUBCATEGORY ? null : Number(value),
            })
          }
        >
          <SelectTrigger id={`${idPrefix}-subcategory`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SUBCATEGORY}>None</SelectItem>
            {options.map((subcategory) => (
              <SelectItem key={subcategory.id} value={String(subcategory.id)}>
                {subcategory.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
