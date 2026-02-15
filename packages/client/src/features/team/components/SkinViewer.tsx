import { Loader2, UserRound } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
import { HulkAnimation } from "./hulk-effects";
import { JetpackAnimation } from "./jetpack-effects";
import { MoonwalkAnimation } from "./moonwalk-effects";
import { NukeAnimation } from "./nuke-effects";

export type SkinViewerHandle = {
  playAnimation: () => void;
  stopAnimation: () => void;
};

type SkinViewerProps = {
  uuid: string;
  username: string;
  width: number;
  height: number;
  hoverAnimation?: HoverAnimation | undefined;
  enableHover?: boolean;
  index: number;
  total: number;
  className?: string;
};

function createAnimation(
  type: Exclude<
    HoverAnimation,
    "jetpack" | "flashlight" | "moonwalk" | "headkick" | "hulk" | "nuke"
  >,
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

export const SkinViewer = forwardRef<SkinViewerHandle, SkinViewerProps>(({
  uuid,
  username,
  width,
  height,
  hoverAnimation,
  enableHover = true,
  index,
  total,
  className,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<SkinViewerLib | null>(null);
  const jetpackRef = useRef<JetpackAnimation | null>(null);
  const flashlightRef = useRef<FlashlightEffect | null>(null);
  const flashlightTimerRef = useRef<number | null>(null);
  const moonwalkRef = useRef<MoonwalkAnimation | null>(null);
  const headkickRef = useRef<HeadKickAnimation | null>(null);
  const hulkRef = useRef<HulkAnimation | null>(null);
  const nukeRef = useRef<NukeAnimation | null>(null);
  const nukeExplosionRef = useRef<Animation | null>(null);
  const kickAnimRef = useRef<KickAnimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      if (hulkRef.current) {
        hulkRef.current.dispose();
        hulkRef.current = null;
      }
      if (nukeRef.current) {
        nukeRef.current.dispose();
        nukeRef.current = null;
      }
      if (nukeExplosionRef.current) {
        nukeExplosionRef.current.cancel();
        nukeExplosionRef.current = null;
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
        headkickRef.current ||
        hulkRef.current ||
        nukeRef.current
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

  // Non-Stratos members listen for nuke events
  useEffect(() => {
    if (username === "Stratos65") return;

    const handleDetonate = () => {
      // Skip if any custom animation is active on this member
      if (
        moonwalkRef.current ||
        flashlightRef.current ||
        jetpackRef.current ||
        headkickRef.current ||
        hulkRef.current ||
        kickAnimRef.current
      )
        return;

      const card = containerRef.current?.closest(
        "button",
      ) as HTMLElement | null;
      if (!card) return;

      // Cancel any previous explosion
      if (nukeExplosionRef.current) {
        nukeExplosionRef.current.cancel();
        nukeExplosionRef.current = null;
      }

      // Random explosion direction
      const angle = Math.random() * Math.PI * 2;
      const distance = 800 + Math.random() * 400;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rot = (Math.random() - 0.5) * 720;
      const shakeX = (Math.random() - 0.5) * 12;
      const shakeY = (Math.random() - 0.5) * 12;

      const anim = card.animate(
        [
          { transform: "none", opacity: 1, offset: 0 },
          {
            transform: `translate(${shakeX}px, ${shakeY}px)`,
            opacity: 1,
            offset: 0.15,
          },
          {
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            opacity: 0,
            offset: 1,
          },
        ],
        {
          duration: 900,
          easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
          fill: "forwards",
        },
      );

      nukeExplosionRef.current = anim;
    };

    const handleReset = () => {
      if (nukeExplosionRef.current) {
        nukeExplosionRef.current.cancel();
        nukeExplosionRef.current = null;
      }
    };

    document.addEventListener("team-nuke-detonate", handleDetonate);
    document.addEventListener("team-nuke-reset", handleReset);

    return () => {
      document.removeEventListener("team-nuke-detonate", handleDetonate);
      document.removeEventListener("team-nuke-reset", handleReset);
      if (nukeExplosionRef.current) {
        nukeExplosionRef.current.cancel();
        nukeExplosionRef.current = null;
      }
    };
  }, [username]);

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
    } else if (hoverAnimation === "hulk") {
      const hulk = new HulkAnimation(viewer);
      hulkRef.current = hulk;
      viewer.animation = hulk;
    } else if (hoverAnimation === "nuke") {
      const nuke = new NukeAnimation(viewer);
      nukeRef.current = nuke;
      viewer.animation = nuke;
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

    if (hulkRef.current) {
      hulkRef.current.dispose();
      hulkRef.current = null;
      // Reload original skin after hulk transformation
      viewer.loadSkin(`/api/skin/${uuid}`);
    }

    if (nukeRef.current) {
      nukeRef.current.dispose();
      nukeRef.current = null;
    }

    viewer.animation = new LookAroundIdleAnimation(index, total);
  };

  useImperativeHandle(ref, () => ({
    playAnimation: () => handleMouseEnter(),
    stopAnimation: () => handleMouseLeave(),
  }));

  return (
    <div
      className={cn("relative", className)}
      style={{ width, height }}
      onMouseEnter={enableHover && hoverAnimation ? handleMouseEnter : undefined}
      onMouseLeave={enableHover && hoverAnimation ? handleMouseLeave : undefined}
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
});

SkinViewer.displayName = "SkinViewer";
