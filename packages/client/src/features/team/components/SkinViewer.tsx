import { UserRound } from "lucide-react";
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
import { BASE_BLEED, frameViewer } from "../effects/core/view";
import {
  createIdleAnimation,
  type LookAroundIdleAnimation,
} from "../effects/idle";
import { createEffect } from "../effects/registry";
import { Spinner } from "@/components/ui/spinner";

export type SkinViewerHandle = {
  playAnimation: () => void;
  stopAnimation: () => void;
};

type SkinViewerProps = {
  skin: string;
  username: string;
  width: number;
  height: number;
  hoverAnimation?: HoverAnimation | undefined;
  enableHover?: boolean;
  className?: string;
};

type Controller = {
  play: () => void;
  stop: () => void;
};

const IDLE_BLEND_SECONDS = 0.4;
const EFFECT_BLEND_SECONDS = 0.2;
const GUEST_BLEND_SECONDS = 0.18;
const SCROLL_BLOCKING_EVENTS = new Set([
  "wheel",
  "mousewheel",
  "touchstart",
  "touchmove",
]);

function createPassiveCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const addEventListener = canvas.addEventListener.bind(canvas);
  canvas.addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (!SCROLL_BLOCKING_EVENTS.has(type)) {
      addEventListener(type, listener, options);
      return;
    }
    const base =
      typeof options === "object" ? options : { capture: options === true };
    addEventListener(type, listener, { ...base, passive: true });
  };
  return canvas;
}

export const SkinViewer = forwardRef<SkinViewerHandle, SkinViewerProps>(
  (
    {
      skin,
      username,
      width,
      height,
      hoverAnimation,
      enableHover = true,
      className,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<Controller | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const depsKey = `${username}-${width}-${height}`;
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
      let idle: LookAroundIdleAnimation | null = null;

      const slot = { width, height };
      const viewer = new SkinViewerLib({
        canvas: createPassiveCanvas(),
        width,
        height,
        enableControls: false,
      });
      const player = viewer.playerObject;
      viewer.controls.dispose();
      viewer.autoRotate = false;
      viewer.canvas.style.position = "absolute";
      viewer.canvas.style.pointerEvents = "none";
      frameViewer(viewer, slot, BASE_BLEED);

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
        idle = createIdleAnimation(viewer, username);
        if (from) show(idle, from, IDLE_BLEND_SECONDS);
        else viewer.animation = idle;
      };

      const endGuest = () => {
        if (!guest || disposed) return;
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
          idle = null;
          const pose = capturePose(player);
          effect = createEffect(hoverAnimation, {
            viewer,
            username,
            card: container.closest("button"),
            setBleed: (bleed) => {
              if (!disposed) frameViewer(viewer, slot, bleed);
            },
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
          idle = null;
          show(next, pose, GUEST_BLEND_SECONDS);
          return {
            cancel: () => {
              if (guest === next) endGuest();
            },
          };
        },
        notice: (point) => {
          if (skinReady) idle?.notice(point);
        },
      });

      startIdle();

      viewer
        .loadSkin(skin)
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
    }, [skin, username, width, height, hoverAnimation]);

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
            <Spinner className="size-6 text-muted-foreground" />
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
