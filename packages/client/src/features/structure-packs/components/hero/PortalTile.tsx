import { useEffect, useRef, useState } from "react";
import portalSprite from "@/assets/parallel-worlds/pw-portal.png";

const TOTAL_FRAMES = 32;
const FRAME_DURATION_MS = 85;
const SPRITE_FRAME_SIZE = 16;
const SPRITE_SRC = portalSprite;

let cachedSprite: HTMLImageElement | null = null;
let spritePromise: Promise<HTMLImageElement> | null = null;

function loadSprite(): Promise<HTMLImageElement> {
  if (cachedSprite) return Promise.resolve(cachedSprite);
  if (spritePromise) return spritePromise;
  spritePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.src = SPRITE_SRC;
    img.onload = () => {
      cachedSprite = img;
      resolve(img);
    };
    img.onerror = () => {
      spritePromise = null;
      reject(new Error("Failed to load portal sprite"));
    };
  });
  return spritePromise;
}

if (typeof window !== "undefined") {
  void loadSprite().catch(() => {});
}

interface PortalTileProps {
  width: number;
  height: number;
  tileSize?: number;
}

export function PortalTile({ width, height, tileSize = 96 }: PortalTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(cachedSprite);
  const rafRef = useRef<number>(0);
  const [ready, setReady] = useState(!!cachedSprite);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    let cancelled = false;
    loadSprite()
      .then((img) => {
        if (cancelled) return;
        imgRef.current = img;
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    canvas.width = cols * SPRITE_FRAME_SIZE;
    canvas.height = rows * SPRITE_FRAME_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const drawTiles = (frame: number) => {
      const img = imgRef.current;
      if (!img) return;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.drawImage(
            img,
            0,
            frame * SPRITE_FRAME_SIZE,
            SPRITE_FRAME_SIZE,
            SPRITE_FRAME_SIZE,
            c * SPRITE_FRAME_SIZE,
            r * SPRITE_FRAME_SIZE,
            SPRITE_FRAME_SIZE,
            SPRITE_FRAME_SIZE,
          );
        }
      }
    };

    const drawFrame = (cur: number, next: number, lerp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 1;
      drawTiles(cur);
      ctx.globalAlpha = lerp;
      drawTiles(next);
      ctx.globalAlpha = 1;
    };

    if (reducedMotion) {
      drawFrame(0, 0, 0);
      return;
    }
    if (!visible) return;

    const draw = () => {
      const elapsed = performance.now();
      const cyclePos = (elapsed / FRAME_DURATION_MS) % TOTAL_FRAMES;
      const cur = Math.floor(cyclePos);
      const next = (cur + 1) % TOTAL_FRAMES;
      const lerp = cyclePos - cur;
      drawFrame(cur, next, lerp);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, tileSize, ready, visible, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: Math.ceil(width / tileSize) * tileSize,
        height: Math.ceil(height / tileSize) * tileSize,
        display: "block",
        imageRendering: "pixelated",
        background:
          "radial-gradient(ellipse at center, oklch(0.35 0.18 280) 0%, oklch(0.18 0.1 275) 80%, oklch(0.12 0.05 275) 100%)",
      }}
    />
  );
}
