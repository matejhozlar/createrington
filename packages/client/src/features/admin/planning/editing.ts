import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";

export interface Draft {
  title: string;
  body: string;
  category: PlanningCategory;
  subcategoryId: number | null;
  status: PlanningItemStatus;
  decision: string;
}

export interface EditBase {
  revision: number;
  draft: Draft;
}

interface EditableItem {
  revision: number;
  title: string;
  body: string | null;
  category: PlanningCategory;
  subcategoryId: number | null;
  status: PlanningItemStatus;
  decision: string | null;
}

const DRAFT_FIELDS = [
  "title",
  "body",
  "category",
  "subcategoryId",
  "status",
  "decision",
] as const satisfies readonly (keyof Draft)[];

export function toEditBase(item: EditableItem): EditBase {
  return {
    revision: item.revision,
    draft: {
      title: item.title,
      body: item.body ?? "",
      category: item.category,
      subcategoryId: item.subcategoryId,
      status: item.status,
      decision: item.decision ?? "",
    },
  };
}

export function changedFields(draft: Draft, base: Draft): Partial<Draft> {
  return Object.fromEntries(
    DRAFT_FIELDS.filter((field) => draft[field] !== base[field]).map(
      (field) => [field, draft[field]],
    ),
  );
}

export function afterSave(
  base: EditBase,
  sent: Partial<Draft>,
  revision: number,
): EditBase {
  return { revision, draft: { ...base.draft, ...sent } };
}

export function isNewerThan(item: { revision: number }, base: EditBase) {
  return item.revision > base.revision;
}
