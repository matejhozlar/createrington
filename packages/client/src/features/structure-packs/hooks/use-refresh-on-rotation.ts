import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc, queryClient } from "@/lib/trpc";

const REFRESH_DELAYS_MS = [1000, 6000];
const MAX_TIMER_MS = 2 ** 31 - 1;

function refreshStructurePacks() {
  void queryClient.invalidateQueries(trpc.public.structurePacks.pathFilter());
  void queryClient.invalidateQueries(trpc.user.structurePacks.pathFilter());
}

export function useRefreshOnRotation() {
  const { data: rotationInfo } = useQuery(
    trpc.public.structurePacks.rotationInfo.queryOptions(),
  );
  const nextRotationAt = rotationInfo?.nextRotationAt ?? null;
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!nextRotationAt) return;
    const remaining = Math.max(
      0,
      new Date(nextRotationAt).getTime() - Date.now(),
    );
    if (remaining + REFRESH_DELAYS_MS[1] > MAX_TIMER_MS) return;
    timersRef.current.push(
      ...REFRESH_DELAYS_MS.map((delay) =>
        window.setTimeout(refreshStructurePacks, remaining + delay),
      ),
    );
  }, [nextRotationAt]);
}
