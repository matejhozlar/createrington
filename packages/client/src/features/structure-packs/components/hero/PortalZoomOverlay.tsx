import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import {
  PORTAL_BLOCK_SIZE,
  PORTAL_NATIVE_H,
  PORTAL_NATIVE_W,
  usePortalGeometry,
} from "@/features/structure-packs/hooks/use-portal-geometry";
import {
  CARDS_FADE_MS,
  RAMP_MS,
  SCALE_MS,
  usePortalPhase,
} from "@/features/structure-packs/hooks/use-portal-phase";
import { PortalFrame } from "./PortalFrame";
import { AMBIENT_PORTAL_FILTER } from "./portal-styles";
import { OverlayBody } from "./overlay/OverlayBody";
import { OverlayHeader } from "./overlay/OverlayHeader";
import { OverlayHero } from "./overlay/OverlayHero";

interface PortalZoomOverlayProps {
  open: boolean;
  onClose: () => void;
  onReblurring?: () => void;
  getSourceRect: (() => DOMRect) | null;
}

export function PortalZoomOverlay({
  open,
  onClose,
  onReblurring,
  getSourceRect,
}: PortalZoomOverlayProps) {
  const { sourceRect, target, ambient } = usePortalGeometry(getSourceRect);
  const phase = usePortalPhase(open, ambient, onReblurring);

  useLockBodyScroll(phase !== "closed");

  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  if (phase === "closed" || !sourceRect) return null;

  const sourceScale = sourceRect.width / PORTAL_NATIVE_W;
  const sourceTransform = `translate3d(${sourceRect.left}px, ${sourceRect.top}px, 0) scale(${sourceScale})`;
  const targetTransform = `translate3d(${target.left}px, ${target.top}px, 0) scale(${target.scale})`;

  const transformIsTarget =
    phase === "scaling" || phase === "open" || phase === "closing";
  const atSourceLook = phase === "entering" || phase === "reblurring";
  const cardsVisible = phase === "open";

  const sourceFilter = ambient ? AMBIENT_PORTAL_FILTER : undefined;
  const targetFilter = ambient ? "blur(0.5px)" : undefined;
  const fadeStyle = {
    opacity: cardsVisible ? 1 : 0,
    transitionDuration: `${CARDS_FADE_MS}ms`,
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden text-white">
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          width: PORTAL_NATIVE_W,
          height: PORTAL_NATIVE_H,
          transformOrigin: "top left",
          transform: transformIsTarget ? targetTransform : sourceTransform,
          filter: atSourceLook ? sourceFilter : targetFilter,
          opacity: ambient && atSourceLook ? 0 : 1,
          backfaceVisibility: "hidden",
          transition: `transform ${SCALE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${RAMP_MS}ms ease-out, opacity ${RAMP_MS}ms ease-out`,
        }}
      >
        <PortalFrame
          blockSize={PORTAL_BLOCK_SIZE}
          variant={ambient ? "ambient" : "hero"}
          idleGlow={false}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-black/70 backdrop-blur-2xl transition-opacity"
        style={fadeStyle}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{
          ...fadeStyle,
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, oklch(0.45 0.2 258 / 0.28), transparent 70%)",
        }}
        aria-hidden
      />

      <div
        className="absolute inset-0 flex flex-col transition-opacity"
        style={fadeStyle}
      >
        <div className="flex h-full w-full flex-col">
          <OverlayHeader onClose={onClose} />
          <OverlayHero />
          <div className="mx-10 h-px bg-white/10" />
          <OverlayBody />
        </div>
      </div>
    </div>,
    document.body,
  );
}
