import { useEffect, useRef, useState } from "react";
import { ActivePack } from "./components/ActivePack";
import { PacksHero, type PacksHeroHandle } from "./components/hero/PacksHero";
import { PortalZoomOverlay } from "./components/hero/PortalZoomOverlay";
import { useRefreshOnRotation } from "./hooks/use-refresh-on-rotation";
import "./structure-packs.css";

export function StructurePacks() {
  const activePackRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<PacksHeroHandle>(null);
  const cancelPendingScrollRef = useRef<(() => void) | null>(null);
  useRefreshOnRotation();

  useEffect(() => {
    return () => {
      cancelPendingScrollRef.current?.();
    };
  }, []);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [getZoomSource, setGetZoomSource] = useState<(() => DOMRect) | null>(
    null,
  );
  const [overlayActive, setOverlayActive] = useState(false);

  const handleEnterPortal = (getRect: () => DOMRect) => {
    setGetZoomSource(() => getRect);
    setZoomOpen(true);
    setOverlayActive(true);
  };

  const handleOpenPortalFromHero = () => {
    if (window.scrollY === 0) {
      heroRef.current?.openPortal();
      return;
    }
    cancelPendingScrollRef.current?.();

    let opened = false;
    const onDone = () => {
      if (opened) return;
      opened = true;
      cleanup();
      heroRef.current?.openPortal();
    };
    const cleanup = () => {
      window.removeEventListener("scrollend", onDone);
      window.clearTimeout(timeoutId);
      cancelPendingScrollRef.current = null;
    };

    window.addEventListener("scrollend", onDone);
    const timeoutId = window.setTimeout(onDone, 1200);
    cancelPendingScrollRef.current = cleanup;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handleExitPortal = () => {
    setZoomOpen(false);
  };

  return (
    <div>
      <PacksHero
        ref={heroRef}
        activePackRef={activePackRef}
        onEnterPortal={handleEnterPortal}
        portalHidden={overlayActive}
      />

      <section className="pb-12 md:py-16 px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <section ref={activePackRef} className="scroll-mt-6">
            <ActivePack onOpenPortal={handleOpenPortalFromHero} />
          </section>
        </div>
      </section>

      <PortalZoomOverlay
        open={zoomOpen}
        onClose={handleExitPortal}
        onReblurring={() => setOverlayActive(false)}
        getSourceRect={getZoomSource}
      />
    </div>
  );
}
