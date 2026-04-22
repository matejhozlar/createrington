import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { ActivePack } from "./components/ActivePack";
import { PacksHero } from "./components/hero/PacksHero";
import { PortalZoomOverlay } from "./components/hero/PortalZoomOverlay";

const DEFAULT_BOOST_UNIT_PRICE = 50;

export function StructurePacks() {
  const { user } = useAuth();

  const activePackRef = useRef<HTMLElement | null>(null);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSource, setZoomSource] = useState<DOMRect | null>(null);
  const [overlayActive, setOverlayActive] = useState(false);

  const { data: pool, isLoading: poolLoading } =
    trpc.user.structurePacks.pool.useQuery(undefined, {
      enabled: !!user,
    });

  const { data: myBoosts } = trpc.user.structurePacks.myBoosts.useQuery(
    undefined,
    { enabled: !!user },
  );

  const { data: rotationInfo } = trpc.user.structurePacks.rotationInfo.useQuery(
    undefined,
    {
      enabled: !!user,
    },
  );

  const totalWeight = pool?.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;

  const myBoostMap = new Map((myBoosts ?? []).map((b) => [b.packId, b.units]));

  const handleEnterPortal = (rect: DOMRect) => {
    setZoomSource(rect);
    setZoomOpen(true);
    setOverlayActive(true);
  };

  const handleExitPortal = () => {
    setZoomOpen(false);
  };

  return (
    <div>
      <PacksHero
        activePackRef={activePackRef}
        onEnterPortal={handleEnterPortal}
        portalHidden={overlayActive}
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <section ref={activePackRef} className="space-y-3 scroll-mt-6">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Active Pack
            </h2>
            <ActivePack />
          </section>
        </div>
      </section>

      <PortalZoomOverlay
        open={zoomOpen}
        onClose={handleExitPortal}
        onClosed={() => setOverlayActive(false)}
        sourceRect={zoomSource}
        pool={pool}
        isLoading={poolLoading}
        totalWeight={totalWeight}
        myBoostMap={myBoostMap}
        boostUnitPrice={
          rotationInfo?.boostUnitPrice ?? DEFAULT_BOOST_UNIT_PRICE
        }
      />
    </div>
  );
}
