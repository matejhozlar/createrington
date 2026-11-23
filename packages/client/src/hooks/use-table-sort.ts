import { useState } from "react";

export type SortDirection = "asc" | "desc";

export function useTableSort<TField extends string>(
  initialField: TField,
  {
    initialDirection = "desc",
    newFieldDirection = "asc",
  }: {
    initialDirection?: SortDirection;
    newFieldDirection?: SortDirection;
  } = {},
) {
  const [order, setOrder] = useState<{
    orderBy: TField;
    orderDirection: SortDirection;
  }>({ orderBy: initialField, orderDirection: initialDirection });

  const toggle = (field: TField) =>
    setOrder((prev) =>
      prev.orderBy === field
        ? {
            orderBy: field,
            orderDirection: prev.orderDirection === "asc" ? "desc" : "asc",
          }
        : { orderBy: field, orderDirection: newFieldDirection },
    );

  const column = (field: TField) => ({
    sorted: order.orderBy === field ? order.orderDirection : (false as const),
    onSort: () => toggle(field),
  });

  return { order, column };
}
