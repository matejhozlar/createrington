import { useState } from "react";
import { PAGE_SIZE } from "../constants";

export function usePagination(key: string) {
  const [state, setState] = useState({ key, count: PAGE_SIZE });
  const shownCount = state.key === key ? state.count : PAGE_SIZE;
  const showMore = () => setState({ key, count: shownCount + PAGE_SIZE });
  return { shownCount, showMore } as const;
}
