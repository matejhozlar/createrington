import { z } from "zod";

export const MAX_SYNC_ENTRIES = 10_000;
export const MAX_SYNC_NAME_LENGTH = 255;

export const syncName = z.string().max(MAX_SYNC_NAME_LENGTH);

export const dimensionId = z.string().min(1).max(MAX_SYNC_NAME_LENGTH);

export function syncList<T extends z.ZodType>(item: T, max = MAX_SYNC_ENTRIES) {
  return z.array(item).max(max);
}
