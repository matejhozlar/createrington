import { Info, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/query-states";
import {
  DEFAULT_BOOST_UNIT_PRICE,
  sortByWeight,
  sumWeights,
} from "@/features/structure-packs/pool";
import { PackRow } from "./PackRow";

const POOL_REFRESH_MS = 60 * 1000;

const GRID_CLASSES =
  "grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3";

export function OverlayBody() {
  const { user } = useAuth();
  const {
    data: pool,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    trpc.public.structurePacks.pool.queryOptions(undefined, {
      refetchInterval: POOL_REFRESH_MS,
    }),
  );
  const { data: myBoosts } = useQuery(
    trpc.user.structurePacks.myBoosts.queryOptions(undefined, {
      enabled: !!user,
    }),
  );
  const { data: rotationInfo } = useQuery(
    trpc.public.structurePacks.rotationInfo.queryOptions(),
  );

  const sortedPool = sortByWeight(pool);
  const totalWeight = sumWeights(pool);
  const myBoostMap = new Map((myBoosts ?? []).map((b) => [b.packId, b.units]));
  const boostUnitPrice =
    rotationInfo?.boostUnitPrice ?? DEFAULT_BOOST_UNIT_PRICE;
  const rotationPaused = rotationInfo?.enabled === false;

  return (
    <div className="nice-scroll flex-1 overflow-y-auto px-10 py-6">
      {isLoading ? (
        <div className={GRID_CLASSES}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[168px] w-full rounded-xl" />
          ))}
        </div>
      ) : isError && !pool ? (
        <ErrorState
          bordered
          message="Couldn't load the dimensions."
          onRetry={() => void refetch()}
        />
      ) : sortedPool.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/50">
          <Package className="mx-auto mb-2 size-8 opacity-50" />
          <p>No dimensions are available for voting right now.</p>
        </div>
      ) : (
        <div className={GRID_CLASSES}>
          {sortedPool.map((entry, i) => (
            <PackRow
              key={entry.pack.id}
              entry={entry}
              totalWeight={totalWeight}
              myBoostUnits={myBoostMap.get(entry.pack.id) ?? 0}
              boostUnitPrice={boostUnitPrice}
              rank={i + 1}
              rotationPaused={rotationPaused}
            />
          ))}
        </div>
      )}
      <div className="mt-6 flex items-center justify-between gap-4 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <Info className="size-3" />
          Weights refresh every minute · boosts locked until next rotation
        </span>
        <span className="hidden shrink-0 md:inline">
          Press{" "}
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          to exit
        </span>
      </div>
    </div>
  );
}
