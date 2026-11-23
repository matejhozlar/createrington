import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { moveItem } from "@/lib/moveItem";

let keySeq = 0;
const nextKey = () => ++keySeq;

export function useItemKeys(length: number) {
  const [keys, setKeys] = useState(() => Array.from({ length }, nextKey));

  let current = keys;
  if (keys.length !== length) {
    current =
      keys.length < length
        ? [...keys, ...Array.from({ length: length - keys.length }, nextKey)]
        : keys.slice(0, length);
    setKeys(current);
  }

  return {
    keys: current,
    indexOf: (key: unknown) => current.indexOf(key as number),
    insert: (index: number) =>
      setKeys((prev) => [
        ...prev.slice(0, index),
        nextKey(),
        ...prev.slice(index),
      ]),
    remove: (index: number) =>
      setKeys((prev) => prev.filter((_, idx) => idx !== index)),
    move: (index: number, dir: -1 | 1) =>
      setKeys((prev) => moveItem(prev, index, dir)),
    reorder: (from: number, to: number) =>
      setKeys((prev) => arrayMove(prev, from, to)),
  };
}
