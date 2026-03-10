import { trpc } from "@/lib/trpc";

/** Returns the set of token IDs currently affected by active market events. */
export function useActiveEventTokenIds(): Set<number> {
  const { data: events } = trpc.public.crypto.activeEvents.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  const ids = new Set<number>();
  if (events) {
    for (const e of events) {
      if (e.tokenId) ids.add(e.tokenId);
    }
  }
  return ids;
}

/** Returns whether any active event applies to the whole market rather than a specific token. */
export function useHasMarketWideEvent(): boolean {
  const { data: events } = trpc.public.crypto.activeEvents.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  return events?.some((e) => !e.tokenId) ?? false;
}
