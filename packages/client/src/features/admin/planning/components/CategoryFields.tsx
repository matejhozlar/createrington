import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  PLANNING_CATEGORIES,
  type PlanningCategory,
} from "@createrington/shared/planning";
import { CATEGORY_CONFIG } from "@/features/admin/planning/constants";
import { subcategoriesWithin } from "@/features/admin/planning/format";
import type { PlanningSubcategory } from "@/features/admin/planning/types";

interface CategoryFieldsProps {
  idPrefix: string;
  categories: PlanningCategory[];
  subcategoryIds: number[];
  subcategories: PlanningSubcategory[];
  onChange: (next: {
    categories: PlanningCategory[];
    subcategoryIds: number[];
  }) => void;
}

function CheckOption({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="w-auto gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

export function CategoryFields({
  idPrefix,
  categories,
  subcategoryIds,
  subcategories,
  onChange,
}: CategoryFieldsProps) {
  const toggleCategory = (category: PlanningCategory, checked: boolean) => {
    const next = PLANNING_CATEGORIES.filter((value) =>
      value === category ? checked : categories.includes(value),
    );
    onChange({
      categories: next,
      subcategoryIds: subcategoriesWithin(next, subcategoryIds, subcategories),
    });
  };

  const toggleSubcategory = (id: number, checked: boolean) =>
    onChange({
      categories,
      subcategoryIds: checked
        ? [...subcategoryIds, id]
        : subcategoryIds.filter((existing) => existing !== id),
    });

  const groups = categories
    .map((category) => ({
      category,
      options: subcategories.filter((s) => s.category === category),
    }))
    .filter(({ options }) => options.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <FieldSet className="gap-0">
        <FieldLegend variant="label">Categories</FieldLegend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PLANNING_CATEGORIES.map((category) => {
            const checked = categories.includes(category);
            return (
              <CheckOption
                key={category}
                id={`${idPrefix}-category-${category}`}
                label={CATEGORY_CONFIG[category].label}
                checked={checked}
                disabled={checked && categories.length === 1}
                onCheckedChange={(value) => toggleCategory(category, value)}
              />
            );
          })}
        </div>
      </FieldSet>

      <FieldSet className="gap-0">
        <FieldLegend variant="label">Subcategories</FieldLegend>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The chosen categories have no subcategories.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(({ category, options }) => (
              <div key={category} className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {CATEGORY_CONFIG[category].label}
                </span>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {options.map((subcategory) => (
                    <CheckOption
                      key={subcategory.id}
                      id={`${idPrefix}-subcategory-${subcategory.id}`}
                      label={subcategory.name}
                      checked={subcategoryIds.includes(subcategory.id)}
                      onCheckedChange={(value) =>
                        toggleSubcategory(subcategory.id, value)
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </FieldSet>
    </div>
  );
}
