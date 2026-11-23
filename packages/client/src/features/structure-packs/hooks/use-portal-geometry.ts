import { useEffect, useMemo, useState } from "react";

const LG_BREAKPOINT_PX = 1024;

export const PORTAL_BLOCK_SIZE = 72;
export const PORTAL_NATIVE_W = 4 * PORTAL_BLOCK_SIZE;
export const PORTAL_NATIVE_H = 5 * PORTAL_BLOCK_SIZE;

const INTERIOR_OFFSET = PORTAL_BLOCK_SIZE;
const INTERIOR_W = 2 * PORTAL_BLOCK_SIZE;
const INTERIOR_H = 3 * PORTAL_BLOCK_SIZE;

function readViewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export function usePortalGeometry(getSourceRect: (() => DOMRect) | null) {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sourceRect = useMemo(() => {
    void viewport;
    return getSourceRect?.() ?? null;
  }, [getSourceRect, viewport]);

  const target = useMemo(() => {
    const scale = Math.max(viewport.w / INTERIOR_W, viewport.h / INTERIOR_H);
    return {
      scale,
      left: viewport.w / 2 - (INTERIOR_OFFSET + INTERIOR_W / 2) * scale,
      top: viewport.h / 2 - (INTERIOR_OFFSET + INTERIOR_H / 2) * scale,
    };
  }, [viewport]);

  return { sourceRect, target, ambient: viewport.w < LG_BREAKPOINT_PX };
}
