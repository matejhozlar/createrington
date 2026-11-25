import type { PlanningCategory } from "@createrington/shared/planning";

export interface PlanningItemFiling {
  categories: PlanningCategory[];
  subcategoryIds: number[];
}

export interface PlanningFilingRow {
  owner_id: number;
  categories: PlanningCategory[];
  subcategory_ids: number[];
}

export function filingQuery(tables: {
  category: string;
  subcategory: string;
  ownerColumn: string;
}): string {
  const { category, subcategory, ownerColumn } = tables;
  return `
    SELECT owner.id AS owner_id,
      ARRAY(
        SELECT c.category::text FROM ${category} c
        WHERE c.${ownerColumn} = owner.id ORDER BY c.category
      ) AS categories,
      ARRAY(
        SELECT s.subcategory_id FROM ${subcategory} s
        WHERE s.${ownerColumn} = owner.id ORDER BY s.subcategory_id
      ) AS subcategory_ids
    FROM unnest($1::int[]) AS owner(id)`;
}

export function toFilings(
  rows: PlanningFilingRow[],
): Map<number, PlanningItemFiling> {
  return new Map(
    rows.map((row) => [
      row.owner_id,
      { categories: row.categories, subcategoryIds: row.subcategory_ids },
    ]),
  );
}
