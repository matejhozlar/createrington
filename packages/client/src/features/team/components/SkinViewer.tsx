import { useEffect, useRef, useState } from "react";
import {
  SkinViewer as SkinViewerLib,
  WalkingAnimation,
  WaveAnimation,
  RunningAnimation,
  FlyingAnimation,
  HitAnimation,
} from "skinview3d";
import { Loader2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HoverAnimation } from "../data";
import { LookAroundIdleAnimation } from "./animations";

type SkinViewerProps = {
  uuid: string;
  username: string;
  width: number;
  height: number;
  hoverAnimation?: HoverAnimation;
  index: number;
  total: number;
  className?: string;
};

function createAnimation(type: HoverAnimation) {
  switch (type) {
    case "wave":
      return new WaveAnimation();
    case "running":
      return new RunningAnimation();
    case "flying":
      return new FlyingAnimation();
    case "hit":
      return new HitAnimation();
    case "walking":
      return new WalkingAnimation();
  }
}

export const SkinViewer = ({
  uuid,
  username,
  width,
  height,
  hoverAnimation = "walking",
  index,
  total,
  className,
}: SkinViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Reset state when effect deps change (render-time pattern)
  const depsKey = `${uuid}-${width}-${height}-${index}-${total}`;
  const [prevDepsKey, setPrevDepsKey] = useState(depsKey);
  if (prevDepsKey !== depsKey) {
    setPrevDepsKey(depsKey);
    setLoading(true);
    setError(false);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    const viewer = new SkinViewerLib({
      width,
      height,
      enableControls: false,
      fov: 50,
      zoom: 0.9,
    });

    viewer.autoRotate = false;
    viewer.animation = new LookAroundIdleAnimation(index, total);

    viewer
      .loadSkin(`/api/skin/${uuid}`)
      .then(() => {
        if (!disposed) setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          setError(true);
        }
      });

    container.appendChild(viewer.canvas);
    viewerRef.current = viewer;

    return () => {
      disposed = true;
      viewer.dispose();
      if (container.contains(viewer.canvas)) {
        container.removeChild(viewer.canvas);
      }
      viewerRef.current = null;
    };
  }, [uuid, width, height, index, total]);

  const handleMouseEnter = () => {
    if (viewerRef.current) {
      viewerRef.current.animation = createAnimation(hoverAnimation);
    }
  };

  const handleMouseLeave = () => {
    if (viewerRef.current) {
      viewerRef.current.animation = new LookAroundIdleAnimation(index, total);
    }
  };

  return (
    <div
      className={cn("relative", className)}
      style={{ width, height }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="img"
      aria-label={`3D skin of ${username}`}
    >
      <div
        ref={containerRef}
        className={cn(
          "transition-opacity duration-300",
          loading || error ? "opacity-0" : "opacity-100",
        )}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <UserRound className="size-10 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
