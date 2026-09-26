import { useState } from "react";
import { moveItem } from "../components-v2/defaults";

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
    remove: (index: number) =>
      setKeys((prev) => prev.filter((_, idx) => idx !== index)),
    move: (index: number, dir: -1 | 1) =>
      setKeys((prev) => moveItem(prev, index, dir)),
  };
}
