import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";
import { ActivePack } from "./components/ActivePack";
import { PackCard } from "./components/PackCard";
import { PacksHero } from "./components/hero/PacksHero";

const DEFAULT_BOOST_UNIT_PRICE = 50;

export function StructurePacks() {
  const { user } = useAuth();

  const poolSectionRef = useRef<HTMLElement | null>(null);
  const activePackRef = useRef<HTMLElement | null>(null);

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

  const totalWeight = pool?.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;

  const myBoostMap = new Map((myBoosts ?? []).map((b) => [b.packId, b.units]));

  return (
    <div>
      <PacksHero poolRef={poolSectionRef} activePackRef={activePackRef} />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Active pack */}
          <section ref={activePackRef} className="space-y-3 scroll-mt-6">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Active Pack
            </h2>
            <ActivePack />
          </section>

          {/* Pool */}
          <section ref={poolSectionRef} className="space-y-3 scroll-mt-6">
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
          </section>
        </div>
      </section>
    </div>
  );
}
