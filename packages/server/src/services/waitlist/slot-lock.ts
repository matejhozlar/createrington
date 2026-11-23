import { createKeyedLock } from "@/utils/keyed-lock";

const withLock = createKeyedLock<"slots">();

export function withSlotLock<T>(fn: () => Promise<T>): Promise<T> {
  return withLock("slots", fn);
}
