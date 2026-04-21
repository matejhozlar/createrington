import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 32;
const FRAME_DURATION_MS = 85;
const SPRITE_SRC = "/assets/parallel-worlds/pw-portal.png";

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
    if (cachedSprite) return;
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const cols = Math.ceil(width / tileSize) + 1;
    const rows = Math.ceil(height / tileSize) + 1;

    const drawFrame = (cur: number, next: number, lerp: number) => {
      const img = imgRef.current;
      if (!img) return;
      ctx.clearRect(0, 0, width, height);

      ctx.globalAlpha = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.drawImage(
            img,
            0,
            cur * 16,
            16,
            16,
            c * tileSize,
            r * tileSize,
            tileSize,
            tileSize,
          );
        }
      }

      ctx.globalAlpha = lerp;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.drawImage(
            img,
            0,
            next * 16,
            16,
            16,
            c * tileSize,
            r * tileSize,
            tileSize,
            tileSize,
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    if (reducedMotion) {
      drawFrame(0, 0, 0);
      return;
    }
    if (!visible) return;

    // Anchor the animation clock to performance.now() directly (a monotonic
    // clock shared by every PortalTile on the page) so two instances — the
    // hero's and the zoom overlay's — stay phase-synced. Otherwise each
    // tile starts counting from its own mount time and the ripple looks
    // like it "restarts" when the overlay unmounts and the hero reappears.
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
        width,
        height,
        display: "block",
        imageRendering: "pixelated",
        background:
          "radial-gradient(ellipse at center, oklch(0.35 0.18 280) 0%, oklch(0.18 0.1 275) 80%, oklch(0.12 0.05 275) 100%)",
      }}
    />
  );
}
