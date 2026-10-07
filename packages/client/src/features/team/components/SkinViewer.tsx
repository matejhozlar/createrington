import { Loader2, UserRound } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { SkinViewer as SkinViewerLib, type PlayerAnimation } from "skinview3d";
import { cn } from "@/lib/utils";
import type { HoverAnimation } from "../data";
import type { TeamEffect } from "../effects/core/effect";
import { BlendedAnimation, capturePose, type Pose } from "../effects/core/pose";
import { stage, type GuestAnimation } from "../effects/core/stage";
import { createIdleAnimation } from "../effects/idle";
import { createEffect } from "../effects/registry";

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

type Controller = {
  play: () => void;
  stop: () => void;
};

const IDLE_BLEND_SECONDS = 0.4;
const EFFECT_BLEND_SECONDS = 0.2;
const GUEST_BLEND_SECONDS = 0.18;
const BASE_FOV_TAN = Math.tan((50 * Math.PI) / 360);
const BASE_ZOOM = 0.9;
const BLEED_X = 2.6;
const BLEED_Y = 1.6;

export const SkinViewer = forwardRef<SkinViewerHandle, SkinViewerProps>(
  (
    {
      uuid,
      username,
      width,
      height,
      hoverAnimation,
      enableHover = true,
      index,
      total,
      className,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<Controller | null>(null);
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
      let skinReady = false;
      let effect: TeamEffect | null = null;
      let guest: GuestAnimation | null = null;

      const bleedX = Math.round((width * (BLEED_X - 1)) / 2);
      const bleedY = Math.round((height * (BLEED_Y - 1)) / 2);
      const canvasHeight = height + bleedY * 2;
      const heightRatio = canvasHeight / height;
      const viewer = new SkinViewerLib({
        width: width + bleedX * 2,
        height: canvasHeight,
        enableControls: false,
        fov: (Math.atan(heightRatio * BASE_FOV_TAN) * 360) / Math.PI,
        zoom: BASE_ZOOM / heightRatio,
      });
      const player = viewer.playerObject;
      viewer.autoRotate = false;
      viewer.canvas.style.position = "absolute";
      viewer.canvas.style.left = `${-bleedX}px`;
      viewer.canvas.style.top = `${-bleedY}px`;
      viewer.canvas.style.pointerEvents = "none";

      const show = (
        animation: PlayerAnimation,
        from: Pose,
        seconds: number,
      ) => {
        const blended = new BlendedAnimation(animation, from, seconds);
        viewer.animation = blended;
        blended.update(player, 0);
        viewer.render();
      };

      const startIdle = (from?: Pose) => {
        const idle = createIdleAnimation(viewer, username, index, total);
        if (from) show(idle, from, IDLE_BLEND_SECONDS);
        else viewer.animation = idle;
      };

      const endGuest = () => {
        if (!guest) return;
        const pose = capturePose(player);
        guest.dispose?.();
        guest = null;
        startIdle(pose);
      };

      const finishEffect = () => {
        if (!effect) return;
        const pose = capturePose(player);
        effect.dispose();
        effect = null;
        startIdle(pose);
      };

      controllerRef.current = {
        play: () => {
          if (!skinReady || !hoverAnimation) return;
          effect?.dispose();
          guest?.dispose?.();
          guest = null;
          const pose = capturePose(player);
          effect = createEffect(hoverAnimation, {
            viewer,
            username,
            card: container.closest("button"),
            onFinished: finishEffect,
          });
          show(effect, pose, EFFECT_BLEND_SECONDS);
        },
        stop: () => effect?.stop(),
      };

      const unregister = stage.register({
        username,
        viewer,
        card: container.closest("button"),
        isBusy: () => effect !== null,
        playGuest: (create) => {
          if (effect || !skinReady) return null;
          const pose = capturePose(player);
          guest?.dispose?.();
          const next = create(viewer, () => {
            if (guest === next) endGuest();
          });
          guest = next;
          show(next, pose, GUEST_BLEND_SECONDS);
          return {
            cancel: () => {
              if (guest === next) endGuest();
            },
          };
        },
      });

      startIdle();

      viewer
        .loadSkin(`/api/skin/${uuid}`)
        .then(() => {
          if (disposed) return;
          skinReady = true;
          setLoading(false);
        })
        .catch(() => {
          if (disposed) return;
          setLoading(false);
          setError(true);
        });

      container.appendChild(viewer.canvas);

      const observer = new IntersectionObserver(([entry]) => {
        if (entry) viewer.renderPaused = !entry.isIntersecting;
      });
      observer.observe(container.parentElement ?? container);

      return () => {
        disposed = true;
        controllerRef.current = null;
        observer.disconnect();
        unregister();
        effect?.dispose();
        guest?.dispose?.();
        viewer.dispose();
        viewer.canvas.remove();
      };
    }, [uuid, username, width, height, index, total, hoverAnimation]);

    const handleMouseEnter = () => controllerRef.current?.play();
    const handleMouseLeave = () => controllerRef.current?.stop();

    useImperativeHandle(ref, () => ({
      playAnimation: () => controllerRef.current?.play(),
      stopAnimation: () => controllerRef.current?.stop(),
    }));

    return (
      <div
        className={cn("relative", className)}
        style={{ width, height }}
        onMouseEnter={
          enableHover && hoverAnimation ? handleMouseEnter : undefined
        }
        onMouseLeave={
          enableHover && hoverAnimation ? handleMouseLeave : undefined
        }
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
  },
);

SkinViewer.displayName = "SkinViewer";
