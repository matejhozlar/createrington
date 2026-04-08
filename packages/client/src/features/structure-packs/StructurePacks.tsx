import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useCountdown } from "@/hooks/use-countdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Clock, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
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
    <div>
      <PageHeader
        title="Packs"
        description="Vote on which pack gets activated next by spending in-game currency to boost your favorites."
        imageSrc="/assets/hero/dark-warehouse.webp"
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
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
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Active Pack
            </h2>
            <ActivePack />
          </div>

          {/* Pool */}
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Vote for Next Rotation
            </h2>

            {poolLoading || rotationLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full rounded-lg" />
                ))}
              </div>
            ) : !pool || pool.length === 0 ? (
              <div className="rounded-md border py-10 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 size-8 opacity-50" />
                <p>No packs are available for voting right now.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>
    </div>
  );
}
