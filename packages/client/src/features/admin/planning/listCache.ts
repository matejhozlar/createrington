import type { PlanningItem } from "./types";

interface ItemList {
  items: PlanningItem[];
}

export function patchListItem(
  list: ItemList | undefined,
  id: number,
  patch: Partial<Pick<PlanningItem, "status" | "revision">>,
): ItemList | undefined {
  if (!list) return list;
  return {
    items: list.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}
