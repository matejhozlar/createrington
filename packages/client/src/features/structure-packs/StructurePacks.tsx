import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useCountdown } from "@/hooks/use-countdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Clock, Info } from "lucide-react";
import { ActivePack } from "./components/ActivePack";
import { PackCard } from "./components/PackCard";

const DEFAULT_BOOST_UNIT_PRICE = 50;

export function StructurePacks() {
  const { user } = useAuth();

  const { data: pool, isLoading: poolLoading } =
    trpc.user.structurePacks.pool.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: myBoosts } = trpc.user.structurePacks.myBoosts.useQuery(
    undefined,
    { enabled: !!user },
  );

  const { data: rotationInfo, isLoading: rotationLoading } =
    trpc.user.structurePacks.rotationInfo.useQuery(undefined, {
      enabled: !!user,
    });

  const countdown = useCountdown(rotationInfo?.nextRotationAt ?? null);

  const totalWeight = pool?.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;

  const myBoostMap = new Map((myBoosts ?? []).map((b) => [b.packId, b.units]));

  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-4xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Structure Packs
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Vote on which structure pack gets activated next by spending in-game
            currency to boost your favorites.
          </p>
        </div>

        {/* Next rotation info */}
        {rotationLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          rotationInfo && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-2.5 text-sm">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Next rotation in</span>
              <span className="font-semibold font-mono">
                {countdown ?? "any moment now"}
              </span>
            </div>
          )
        )}

        {/* Boost reset notice */}
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            All boosts reset when the next rotation occurs. Boosts are
            non-refundable — spend wisely!
          </AlertDescription>
        </Alert>

        {/* Active pack */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Active Pack
          </h2>
          <ActivePack />
        </div>

        {/* Pool */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Vote for Next Rotation
          </h2>

          {poolLoading || rotationLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-lg" />
              ))}
            </div>
          ) : !pool || pool.length === 0 ? (
            <div className="rounded-md border py-10 text-center text-muted-foreground">
              <Package className="mx-auto mb-2 size-8 opacity-50" />
              <p>No packs are available for voting right now.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pool.map((entry) => (
                <PackCard
                  key={entry.pack.id}
                  pack={entry.pack}
                  weight={entry.weight}
                  boostUnits={entry.boostUnits}
                  totalWeight={totalWeight}
                  myBoostUnits={myBoostMap.get(entry.pack.id) ?? 0}
                  boostUnitPrice={
                    rotationInfo?.boostUnitPrice ?? DEFAULT_BOOST_UNIT_PRICE
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
