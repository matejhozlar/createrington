import { Loader2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FlyingAnimation,
  HitAnimation,
  RunningAnimation,
  SkinViewer as SkinViewerLib,
  WalkingAnimation,
  WaveAnimation,
} from "skinview3d";
import { cn } from "@/lib/utils";
import type { HoverAnimation } from "../data";
import { LookAroundIdleAnimation } from "./animations";
import { FlashlightAimAnimation, FlashlightEffect } from "./flashlight-effects";
import { HeadKickAnimation, KickAnimation } from "./headkick-effects";
import { JetpackAnimation } from "./jetpack-effects";
import { MoonwalkAnimation } from "./moonwalk-effects";

type SkinViewerProps = {
  uuid: string;
  username: string;
  width: number;
  height: number;
  hoverAnimation?: HoverAnimation | undefined;
  index: number;
  total: number;
  className?: string;
};

function createAnimation(
  type: Exclude<HoverAnimation, "jetpack" | "flashlight" | "moonwalk" | "headkick">,
) {
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
  hoverAnimation,
  index,
  total,
  className,
}: SkinViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);
  const jetpackRef = useRef<JetpackAnimation | null>(null);
  const flashlightRef = useRef<FlashlightEffect | null>(null);
  const flashlightTimerRef = useRef<number | null>(null);
  const moonwalkRef = useRef<MoonwalkAnimation | null>(null);
  const headkickRef = useRef<HeadKickAnimation | null>(null);
  const kickAnimRef = useRef<KickAnimation | null>(null);
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
      if (flashlightTimerRef.current !== null) {
        clearTimeout(flashlightTimerRef.current);
        flashlightTimerRef.current = null;
      }
      if (flashlightRef.current) {
        flashlightRef.current.dispose();
        flashlightRef.current = null;
      }
      if (jetpackRef.current) {
        jetpackRef.current.dispose();
        jetpackRef.current = null;
      }
      if (moonwalkRef.current) {
        moonwalkRef.current.dispose();
        moonwalkRef.current = null;
      }
      if (headkickRef.current) {
        headkickRef.current.dispose();
        headkickRef.current = null;
      }
      viewer.dispose();
      if (container.contains(viewer.canvas)) {
        container.removeChild(viewer.canvas);
      }
      viewerRef.current = null;
    };
  }, [uuid, width, height, index, total]);

  // Cailin05 listens for kick requests from imahomen's headkick animation
  useEffect(() => {
    if (username !== "Cailin05") return;

    const handleKickRequest = (e: Event) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      // Ignore if any custom animation is active (e.g., moonwalk hover)
      if (
        moonwalkRef.current ||
        flashlightRef.current ||
        jetpackRef.current ||
        headkickRef.current
      )
        return;

      const { headCenterX } = (e as CustomEvent<{ headCenterX: number }>)
        .detail;
      const myRect = viewer.canvas.getBoundingClientRect();
      const slideDistance = myRect.left + myRect.width / 2 - headCenterX;
      const kick = new KickAnimation(viewer, slideDistance);
      kickAnimRef.current = kick;
      viewer.animation = kick;
    };

    const handleKickDone = () => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      if (kickAnimRef.current) {
        kickAnimRef.current.dispose();
        kickAnimRef.current = null;
      }
      viewer.animation = new LookAroundIdleAnimation(index, total);
    };

    document.addEventListener("team-kick-request", handleKickRequest);
    document.addEventListener("team-kick-done", handleKickDone);
    document.addEventListener("team-kick-cancel", handleKickDone);

    return () => {
      document.removeEventListener("team-kick-request", handleKickRequest);
      document.removeEventListener("team-kick-done", handleKickDone);
      document.removeEventListener("team-kick-cancel", handleKickDone);
    };
  }, [username, index, total]);

  const handleMouseEnter = () => {
    const viewer = viewerRef.current;
    if (!viewer || !hoverAnimation) return;

    if (hoverAnimation === "flashlight") {
      viewer.animation = new FlashlightAimAnimation();
      flashlightTimerRef.current = window.setTimeout(() => {
        flashlightTimerRef.current = null;
        const flashlight = new FlashlightEffect(viewer.canvas);
        flashlightRef.current = flashlight;
        flashlight.start();
      }, 1000);
    } else if (hoverAnimation === "jetpack") {
      const jetpack = new JetpackAnimation(viewer);
      jetpackRef.current = jetpack;
      viewer.animation = jetpack;
    } else if (hoverAnimation === "moonwalk") {
      const moonwalk = new MoonwalkAnimation(viewer);
      moonwalkRef.current = moonwalk;
      viewer.animation = moonwalk;
    } else if (hoverAnimation === "headkick") {
      const headkick = new HeadKickAnimation(viewer);
      headkickRef.current = headkick;
      viewer.animation = headkick;
    } else {
      viewer.animation = createAnimation(hoverAnimation);
    }
  };

  const handleMouseLeave = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (flashlightTimerRef.current !== null) {
      clearTimeout(flashlightTimerRef.current);
      flashlightTimerRef.current = null;
    }

    if (flashlightRef.current) {
      flashlightRef.current.dispose();
      flashlightRef.current = null;
    }

    if (jetpackRef.current) {
      jetpackRef.current.dispose();
      jetpackRef.current = null;
      // Reload original skin, then set idle animation
      viewer
        .loadSkin(`/api/skin/${uuid}`)
        .then(() => {
          // Skin loaded, idle animation already handles pose reset
        })
        .catch(() => {
          // Skin reload failed, still reset animation
        });
    }

    if (moonwalkRef.current) {
      moonwalkRef.current.dispose();
      moonwalkRef.current = null;
    }

    if (headkickRef.current) {
      headkickRef.current.dispose();
      headkickRef.current = null;
    }

    viewer.animation = new LookAroundIdleAnimation(index, total);
  };

  return (
    <div
      className={cn("relative", className)}
      style={{ width, height }}
      onMouseEnter={hoverAnimation ? handleMouseEnter : undefined}
      onMouseLeave={hoverAnimation ? handleMouseLeave : undefined}
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
